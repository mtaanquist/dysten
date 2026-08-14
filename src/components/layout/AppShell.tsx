import type { ReactNode } from "react";
import { Role } from "@prisma/client";
import { atLeast } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth/types";
import { Blobs } from "@/components/ui";
import { BRAND_NAME, ORG_NAME } from "@/lib/branding";
import { getDefaultCampaignId } from "@/lib/queries";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import styles from "./AppShell.module.css";

/**
 * The signed-in frame: decorative blobs, the blue header, and a centred
 * content column. Every authenticated page renders inside one of these, which
 * is what gives History and Management the same side margins as the dashboard.
 */
export async function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  // Resolved here so the header's "Campaign" link points at a real campaign.
  // Left as /campaigns only when there is none to point at, in which case that
  // route's redirect sends you back to the dashboard.
  const defaultCampaignId = await getDefaultCampaignId(user.id);
  const campaignHref = defaultCampaignId ? `/campaigns/${defaultCampaignId}` : "/campaigns";
  const canManage = atLeast(user.role, Role.CAPTAIN);

  return (
    <div className={styles.root}>
      <Blobs />
      <div className={styles.stack}>
        <Header
          orgName={ORG_NAME}
          brandName={BRAND_NAME}
          displayName={user.displayName}
          email={user.email}
          canManage={canManage}
          theme={user.theme}
          campaignHref={campaignHref}
        />
        <main className={styles.container}>{children}</main>
        {/* Phones only — hidden in CSS above 640px. */}
        <BottomNav canManage={canManage} campaignHref={campaignHref} />
      </div>
    </div>
  );
}
