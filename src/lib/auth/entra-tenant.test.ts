import { after, afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  TenantNotAllowedError,
  allowedTenantIds,
  assertTenantAllowed,
  authorityTenant,
  type EntraClaims,
} from "./entra-tenant";

const ACME = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

const originalTenants = process.env.ENTRA_TENANT_IDS;
const originalGuests = process.env.ENTRA_ALLOW_GUESTS;

function configure({ tenants, allowGuests }: { tenants?: string; allowGuests?: string }) {
  if (tenants === undefined) delete process.env.ENTRA_TENANT_IDS;
  else process.env.ENTRA_TENANT_IDS = tenants;

  if (allowGuests === undefined) delete process.env.ENTRA_ALLOW_GUESTS;
  else process.env.ENTRA_ALLOW_GUESTS = allowGuests;
}

/** A token from `tid` that is internally consistent — the happy shape. */
function claims(tid: string, extra: Partial<EntraClaims> = {}): EntraClaims {
  return {
    tid,
    iss: `https://login.microsoftonline.com/${tid}/v2.0`,
    oid: "00000000-0000-0000-0000-00000000000a",
    ...extra,
  };
}

function restore() {
  configure({ tenants: originalTenants, allowGuests: originalGuests });
}

afterEach(restore);
after(restore);

describe("allowedTenantIds", () => {
  it("is empty when unset, rather than defaulting to something permissive", () => {
    configure({ tenants: undefined });
    assert.deepEqual(allowedTenantIds(), []);
  });

  it("splits a list and tolerates the spaces people leave after commas", () => {
    configure({ tenants: ` ${ACME} , ${OTHER} ` });
    assert.deepEqual(allowedTenantIds(), [ACME, OTHER]);
  });

  it("drops empty entries left by a trailing comma", () => {
    configure({ tenants: `${ACME},` });
    assert.deepEqual(allowedTenantIds(), [ACME]);
  });
});

describe("authorityTenant", () => {
  it("names the tenant when there is exactly one, so Microsoft refuses the rest", () => {
    configure({ tenants: ACME });
    assert.equal(authorityTenant(), ACME);
  });

  it("falls back to /organizations for a list, because no authority names a subset", () => {
    configure({ tenants: `${ACME},${OTHER}` });
    assert.equal(authorityTenant(), "organizations");
  });

  it("never yields /common", () => {
    configure({ tenants: `${ACME},${OTHER}` });
    assert.notEqual(authorityTenant(), "common");
  });

  it("throws rather than guessing when nothing is configured", () => {
    configure({ tenants: undefined });
    assert.throws(() => authorityTenant(), /ENTRA_TENANT_IDS is not set/);
  });
});

describe("assertTenantAllowed", () => {
  it("accepts a token from the configured tenant", () => {
    configure({ tenants: ACME });
    assert.doesNotThrow(() => assertTenantAllowed(claims(ACME)));
  });

  it("accepts any tenant on the list", () => {
    configure({ tenants: `${ACME},${OTHER}` });
    assert.doesNotThrow(() => assertTenantAllowed(claims(ACME)));
    assert.doesNotThrow(() => assertTenantAllowed(claims(OTHER)));
  });

  it("rejects a tenant that is not on the list", () => {
    configure({ tenants: ACME });
    assert.throws(() => assertTenantAllowed(claims(OTHER)), TenantNotAllowedError);
  });

  it("rejects a token with no tenant at all", () => {
    configure({ tenants: ACME });
    assert.throws(() => assertTenantAllowed({ iss: "x" }), TenantNotAllowedError);
  });

  it("refuses everything when the allowlist is unset", () => {
    configure({ tenants: undefined });
    assert.throws(() => assertTenantAllowed(claims(ACME)), /ENTRA_TENANT_IDS is not set/);
  });

  it("rejects an issuer that disagrees with the tenant claim", () => {
    configure({ tenants: ACME });
    assert.throws(
      () => assertTenantAllowed(claims(ACME, { iss: `https://login.microsoftonline.com/${OTHER}/v2.0` })),
      TenantNotAllowedError,
    );
  });

  it("rejects an issuer that merely contains the tenant id somewhere", () => {
    // The whole point of comparing the issuer whole: a hostile host can put an
    // allowed tenant id anywhere in a URL, and a substring check would pass it.
    configure({ tenants: ACME });
    assert.throws(
      () => assertTenantAllowed(claims(ACME, { iss: `https://evil.example.com/${ACME}/v2.0` })),
      TenantNotAllowedError,
    );
  });

  it("allows guests by default, since B2B accounts are usually wanted", () => {
    configure({ tenants: ACME });
    assert.doesNotThrow(() => assertTenantAllowed(claims(ACME, { acct: 1 })));
  });

  it("rejects guests when guests are switched off", () => {
    configure({ tenants: ACME, allowGuests: "false" });
    assert.throws(() => assertTenantAllowed(claims(ACME, { acct: 1 })), TenantNotAllowedError);
  });

  it("still admits members of the tenant when guests are switched off", () => {
    configure({ tenants: ACME, allowGuests: "false" });
    assert.doesNotThrow(() => assertTenantAllowed(claims(ACME, { acct: 0 })));
  });

  it("refuses rather than guesses when guests are off but acct is missing", () => {
    // `acct` is an optional claim. Reading its absence as "not a guest" would
    // let an unconfigured app registration admit every guest in the directory
    // while the setting claims to exclude them.
    configure({ tenants: ACME, allowGuests: "false" });
    assert.throws(() => assertTenantAllowed(claims(ACME)), /no `acct` claim/);
  });

  it("does not care about a missing acct while guests are allowed", () => {
    configure({ tenants: ACME, allowGuests: undefined });
    assert.doesNotThrow(() => assertTenantAllowed(claims(ACME)));
  });

  it("marks policy refusals so the callback can say why", () => {
    configure({ tenants: ACME });
    try {
      assertTenantAllowed(claims(OTHER));
      assert.fail("expected a rejection");
    } catch (error) {
      assert.ok(error instanceof TenantNotAllowedError);
      assert.equal(error.code, "tenant");
    }
  });
});
