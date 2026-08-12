"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Role } from "@prisma/client";
import { useFormatters, useTranslator } from "@/i18n/provider";
import { CAMPAIGN_TYPE_KEYS } from "@/lib/campaign-types";
import type { ManagementData } from "@/lib/queries";
import {
  addParticipant,
  closeCampaign,
  deleteCampaign,
  removeParticipant,
  saveCampaign,
  setUserRole,
} from "@/app/actions/campaigns";
import { Avatar, Panel, PanelTitle } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import styles from "./manage.module.css";

interface DraftState {
  id?: string;
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  description: string;
  goalValue: string;
  goalName: string;
}

const EMPTY_DRAFT: DraftState = {
  name: "",
  type: "step",
  startDate: "",
  endDate: "",
  description: "",
  goalValue: "",
  goalName: "",
};

/** Create / edit form. Editing is driven by `?edit=<id>` so it survives a reload. */
export function CampaignForm({
  editing,
}: {
  editing: (DraftState & { id: string }) | null;
}) {
  const t = useTranslator();
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  // The caller keys this component on the campaign being edited, so switching
  // campaigns remounts the form and this initial value is re-read. No effect
  // needs to copy the prop into state afterwards.
  const [draft, setDraft] = useState<DraftState>(editing ?? EMPTY_DRAFT);

  const update = (field: keyof DraftState) => (value: string) =>
    setDraft((previous) => ({ ...previous, [field]: value }));

  return (
    <Panel>
      <PanelTitle>{editing ? t("manage.editCampaign") : t("manage.createCampaign")}</PanelTitle>

      <form
        className={styles.form}
        action={() =>
          startTransition(async () => {
            const result = await saveCampaign({
              id: draft.id,
              name: draft.name,
              type: draft.type,
              startDate: draft.startDate,
              endDate: draft.endDate,
              description: draft.description,
              goalValue: draft.goalValue,
              goalName: draft.goalName,
            });
            if (result.ok) {
              showToast(draft.id ? "toast.campaignUpdated" : "toast.campaignCreated");
              setDraft(EMPTY_DRAFT);
              router.push("/manage");
            } else {
              showToast(result.error);
            }
          })
        }
      >
        <Field label={t("manage.campaignName")}>
          <input
            className={styles.input}
            value={draft.name}
            placeholder={t("manage.campaignNamePlaceholder")}
            onChange={(event) => update("name")(event.target.value)}
            required
          />
        </Field>

        <Field label={t("manage.type")}>
          <select
            className={styles.input}
            value={draft.type}
            onChange={(event) => update("type")(event.target.value)}
          >
            {CAMPAIGN_TYPE_KEYS.map((key) => (
              <option key={key} value={key}>
                {t(`campaignTypes.${key}.name` as never)}
              </option>
            ))}
          </select>
        </Field>

        <div className={styles.dateRow}>
          <Field label={t("manage.startDate")}>
            <input
              className={styles.input}
              type="date"
              value={draft.startDate}
              onChange={(event) => update("startDate")(event.target.value)}
              required
            />
          </Field>
          <Field label={t("manage.endDate")}>
            <input
              className={styles.input}
              type="date"
              value={draft.endDate}
              min={draft.startDate || undefined}
              onChange={(event) => update("endDate")(event.target.value)}
              required
            />
          </Field>
        </div>

        <Field label={t("manage.description")}>
          <textarea
            className={styles.textarea}
            rows={3}
            value={draft.description}
            onChange={(event) => update("description")(event.target.value)}
          />
        </Field>

        <div className={styles.dateRow}>
          <Field label={t("manage.sharedGoalValue")}>
            <input
              className={styles.input}
              type="number"
              min={0}
              inputMode="decimal"
              value={draft.goalValue}
              placeholder="1200000"
              onChange={(event) => update("goalValue")(event.target.value)}
            />
          </Field>
          <Field label={t("manage.sharedGoalName")}>
            <input
              className={styles.input}
              value={draft.goalName}
              placeholder={t("manage.sharedGoalNamePlaceholder")}
              onChange={(event) => update("goalName")(event.target.value)}
            />
          </Field>
        </div>

        <div className={styles.formActions}>
          <button type="submit" className={styles.primary} disabled={pending}>
            {t("common.save")}
          </button>
          {editing ? (
            <Link href="/manage" className={styles.ghost}>
              {t("common.cancel")}
            </Link>
          ) : null}
        </div>
      </form>
    </Panel>
  );
}

/** All campaigns with their management actions. */
export function CampaignAdminList({
  campaigns,
  canDelete,
}: {
  campaigns: ManagementData["campaigns"];
  canDelete: boolean;
}) {
  const t = useTranslator();
  const format = useFormatters();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <Panel>
      <PanelTitle>{t("manage.campaigns")}</PanelTitle>
      <div className={styles.campaignList}>
        {campaigns.map((campaign) => (
          <div key={campaign.id} className={styles.campaignRow}>
            <div className={styles.campaignHead}>
              <span
                className={`${styles.statusDot} ${
                  campaign.status === "active"
                    ? styles.statusActive
                    : campaign.status === "upcoming"
                      ? styles.statusUpcoming
                      : styles.statusEnded
                }`}
                aria-hidden="true"
              />
              <span className={styles.campaignName}>{campaign.name}</span>
            </div>
            <div className={styles.campaignType}>{t(`campaignTypes.${campaign.type}.name` as never)}</div>
            <div className={styles.campaignMeta}>
              {format.dateRange(campaign.startDate, campaign.endDate)} ·{" "}
              {t("campaign.participantCount", { count: campaign.participantCount })}
            </div>

            <div className={styles.campaignActions}>
              <Link href={`/manage?edit=${campaign.id}`} className={styles.secondary}>
                {t("common.edit")}
              </Link>
              <Link href={`/manage?roster=${campaign.id}`} className={styles.secondary}>
                {t("manage.manageRoster")}
              </Link>

              {campaign.status === "active" ? (
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(t("manage.confirmClose"))) return;
                    startTransition(async () => {
                      const result = await closeCampaign(campaign.id);
                      showToast(result.ok ? "toast.campaignClosed" : result.error);
                    });
                  }}
                >
                  {t("manage.closeEarly")}
                </button>
              ) : null}

              {canDelete ? (
                <button
                  type="button"
                  className={styles.destructive}
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(t("manage.confirmDelete"))) return;
                    startTransition(async () => {
                      const result = await deleteCampaign(campaign.id);
                      showToast(result.ok ? "toast.campaignDeleted" : result.error);
                    });
                  }}
                >
                  {t("manage.deleteCampaign")}
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function RosterManager({ roster }: { roster: NonNullable<ManagementData["roster"]> }) {
  const t = useTranslator();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <Panel>
      <PanelTitle>{t("manage.manageRoster")}</PanelTitle>
      <div className={styles.rosterCampaign}>{roster.campaignName}</div>

      {roster.members.length === 0 ? (
        <p className={styles.emptyNote}>{t("manage.rosterEmpty")}</p>
      ) : (
        <div className={styles.chips}>
          {roster.members.map((member) => (
            <span key={member.id} className={styles.chip}>
              <Avatar name={member.displayName} size="sm" />
              <span className={styles.chipName}>{member.displayName}</span>
              <button
                type="button"
                className={styles.chipRemove}
                aria-label={`${t("common.remove")} ${member.displayName}`}
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await removeParticipant(roster.campaignId, member.id);
                    showToast(result.ok ? "toast.rosterUpdated" : result.error);
                  })
                }
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {roster.candidates.length > 0 ? (
        <div className={styles.addSection}>
          <div className={styles.addLabel}>{t("manage.addParticipant")}</div>
          <div className={styles.chips}>
            {roster.candidates.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                className={styles.addChip}
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await addParticipant(roster.campaignId, candidate.id);
                    showToast(result.ok ? "toast.rosterUpdated" : result.error);
                  })
                }
              >
                + {candidate.displayName}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

export function RoleTable({ users }: { users: ManagementData["users"] }) {
  const t = useTranslator();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <Panel>
      <PanelTitle>{t("manage.roleAssignment")}</PanelTitle>
      <div className={styles.adminOnly}>{t("manage.adminOnly")}</div>

      <div className={styles.roleList}>
        {users.map((user) => (
          <div key={user.id} className={styles.roleRow}>
            <Avatar name={user.displayName} />
            <div className={styles.roleText}>
              <div className={styles.roleName}>{user.displayName}</div>
              <div className={styles.roleEmail}>{user.email}</div>
            </div>
            <select
              className={styles.roleSelect}
              value={user.role}
              disabled={pending}
              onChange={(event) => {
                const next = event.target.value;
                startTransition(async () => {
                  const result = await setUserRole(user.id, next);
                  showToast(result.ok ? "toast.roleUpdated" : result.error);
                });
              }}
            >
              <option value={Role.MEMBER}>{t("roles.member")}</option>
              <option value={Role.CAPTAIN}>{t("roles.captain")}</option>
              <option value={Role.ADMIN}>{t("roles.admin")}</option>
            </select>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}
