import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/queries";
import { createTranslator } from "@/i18n/translate";
import { AppShell } from "@/components/layout/AppShell";
import { ProfileBar } from "@/components/dashboard/ProfileBar";
import { CampaignCard } from "@/components/campaign/CampaignCard";
import { OpenCampaignCard } from "@/components/dashboard/OpenCampaignCard";
import { PreviousCampaigns } from "@/components/dashboard/PreviousCampaigns";
import styles from "./dashboard.module.css";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ past?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const { past } = await searchParams;
  const pastPage = Number.parseInt(past ?? "0", 10);
  const data = await getDashboardData(user.id, Number.isFinite(pastPage) ? pastPage : 0);
  const t = createTranslator(user.locale);

  return (
    <AppShell user={user}>
      <div className={styles.page}>
        <ProfileBar
          displayName={user.displayName}
          email={user.email}
          role={user.role}
          effectiveRole={user.effectiveRole}
          remindersEnabled={user.remindersEnabled}
        />

        <section>
          <h2 className={styles.sectionLabel}>{t("dashboard.yourCampaigns")}</h2>
          {data.mine.length > 0 ? (
            <div className={styles.cardStack}>
              {data.mine.map((summary) => (
                <CampaignCard key={summary.id} summary={summary} />
              ))}
            </div>
          ) : (
            <p className={styles.empty}>
              {t("dashboard.noCampaigns")} {t("dashboard.noCampaignsHint")}
            </p>
          )}
        </section>

        {data.openToJoin.length > 0 ? (
          <section className={styles.section}>
            <h2 className={styles.sectionLabel}>{t("dashboard.otherCampaigns")}</h2>
            <div className={styles.openGrid}>
              {data.openToJoin.map((summary) => (
                <OpenCampaignCard key={summary.id} summary={summary} />
              ))}
            </div>
          </section>
        ) : null}

        {data.past.length > 0 ? (
          <PreviousCampaigns rows={data.past} page={data.pastPage} pageCount={data.pastPageCount} />
        ) : null}
      </div>
    </AppShell>
  );
}
