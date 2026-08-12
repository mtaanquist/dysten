import { NextResponse } from "next/server";
import { runMissingEntryReminders } from "@/lib/notifications";
import { isIsoDate } from "@/lib/dates";

/**
 * Trigger for the missing-entry reminder sweep.
 *
 * Scheduling lives outside the app — a cron container, a platform scheduler, or
 * a CI job can POST here each morning. Guarded by a shared secret; if
 * NOTIFICATIONS_RUN_TOKEN is unset the endpoint stays closed rather than
 * defaulting to open.
 */
export async function POST(request: Request) {
  const token = process.env.NOTIFICATIONS_RUN_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Notifications endpoint is disabled." }, { status: 404 });
  }

  const provided = request.headers.get("authorization");
  if (provided !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  // Optional ?date= override, so a missed run can be replayed for a past day.
  const url = new URL(request.url);
  const requested = url.searchParams.get("date");
  if (requested && !isIsoDate(requested)) {
    return NextResponse.json({ error: "Invalid date; expected YYYY-MM-DD." }, { status: 400 });
  }

  const sent = await runMissingEntryReminders(requested ?? undefined);
  return NextResponse.json({ ok: true, reminders: sent });
}
