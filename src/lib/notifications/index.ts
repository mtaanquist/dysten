import { prisma } from "@/lib/db";
import { resolveLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/translate";
import { addDays, today as currentDay, type IsoDate } from "@/lib/dates";
import { campaignStatus } from "@/lib/campaign-status";
import type { MissingEntryReminder, NotificationChannel, NotificationEvent } from "./types";

export type { MissingEntryReminder, NotificationChannel, NotificationEvent } from "./types";

/**
 * Logs what would be sent. Always enabled, so reminder logic is observable in
 * development and in a container's logs before any transport is configured.
 */
const consoleChannel: NotificationChannel = {
  name: "console",
  reachesPeople: false,
  isEnabled: () => true,
  async send(event) {
    if (event.kind !== "missing-entry") return;
    const t = createTranslator(event.recipient.locale);
    console.info(
      `[notify] ${event.recipient.email} — ${event.campaign.name}: ` +
        `${t("campaign.missingDays", { count: event.totalMissingDays })} ` +
        `(most recent: ${event.missingDate})`,
    );
  },
};

/**
 * E-mail. Intentionally a stub — picking a transport (SMTP relay, Microsoft
 * Graph sendMail, a provider SDK) is an infrastructure decision, and the
 * credentials for it do not exist yet.
 *
 * To finish: set SMTP_URL (or swap in Graph, which reuses the Entra app
 * registration), render the message body from the i18n resources using the
 * recipient's own locale, and return once the transport accepts it.
 */
const emailChannel: NotificationChannel = {
  name: "email",
  reachesPeople: true,
  isEnabled: () => Boolean(process.env.SMTP_URL),
  async send() {
    throw new Error(
      "E-mail notifications are enabled (SMTP_URL is set) but the transport is not implemented. " +
        "See src/lib/notifications/index.ts.",
    );
  },
};

/**
 * Microsoft Teams. The slot the spec asked to leave open: post an Adaptive Card
 * to an incoming-webhook URL. Enable by setting TEAMS_WEBHOOK_URL.
 */
const teamsChannel: NotificationChannel = {
  name: "teams",
  reachesPeople: true,
  isEnabled: () => Boolean(process.env.TEAMS_WEBHOOK_URL),
  async send() {
    throw new Error(
      "Teams notifications are enabled (TEAMS_WEBHOOK_URL is set) but the transport is not implemented. " +
        "See src/lib/notifications/index.ts.",
    );
  },
};

const channels: NotificationChannel[] = [consoleChannel, emailChannel, teamsChannel];

/**
 * Whether a reminder could actually arrive somewhere.
 *
 * The dashboard asks this before offering the opt-in. A bell that switches on
 * notifications nobody can receive is worse than no bell at all: it reads as a
 * promise, and the promise is not kept. Console output does not count — it
 * reaches a log file, not a person.
 *
 * This reports what is *configured*, which is deliberately not the same as what
 * works: both transports above are still stubs that throw. Setting SMTP_URL
 * therefore brings the opt-in back before anything can be delivered, which is
 * the right moment for it to reappear — whoever sets that variable is the
 * person implementing the transport.
 */
export function remindersDeliverable(): boolean {
  return channels.some((channel) => channel.reachesPeople && channel.isEnabled());
}

/**
 * Fans an event out to every enabled channel.
 *
 * A channel that throws is logged and skipped: one broken transport must not
 * stop the others, and a reminder is never important enough to fail a job over.
 */
export async function dispatch(event: NotificationEvent): Promise<void> {
  await Promise.all(
    channels
      .filter((channel) => channel.isEnabled())
      .map(async (channel) => {
        try {
          await channel.send(event);
        } catch (error) {
          console.error(`[notify] channel "${channel.name}" failed:`, error);
        }
      }),
  );
}

/**
 * Finds everyone who should be nudged about a missing day.
 *
 * Runs against a given day — normally "yesterday" relative to the app clock —
 * and covers only campaigns that were genuinely active then. Opted-out users
 * are excluded at the query, so their absence needs no downstream check.
 *
 * Deliberately has no schedule attached: call it from a cron container, a
 * platform scheduler, or `POST /api/notifications/run` behind a shared secret.
 * Wiring a scheduler is a deployment decision, not an application one.
 */
export async function collectMissingEntryReminders(
  forDate: IsoDate = addDays(currentDay(), -1),
): Promise<MissingEntryReminder[]> {
  const campaigns = await prisma.campaign.findMany({
    where: {
      startDate: { lte: forDate },
      endDate: { gte: forDate },
      closedEarlyAt: null,
    },
    include: {
      participants: {
        where: { user: { remindersEnabled: true } },
        include: { user: true },
      },
      entries: { select: { userId: true, date: true } },
    },
  });

  const reminders: MissingEntryReminder[] = [];

  for (const campaign of campaigns) {
    // Guard against a campaign that has since been closed or not yet started.
    if (campaignStatus(campaign, forDate) !== "active") continue;

    const loggedOn = new Set(
      campaign.entries.filter((entry) => entry.date === forDate).map((entry) => entry.userId),
    );
    const loggedAny = new Map<string, Set<string>>();
    for (const entry of campaign.entries) {
      const set = loggedAny.get(entry.userId) ?? new Set<string>();
      set.add(entry.date);
      loggedAny.set(entry.userId, set);
    }

    for (const participation of campaign.participants) {
      if (loggedOn.has(participation.userId)) continue;
      // Someone who joined after the day in question can't have logged it.
      if (participation.joinedAt.toISOString().slice(0, 10) > forDate) continue;

      const logged = loggedAny.get(participation.userId) ?? new Set<string>();
      let missing = 0;
      for (let day = campaign.startDate; day <= forDate; day = addDays(day, 1)) {
        if (!logged.has(day)) missing += 1;
      }

      reminders.push({
        kind: "missing-entry",
        recipient: {
          id: participation.user.id,
          email: participation.user.email,
          displayName: participation.user.displayName,
          locale: resolveLocale(participation.user.locale),
        },
        campaign: { id: campaign.id, name: campaign.name, type: campaign.type },
        missingDate: forDate,
        totalMissingDays: missing,
      });
    }
  }

  return reminders;
}

/** Collects and dispatches in one call — the entry point a scheduler hits. */
export async function runMissingEntryReminders(forDate?: IsoDate): Promise<number> {
  const reminders = await collectMissingEntryReminders(forDate);
  for (const reminder of reminders) await dispatch(reminder);
  return reminders.length;
}
