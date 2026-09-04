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

const SMTP_VARS = ["SMTP_URL", "SMTP_HOST", "SMTP_FROM", "TEAMS_WEBHOOK_URL"] as const;
const original = new Map(SMTP_VARS.map((name) => [name, process.env[name]]));

function configure(values: Partial<Record<(typeof SMTP_VARS)[number], string>>) {
  for (const name of SMTP_VARS) {
    const value = values[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

afterEach(() => configure({}));

after(() => {
  for (const [name, value] of original) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("remindersDeliverable", () => {
  /* The case the bug was about: nothing configured, yet the dashboard was
     still offering to turn e-mail reminders on. */
  it("is false when no transport is configured", () => {
    configure({});
    assert.equal(remindersDeliverable(), false);
  });

  it("is true once e-mail is configured", () => {
    configure({ SMTP_URL: "smtp://relay.example:25", SMTP_FROM: "dysten@example.com" });
    assert.equal(remindersDeliverable(), true);
  });

  it("is true for a relay spelled out in the discrete variables", () => {
    configure({ SMTP_HOST: "relay.example", SMTP_FROM: "dysten@example.com" });
    assert.equal(remindersDeliverable(), true);
  });

  /* A relay with nothing to put on the envelope cannot deliver anything, so
     it must not bring the opt-in back. See ./smtp.ts. */
  it("is false for a relay with no sender address", () => {
    configure({ SMTP_URL: "smtp://relay.example:25" });
    assert.equal(remindersDeliverable(), false);
  });

  it("is false for a sender address with no relay", () => {
    configure({ SMTP_FROM: "dysten@example.com" });
    assert.equal(remindersDeliverable(), false);
  });

  it("is true once Teams is configured, without e-mail", () => {
    configure({ TEAMS_WEBHOOK_URL: "https://example.webhook.office.com/hook" });
    assert.equal(remindersDeliverable(), true);
  });

  it("is true when both are configured", () => {
    configure({
      SMTP_URL: "smtp://relay.example:25",
      SMTP_FROM: "dysten@example.com",
      TEAMS_WEBHOOK_URL: "https://example.com/hook",
    });
    assert.equal(remindersDeliverable(), true);
  });

  /* An empty variable is how a compose file spells "I left this blank",
     not "I configured an empty relay". */
  it("treats an empty variable as unconfigured", () => {
    configure({ SMTP_URL: "", SMTP_FROM: "", TEAMS_WEBHOOK_URL: "" });
    assert.equal(remindersDeliverable(), false);
  });

  /* A value nobody can act on is not a configuration. Reporting it as one
     would offer the opt-in for mail that could never be sent. */
  it("is false for an SMTP configuration it cannot read", () => {
    configure({ SMTP_URL: "relay.example:25", SMTP_FROM: "dysten@example.com" });
    assert.equal(remindersDeliverable(), false);
  });

  /* The console channel is enabled unconditionally. If it ever counted, the
     opt-in would be offered on every deployment, which is the whole bug. */
  it("does not count the console channel, which is always on", () => {
    configure({});
    assert.equal(remindersDeliverable(), false, "console must not make reminders deliverable");
  });
});
