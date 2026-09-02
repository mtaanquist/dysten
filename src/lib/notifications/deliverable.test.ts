import { after, afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { remindersDeliverable } from "./index";

/**
 * Whether the app should offer a reminder opt-in at all.
 *
 * The question is not "is the reminder logic working" but "could a reminder
 * reach a person". Those differ, because the console channel is always on and
 * always reaches nothing but a log file — which is exactly the trap this
 * guards: an opt-in that looks like a promise and delivers nothing.
 */

const originalSmtp = process.env.SMTP_URL;
const originalTeams = process.env.TEAMS_WEBHOOK_URL;

function configure({ smtp, teams }: { smtp?: string; teams?: string }) {
  if (smtp === undefined) delete process.env.SMTP_URL;
  else process.env.SMTP_URL = smtp;

  if (teams === undefined) delete process.env.TEAMS_WEBHOOK_URL;
  else process.env.TEAMS_WEBHOOK_URL = teams;
}

afterEach(() => configure({}));

after(() => {
  if (originalSmtp === undefined) delete process.env.SMTP_URL;
  else process.env.SMTP_URL = originalSmtp;
  if (originalTeams === undefined) delete process.env.TEAMS_WEBHOOK_URL;
  else process.env.TEAMS_WEBHOOK_URL = originalTeams;
});

describe("remindersDeliverable", () => {
  /* The case the bug was about: nothing configured, yet the dashboard was
     still offering to turn e-mail reminders on. */
  it("is false when no transport is configured", () => {
    configure({});
    assert.equal(remindersDeliverable(), false);
  });

  it("is true once e-mail is configured", () => {
    configure({ smtp: "smtp://relay.example:25" });
    assert.equal(remindersDeliverable(), true);
  });

  it("is true once Teams is configured, without e-mail", () => {
    configure({ teams: "https://example.webhook.office.com/hook" });
    assert.equal(remindersDeliverable(), true);
  });

  it("is true when both are configured", () => {
    configure({ smtp: "smtp://relay.example:25", teams: "https://example.com/hook" });
    assert.equal(remindersDeliverable(), true);
  });

  /* An empty variable is how a compose file spells "I left this blank",
     not "I configured an empty relay". */
  it("treats an empty variable as unconfigured", () => {
    configure({ smtp: "", teams: "" });
    assert.equal(remindersDeliverable(), false);
  });

  /* The console channel is enabled unconditionally. If it ever counted, the
     opt-in would be offered on every deployment, which is the whole bug. */
  it("does not count the console channel, which is always on", () => {
    configure({});
    assert.equal(remindersDeliverable(), false, "console must not make reminders deliverable");
  });
});
