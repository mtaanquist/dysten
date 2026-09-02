import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createTranslator } from "@/i18n/translate";
import { AppShell } from "@/components/layout/AppShell";
import { Panel, PanelTitle } from "@/components/ui";
import styles from "./rules.module.css";

/**
 * One page that answers "how does this actually work".
 *
 * The rules used to be stated on the campaign pages themselves, which meant
 * everyone read them every day forever. They belong somewhere you go once.
 */
export default async function RulesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const t = createTranslator(user.locale);

  return (
    <AppShell user={user}>
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>{t("rules.title")}</h1>
          <p className={styles.intro}>{t("rules.intro")}</p>
        </header>

        <Panel>
          <PanelTitle>{t("rules.loggingTitle")}</PanelTitle>
          <p className={styles.body}>{t("rules.loggingBody")}</p>
          <p className={styles.body}>{t("rules.loggingLate")}</p>
        </Panel>

        <Panel>
          <PanelTitle>{t("rules.stepTitle")}</PanelTitle>
          <p className={styles.body}>{t("rules.stepBody")}</p>

          <dl className={styles.fields}>
            <dt className={styles.fieldName}>{t("rules.stepFieldSteps")}</dt>
            <dd className={styles.fieldBody}>{t("rules.stepFieldStepsBody")}</dd>
            <dt className={styles.fieldName}>{t("rules.stepFieldCalculated")}</dt>
            <dd className={styles.fieldBody}>{t("rules.stepFieldCalculatedBody")}</dd>
          </dl>

          <p className={styles.body}>{t("rules.stepCalculator")}</p>
        </Panel>

        <Panel>
          <PanelTitle>{t("rules.winnerTitle")}</PanelTitle>
          <p className={styles.lead}>{t("rules.winnerLead")}</p>
          <p className={styles.body}>{t("rules.winnerTickets")}</p>
          <p className={styles.body}>{t("rules.winnerDraw")}</p>
          <p className={styles.body}>{t("rules.winnerOnce")}</p>
        </Panel>

        <Panel>
          <PanelTitle>{t("rules.bikeTitle")}</PanelTitle>
          <p className={styles.lead}>{t("rules.bikeLead")}</p>
          <p className={styles.body}>{t("rules.bikeBody")}</p>
          <p className={styles.body}>{t("rules.bikeZero")}</p>
        </Panel>

        <Panel>
          <PanelTitle>{t("rules.numbersTitle")}</PanelTitle>
          <p className={styles.body}>{t("rules.numbersBody")}</p>
          <p className={styles.body}>{t("rules.numbersEstimate")}</p>
          <p className={styles.body}>{t("rules.numbersPadel")}</p>
        </Panel>

        <Panel>
          <PanelTitle>{t("rules.creditsTitle")}</PanelTitle>
          {/* The wording and the link are the ones Flaticon's own "How to
              attribute?" dialog hands you, kept verbatim and left in English:
              it names a person and a pack, so translating it would be
              rewriting somebody's credit. */}
          <p className={styles.body}>
            {t("rules.creditsIcon")}{" "}
            <a
              className="textLink"
              href="https://www.flaticon.com/free-icons/athlete"
              title="athlete icons"
              target="_blank"
              rel="noopener noreferrer"
            >
              Athlete icons created by Smashicons - Flaticon
            </a>
          </p>
        </Panel>
      </div>
    </AppShell>
  );
}
