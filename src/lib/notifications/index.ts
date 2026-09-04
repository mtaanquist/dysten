import type { Transporter } from "nodemailer";

import { prisma } from "@/lib/db";
import { resolveLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/translate";
import { addDays, today as currentDay, type IsoDate } from "@/lib/dates";
import { campaignStatus } from "@/lib/campaign-status";
import { renderMissingEntryMail } from "./message";
import { readSmtpSettings } from "./smtp";
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
 * E-mail, over SMTP.
 *
 * Configured entirely from the environment — see ./smtp.ts for the variables
 * and how they resolve. Nothing is sent unless a relay *and* a sender address
 * are both configured; half of a configuration is not a channel.
 *
 * The transport is built once and reused across a run: a reminder job mails a
 * few dozen people, and nodemailer will keep the connection open across them
 * rather than paying for a handshake each time. It is rebuilt if the settings
 * change underneath it, which in practice only happens in a test.
 *
 * nodemailer is imported where it is used rather than at the top of the file.
 * Every page that renders the dashboard asks whether reminders are deliverable,
 * and that question does not need a mail library loaded to answer it.
 */
let transport: { key: string; mailer: Transporter } | null = null;

async function mailer() {
  const settings = readSmtpSettings();
  if (!settings) return null;

  const key = JSON.stringify(settings);
  if (!transport || transport.key !== key) {
    transport?.mailer.close();
    const { createTransport } = await import("nodemailer");
    transport = { key, mailer: createTransport(settings) };
  }
  return { settings, mailer: transport.mailer };
}

const emailChannel: NotificationChannel = {
  name: "email",
  reachesPeople: true,
  isEnabled: () => readSmtpSettings() !== null,
  async send(event) {
    if (event.kind !== "missing-entry") return;

    const active = await mailer();
    // isEnabled() ran first, so this is a configuration that changed between
    // the two calls rather than a case worth handling quietly.
    if (!active) throw new Error("SMTP is not configured.");

    const { subject, text } = renderMissingEntryMail(event);
    await active.mailer.sendMail({
      from: active.settings.from,
      to: event.recipient.email,
      subject,
      text,
    });
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
 * This reports what is *configured*, which is not quite the same as what
 * works: a relay can be named correctly and still refuse the connection. It is
 * as close as the question can be answered without sending a message to find
 * out, and it is answered on every render.
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
