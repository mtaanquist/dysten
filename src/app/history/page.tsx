import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getHistoryList } from "@/lib/queries";
import { createTranslator } from "@/i18n/translate";
import { createFormatters } from "@/lib/format";
import { AppShell } from "@/components/layout/AppShell";
import { Pill } from "@/components/ui";
import styles from "./history.module.css";

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const campaigns = await getHistoryList();
  const t = createTranslator(user.locale);
  const format = createFormatters(user.locale);

  return (
    <AppShell user={user}>
      <div className={styles.page}>
        <h1 className={styles.title}>{t("history.title")}</h1>

        {campaigns.length === 0 ? (
          <p className={styles.empty}>{t("history.empty")}</p>
        ) : (
          <div className={styles.list}>
            {campaigns.map((campaign) => (
              <Link key={campaign.id} href={`/history/${campaign.id}`} className={styles.card}>
                <div>
                  <Pill tone="soft">{t(`campaignTypes.${campaign.type}.name` as never)}</Pill>
                  <div className={styles.name}>{campaign.name}</div>
                  <div className={styles.meta}>
                    {format.dateRange(campaign.startDate, campaign.endDate)} · {campaign.participantCount}{" "}
                    {t("campaign.participants")}
                  </div>
                </div>
                <div className={styles.winnerBlock}>
                  <div className={styles.winnerLabel}>{t("history.winner")}</div>
                  <div className={styles.winnerName}>{campaign.winnerName ?? "–"}</div>
                  <div className={styles.winnerTotal}>
                    {format.value(campaign.type, campaign.winnerTotal)}{" "}
                    {t(`campaignTypes.${campaign.type}.unit` as never)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
