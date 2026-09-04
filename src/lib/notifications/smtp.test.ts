import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { readSmtpSettings, type Env } from "./smtp";

/**
 * How a deployment's environment becomes a relay.
 *
 * The env is passed in rather than read from `process.env`, so these cases say
 * exactly what a deployment set and nothing leaks between them.
 */

const FROM = "Dysten <noreply@example.com>";

function settings(env: Env) {
  return readSmtpSettings(env);
}

describe("readSmtpSettings — nothing configured", () => {
  it("is null on an empty environment", () => {
    assert.equal(settings({}), null);
  });

  it("is null with a relay but no sender", () => {
    assert.equal(settings({ SMTP_HOST: "relay.example" }), null);
    assert.equal(settings({ SMTP_URL: "smtp://relay.example" }), null);
  });

  /* The point of requiring a sender: a relay alone would switch the reminder
     opt-in back on for a channel that still cannot address a message. */
  it("is null with a sender but no relay", () => {
    assert.equal(settings({ SMTP_FROM: FROM }), null);
  });

  it("treats blank variables as unset", () => {
    assert.equal(settings({ SMTP_HOST: "   ", SMTP_FROM: FROM }), null);
    assert.equal(settings({ SMTP_HOST: "relay.example", SMTP_FROM: "  " }), null);
  });
});

describe("readSmtpSettings — discrete variables", () => {
  it("defaults to submission on 587 with STARTTLS", () => {
    assert.deepEqual(settings({ SMTP_HOST: "relay.example", SMTP_FROM: FROM }), {
      host: "relay.example",
      port: 587,
      secure: false,
      from: FROM,
    });
  });

  it("carries credentials when a user is given", () => {
    assert.deepEqual(
      settings({
        SMTP_HOST: "relay.example",
        SMTP_USER: "dysten",
        SMTP_PASSWORD: "s3cret",
        SMTP_FROM: FROM,
      }),
      {
        host: "relay.example",
        port: 587,
        secure: false,
        auth: { user: "dysten", pass: "s3cret" },
        from: FROM,
      },
    );
  });

  /* An internal relay that trusts its network. Sending an empty username
     would fail the handshake, so auth is left off entirely. */
  it("omits auth when no user is given", () => {
    assert.equal(settings({ SMTP_HOST: "relay.example", SMTP_FROM: FROM })?.auth, undefined);
  });

  it("infers implicit TLS from port 465", () => {
    const result = settings({ SMTP_HOST: "relay.example", SMTP_PORT: "465", SMTP_FROM: FROM });
    assert.equal(result?.port, 465);
    assert.equal(result?.secure, true);
  });

  it("defaults to port 465 when TLS is asked for without a port", () => {
    const result = settings({ SMTP_HOST: "relay.example", SMTP_SECURE: "true", SMTP_FROM: FROM });
    assert.equal(result?.port, 465);
    assert.equal(result?.secure, true);
  });

  it("lets an explicit SMTP_SECURE overrule the port", () => {
    const result = settings({
      SMTP_HOST: "relay.example",
      SMTP_PORT: "465",
      SMTP_SECURE: "false",
      SMTP_FROM: FROM,
    });
    assert.equal(result?.secure, false);
  });

  it("accepts the 1 / 0 and yes / no a shell is likely to pass", () => {
    assert.equal(settings({ SMTP_HOST: "h", SMTP_SECURE: "1", SMTP_FROM: FROM })?.secure, true);
    assert.equal(settings({ SMTP_HOST: "h", SMTP_SECURE: "YES", SMTP_FROM: FROM })?.secure, true);
    assert.equal(settings({ SMTP_HOST: "h", SMTP_SECURE: "0", SMTP_FROM: FROM })?.secure, false);
  });
});

describe("readSmtpSettings — SMTP_URL shorthand", () => {
  it("reads host, port and credentials out of the URL", () => {
    assert.deepEqual(
      settings({ SMTP_URL: "smtp://dysten:s3cret@relay.example:2525", SMTP_FROM: FROM }),
      {
        host: "relay.example",
        port: 2525,
        secure: false,
        auth: { user: "dysten", pass: "s3cret" },
        from: FROM,
      },
    );
  });

  it("takes implicit TLS from an smtps:// scheme", () => {
    const result = settings({ SMTP_URL: "smtps://relay.example", SMTP_FROM: FROM });
    assert.equal(result?.secure, true);
    assert.equal(result?.port, 465);
  });

  /* A password with an @ or a : in it has to be percent-encoded to survive a
     URL, and has to come back out the other side unchanged. */
  it("decodes percent-encoded credentials", () => {
    assert.deepEqual(
      settings({ SMTP_URL: "smtp://user%40corp:p%40ss%3Aword@relay.example", SMTP_FROM: FROM })?.auth,
      { user: "user@corp", pass: "p@ss:word" },
    );
  });

  it("still needs a sender", () => {
    assert.equal(settings({ SMTP_URL: "smtp://relay.example" }), null);
  });
});

describe("readSmtpSettings — precedence", () => {
  it("lets the discrete host win over the URL", () => {
    const result = settings({
      SMTP_URL: "smtp://ignored.example:2525",
      SMTP_HOST: "relay.example",
      SMTP_FROM: FROM,
    });
    assert.equal(result?.host, "relay.example");
  });

  /* Field by field, so a deployment can keep the URL it already has and
     override only the part that changed. */
  it("overrides one field of the URL and keeps the rest", () => {
    const result = settings({
      SMTP_URL: "smtp://dysten:s3cret@relay.example:2525",
      SMTP_PORT: "587",
      SMTP_FROM: FROM,
    });
    assert.equal(result?.host, "relay.example");
    assert.equal(result?.port, 587);
    assert.deepEqual(result?.auth, { user: "dysten", pass: "s3cret" });
  });
});

describe("readSmtpSettings — values it cannot make sense of", () => {
  /* Silently falling back to 587 would send mail somewhere the deployment
     never asked for. Unconfigured is the honest reading, and it shows: the
     reminder opt-in stays hidden. */
  it("is null for a port that is not a number", () => {
    assert.equal(settings({ SMTP_HOST: "relay.example", SMTP_PORT: "58 7", SMTP_FROM: FROM }), null);
  });

  it("is null for a port outside the valid range", () => {
    assert.equal(settings({ SMTP_HOST: "relay.example", SMTP_PORT: "0", SMTP_FROM: FROM }), null);
    assert.equal(settings({ SMTP_HOST: "relay.example", SMTP_PORT: "99999", SMTP_FROM: FROM }), null);
  });

  it("is null for an unparseable SMTP_URL", () => {
    assert.equal(settings({ SMTP_URL: "relay.example:587", SMTP_FROM: FROM }), null);
  });

  it("is null for a URL that is not SMTP", () => {
    assert.equal(settings({ SMTP_URL: "https://relay.example", SMTP_FROM: FROM }), null);
  });

  /* Guessing here would decide whether the connection is encrypted. */
  it("is null for an SMTP_SECURE it cannot read", () => {
    assert.equal(settings({ SMTP_HOST: "relay.example", SMTP_SECURE: "maybe", SMTP_FROM: FROM }), null);
  });
});
