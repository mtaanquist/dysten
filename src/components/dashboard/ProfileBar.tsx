"use client";

import { useTransition } from "react";
import { Role } from "@prisma/client";
import { useTranslator } from "@/i18n/provider";
import { setViewRole, toggleReminders } from "@/app/actions/session";
import { useToast } from "@/components/ui/Toast";
import styles from "./ProfileBar.module.css";

/**
 * The dashboard's greeting row.
 *
 * The reminder opt-in is a bell / crossed-bell toggle sitting next to the
 * e-mail address, which is where the design moved it from a checkbox row.
 * "View as" only appears for captains and admins, and only ever lets them
 * preview a *lesser* role.
 */
export function ProfileBar({
  displayName,
  email,
  role,
  effectiveRole,
  remindersEnabled,
}: {
  displayName: string;
  email: string;
  role: Role;
  effectiveRole: Role;
  remindersEnabled: boolean;
}) {
  const t = useTranslator();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();

  const roleKey =
    effectiveRole === Role.ADMIN ? "roles.admin" : effectiveRole === Role.CAPTAIN ? "roles.captain" : "roles.member";

  const reminderLabel = remindersEnabled ? t("profile.remindersOn") : t("profile.remindersOff");

  // Only a captain or admin has anything to preview.
  const canPreview = role !== Role.MEMBER;

  return (
    <div className={styles.bar}>
      <div>
        <div className={styles.greeting}>{t("dashboard.greeting")}</div>
        <h1 className={styles.name}>{displayName}</h1>
        <div className={styles.identity}>
          <span className={styles.email}>
            {email} · {t(roleKey)}
          </span>
          <button
            type="button"
            className={`${styles.bell} ${remindersEnabled ? styles.bellOn : styles.bellOff}`}
            title={reminderLabel}
            aria-label={reminderLabel}
            aria-pressed={remindersEnabled}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await toggleReminders();
                showToast(remindersEnabled ? "toast.remindersOff" : "toast.remindersOn");
              })
            }
          >
            <BellIcon crossed={!remindersEnabled} />
          </button>
        </div>
      </div>

      {canPreview ? (
        <label className={styles.viewAs}>
          <span className={styles.viewAsLabel}>{t("profile.viewAs")}</span>
          <select
            className={styles.viewAsSelect}
            value={effectiveRole}
            disabled={pending}
            onChange={(event) => {
              const next = event.target.value;
              startTransition(() => {
                void setViewRole(next);
              });
            }}
          >
            <option value={Role.MEMBER}>{t("roles.member")}</option>
            <option value={Role.CAPTAIN}>{t("roles.captain")}</option>
            {role === Role.ADMIN ? <option value={Role.ADMIN}>{t("roles.admin")}</option> : null}
          </select>
        </label>
      ) : null}
    </div>
  );
}

function BellIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      {crossed ? <line x1="3" y1="3" x2="21" y2="21" /> : null}
    </svg>
  );
}
