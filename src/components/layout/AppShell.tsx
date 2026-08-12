import type { ReactNode } from "react";
import { Role } from "@prisma/client";
import { atLeast } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth/types";
import { Blobs } from "@/components/ui";
import { ORG_NAME } from "@/lib/branding";
import { Header } from "./Header";
import styles from "./AppShell.module.css";

/**
 * The signed-in frame: decorative blobs, the blue header, and a centred
 * content column. Every authenticated page renders inside one of these, which
 * is what gives History and Management the same side margins as the dashboard.
 */
export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  return (
    <div className={styles.root}>
      <Blobs />
      <div className={styles.stack}>
        <Header
          orgName={ORG_NAME}
          displayName={user.displayName}
          email={user.email}
          canManage={atLeast(user.effectiveRole, Role.CAPTAIN)}
        />
        <main className={styles.container}>{children}</main>
      </div>
    </div>
  );
}
