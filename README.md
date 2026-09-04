# Dysten

An internal web app for running workplace activity campaigns. People join a
campaign, log what they did each day, and compete on a leaderboard. When a
campaign ends it becomes part of a permanent history, with its final standings
and the exact roster that took part.

*Dysten* is Danish for "the contest" — the word these campaigns are named after
in the first place (*Trappedysten*, *Skridt-udfordringen*). The interface calls
itself **Dysten** in Danish and **Challenges** in English; both come from
`app.tagline` in the language files, so an organisation can rename it without
touching code.

It ships with two kinds of campaign and is built so more can be added:

- **Step campaign** — steps actually walked, plus steps converted from other
  activities like cycling or sport. Most steps wins.
- **Bike-to-work campaign** — kilometres commuted, plus kilometres in spare
  time. **Most days out wins**, not most kilometres: how far you live from the
  office is not an achievement. The distance is still logged and shown, it just
  does not decide the standings.

Each type carries its own colour through the type pill and the shared-goal
panel, so a dashboard showing both tells them apart at a glance.

The interface is fully translated into **English** and **Danish**, and
defaults to Danish. Each person picks their own language and it is remembered.

---

## Contents

- [What you get](#what-you-get)
- [Quick start with Docker Compose](#quick-start-with-docker-compose)
- [Running from source](#running-from-source)
- [Configuration](#configuration)
- [Signing in](#signing-in)
- [Roles and permissions](#roles-and-permissions)
- [Adding a campaign type](#adding-a-campaign-type)
- [Adding a language](#adding-a-language)
- [Reminders](#reminders)
- [Backups and data](#backups-and-data)
- [Published images](#published-images)
- [Project layout](#project-layout)
- [How it is built](#how-it-is-built)
- [Credits](#credits)

---

## What you get

**Dashboard.** Every campaign you have joined, one card each — because a step
campaign and a bike campaign can run at the same time. Each card shows the
campaign's shared goal, your total, your rank, the figure your rank is built on,
and how many days you still owe an entry for. Campaigns you could join and
finished campaigns share the row below, side by side.

**Campaign page.** The shared goal across the top, then a month-by-month
calendar where you type your two numbers into any day in the range — including
days you forgot. Then highlights (best single day, longest streak, biggest
climber this week), the leaderboard with movement arrows and streak badges, and
a cumulative progress chart for the leading five. The leaderboard is the roster:
everyone on the campaign appears, including people who have logged nothing yet.
Tapping anyone opens their day-by-day figures — and for an admin, on a campaign that
still accepts entries, those figures are editable. Every day in the range gets a
row, including days that were never logged, because that is usually what needs
correcting. Anything an admin changes is stamped as their correction and says so
wherever it appears.

**History.** Every finished campaign, its final standings with the winner
highlighted, and the roster exactly as it stood at the end. An admin who reopens
one for corrections gets the same editable day-by-day panel there.

**Management.** For captains and admins: create and edit campaigns, manage
rosters, close a campaign early. Admins can additionally assign roles, delete
campaigns, and reopen a finished one to correct entries.

---

## Quick start with Docker Compose

You need Docker with the Compose plugin. Nothing else — no Node, no database
server.

**1. Make a folder and put this in `compose.yaml`:**

```yaml
services:
  app:
    image: ghcr.io/mtaanquist/dysten:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: "file:/data/app.db"
      ORG_NAME: "${ORG_NAME}"
      BRAND_NAME: "${BRAND_NAME}"
      APP_SECRET: "${APP_SECRET}"
      APP_TIMEZONE: "${APP_TIMEZONE}"
      APP_URL: "${APP_URL}"
      AUTH_PROVIDER: "${AUTH_PROVIDER}"
      ALLOW_DEV_AUTH: "${ALLOW_DEV_AUTH}"
      ENTRA_TENANT_IDS: "${ENTRA_TENANT_IDS}"
      ENTRA_CLIENT_ID: "${ENTRA_CLIENT_ID}"
      ENTRA_CLIENT_SECRET: "${ENTRA_CLIENT_SECRET}"
      SEED_ADMIN_EMAILS: "${SEED_ADMIN_EMAILS}"
      SEED_ON_START: "${SEED_ON_START}"
    volumes:
      - data:/data

volumes:
  data:
```

**2. Put this next to it in `.env`:**

```dotenv
# The organisation shown in the header and on the sign-in page.
ORG_NAME=Acme

# Optional. A club or group that runs the campaigns, shown in larger type with
# the organisation beneath it. Leave empty for just the organisation.
BRAND_NAME=

# Signs session cookies. Generate your own with:  openssl rand -base64 32
# Required. Must be at least 16 characters. Do not share it or reuse it.
APP_SECRET=CHANGE-ME-openssl-rand-base64-32

# Decides when "today" rolls over for logging.
APP_TIMEZONE=Europe/Copenhagen

# Public origin of this deployment. Required for Microsoft sign-in, because the
# redirect URI must match the app registration exactly.
APP_URL=https://dysten.example.com

# "dev" lets you pick an account from a list, with no identity provider — fine
# for a first look, never for real use. Switch to "entra" for Microsoft 365 and
# fill in the three variables below; then drop ALLOW_DEV_AUTH entirely.
AUTH_PROVIDER=dev
ALLOW_DEV_AUTH=true

# Only needed when AUTH_PROVIDER=entra. ENTRA_TENANT_IDS is a comma-separated
# allowlist — normally just your own tenant. See "Restricting who may sign in".
ENTRA_TENANT_IDS=
ENTRA_CLIENT_ID=
ENTRA_CLIENT_SECRET=

# Anyone signing in with one of these addresses becomes an admin.
# Comma-separated. The very first person to sign in becomes an admin anyway.
SEED_ADMIN_EMAILS=

# Set to true for ONE run to load demo campaigns and people, then set it back
# to false. It deletes existing data first, so never leave it on.
SEED_ON_START=true
```

**3. Start it:**

```bash
docker compose up -d
```

**4. Open <http://localhost:3000>.**

With `SEED_ON_START=true` you land on a sign-in page listing ten demo people.
Pick *Mette Sørensen* to see an admin's view. There are two campaigns running,
one open to join, and two finished ones in the history.

**5. Turn the demo seed off**, or the next restart wipes everything you entered:

```bash
# set SEED_ON_START=false in .env, then
docker compose up -d
```

### Useful commands

```bash
docker compose logs -f app     # watch the logs
docker compose pull            # fetch a newer image
docker compose up -d           # apply it (migrations run automatically)
docker compose down            # stop; the data volume survives
docker compose down -v         # stop AND delete the database
```

> **One container only.** The database is a SQLite file on the `data` volume, so
> two app containers cannot share it. That is ample for one company's campaigns.
> If you ever need more, the repository's own `compose.yaml` carries a commented
> PostgreSQL service and the three steps to switch.

---

## Running from source

You need **Node.js 22** or newer.

```bash
git clone https://github.com/mtaanquist/dysten.git
cd dysten
npm install

cp .env.example .env      # then set APP_SECRET to anything 16+ characters

npx prisma migrate deploy # create the database
npm run db:seed           # optional: load the demo data

npm run dev               # http://localhost:3000
```

Other scripts:

| Command | Does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build |
| `npm start` | Serve a production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | The scoring rules, via `node:test`. No database needed |
| `npm run lint` | ESLint. Next 16 removed `next lint`, so this is the CLI directly |
| `npm run db:migrate` | Create a migration after editing the schema |
| `npm run db:seed` | Reset to the demo data |
| `npm run db:studio` | Browse the database in a GUI |

---

## Configuration

Everything is an environment variable. Nothing is baked into the image, so the
same published image serves any organisation.

| Variable | Default | What it does |
| --- | --- | --- |
| `DATABASE_URL` | — | SQLite file location. In Docker: `file:/data/app.db` |
| `ORG_NAME` | `Acme` | Organisation in the header and on the sign-in card |
| `BRAND_NAME` | unset | Optional sub-brand shown above the organisation, in larger type |
| `APP_SECRET` | — | **Required.** Signs session cookies; 16+ characters |
| `APP_TIMEZONE` | `Europe/Copenhagen` | When "today" rolls over |
| `APP_TODAY` | unset | Pins the app's idea of today (`YYYY-MM-DD`). For demos and tests only |
| `AUTH_PROVIDER` | `dev` | `dev` or `entra` |
| `ALLOW_DEV_AUTH` | unset | Lets the dev sign-in run in a production build |
| `SEED_ADMIN_EMAILS` | empty | Comma-separated addresses provisioned as admins |
| `SEED_ON_START` | `false` | Loads demo data on start. **Deletes existing data** |
| `APP_URL` | request origin | Public origin, e.g. `https://dysten.example.com`. Builds the OAuth redirect URI and every redirect back into the app. In Docker the fallback is the container's own `http://0.0.0.0:3000`, so set it |
| `ENTRA_TENANT_IDS` | — | Required when `AUTH_PROVIDER=entra`. Comma-separated allowlist of tenant ids |
| `ENTRA_CLIENT_ID` | — | Required when `AUTH_PROVIDER=entra` |
| `ENTRA_CLIENT_SECRET` | — | Required when `AUTH_PROVIDER=entra` |
| `ENTRA_ALLOW_GUESTS` | `true` | Set `false` to reject B2B guest accounts |
| `SMTP_HOST` | unset | Relay for reminder e-mails. Enables the channel, together with `SMTP_FROM` |
| `SMTP_PORT` | `587`, or `465` with implicit TLS | Relay port |
| `SMTP_USER` | unset | Username. Leave unset for a relay that accepts unauthenticated mail |
| `SMTP_PASSWORD` | unset | Password |
| `SMTP_SECURE` | from the port | `true` for implicit TLS (port 465); otherwise STARTTLS |
| `SMTP_FROM` | unset | **Required for e-mail.** Sender, e.g. `Dysten <noreply@example.com>` |
| `SMTP_URL` | unset | Shorthand for host, port and credentials: `smtp://user:pass@relay:587`. The variables above win over it, field by field |
| `TEAMS_WEBHOOK_URL` | unset | Enables the Teams reminder channel |
| `NOTIFICATIONS_RUN_TOKEN` | unset | Shared secret for the reminder endpoint |

---

## Signing in

### Development sign-in (the default)

`AUTH_PROVIDER=dev` shows a list of accounts and lets you become any of them.
There is no password. It is for getting the app running and for local work.

It refuses to run in a production build unless you also set
`ALLOW_DEV_AUTH=true`, so it cannot ship by accident.

### Microsoft 365 (Entra ID)

The production sign-in: the authorisation-code flow with PKCE, straight against
the v2.0 endpoints. The app never calls Graph — the object id, e-mail and display
name it needs are all in the ID token — so there is no access token to keep and
nothing to refresh.

Account creation, the first-user-becomes-admin rule and role assignment need no
changes: the callback provisions the user and writes the same signed session
cookie the dev provider uses, and every request after that just reads the cookie.

#### Registering the app

You need someone who can create app registrations in your tenant — often
Application Administrator or Cloud Application Administrator rather than a full
Global Administrator. Getting that person's time is usually the long pole here,
so start it before you need it.

Throughout, `{your-url}` is the public origin of the deployment, e.g.
`https://dysten.example.com`.

**1. Create the registration.**

In the [Microsoft Entra admin center](https://entra.microsoft.com):
**Identity → Applications → App registrations → New registration**.

| Field | Value |
| --- | --- |
| Name | Anything; users see it on the consent screen. "Dysten" is fine |
| Supported account types | **Accounts in this organizational directory only (Single tenant)** |
| Redirect URI | Platform **Web**, value `{your-url}/api/auth/callback` |

The account-types choice is the strongest of the three tenant controls, because
it makes Microsoft itself refuse to issue a token to anyone else — it does not
depend on this app's code being correct. Only pick a multi-tenant option if you
genuinely need several tenants; see [Restricting who may sign in](#restricting-who-may-sign-in)
for what that costs.

The redirect URI must be **Web**, not "Single-page application". A SPA
registration refuses to accept a client secret, and this is a confidential
client. HTTPS is required except for `http://localhost`, which Entra allows so
you can test against a real tenant from your own machine.

**2. Copy the two ids.** The registration's **Overview** page has both:

- **Application (client) ID** → `ENTRA_CLIENT_ID`
- **Directory (tenant) ID** → `ENTRA_TENANT_IDS`

**3. Create a client secret.**

**Certificates & secrets → Client secrets → New client secret.** Give it a
description and an expiry.

Copy the **Value** column, not the Secret ID — they sit next to each other and
the Value is the one you need. It is shown once and is unrecoverable afterwards;
if you miss it, delete the secret and make another. That goes in
`ENTRA_CLIENT_SECRET`.

Entra caps secret lifetime at 24 months. **Put the expiry date in a calendar
now** — an expired secret takes sign-in down for everyone at once, and the
symptom (`AADSTS7000215`) does not obviously say "your secret expired".

**4. Check the permissions.**

**API permissions** should already list Microsoft Graph → `User.Read`
(delegated), added by default. That is enough. The app requests
`openid profile email`, all of which are delegated Graph permissions that a user
consents to themselves — no admin consent, no application permissions, nothing
that reads anyone else's data.

**5. Only if you are setting `ENTRA_ALLOW_GUESTS=false`:** add the `acct` claim.

**Token configuration → Add optional claim → ID → `acct`.**

`acct` is what distinguishes a member of your tenant (`0`) from a B2B guest
(`1`), and Entra omits it unless the registration asks for it. The app refuses
every sign-in if you have switched guests off and the claim is missing, rather
than guessing — an absent claim read as "not a guest" would quietly admit every
guest in the directory while the setting says the opposite. If you see that
refusal, this step is what you skipped.

**6. Optional but worth knowing: restrict who can use it at all.**

**Enterprise applications → (your app) → Properties → Assignment required: Yes**,
then assign the users or groups under **Users and groups**. Anyone else is
refused by Entra before they ever reach the app.

This is the cleanest way to run a beta: put the pilot group on the assignment
list and open it up later, without touching configuration or code.

**7. Set the environment.**

```dotenv
AUTH_PROVIDER=entra
APP_URL=https://dysten.example.com
ENTRA_TENANT_IDS=<Directory (tenant) ID>
ENTRA_CLIENT_ID=<Application (client) ID>
ENTRA_CLIENT_SECRET=<the secret Value>
```

Then drop `ALLOW_DEV_AUTH` entirely, so the account picker cannot come back.

`APP_URL` matters more than it looks. The redirect URI has to match the
registration byte for byte, and behind a reverse proxy the request's own idea of
its origin is whatever the proxy forwarded — which is the difference between
working and `AADSTS50011`.

#### When it does not work

Nearly every first-run failure is one of these. The `AADSTS` code is in the
Microsoft error page, and the app logs its own refusals with an `[auth]` prefix.

| What you see | Usually means |
| --- | --- |
| `AADSTS50011` redirect URI mismatch | `APP_URL` and the registered redirect URI disagree — check the scheme, a trailing slash, and that the path is exactly `/api/auth/callback` |
| `AADSTS7000215` invalid client secret | The secret expired, or the Secret **ID** was copied instead of the **Value** |
| `AADSTS700016` application not found | `ENTRA_CLIENT_ID` is wrong, or the registration is in a different tenant from `ENTRA_TENANT_IDS` |
| `AADSTS50020` user account does not exist in tenant | A personal Microsoft account, or someone from another tenant, against a single-tenant registration. Working as intended |
| "Your account is not from an organisation allowed to use Dysten" | The app's own check: the token's `tid` is not in `ENTRA_TENANT_IDS`. The log line names the tenant it saw |
| That message for *everyone*, with `no acct claim` in the log | `ENTRA_ALLOW_GUESTS=false` without step 5 |
| "Sign-in failed", `state mismatch` in the log | The one-time cookies did not survive the round trip. Almost always a missing `secure`/HTTPS mismatch or a proxy dropping cookies |

#### Restricting who may sign in

`ENTRA_TENANT_IDS` is a comma-separated allowlist. **With one id** — the normal
case for a single company — three independent layers hold:

1. **The app registration is single-tenant**, so Microsoft itself refuses to
   issue a token to anyone else. This is the strongest of the three, because it
   does not depend on this code being right.
2. **The authority names your tenant**: `https://login.microsoftonline.com/{tenant-id}/v2.0`,
   never `/common`. Using `/common` is the single most common way an app meant
   for one company ends up accepting sign-ins from every Microsoft tenant in the
   world. The app builds this from your list, so there is nothing to get wrong.
3. **The `tid` claim is checked** against the list, on the verified token, and
   the sign-in is refused if it does not match. Configuration drifts; an
   assertion in code does not.

**With more than one id, the first two are gone and cannot be recovered.** No
authority URL names a *subset* of tenants, so the registration has to be
multi-tenant and the authority becomes `/organizations`. The allowlist stops
being a backstop and becomes the only thing between the app and every Microsoft
tenant on earth. It still works, and the check is tested — but add a second
tenant deliberately, knowing that is the trade.

Guest (B2B) accounts invited into your directory carry *your* tenant id while
belonging to another organisation, so they pass all three checks. If contractors
and partners should not appear on the leaderboard, set `ENTRA_ALLOW_GUESTS=false`.

The rules live in [`src/lib/auth/entra-tenant.ts`](src/lib/auth/entra-tenant.ts),
kept free of framework imports so they can be tested as plain functions — see
`entra-tenant.test.ts`. That is deliberate: this is the code you least want to be
exercising for the first time in production.

---

## Roles and permissions

| | Member | Team captain | Admin |
| --- | :-: | :-: | :-: |
| Join campaigns, log own entries | ✓ | ✓ | ✓ |
| See everyone's stats and daily entries | ✓ | ✓ | ✓ |
| Create and edit campaigns | | ✓ | ✓ |
| Manage rosters, close a campaign early | | ✓ | ✓ |
| Assign roles | | | ✓ |
| Correct or delete anyone's entry | | | ✓ |
| Delete a campaign, reopen a finished one | | | ✓ |

The **first person to sign in becomes an admin.** After that, admins promote
people from the management screen. `SEED_ADMIN_EMAILS` can pre-authorise more.

Every check reads the role stored against the account, in one place —
[`src/lib/permissions.ts`](src/lib/permissions.ts). A hidden button and a
rejected request cannot disagree, because the component and the server action
call the same function.

---

## Adding a campaign type

A campaign type decides what the two numbers on each day mean, **how the winner
is decided**, and what colour the campaign wears. Adding one takes two edits and
**no database migration**, because entries store two neutral values and the type
decides how to read them.

**1.** Add it to [`src/lib/campaign-types.ts`](src/lib/campaign-types.ts):

```ts
export const CAMPAIGN_TYPES = {
  step: {
    key: "step", decimals: 0, inputStep: 10,
    rankBy: "total", winnerBy: "raffle", ticketsPer: 10_000,
    activityCalculator: true,
    accent: "var(--c-type-step)",
  },
  bike: {
    key: "bike", decimals: 1, inputStep: 0.1,
    rankBy: "activeDays", winnerBy: "topScore",
    accent: "var(--c-type-bike)",
  },
  swim: {                                                    // new
    key: "swim", decimals: 0, inputStep: 50,
    rankBy: "total", winnerBy: "topScore",
    accent: "var(--c-type-swim)",
  },
} as const satisfies Record<string, CampaignTypeDefinition>;
```

`ticketsPer` is only read when `winnerBy` is `"raffle"`, and
`activityCalculator` opts the type into the activity-to-steps calculator on the
entry screen — both may be left out, as the bike and swim entries show.

`accent` names a token you add to
[`src/styles/tokens.css`](src/styles/tokens.css) — no hex belongs outside that
file. Give it the same **relative luminance** as the existing two (0.61) rather
than eyeballing it: that is what makes the accents read as a set, and it carries
the contrast guarantees with it, since the shared-goal panel and the type pill
both put dark ink on this colour.

**2.** Add its wording to **every** file in `src/i18n/messages/`:

```json
"swim": {
  "name": "Swimming challenge",
  "unit": "metres",
  "field1": "Metres swum",
  "field1Short": "Pool",
  "field1Help": "Distance covered in the pool",
  "field2": "Open water",
  "field2Short": "Open",
  "field2Help": "Lakes, sea, anything without lane ropes"
}
```

It now appears in the campaign type dropdown. `decimals` controls both display
and rounding on save; `inputStep` sets the step on the number inputs.

### Ranking and winning

These are **two separate questions**, and the registry keeps them apart: a
campaign can rank people one way and pick its winner another.

`rankBy` picks what the standings sort on, and everything that compares people —
the leaderboard, the gap to the rank above, the progress chart — follows it from
that one word.

- **`total`** — most logged wins. Right when the number is comparable between
  people, as steps are.
- **`activeDays`** — most days *out* wins, and the amount is only ever shown.
  Right for cycling to work: how far you live from the office is not an
  achievement, and ranking on kilometres hands the campaign to whoever has the
  longest commute. A day counts when something was actually ridden, so logging a
  zero buys nothing, and two people on the same number of days genuinely tie
  rather than being split by distance.

`winnerBy` then decides who actually wins, which is not always the top of that
board.

- **`topScore`** — the leaderboard decides it. Whoever is first, wins.
- **`raffle`** — logging earns tickets, one per `ticketsPer` units and at least
  one for anybody who logged at all, and a captain draws one when the campaign
  ends. The board still sorts on `rankBy`, because watching the numbers is what
  makes people turn out; it just no longer hands over the prize by itself. See
  [`src/lib/raffle.ts`](src/lib/raffle.ts).

Keeping the two apart is deliberate. Folding a raffle into `rankBy` would have
dragged the sort, the gap and the chart into a change that has nothing to do
with any of them.

A shared goal is always a raw amount either way — "together we ride around
Denmark" is a distance the group covers, whoever ends up winning.

---

## Adding a language

**1.** Copy `src/i18n/messages/en-GB.json` to, say, `de-DE.json` and translate
the values. Leave the keys alone.

**2.** Register it in [`src/i18n/config.ts`](src/i18n/config.ts):

```ts
import deDE from "./messages/de-DE.json";

export const LOCALES = ["da-DK", "en-GB", "de-DE"] as const;

export const MESSAGES: Record<Locale, Messages> = {
  "da-DK": daDK as Messages,
  "en-GB": enGB,
  "de-DE": deDE as Messages,
};

export const LOCALE_LABELS: Record<Locale, string> = {
  "da-DK": "Dansk",
  "en-GB": "English (GB)",
  "de-DE": "Deutsch",
};
```

That is the whole job. No component contains a literal string, so nothing else
needs touching. Dates, numbers and decimal separators follow automatically from
the locale tag, and TypeScript will tell you if a key is missing.

Plurals are written as `key_one` and `key_other` and selected with the
language's own plural rules — so a language with more plural forms than English
is handled by adding the forms it needs.

---

## Reminders

People can opt in, with the bell icon beside their e-mail on the dashboard, to
be nudged when they forget to log a day.

**The bell only appears once a channel that reaches people is configured.**
With no relay and no `TEAMS_WEBHOOK_URL` there is nowhere for a reminder to go,
and offering the switch would promise something the deployment cannot deliver.
Configure one and the opt-in returns. The `console` channel does not count
towards this: it reaches a log file, not a person.

### E-mail

Set a relay and a sender:

```bash
SMTP_HOST=relay.example.com
SMTP_PORT=587
SMTP_USER=dysten
SMTP_PASSWORD=...
SMTP_FROM="Dysten <noreply@example.com>"
```

`SMTP_FROM` is as required as the host: a relay with nothing to put on the
envelope cannot deliver anything, so the channel stays off — and the bell stays
hidden — until both are set. `SMTP_URL` is a shorthand for the first four
(`smtp://user:pass@relay.example.com:587`, or `smtps://` for implicit TLS), and
the discrete variables override it field by field.

Implicit TLS follows the port unless `SMTP_SECURE` says otherwise: 465 connects
encrypted from the first byte, anything else uses STARTTLS. A value the app
cannot parse — a port that is not a number, an `SMTP_SECURE` that is neither
true nor false — counts as unconfigured rather than being guessed at, so the
bell disappearing after an edit means one of these is malformed.

The message is rendered in each recipient's own language and links to the
campaign using `APP_URL`; without `APP_URL` the reminder is still sent, without
the link.

### Teams

Still a stub. Set `TEAMS_WEBHOOK_URL` to enable the channel, then implement it
in [`src/lib/notifications/index.ts`](src/lib/notifications/index.ts). Until
then the `console` channel logs exactly who would have been contacted, so the
logic is observable.

### Running the job

Nothing is scheduled from inside the app. Point a scheduler at the endpoint:

```bash
curl -X POST https://your-host/api/notifications/run \
  -H "Authorization: Bearer $NOTIFICATIONS_RUN_TOKEN"
```

It checks yesterday by default; add `?date=2026-08-11` to replay a missed run.
The endpoint returns 404 unless `NOTIFICATIONS_RUN_TOKEN` is set, so it is
closed rather than open by default.

---

## Backups and data

Everything lives in one SQLite file on the `data` volume.

### Why SQLite

One writer, a few dozen readers, a few thousand rows a year. SQLite is not a
compromise at this size — it is faster than a network round trip to Postgres,
it has no second container to run or connection string to get wrong, and the
whole dataset is one file you can copy to your laptop and open. Adding Postgres
would add operational surface and buy nothing this app can use.

Write-ahead logging is enabled on first start, so readers never block the
writer.

### Taking a backup

**Do not copy `app.db` while the app is running.** In WAL mode the most recent
commits live in the `-wal` sidecar, so a copy of `app.db` alone is missing them.
It will usually restore fine, which is the dangerous part — the failure shows up
on the day you actually need it.

Use the backup script instead. `VACUUM INTO` writes a complete, compacted
snapshot in one statement, safely, while the app keeps serving:

```bash
docker compose exec app node ./prisma/backup.ts /data/backups/app.db
```

From source, `npm run backup` does the same and writes to
`prisma/backups/app-YYYY-MM-DD.db`.

The snapshot is an ordinary, quiescent file. **Point your backup agent at that,
not at `app.db`.** If you run something like Duplicacy, Restic or Borg over the
volume, schedule the snapshot to run first — a file-level agent copying a live
database has exactly the problem above, and it cannot tell that anything went
wrong.

`VACUUM INTO` refuses to overwrite an existing file, so a backup can never
silently truncate the one before it.

### Restoring

Stop the app, copy a snapshot over `/data/app.db`, delete any `app.db-wal` and
`app.db-shm` beside it, and start again. Migrations run automatically on start
and only ever apply migrations that already exist — they never reset anything.

---

## Published images

Images are published to the GitHub Container Registry on every push to `main`
and on every version tag:

```
ghcr.io/mtaanquist/dysten:latest    # newest main
ghcr.io/mtaanquist/dysten:v1.2.3    # a release tag
ghcr.io/mtaanquist/dysten:1.2       # tracks 1.2.x
ghcr.io/mtaanquist/dysten:sha-abc123
```

Cut a release by tagging:

```bash
git tag v1.0.0 && git push origin v1.0.0
```

Builds are `linux/amd64`. To add `arm64`, uncomment the platforms line in
[`.github/workflows/publish.yml`](.github/workflows/publish.yml) — be aware it
is emulated on GitHub's runners and roughly triples the build time.

If the repository is private, its images are private too, and pulling needs
`docker login ghcr.io` with a token that has `read:packages`.

---

## Project layout

```
prisma/
  schema.prisma        Users, campaigns, participation, entries
  seed.ts              Demo data
src/
  app/                 Pages and server actions (Next.js App Router)
    actions/           Every mutation: entries, campaigns, session
  components/          UI, grouped by screen
  i18n/
    messages/          One JSON file per language — all user-facing text
  lib/
    auth/              Sign-in seam: dev provider, Entra provider
    campaign-types.ts  The extensible type registry: fields, ranking,
                       how the winner is picked, colour
    campaign-status.ts Status derived from dates, plus the two overrides
    scoring.ts         Totals, tied ranks, streaks, highlights
    scoring.test.ts    The competitive rules, tested without a database
    raffle.ts          Tickets and the draw, for raffle campaign types
    activities.ts      MET table converting other activities into steps
    queries.ts         Read models for the screens
    notifications/     Reminder events and channels
    dates.ts           Calendar-day handling
  styles/tokens.css    Every colour, size and radius in the design
.design/               The original design mockups, for reference
```

---

## How it is built

**Next.js 16** (App Router, React server components) with **TypeScript**,
**Prisma** over **SQLite**, and plain CSS modules driven by the design tokens.

A few decisions worth knowing before you change things:

- **Calendar days are strings, not timestamps.** `"2026-08-12"` — because the
  app is about which day a value belongs to. Storing timestamps means an entry
  logged at 23:00 in Copenhagen lands on the previous day once it passes through
  UTC.
- **Status is derived, never stored.** A campaign is upcoming, active or ended
  because of its dates. Only two real overrides are persisted: closing early,
  and reopening for corrections. Reopening deliberately does not make a finished
  campaign "active" again — it unlocks editing without putting it back on
  everyone's dashboard.
- **Ranks are computed at read time** and shared on ties. Correcting a
  three-year-old entry cannot leave a stale standing behind.
- **A raffle draw is the one result that is written down.** It cannot be
  derived: recomputing a random winner would name somebody different on every
  read, and an admin correcting an entry weeks later must not move the prize.
  The winner is stored with the ticket counts it came from and the index drawn,
  which is enough to check the result afterwards rather than take it on trust.
- **The competitive rules live in the type registry**, as two words rather than
  one. `rankBy` decides what the standings sort on, and every comparison — the
  sort, the gap, the chart — reads the `score` it produces. `winnerBy` decides
  who takes the prize, which on a raffle campaign is not whoever tops that
  board. They are separate on purpose: a draw changes who wins without changing
  how anyone is ranked, and one word doing both jobs would have tangled the two.
  Either way the rule is stated once, and a new campaign type cannot half-adopt
  it.
- **A campaign's range decides what counts.** Its dates are editable after
  people have logged against them, so shortening one can leave entries on days
  the campaign no longer covers. Every read model filters entries through
  `campaign-range.ts` on the way in, and shortening a campaign asks before
  deleting what it would strand. The filter is the belt: standings stay right
  even on a campaign shortened before any of this existed.
- **Scoring is pure functions** in `scoring.ts`, taking data as arguments. The
  competitive rules — the part people will argue about — are testable without a
  database, and the leaderboard, chart and highlights all read from one query.
- **Fonts are self-hosted.** Barlow is downloaded at build time and served from
  your own origin, so no user's browser calls a third-party font CDN.

The design mockups this was built from are in [`.design/`](.design/), including
a component sheet naming the token behind nearly every value.

---

## Credits

The app icon is used under Flaticon's free licence, which asks for the credit
below. It also appears in the app, on the Rules page.

<a href="https://www.flaticon.com/free-icons/athlete" title="athlete icons">Athlete icons created by Smashicons - Flaticon</a>

The activity-to-steps calculator uses MET values from the
[2024 Adult Compendium of Physical Activities](https://pacompendium.com/adult-compendium/).
