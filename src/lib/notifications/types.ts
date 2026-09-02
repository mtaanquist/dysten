import type { Locale } from "@/i18n/config";
import type { IsoDate } from "@/lib/dates";

/**
 * Notifications are modelled as *events* delivered to *channels*.
 *
 * The spec asks for opt-in e-mail today and leaves room for a Teams webhook
 * later. Keeping the event shape independent of the transport means adding
 * Teams is a new channel registered in ./index.ts — no caller changes, and no
 * reminder logic duplicated per transport.
 */

export interface MissingEntryReminder {
  kind: "missing-entry";
  recipient: {
    id: string;
    email: string;
    displayName: string;
    locale: Locale;
  };
  campaign: {
    id: string;
    name: string;
    type: string;
  };
  /** The day that has no entry — normally yesterday. */
  missingDate: IsoDate;
  /** Every un-logged day so far, so a channel can nudge about a backlog. */
  totalMissingDays: number;
}

export type NotificationEvent = MissingEntryReminder;

export interface NotificationChannel {
  readonly name: string;
  /**
   * Whether this channel reaches an actual person. The console channel does
   * not — it writes to the server log, which is how you check the reminder
   * logic works, but nobody is notified by it. The app asks this before
   * offering anyone a reminder opt-in.
   */
  readonly reachesPeople: boolean;
  /** Skipped silently when false, so an unconfigured channel is not an error. */
  isEnabled(): boolean;
  send(event: NotificationEvent): Promise<void>;
}
