import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getHistoryDetail, getPersonDetail } from "@/lib/queries";
import { canAdminister, canReopenCampaign } from "@/lib/permissions";
import { accentStyle, ranksByActiveDays } from "@/lib/campaign-types";
import { today } from "@/lib/dates";
import { createTranslator } from "@/i18n/translate";
import { createFormatters } from "@/lib/format";
import { AppShell } from "@/components/layout/AppShell";
import { Avatar, Panel, PanelTitle, Pill } from "@/components/ui";
import { PersonDrawer } from "@/components/campaign/PersonDrawer";
import { ReopenButton } from "@/components/history/ReopenButton";
import styles from "../history.module.css";

export default async function HistoryDetailPage({
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

  const detail = await getHistoryDetail(id);
  if (!detail) notFound();

  const t = createTranslator(user.locale);
  const format = createFormatters(user.locale);
  const unit = t(`campaignTypes.${detail.type}.unit` as never);
  const byDays = ranksByActiveDays(detail.type);

  const personDetail = person ? await getPersonDetail(id, person) : null;

  return (
    <AppShell user={user}>
      <div className={styles.page}>
        <Link href="/history" className={`textLink ${styles.back}`}>
          ← {t("history.backToHistory")}
        </Link>

        <Panel className={styles.detailHeader}>
          <Pill tone="type" style={accentStyle(detail.type)}>
            {t(`campaignTypes.${detail.type}.name` as never)}
          </Pill>
          <h1 className={styles.detailTitle}>{detail.name}</h1>
          <div className={styles.meta}>{format.dateRange(detail.startDate, detail.endDate)}</div>

          <div className={styles.winnerBanner}>
            <div className={styles.winnerLabel}>{t("history.winner")}</div>
            <div className={styles.winnerBig}>{detail.winnerName ?? "–"}</div>
            <div className={styles.winnerBigTotal}>
              {byDays
                ? t("campaign.daysOutCount", { count: detail.winnerScore })
                : `${format.value(detail.type, detail.winnerScore)} ${unit}`}
            </div>

            {canReopenCampaign(user) ? (
              <div className={styles.reopenSlot}>
                <ReopenButton campaignId={detail.id} alreadyReopened={detail.reopenedForCorrections} />
              </div>
            ) : null}
          </div>
        </Panel>

        <div className={styles.detailColumns}>
          <Panel>
            <PanelTitle>{t("history.finalStandings")}</PanelTitle>
            <div className={styles.scroller}>
              <div className={styles.standings}>
                <div className={styles.standingsHead}>
                  <div>{t("campaign.rank")}</div>
                  <div>{t("campaign.name")}</div>
                  <div className={styles.right}>
                    {byDays ? t("campaign.daysOut") : t("campaign.total")}
                  </div>
                  <div className={styles.right}>{t("campaign.averagePerDay")}</div>
                </div>

                {detail.standings.map((row) => (
                  <Link
                    key={row.userId}
                    href={`/history/${id}?person=${row.userId}`}
                    scroll={false}
                    className={`${styles.standingsRow} ${row.rank === 1 ? styles.winnerRow : ""}`}
                  >
                    <div className={styles.rank}>{row.rank}</div>
                    <div className={styles.person}>
                      <Avatar name={row.displayName} />
                      <span className={styles.personName}>{row.displayName}</span>
                    </div>
                    <div className={styles.right}>
                      <div className={styles.total}>
                        {byDays ? row.activeDays : format.value(detail.type, row.total)}
                      </div>
                      <div className={styles.split}>
                        {byDays
                          ? `${format.value(detail.type, row.total)} ${unit}`
                          : `${format.value(detail.type, row.value1)} + ${format.value(detail.type, row.value2)}`}
                      </div>
                    </div>
                    <div className={`${styles.right} ${styles.average}`}>
                      {format.value(detail.type, row.average)}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelTitle>{t("history.roster")}</PanelTitle>
            <div className={styles.roster}>
              {detail.roster.map((participant) => (
                <span key={participant.id} className={styles.rosterChip}>
                  <Avatar name={participant.displayName} size="sm" />
                  <span className={styles.rosterName}>{participant.displayName}</span>
                </span>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* This is where reopening a campaign pays off: a finished campaign that
          an admin has reopened is editable again, and the drawer is the surface
          for it. `editable` is decided by the query, so this page and the
          campaign page cannot disagree about what "reopened" means. */}
      {personDetail ? (
        <PersonDrawer
          detail={personDetail}
          closeHref={`/history/${id}`}
          canCorrect={canAdminister(user)}
          today={today()}
        />
      ) : null}
    </AppShell>
  );
}
