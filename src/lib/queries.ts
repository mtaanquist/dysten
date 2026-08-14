import { prisma } from "@/lib/db";
import { campaignStatus, entriesEditable, scoringHorizon, type CampaignStatus } from "./campaign-status";
import { campaignType } from "./campaign-types";
import { today as currentDay, type IsoDate } from "./dates";
import {
  bestSingleDay,
  combinedTotal,
  computeStandings,
  cumulativeSeries,
  currentStreak,
  gapToNextRank,
  goalProgress,
  longestStreak,
  missingDays,
  rankMovements,
  type CumulativeSeries,
  type EntryLike,
  type ParticipantLike,
  type RankMovement,
  type Standing,
} from "./scoring";
import { addDays } from "./dates";

// Re-exported so components can type their props against the read models
// without reaching past this module into the scoring internals.
export type { CumulativeSeries, RankMovement, Standing } from "./scoring";
export type { CampaignStatus } from "./campaign-status";

/**
 * Read models for the screens.
 *
 * Pages fetch through here rather than talking to Prisma directly, so the
 * scoring rules are applied identically everywhere — a total on the dashboard
 * card and the same total on the campaign page come from one code path.
 */

const CAMPAIGN_INCLUDE = {
  participants: {
    include: { user: { select: { id: true, displayName: true, email: true } } },
    orderBy: { joinedAt: "asc" },
  },
  entries: {
    select: { userId: true, date: true, value1: true, value2: true, editedByAdmin: true },
  },
} as const;

type CampaignWithData = Awaited<
  ReturnType<typeof prisma.campaign.findFirstOrThrow<{ include: typeof CAMPAIGN_INCLUDE }>>
>;

export interface CampaignSummary {
  id: string;
  name: string;
  description: string;
  type: string;
  startDate: IsoDate;
  endDate: IsoDate;
  status: CampaignStatus;
  editable: boolean;
  /** Days left in a running campaign; days until start for an upcoming one. */
  daysRemaining: number;
  daysUntilStart: number;
  participantCount: number;
  isParticipant: boolean;

  goalName: string | null;
  goalValue: number | null;
  /** 0–1, or null when the campaign has no shared goal. */
  goalFraction: number | null;
  combined: number;

  myTotal: number;
  myRank: number | null;
  myAverage: number;
  /** Days the user actually got out — what decides the rank on a bike campaign. */
  myActiveDays: number;
  myStreak: number;
  myMissingDays: number;
  totalParticipantsRanked: number;
}

function toRoster(campaign: CampaignWithData): ParticipantLike[] {
  return campaign.participants.map((participation) => ({
    id: participation.user.id,
    displayName: participation.user.displayName,
    email: participation.user.email,
  }));
}

function toEntries(campaign: CampaignWithData): EntryLike[] {
  return campaign.entries;
}

export function buildCampaignSummary(
  campaign: CampaignWithData,
  userId: string,
  today: IsoDate = currentDay(),
): CampaignSummary {
  const roster = toRoster(campaign);
  const entries = toEntries(campaign);
  const horizon = scoringHorizon(campaign, today);
  const status = campaignStatus(campaign, today);

  const standings = computeStandings(roster, entries, horizon, campaign.type);
  const mine = standings.find((row) => row.userId === userId) ?? null;

  const participation = campaign.participants.find((p) => p.user.id === userId);
  // Count missing days from when the user actually joined — telling a late
  // joiner they have missed three weeks would be both wrong and discouraging.
  const joinedOn = participation ? participation.joinedAt.toISOString().slice(0, 10) : campaign.startDate;
  const missingFrom = joinedOn > campaign.startDate ? joinedOn : campaign.startDate;

  const combined = combinedTotal(standings, campaign.type);
  const totalDays = Math.max(0, dayCount(campaign.startDate, campaign.endDate));
  const elapsedDays = status === "upcoming" ? 0 : Math.max(0, dayCount(campaign.startDate, horizon));

  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    type: campaign.type,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    status,
    editable: entriesEditable(campaign, today),
    daysRemaining: Math.max(0, totalDays - elapsedDays),
    daysUntilStart: Math.max(0, dayCount(today, campaign.startDate)),
    participantCount: campaign.participants.length,
    isParticipant: Boolean(participation),

    goalName: campaign.goalName,
    goalValue: campaign.goalValue,
    goalFraction: goalProgress(combined, campaign.goalValue),
    combined,

    myTotal: mine?.total ?? 0,
    myRank: mine && mine.daysLogged > 0 ? mine.rank : null,
    myAverage: mine?.average ?? 0,
    myActiveDays: mine?.activeDays ?? 0,
    myStreak: participation ? currentStreak(entries, userId, horizon) : 0,
    myMissingDays:
      participation && status !== "upcoming"
        ? missingDays(entries, userId, missingFrom, horizon).length
        : 0,
    totalParticipantsRanked: standings.length,
  };
}

function dayCount(from: IsoDate, to: IsoDate): number {
  if (to < from) return 0;
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1,
  );
}

// ---- Dashboard -------------------------------------------------------------

export interface DashboardData {
  mine: CampaignSummary[];
  openToJoin: CampaignSummary[];
  past: PastCampaignRow[];
  pastPageCount: number;
  pastPage: number;
}

export interface PastCampaignRow {
  id: string;
  name: string;
  type: string;
  startDate: IsoDate;
  endDate: IsoDate;
  winnerName: string | null;
  /** The winner's ranking figure — steps, or days out on a bike campaign. */
  winnerScore: number;
  myRank: number | null;
  participantCount: number;
}

export const PAST_PER_PAGE = 3;

export async function getDashboardData(userId: string, pastPage = 0): Promise<DashboardData> {
  const today = currentDay();
  const campaigns = await prisma.campaign.findMany({
    include: CAMPAIGN_INCLUDE,
    orderBy: { startDate: "asc" },
  });

  const live = campaigns.filter((campaign) => campaignStatus(campaign, today) !== "ended");
  const ended = campaigns
    .filter((campaign) => campaignStatus(campaign, today) === "ended")
    .sort((a, b) => b.endDate.localeCompare(a.endDate));

  const summaries = live.map((campaign) => buildCampaignSummary(campaign, userId, today));

  const pastPageCount = Math.max(1, Math.ceil(ended.length / PAST_PER_PAGE));
  const page = Math.min(Math.max(0, pastPage), pastPageCount - 1);

  const past = ended.slice(page * PAST_PER_PAGE, page * PAST_PER_PAGE + PAST_PER_PAGE).map((campaign) => {
    const standings = computeStandings(
      toRoster(campaign),
      toEntries(campaign),
      campaign.endDate,
      campaign.type,
    );
    const mine = standings.find((row) => row.userId === userId);
    const winner = standings[0];

    return {
      id: campaign.id,
      name: campaign.name,
      type: campaign.type,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      winnerName: winner?.displayName ?? null,
      winnerScore: winner?.score ?? 0,
      myRank: mine && mine.daysLogged > 0 ? mine.rank : null,
      participantCount: campaign.participants.length,
    } satisfies PastCampaignRow;
  });

  return {
    mine: summaries.filter((summary) => summary.isParticipant),
    openToJoin: summaries.filter((summary) => !summary.isParticipant),
    past,
    pastPageCount,
    pastPage: page,
  };
}

// ---- Campaign detail -------------------------------------------------------

export interface LeaderboardRow extends Standing {
  email?: string;
  movement: RankMovement;
  streak: number;
  /** Share of the leader's ranking score, for the inline bar. */
  barFraction: number;
  isMe: boolean;
}

export interface HighlightItem {
  key: "bestDay" | "longestStreak" | "biggestClimber";
  value: number | null;
  /** Rendered by the component; the raw parts stay separate for formatting. */
  who: string;
  date?: IsoDate;
  unitless?: boolean;
}

export interface CampaignDetail {
  summary: CampaignSummary;
  /** Everyone on the campaign, ranked — people who have logged nothing included. */
  standings: LeaderboardRow[];
  series: CumulativeSeries[];
  highlights: HighlightItem[];
  gap: { amount: number; rank: number } | null;
  /** The signed-in user's entries, keyed by day, for the calendar. */
  myEntries: Record<IsoDate, { value1: number; value2: number; editedByAdmin: boolean }>;
  horizon: IsoDate;
}

export async function getCampaignDetail(
  campaignId: string,
  userId: string,
): Promise<CampaignDetail | null> {
  const today = currentDay();
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: CAMPAIGN_INCLUDE,
  });
  if (!campaign) return null;

  const roster = toRoster(campaign);
  const entries = toEntries(campaign);
  const horizon = scoringHorizon(campaign, today);
  const summary = buildCampaignSummary(campaign, userId, today);

  const standings = computeStandings(roster, entries, horizon, campaign.type);
  // "Since yesterday" — the previous day's standings give the movement arrows.
  const yesterday = computeStandings(roster, entries, addDays(horizon, -1), campaign.type);
  const movements = rankMovements(standings, yesterday);

  // The bar shows share of the leader on whatever the campaign ranks by, so it
  // always agrees with the order the rows are in.
  const leaderScore = standings[0]?.score ?? 0;
  const emails = new Map(roster.map((p) => [p.id, p.email ?? ""]));

  const leaderboard: LeaderboardRow[] = standings.map((row) => ({
    ...row,
    email: emails.get(row.userId),
    movement: movements.get(row.userId) ?? { delta: 0, direction: "none" },
    streak: currentStreak(entries, row.userId, horizon),
    barFraction: leaderScore > 0 ? Math.max(0.04, row.score / leaderScore) : 0.04,
    isMe: row.userId === userId,
  }));

  const best = bestSingleDay(entries, roster, horizon, campaign.type);
  const longest = roster
    .map((participant) => ({
      participant,
      days: longestStreak(entries, participant.id, campaign.startDate, horizon),
    }))
    .sort((a, b) => b.days - a.days)[0];

  // A week back, for the biggest-climber highlight.
  const weekAgo = computeStandings(roster, entries, addDays(horizon, -7), campaign.type);
  const weekMovements = rankMovements(standings, weekAgo);
  const climber = [...standings]
    .map((row) => ({ row, delta: weekMovements.get(row.userId)?.delta ?? 0 }))
    .sort((a, b) => b.delta - a.delta)[0];

  const highlights: HighlightItem[] = [
    { key: "bestDay", value: best?.total ?? null, who: best?.displayName ?? "", date: best?.date },
    {
      key: "longestStreak",
      value: longest?.days ?? null,
      who: longest?.participant.displayName ?? "",
      unitless: true,
    },
    {
      key: "biggestClimber",
      value: climber && climber.delta > 0 ? climber.delta : null,
      who: climber?.row.displayName ?? "",
      unitless: true,
    },
  ];

  const myEntries: CampaignDetail["myEntries"] = {};
  for (const entry of entries) {
    if (entry.userId !== userId) continue;
    myEntries[entry.date] = {
      value1: entry.value1,
      value2: entry.value2,
      editedByAdmin: Boolean(entry.editedByAdmin),
    };
  }

  return {
    summary,
    standings: leaderboard,
    series: cumulativeSeries(standings, entries, campaign.startDate, horizon, campaign.type),
    highlights,
    gap: gapToNextRank(standings, userId, campaign.type),
    myEntries,
    horizon,
  };
}

/** The campaign a bare /campaigns visit should land on. */
export async function getDefaultCampaignId(userId: string): Promise<string | null> {
  const today = currentDay();
  const campaigns = await prisma.campaign.findMany({
    select: { id: true, startDate: true, endDate: true, closedEarlyAt: true, reopenedForCorrections: true, participants: { where: { userId }, select: { id: true } } },
    orderBy: { startDate: "asc" },
  });

  const active = campaigns.filter((campaign) => campaignStatus(campaign, today) === "active");
  return (
    active.find((campaign) => campaign.participants.length > 0)?.id ?? active[0]?.id ?? campaigns[0]?.id ?? null
  );
}

/** Active campaigns, for the campaign page's switcher pills. */
export async function getCampaignSwitcher(): Promise<{ id: string; name: string }[]> {
  const today = currentDay();
  const campaigns = await prisma.campaign.findMany({
    select: { id: true, name: true, startDate: true, endDate: true, closedEarlyAt: true, reopenedForCorrections: true },
    orderBy: { startDate: "asc" },
  });
  return campaigns
    .filter((campaign) => campaignStatus(campaign, today) === "active")
    .map(({ id, name }) => ({ id, name }));
}

// ---- Person day-by-day -----------------------------------------------------

export interface PersonDetail {
  userId: string;
  displayName: string;
  email: string;
  campaignId: string;
  campaignName: string;
  campaignType: string;
  campaignStart: IsoDate;
  campaignEnd: IsoDate;
  /**
   * Whether this campaign accepts writes at all right now — active, or ended
   * and reopened for corrections. Answered here rather than at each call site
   * so the campaign page and the history page cannot drift apart.
   */
  editable: boolean;
  total: number;
  rows: { date: IsoDate; value1: number; value2: number; total: number; editedByAdmin: boolean }[];
}

export async function getPersonDetail(
  campaignId: string,
  personId: string,
): Promise<PersonDetail | null> {
  const [campaign, person] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        name: true,
        type: true,
        startDate: true,
        endDate: true,
        closedEarlyAt: true,
        reopenedForCorrections: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: personId },
      select: { id: true, displayName: true, email: true },
    }),
  ]);
  if (!campaign || !person) return null;

  const entries = await prisma.entry.findMany({
    where: { campaignId, userId: personId },
    orderBy: { date: "asc" },
    select: { date: true, value1: true, value2: true, editedByAdmin: true },
  });

  const { decimals } = campaignType(campaign.type);
  const factor = 10 ** decimals;
  const round = (value: number) => Math.round(value * factor) / factor;

  return {
    userId: person.id,
    displayName: person.displayName,
    email: person.email,
    campaignId: campaign.id,
    campaignName: campaign.name,
    campaignType: campaign.type,
    campaignStart: campaign.startDate,
    campaignEnd: campaign.endDate,
    editable: entriesEditable(campaign),
    total: round(entries.reduce((sum, entry) => sum + entry.value1 + entry.value2, 0)),
    rows: entries.map((entry) => ({
      date: entry.date,
      value1: entry.value1,
      value2: entry.value2,
      total: round(entry.value1 + entry.value2),
      editedByAdmin: entry.editedByAdmin,
    })),
  };
}

// ---- History ---------------------------------------------------------------

export interface HistoryRow {
  id: string;
  name: string;
  type: string;
  startDate: IsoDate;
  endDate: IsoDate;
  participantCount: number;
  winnerName: string | null;
  /** The winner's ranking figure — steps, or days out on a bike campaign. */
  winnerScore: number;
}

export async function getHistoryList(): Promise<HistoryRow[]> {
  const today = currentDay();
  const campaigns = await prisma.campaign.findMany({
    include: CAMPAIGN_INCLUDE,
    orderBy: { endDate: "desc" },
  });

  return campaigns
    .filter((campaign) => campaignStatus(campaign, today) === "ended")
    .map((campaign) => {
      const standings = computeStandings(
        toRoster(campaign),
        toEntries(campaign),
        campaign.endDate,
        campaign.type,
      );
      const winner = standings[0];
      return {
        id: campaign.id,
        name: campaign.name,
        type: campaign.type,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        participantCount: campaign.participants.length,
        winnerName: winner?.displayName ?? null,
        winnerScore: winner?.score ?? 0,
      };
    });
}

export interface HistoryDetail {
  id: string;
  name: string;
  description: string;
  type: string;
  startDate: IsoDate;
  endDate: IsoDate;
  reopenedForCorrections: boolean;
  winnerName: string | null;
  /** The winner's ranking figure — steps, or days out on a bike campaign. */
  winnerScore: number;
  standings: Standing[];
  roster: { id: string; displayName: string }[];
}

export async function getHistoryDetail(campaignId: string): Promise<HistoryDetail | null> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: CAMPAIGN_INCLUDE,
  });
  if (!campaign) return null;

  // Frozen at the end date: a finished campaign's standings must never move.
  const standings = computeStandings(
    toRoster(campaign),
    toEntries(campaign),
    campaign.endDate,
    campaign.type,
  );

  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    type: campaign.type,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    reopenedForCorrections: campaign.reopenedForCorrections,
    winnerName: standings[0]?.displayName ?? null,
    winnerScore: standings[0]?.score ?? 0,
    standings,
    roster: campaign.participants.map((participation) => ({
      id: participation.user.id,
      displayName: participation.user.displayName,
    })),
  };
}

// ---- Management ------------------------------------------------------------

export interface ManagementData {
  campaigns: {
    id: string;
    name: string;
    type: string;
    startDate: IsoDate;
    endDate: IsoDate;
    status: CampaignStatus;
    participantCount: number;
  }[];
  users: { id: string; displayName: string; email: string; role: string; active: boolean }[];
  roster: {
    campaignId: string;
    campaignName: string;
    members: { id: string; displayName: string }[];
    candidates: { id: string; displayName: string }[];
  } | null;
}

export async function getManagementData(rosterCampaignId?: string): Promise<ManagementData> {
  const today = currentDay();
  const [campaigns, users] = await Promise.all([
    prisma.campaign.findMany({
      orderBy: { startDate: "desc" },
      include: { _count: { select: { participants: true } } },
    }),
    prisma.user.findMany({ orderBy: { displayName: "asc" } }),
  ]);

  const rosterId = rosterCampaignId ?? campaigns.find((c) => campaignStatus(c, today) === "active")?.id ?? campaigns[0]?.id;

  let roster: ManagementData["roster"] = null;
  if (rosterId) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: rosterId },
      include: { participants: { include: { user: { select: { id: true, displayName: true } } } } },
    });
    if (campaign) {
      const memberIds = new Set(campaign.participants.map((p) => p.user.id));
      roster = {
        campaignId: campaign.id,
        campaignName: campaign.name,
        members: campaign.participants.map((p) => ({
          id: p.user.id,
          displayName: p.user.displayName,
        })),
        // People who have left stay on the rosters they were already on —
        // history keeps them — but are not offered for new ones.
        candidates: users
          .filter((user) => !memberIds.has(user.id) && !user.deactivatedAt)
          .map((user) => ({ id: user.id, displayName: user.displayName })),
      };
    }
  }

  return {
    campaigns: campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      type: campaign.type,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      status: campaignStatus(campaign, today),
      participantCount: campaign._count.participants,
    })),
    users: users.map((user) => ({
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      active: !user.deactivatedAt,
    })),
    roster,
  };
}
