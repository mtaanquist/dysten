# Activity Campaign Tracker

An internal web app for running workplace activity campaigns. People join a
campaign, log what they did each day, and compete on a leaderboard. When a
campaign ends it becomes part of a permanent history, with its final standings
and the exact roster that took part.

It ships with two kinds of campaign and is built so more can be added:

- **Step campaign** — steps actually walked, plus steps converted from other
  activities like cycling or sport.
- **Bike-to-work campaign** — kilometres commuted, plus kilometres in spare time.

The interface is fully translated into **English (GB)** and **Danish**, and
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

---

## What you get

**Dashboard.** Every campaign you have joined, one card each — because a step
campaign and a bike campaign can run at the same time. Each card shows the
campaign's shared goal, your total, your rank, your daily average, and how many
days you still owe an entry for. Campaigns you could join sit below, and
finished campaigns below that, paginated.

**Campaign page.** The shared goal across the top, then a month-by-month
calendar where you type your two numbers into any day in the range — including
days you forgot. Then highlights (best single day, longest streak, biggest
climber this week), the leaderboard with movement arrows and streak badges, a
cumulative progress chart for the leading five, and the full roster. Tapping
anyone opens their day-by-day figures — and for an admin, on a campaign that
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
    image: ghcr.io/mtaanquist/activitycampaigntracker:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: "file:/data/app.db"
      ORG_NAME: "${ORG_NAME}"
      APP_SECRET: "${APP_SECRET}"
      APP_TIMEZONE: "${APP_TIMEZONE}"
      AUTH_PROVIDER: "${AUTH_PROVIDER}"
      ALLOW_DEV_AUTH: "${ALLOW_DEV_AUTH}"
      SEED_ADMIN_EMAILS: "${SEED_ADMIN_EMAILS}"
      SEED_ON_START: "${SEED_ON_START}"
    volumes:
      - data:/data

volumes:
  data:
```

**2. Put this next to it in `.env`:**

```dotenv
# The name shown in the header and on the sign-in page.
ORG_NAME=Acme

# Signs session cookies. Generate your own with:  openssl rand -base64 32
# Required. Must be at least 16 characters. Do not share it or reuse it.
APP_SECRET=CHANGE-ME-openssl-rand-base64-32

# Decides when "today" rolls over for logging.
APP_TIMEZONE=Europe/Copenhagen

# "dev" lets you pick an account from a list, with no identity provider.
# Switch to "entra" once Microsoft 365 sign-in is wired up.
AUTH_PROVIDER=dev
ALLOW_DEV_AUTH=true

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
> two app containers cannot share it. That is ample for a company-sized tracker.
> If you ever need more, the repository's own `compose.yaml` carries a commented
> PostgreSQL service and the three steps to switch.

---

## Running from source

You need **Node.js 22** or newer.

```bash
git clone https://github.com/mtaanquist/activitycampaigntracker.git
cd activitycampaigntracker
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
| `ORG_NAME` | `Acme` | Name in the header and on the sign-in card |
| `APP_SECRET` | — | **Required.** Signs session cookies; 16+ characters |
| `APP_TIMEZONE` | `Europe/Copenhagen` | When "today" rolls over |
| `APP_TODAY` | unset | Pins the app's idea of today (`YYYY-MM-DD`). For demos and tests only |
| `AUTH_PROVIDER` | `dev` | `dev` or `entra` |
| `ALLOW_DEV_AUTH` | unset | Lets the dev sign-in run in a production build |
| `SEED_ADMIN_EMAILS` | empty | Comma-separated addresses provisioned as admins |
| `SEED_ON_START` | `false` | Loads demo data on start. **Deletes existing data** |
| `ENTRA_TENANT_ID` | — | Required when `AUTH_PROVIDER=entra` |
| `ENTRA_CLIENT_ID` | — | Required when `AUTH_PROVIDER=entra` |
| `ENTRA_CLIENT_SECRET` | — | Required when `AUTH_PROVIDER=entra` |
| `ENTRA_ALLOW_GUESTS` | `true` | Set `false` to reject B2B guest accounts |
| `SMTP_URL` | unset | Enables the e-mail reminder channel |
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

This is the intended production sign-in and it is **not finished** — everything
around it is in place, but the token exchange itself needs a tenant that only
you can create. It is a self-contained job:

1. Register an application in Entra ID. Add a web redirect URI of
   `{your-url}/api/auth/callback` and grant the delegated `User.Read` scope.
2. Set `AUTH_PROVIDER=entra`, `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID` and
   `ENTRA_CLIENT_SECRET`.
3. Implement the authorisation-code exchange in
   [`src/lib/auth/entra-provider.ts`](src/lib/auth/entra-provider.ts). That file
   documents exactly what to map to what.

Account creation, the first-user-becomes-admin rule, and role assignment already
work and need no changes.

#### Restricting sign-in to your tenant only

Do all three. The first two are configuration that is easy to get subtly wrong;
the third is the check that catches it when it is.

1. **Register the app as single-tenant** — "Accounts in this organizational
   directory only". Microsoft then refuses to issue tokens for other tenants.
2. **Use the tenant-scoped authority.** `https://login.microsoftonline.com/{tenant-id}/v2.0`,
   never `/common` or `/organizations`. Using `/common` is the single most common
   way an app meant for one company ends up accepting sign-ins from every
   Microsoft tenant in the world.
3. **Verify the `tid` claim** matches your tenant id. `assertTenantAllowed()` in
   the provider file does this and throws if it does not — call it on the
   validated claims before trusting them. Configuration drifts; an assertion in
   code does not.

Guest (B2B) accounts invited into your directory carry *your* tenant id while
belonging to another organisation, so they pass all three checks. If contractors
and partners should not appear on the leaderboard, set `ENTRA_ALLOW_GUESTS=false`.

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

Captains and admins get a **"View as"** control on the dashboard, to see the app
as a lesser role. It only ever goes *down* — permission checks use the previewed
role, so the preview is genuine and can never widen someone's access.

---

## Adding a campaign type

A campaign type decides what the two numbers on each day mean. Adding one takes
two edits and **no database migration**, because entries store two neutral
values and the type decides how to read them.

**1.** Add it to [`src/lib/campaign-types.ts`](src/lib/campaign-types.ts):

```ts
export const CAMPAIGN_TYPES = {
  step: { key: "step", decimals: 0, inputStep: 10 },
  bike: { key: "bike", decimals: 1, inputStep: 0.1 },
  swim: { key: "swim", decimals: 0, inputStep: 50 },   // new
} as const satisfies Record<string, CampaignTypeDefinition>;
```

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

The delivery layer is built and the **transports are stubs**: choosing an SMTP
relay or a Teams webhook is a decision for whoever deploys this. Set `SMTP_URL`
or `TEAMS_WEBHOOK_URL` to enable a channel, then implement it in
[`src/lib/notifications/index.ts`](src/lib/notifications/index.ts). Until then a
`console` channel logs exactly who would have been contacted, so the logic is
observable.

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

Everything lives in one SQLite file on the `data` volume. To back it up:

```bash
docker compose exec app sh -c "cp /data/app.db /data/backup-$(date +%F).db"
docker compose cp app:/data/backup-$(date +%F).db ./
```

Restore by stopping the app, copying a file back to `/data/app.db`, and starting
it again. Migrations run automatically on every start and only ever apply
migrations that already exist — they never reset anything.

---

## Published images

Images are published to the GitHub Container Registry on every push to `main`
and on every version tag:

```
ghcr.io/mtaanquist/activitycampaigntracker:latest    # newest main
ghcr.io/mtaanquist/activitycampaigntracker:v1.2.3    # a release tag
ghcr.io/mtaanquist/activitycampaigntracker:1.2       # tracks 1.2.x
ghcr.io/mtaanquist/activitycampaigntracker:sha-abc123
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
    campaign-types.ts  The extensible type registry
    campaign-status.ts Status derived from dates, plus the two overrides
    scoring.ts         Totals, tied ranks, streaks, highlights
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
- **Scoring is pure functions** in `scoring.ts`, taking data as arguments. The
  competitive rules — the part people will argue about — are testable without a
  database, and the leaderboard, chart and highlights all read from one query.
- **Fonts are self-hosted.** Barlow is downloaded at build time and served from
  your own origin, so no user's browser calls a third-party font CDN.

The design mockups this was built from are in [`.design/`](.design/), including
a component sheet naming the token behind nearly every value.
