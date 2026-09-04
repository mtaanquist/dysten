import { after, afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { renderMissingEntryMail } from "./message";
import type { MissingEntryReminder } from "./types";

/**
 * What lands in someone's inbox.
 *
 * The reminder is written in the recipient's own language, and it has to hold
 * together when the deployment has told the app nothing about its own address.
 */

const originalAppUrl = process.env.APP_URL;

afterEach(() => {
  delete process.env.APP_URL;
});

after(() => {
  if (originalAppUrl === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = originalAppUrl;
});

function reminder(overrides: Partial<MissingEntryReminder> = {}): MissingEntryReminder {
  return {
    kind: "missing-entry",
    recipient: {
      id: "u1",
      email: "someone@example.com",
      displayName: "Mette",
      locale: "en-GB",
      ...overrides.recipient,
    },
    campaign: { id: "c1", name: "Step challenge", type: "step", ...overrides.campaign },
    missingDate: overrides.missingDate ?? "2026-09-02",
    totalMissingDays: overrides.totalMissingDays ?? 1,
  };
}

describe("renderMissingEntryMail", () => {
  it("names the campaign and the day in the subject", () => {
    const mail = renderMissingEntryMail(reminder());
    assert.match(mail.subject, /Step challenge/);
    assert.match(mail.subject, /2 September/);
  });

  it("greets the recipient by name", () => {
    assert.match(renderMissingEntryMail(reminder()).text, /Hi Mette,/);
  });

  /* The mail is already about one missing day; saying "that leaves 1 day
     without an entry" underneath it is the same sentence twice. */
  it("mentions a backlog only when there is more than one day", () => {
    assert.doesNotMatch(renderMissingEntryMail(reminder()).text, /leaves/);
    assert.match(
      renderMissingEntryMail(reminder({ totalMissingDays: 4 })).text,
      /leaves 4 days without an entry/,
    );
  });

  it("writes to a Danish recipient in Danish, with Danish dates", () => {
    const mail = renderMissingEntryMail(
      reminder({
        recipient: {
          id: "u2",
          email: "anders@example.com",
          displayName: "Anders",
          locale: "da-DK",
        },
        totalMissingDays: 3,
      }),
    );
    assert.match(mail.text, /Hej Anders/);
    assert.match(mail.text, /2\. september/);
    assert.match(mail.text, /3 dage/);
  });

  it("links into the campaign when APP_URL is set", () => {
    process.env.APP_URL = "https://dysten.example.com";
    assert.match(renderMissingEntryMail(reminder()).text, /https:\/\/dysten\.example\.com\/campaigns\/c1/);
  });

  it("tolerates a trailing slash on APP_URL", () => {
    process.env.APP_URL = "https://dysten.example.com/";
    assert.match(renderMissingEntryMail(reminder()).text, /example\.com\/campaigns\/c1/);
    assert.doesNotMatch(renderMissingEntryMail(reminder()).text, /\/\/campaigns/);
  });

  /* Without a public origin the app only knows the address it is bound to
     inside its container, which no reader could follow. No link beats one
     that goes nowhere. */
  it("leaves the link out when APP_URL is unset", () => {
    const mail = renderMissingEntryMail(reminder());
    assert.doesNotMatch(mail.text, /http/);
    assert.match(mail.text, /turn these reminders off/);
  });

  it("always says how to stop receiving them", () => {
    process.env.APP_URL = "https://dysten.example.com";
    assert.match(renderMissingEntryMail(reminder()).text, /turn these reminders off/);
  });
});
