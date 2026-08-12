import { PrismaClient, Role } from "@prisma/client";

/**
 * Demo data mirroring the design prototype, so a fresh checkout has something
 * worth looking at: two overlapping active campaigns of different types, one
 * upcoming, and two finished ones for the history screens.
 *
 * The generator is a seeded PRNG rather than Math.random, so re-seeding
 * produces identical numbers and screenshots stay comparable.
 */

const prisma = new PrismaClient();

/** The day the demo data is built around; matches APP_TODAY in .env.example. */
const TODAY = process.env.APP_TODAY ?? "2026-08-12";

function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dayRange(start: string, end: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

const PEOPLE = [
  { key: "u1", displayName: "Mette Sørensen", email: "mette.sorensen@example.com", role: Role.ADMIN },
  { key: "u2", displayName: "Jonas Krogh", email: "jonas.krogh@example.com", role: Role.CAPTAIN },
  { key: "u3", displayName: "Amalie Bech", email: "amalie.bech@example.com", role: Role.MEMBER },
  { key: "u4", displayName: "Rasmus Dahl", email: "rasmus.dahl@example.com", role: Role.MEMBER },
  { key: "u5", displayName: "Sofie Lindberg", email: "sofie.lindberg@example.com", role: Role.MEMBER },
  { key: "u6", displayName: "Thomas Nygaard", email: "thomas.nygaard@example.com", role: Role.MEMBER },
  { key: "u7", displayName: "Camilla Holm", email: "camilla.holm@example.com", role: Role.CAPTAIN },
  { key: "u8", displayName: "Peter Vestergaard", email: "peter.vestergaard@example.com", role: Role.MEMBER },
  { key: "u9", displayName: "Line Aagaard", email: "line.aagaard@example.com", role: Role.MEMBER },
  { key: "u10", displayName: "Frederik Storm", email: "frederik.storm@example.com", role: Role.MEMBER },
];

const CAMPAIGNS = [
  {
    key: "c1",
    name: "Skridt-udfordringen 2026",
    type: "step",
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    goalValue: 1_200_000,
    goalName: "Sammen går vi til Paris",
    description:
      "En måned hvor hele huset går, cykler og svømmer sig til Paris. Registrér hver dag inden midnat.",
    roster: ["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u9"],
  },
  {
    key: "c2",
    name: "Cykel til arbejde 2026",
    type: "bike",
    startDate: "2026-08-03",
    endDate: "2026-09-13",
    goalValue: 4_000,
    goalName: "Hele vejen rundt om Danmark",
    description: "Seks uger på to hjul. Km til og fra arbejde plus fritidsture.",
    roster: ["u1", "u2", "u4", "u7", "u9"],
  },
  {
    key: "c5",
    name: "Trappedysten oktober",
    type: "step",
    startDate: "2026-10-01",
    endDate: "2026-10-31",
    goalValue: 600_000,
    goalName: "Op på Himmelbjerget 100 gange",
    description: "Kort og intens oktoberdyst — tilmelding er åben nu.",
    roster: ["u2"],
  },
  {
    key: "c3",
    name: "Skridtkampen 2025",
    type: "step",
    startDate: "2025-08-01",
    endDate: "2025-08-31",
    goalValue: 1_000_000,
    goalName: "Til Berlin og hjem",
    description: "Sidste års skridtdyst.",
    roster: ["u1", "u2", "u3", "u5", "u6", "u8", "u10"],
  },
  {
    key: "c4",
    name: "Cykel til arbejde 2025",
    type: "bike",
    startDate: "2025-09-01",
    endDate: "2025-09-30",
    goalValue: null,
    goalName: null,
    description: "Pendlerdyst på cykel.",
    roster: ["u2", "u4", "u7", "u8", "u9"],
  },
];

async function main() {
  console.info("Seeding…");

  // Idempotent: wipe in dependency order so re-running gives the same result.
  await prisma.entry.deleteMany();
  await prisma.participation.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.user.deleteMany();

  const userIds = new Map<string, string>();
  for (const person of PEOPLE) {
    const user = await prisma.user.create({
      data: {
        email: person.email,
        displayName: person.displayName,
        role: person.role,
        locale: "da-DK",
        // One opt-out so the bell toggle has both states represented.
        remindersEnabled: person.key !== "u6",
      },
    });
    userIds.set(person.key, user.id);
  }

  for (const [campaignIndex, definition] of CAMPAIGNS.entries()) {
    const campaign = await prisma.campaign.create({
      data: {
        name: definition.name,
        description: definition.description,
        type: definition.type,
        startDate: definition.startDate,
        endDate: definition.endDate,
        goalValue: definition.goalValue,
        goalName: definition.goalName,
        createdById: userIds.get("u1"),
        participants: {
          create: definition.roster.map((key) => ({ userId: userIds.get(key)! })),
        },
      },
    });

    // Upcoming campaigns have no entries yet.
    if (definition.startDate > TODAY) continue;

    const days = dayRange(definition.startDate, definition.endDate);
    const hasEnded = definition.endDate < TODAY;
    const upTo = hasEnded ? days.length : days.indexOf(TODAY) + 1;

    for (const [rosterIndex, key] of definition.roster.entries()) {
      const random = seededRandom(1000 * (campaignIndex + 1) + 37 * (rosterIndex + 1));
      const isStep = definition.type === "step";
      const base = isStep ? 5200 + Math.floor(random() * 6500) : 9 + random() * 14;

      const rows: { date: string; value1: number; value2: number }[] = [];
      for (let i = 0; i < upTo; i += 1) {
        const date = days[i];
        // A tenth of days go unlogged, so streaks and gaps look real.
        if (random() < 0.12) continue;
        // Mette's last two days are left blank on the live step campaign so the
        // "days missing entries" state is visible straight after seeding.
        if (key === "u1" && definition.key === "c1" && date >= "2026-08-11") continue;

        const wobble = 0.6 + random() * 0.9;
        rows.push(
          isStep
            ? {
                date,
                value1: Math.round((base * wobble) / 10) * 10,
                value2: random() < 0.45 ? Math.round((base * 0.4 * random()) / 10) * 10 : 0,
              }
            : {
                date,
                value1: Math.round(base * wobble * 10) / 10,
                value2: random() < 0.5 ? Math.round(base * 0.6 * random() * 10) / 10 : 0,
              },
        );
      }

      if (rows.length > 0) {
        await prisma.entry.createMany({
          data: rows.map((row) => ({ ...row, campaignId: campaign.id, userId: userIds.get(key)! })),
        });
      }
    }
  }

  const [users, campaigns, entries] = await Promise.all([
    prisma.user.count(),
    prisma.campaign.count(),
    prisma.entry.count(),
  ]);
  console.info(`Seeded ${users} users, ${campaigns} campaigns, ${entries} entries.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
