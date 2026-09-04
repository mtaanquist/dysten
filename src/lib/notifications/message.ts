import { createTranslator } from "@/i18n/translate";
import { createFormatters } from "@/lib/format";
import type { MissingEntryReminder } from "./types";

/**
 * What a reminder actually says.
 *
 * Separate from the transport so the wording can be tested without a relay,
 * and so a second transport gets the same text rather than its own copy.
 *
 * Everything is rendered in the recipient's own locale — their language and
 * their date order — because a reminder that arrives in someone else's Danish
 * is a worse reminder. Plain text only: there is nothing here a layout would
 * add to, and one paragraph in an inbox never renders wrong.
 */

export interface MailContent {
  subject: string;
  text: string;
}

/**
 * The public origin, for the link into the campaign.
 *
 * `appOrigin` in the auth flow reads it off the incoming request, which a
 * scheduled run does not have — so this reads the configured value directly.
 * When it is unset the mail goes out without a link rather than with a broken
 * one pointing at the container's own address.
 */
function campaignUrl(campaignId: string): string | null {
  const origin = process.env.APP_URL?.trim().replace(/\/+$/, "");
  return origin ? `${origin}/campaigns/${campaignId}` : null;
}

export function renderMissingEntryMail(event: MissingEntryReminder): MailContent {
  const t = createTranslator(event.recipient.locale);
  const format = createFormatters(event.recipient.locale);
  const day = format.dayLong(event.missingDate);

  const lines = [
    t("notifications.missingEntry.greeting", { name: event.recipient.displayName }),
    "",
    t("notifications.missingEntry.body", { day, campaign: event.campaign.name }),
  ];

  // Only worth saying when there is a backlog; "1 day missing" is the day the
  // mail is already about, and repeating it back adds nothing.
  if (event.totalMissingDays > 1) {
    lines.push(t("notifications.missingEntry.backlog", { count: event.totalMissingDays }));
  }

  const url = campaignUrl(event.campaign.id);
  if (url) {
    lines.push("", t("notifications.missingEntry.link", { url }));
  }

  lines.push("", t("notifications.missingEntry.optOut"));

  return {
    subject: t("notifications.missingEntry.subject", { day, campaign: event.campaign.name }),
    text: `${lines.join("\n")}\n`,
  };
}
