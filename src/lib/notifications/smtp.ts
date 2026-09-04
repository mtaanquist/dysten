/**
 * Turning environment variables into an SMTP connection.
 *
 * Kept apart from the channel that uses it, and pure, because the interesting
 * part is the precedence rather than the sending: a deployment may spell its
 * relay as one URL or as separate fields, and the two have to agree on what
 * they mean. Nothing here opens a socket, so all of it is testable.
 *
 * Two rules run through the whole file:
 *
 * - An empty variable is how a compose file spells "I left this blank", never
 *   "I configured an empty value". Blank reads as unset everywhere.
 * - A value the app cannot make sense of counts as unset too, and leaves the
 *   channel disabled. That is deliberately not the same as guessing: a port of
 *   "58 7" silently becoming 587 would be a promise the deployment never made.
 */

export interface SmtpSettings {
  host: string;
  port: number;
  /** Implicit TLS from the first byte, as on port 465, rather than STARTTLS. */
  secure: boolean;
  /** Omitted for a relay that accepts unauthenticated mail from inside. */
  auth?: { user: string; pass: string };
  /** Envelope sender, e.g. `Dysten <noreply@example.com>`. */
  from: string;
}

export type Env = Record<string, string | undefined>;

/** Trimmed, with blank treated as absent. */
function read(env: Env, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

/**
 * `true` / `false`, and the `1` / `0` a shell script is likely to pass.
 *
 * `null` for anything else, which invalidates the whole configuration rather
 * than falling back. Guessing here would decide whether the connection is
 * encrypted from the first byte, and that is not a guess worth making.
 */
function readBoolean(env: Env, name: string): boolean | null | undefined {
  const value = read(env, name)?.toLowerCase();
  if (value === undefined) return undefined;
  if (value === "true" || value === "1" || value === "yes") return true;
  if (value === "false" || value === "0" || value === "no") return false;
  return null;
}

/** A port, or `null` for a value that is present but not one. */
function readPort(value: string | undefined): number | null | undefined {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value)) return null;
  const port = Number(value);
  return port >= 1 && port <= 65535 ? port : null;
}

interface UrlParts {
  host: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
}

/**
 * `smtp://user:pass@relay.example:587`, the shorthand the app shipped with.
 *
 * `smtps://` means implicit TLS. Credentials are percent-decoded, so a password
 * containing an `@` survives being written into a URL.
 */
function parseUrl(raw: string): UrlParts | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const secure = url.protocol === "smtps:" ? true : url.protocol === "smtp:" ? false : null;
  if (secure === null || !url.hostname) return null;

  const port = readPort(url.port || undefined);
  if (port === null) return null;

  return {
    host: url.hostname,
    port,
    secure: secure || undefined,
    user: url.username ? decodeURIComponent(url.username) : undefined,
    pass: url.password ? decodeURIComponent(url.password) : undefined,
  };
}

/**
 * The relay to send through, or `null` when this deployment has not configured
 * one it could actually send from.
 *
 * `SMTP_FROM` is as required as the host is. A relay with no sender to put on
 * the envelope cannot deliver anything, and reporting that as "configured"
 * would put the reminder opt-in back in front of people for a channel that
 * still goes nowhere — which is the exact promise `remindersDeliverable`
 * exists to keep the app from making.
 *
 * The discrete variables win field by field over `SMTP_URL`, so a deployment
 * can keep the URL it has and override just the port.
 */
export function readSmtpSettings(env: Env = process.env): SmtpSettings | null {
  const rawUrl = read(env, "SMTP_URL");
  const url = rawUrl ? parseUrl(rawUrl) : undefined;
  if (rawUrl && !url) return null;

  const host = read(env, "SMTP_HOST") ?? url?.host;
  const from = read(env, "SMTP_FROM");
  if (!host || !from) return null;

  const port = readPort(read(env, "SMTP_PORT"));
  if (port === null) return null;

  // Order matters: an explicit SMTP_SECURE decides the default port, and
  // failing that the port decides the mode, because 465 means implicit TLS
  // everywhere and no other port does.
  const secureSetting = readBoolean(env, "SMTP_SECURE");
  if (secureSetting === null) return null;
  const declaredSecure = secureSetting ?? url?.secure;
  const resolvedPort = port ?? url?.port ?? (declaredSecure ? 465 : 587);
  const secure = declaredSecure ?? resolvedPort === 465;

  const user = read(env, "SMTP_USER") ?? url?.user;
  const pass = read(env, "SMTP_PASSWORD") ?? url?.pass;

  return {
    host,
    port: resolvedPort,
    secure,
    // An internal relay that accepts anything from the network it trusts needs
    // no credentials, and offering it an empty username fails the handshake.
    ...(user ? { auth: { user, pass: pass ?? "" } } : {}),
    from,
  };
}
