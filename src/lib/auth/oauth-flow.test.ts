import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { appOrigin, appUrl, callbackUrl } from "./oauth-flow";

const original = process.env.APP_URL;

afterEach(() => {
  if (original === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = original;
});

// Behind a reverse proxy the request's own origin is the internal address the
// server bound to, which no browser can follow.
const internal = new Request("http://0.0.0.0:3000/api/auth/callback?code=x");

describe("appOrigin", () => {
  it("prefers APP_URL over the request's origin", () => {
    process.env.APP_URL = "https://dysten.example.com";
    assert.equal(appOrigin(internal), "https://dysten.example.com");
  });

  it("trims whitespace and trailing slashes", () => {
    process.env.APP_URL = "  https://dysten.example.com//  ";
    assert.equal(appOrigin(internal), "https://dysten.example.com");
  });

  it("falls back to the request's origin when APP_URL is unset", () => {
    delete process.env.APP_URL;
    assert.equal(appOrigin(internal), "http://0.0.0.0:3000");
  });

  it("falls back when APP_URL is blank", () => {
    process.env.APP_URL = "   ";
    assert.equal(appOrigin(internal), "http://0.0.0.0:3000");
  });
});

describe("appUrl", () => {
  it("builds redirects against APP_URL, not the request", () => {
    process.env.APP_URL = "https://dysten.example.com";
    assert.equal(appUrl(internal, "/"), "https://dysten.example.com/");
    assert.equal(
      appUrl(internal, "/sign-in?error=denied"),
      "https://dysten.example.com/sign-in?error=denied",
    );
  });

  it("keeps a path prefix in APP_URL", () => {
    process.env.APP_URL = "https://example.com/dysten";
    assert.equal(appUrl(internal, "/sign-in"), "https://example.com/sign-in");
  });
});

describe("callbackUrl", () => {
  it("hangs the callback path off the configured origin", () => {
    process.env.APP_URL = "https://dysten.example.com";
    assert.equal(callbackUrl(internal), "https://dysten.example.com/api/auth/callback");
  });
});
