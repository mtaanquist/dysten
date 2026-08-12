import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canAssignRoles, canDeleteCampaign, canManageCampaigns } from "@/lib/permissions";
import { getManagementData } from "@/lib/queries";
import { createTranslator } from "@/i18n/translate";
import {
  CampaignAdminList,
  CampaignForm,
  RoleTable,
  RosterManager,
} from "@/components/manage/ManagementPanels";
import { AppShell } from "@/components/layout/AppShell";
import styles from "./manage.module.css";

export default async function ManagePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; roster?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  // Captains and admins only — and this reads effectiveRole, so an admin
  // previewing as a member is bounced too, exactly as a member would be.
  if (!canManageCampaigns(user)) redirect("/");

  const { edit, roster } = await searchParams;
  const data = await getManagementData(roster);
  const t = createTranslator(user.locale);

  const editing = edit
    ? await prisma.campaign.findUnique({
        where: { id: edit },
        select: {
          id: true,
          name: true,
          type: true,
          startDate: true,
          endDate: true,
          description: true,
          goalValue: true,
          goalName: true,
        },
      })
    : null;

  return (
    <AppShell user={user}>
      <div className={styles.page}>
        <h1 className={styles.title}>{t("manage.title")}</h1>
        <p className={styles.subtitle}>{t("manage.captainOnly")}</p>

        <div className={styles.columns}>
          <CampaignForm
            editing={
              editing
                ? {
                    id: editing.id,
                    name: editing.name,
                    type: editing.type,
                    startDate: editing.startDate,
                    endDate: editing.endDate,
                    description: editing.description,
                    goalValue: editing.goalValue === null ? "" : String(editing.goalValue),
                    goalName: editing.goalName ?? "",
                  }
                : null
            }
          />

          <div className={styles.sideStack}>
            <CampaignAdminList campaigns={data.campaigns} canDelete={canDeleteCampaign(user)} />
            {data.roster ? <RosterManager roster={data.roster} /> : null}
            {canAssignRoles(user) ? <RoleTable users={data.users} /> : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
