import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canAdminister } from "@/lib/permissions";
import { accentStyle } from "@/lib/campaign-types";
import { getCampaignDetail, getCampaignSwitcher, getPersonDetail } from "@/lib/queries";
import { today } from "@/lib/dates";
import { createTranslator } from "@/i18n/translate";
import { createFormatters } from "@/lib/format";
import { AppShell } from "@/components/layout/AppShell";
import { Panel, PanelTitle, Pill } from "@/components/ui";
import { EntryCalendar } from "@/components/campaign/EntryCalendar";
import { DayEntry } from "@/components/campaign/DayEntry";
import { Leaderboard } from "@/components/campaign/Leaderboard";
import { PersonDrawer } from "@/components/campaign/PersonDrawer";
import { GoalPanel, Highlights, ProgressChart } from "@/components/campaign/panels";
import styles from "../campaign.module.css";

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ person?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const { id } = await params;
  const { person } = await searchParams;

  const [detail, switcher] = await Promise.all([
    getCampaignDetail(id, user.id),
    getCampaignSwitcher(),
  ]);
  if (!detail) notFound();

  const t = createTranslator(user.locale);
  const format = createFormatters(user.locale);
  const { summary } = detail;

  const personDetail = person ? await getPersonDetail(id, person) : null;

  return (
    <AppShell user={user}>
      <div className={styles.page}>
        {switcher.length > 1 ? (
          <nav className={styles.switcher} aria-label={t("nav.campaign")}>
            {switcher.map((option) => (
              <Link
                key={option.id}
                href={`/campaigns/${option.id}`}
                className={`${styles.switch} ${option.id === id ? styles.switchActive : ""}`}
                aria-current={option.id === id ? "page" : undefined}
              >
                {option.name}
              </Link>
            ))}
          </nav>
        ) : null}

        <header className={styles.header}>
          <div>
            <Pill tone="type" style={accentStyle(summary.type)}>
              {t(`campaignTypes.${summary.type}.name` as never)}
            </Pill>
            <h1 className={styles.title}>{summary.name}</h1>
            <div className={styles.range}>{format.dateRange(summary.startDate, summary.endDate)}</div>
          </div>
          <div className={styles.countdown}>
            {summary.status === "ended" ? (
              <div className={styles.endedLabel}>{t("campaign.ended")}</div>
            ) : (
              <>
                <div className={styles.countdownNumber}>
                  {summary.status === "upcoming" ? summary.daysUntilStart : summary.daysRemaining}
                </div>
                <div className={styles.countdownLabel}>
                  {summary.status === "upcoming"
                    ? t("campaign.untilStart", { count: summary.daysUntilStart })
                    : t("campaign.daysRemaining", { count: summary.daysRemaining })}
                </div>
              </>
            )}
          </div>
        </header>

        <div className={styles.goalSlot}>
          <GoalPanel summary={summary} />
        </div>

        <Panel className={styles.entries}>
          {/* Just the title. The campaign name is in the header a screen-length
              above, and the two field names are on the fields themselves — the
              subtitle said both again on the way past. */}
          <PanelTitle>{t("campaign.myEntries")}</PanelTitle>

          {summary.isParticipant ? (
            /* Two controls over the same data, one visible per viewport: the
               month grid at desk widths, the day-at-a-time form on a phone. */
            <>
              <EntryCalendar
                campaignId={summary.id}
                type={summary.type}
                startDate={summary.startDate}
                endDate={summary.endDate}
                today={today()}
                status={summary.status}
                editable={summary.editable}
                entries={detail.myEntries}
              />
              <DayEntry
                campaignId={summary.id}
                type={summary.type}
                startDate={summary.startDate}
                endDate={summary.endDate}
                today={today()}
                status={summary.status}
                editable={summary.editable}
                entries={detail.myEntries}
              />
            </>
          ) : (
            <p className={styles.notMember}>{t("campaign.notParticipating")}</p>
          )}
        </Panel>

        <div className={styles.highlightSlot}>
          <Highlights items={detail.highlights} type={summary.type} />
        </div>

        <div className={styles.columns}>
          <Panel>
            <div className={styles.leaderboardHead}>
              <PanelTitle>{t("campaign.leaderboard")}</PanelTitle>
              <span className={styles.leaderboardHint}>{t("campaign.dayByDay")} →</span>
            </div>
            <Leaderboard
              rows={detail.standings}
              type={summary.type}
              gap={detail.gap}
              basePath={`/campaigns/${id}`}
            />
          </Panel>

          {/* No separate roster panel: the leaderboard already lists everyone
              on the campaign, people who have logged nothing included, so a
              participant list beside it was the same names twice. */}
          <div className={styles.sideStack}>
            <ProgressChart series={detail.series} type={summary.type} />
          </div>
        </div>
      </div>

      {personDetail ? (
        <PersonDrawer
          detail={personDetail}
          closeHref={`/campaigns/${id}`}
          canCorrect={canAdminister(user)}
          today={today()}
        />
      ) : null}
    </AppShell>
  );
}
