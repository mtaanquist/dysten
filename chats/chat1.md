# Calendar grid input design

_Started 2026-08-12 07:19 UTC_

---

## User

<system-info comment="Only acknowledge these if relevant">
Project title is now "# Claude Design Prompt: Consortio IT Activity Tracker??Build an internal web app"
The project currently has no files except possibly dotfiles — a `list_files` on the project root would return nothing else.
Current date is now August 12, 2026
</system-info>

<default aesthetic_system_instructions>
The user has not attached a design system. If they have ALSO not attached references or art direction, and the project is empty (the auto-managed _ds/ folder doesn't count), ask your opening questions with the ask_user tool. Whenever you ask opening questions in this project, include a design-system question in the form: the user's pick there sets the visual direction, so do NOT also ask about the visual aesthetic (no questions about vibe, colors or palette directions (including color-swatch svg-options questions), typography, mood, or art direction). Spend your other questions on everything else: audience, purpose, content, structure, scope, interactions, tone of copy. Exception: if the request already states the visual direction as a brand or concrete art direction, leave the design-system question out of your own questions (the app may still add one — it's skippable, and a skip doesn't change the stated direction) — but if they name a design system that isn't attached, keep the question: their pick there is what attaches it.

If the design-system question comes back unanswered — skipped without a pick (a "Not sure" / decide-for-me answer counts as a pick: it applies the effective default) — and no references or other art direction arrived either, THEN ask the visual-aesthetic questions before designing: a follow-up round (or one focused question) about vibe, colors, type, and mood is the right move once the design-system ask went unanswered. Do NOT just pick your own. Once you have a direction, use this guidance when creating designs:
- Choose a type pairing from web-safe set or Google Fonts. Helvetica is a good choice. Avoid hard-to-read or overly stylized fonts. Use 1-3 fonts only.
- Foreground and background: choose a color tone (warm, cool, neutral, something in-between). Use subtly-toned whites and blacks; avoid saturations above 0.02 for whites.
- Accents: choose 0-2 additional accent colors using oklch. All accents should share same chroma and lightness; vary hue.
- NEVER write out an SVG yourself that's more complicated than a square, circle, diamond, etc.
- For imagery, never hand-draw SVGs; use subtly-striped SVG placeholders instead with monospace explainers for what should be dropped there (e.g. “product shot”)

CRITICAL: ignore default aesthetic entirely if given other aesthetic instructions like reference images, design systems or guidance, or if there are user-authored files in the project already (the auto-managed _ds/ folder is not user-authored).
</default aesthetic_system_instructions>

<pasted_text name="Pasted text (98 lines)">
# Claude Design Prompt: Consortio IT Activity Tracker

Build an internal web app for Consortio IT where employees join activity campaigns (starting with step-counting), log daily values, and compete on a leaderboard. The app must support multiple campaign types over time and keep a full history of past campaigns.

## Branding and visual style

Match the Consortio IT website look:

- Primary blue: approx #1789CE (header bars, links, accents)
- Light blue: approx #A9C7E8 (section backgrounds, cards)
- Dark maroon/red: approx #A93B4E (primary buttons, e.g. "Log activity", "Join campaign")
- White content areas, generous whitespace
- Soft organic shapes: rounded blob/wave decorative elements in light blue and grey, similar to the website's wave dividers and blob graphics
- Clean sans-serif typography, bold headings in blue or near-black
- Buttons: pill-shaped, maroon with white uppercase text

Localisation: see the Localisation section below.

## Authentication and roles

- Sign in with Microsoft 365 (Entra ID / OAuth). Users are identified by their work account; display name and email come from M365.
- Three roles:
  - Member: join campaigns, log their own entries, view leaderboards, everyone's stats within their campaigns, and history.
  - Team captain: everything a member can do, plus create and edit campaigns, manage campaign rosters, and close a campaign.
  - Admin: everything a captain can do, plus site management: assign captain/admin roles, correct or delete any entry, delete campaigns, and reopen ended campaigns for corrections.
- First user to sign in becomes admin (or seed a configurable admin email list).

## Core concepts and data model

- User: M365 identity, display name, email, role.
- Campaign: name, description, start date, end date, status (upcoming / active / ended), and a campaign type.
- Participants: each campaign has its own roster. Not everyone in the company joins; users opt in (or an admin adds them) per campaign. The roster is stored with the campaign, so history shows exactly who took part in each past campaign.
- Campaign type (extensible): defines the two value fields and their labels/units.
  - Step campaign (build now):
    - Field 1: "Steps" (actual steps walked)
    - Field 2: "Calculated" (converted steps from other activities, e.g. biking or sports)
    - Unit: steps. Score = steps + calculated.
  - Bike-to-work campaign (design for, can be added later):
    - Field 1: "Km biked to work"
    - Field 2: "Km in spare time"
    - Unit: km. Score = sum of both.
  - Keep field labels, units, and any help text configurable per campaign type so new types can be added without restructuring data.
- Daily entry: user, campaign, date, value1, value2, timestamp of last edit. One entry per user per day per campaign; editing overwrites. Dates must fall within the campaign range. Users can backfill earlier days in the range.

## Screens

1. Dashboard (after sign-in)
   - Active campaign(s) the user is in, with a quick-entry form for today (two numeric fields with the campaign type's labels).
   - The user's running total and current rank.
   - Link to join any open campaign they are not in yet.

2. Campaign page
   - Header with campaign name, date range, days remaining.
   - Entry grid/calendar for the signed-in user: one row per day in the range with both fields editable inline.
   - Leaderboard: participants ranked by total (value1 + value2). Show name, total, and a breakdown of the two fields. Winner is the individual with the highest total when the campaign ends.
   - Participant list: who is on this campaign's roster, including anyone who joined but has not logged yet.
   - Simple progress chart: cumulative totals over time for the top participants.

3. History
   - List of past campaigns with dates and type.
   - Opening a past campaign shows its final leaderboard, winner highlighted, the full participant roster from that year, and each participant's entries exactly as they stood at campaign end.

4. Management (visible to captains and admins)
   - Create/edit campaign: name, type (step or bike), dates, description.
   - Manage the campaign roster: add or remove participants.
   - Close a campaign early.
   - Admin-only extras: role assignment, edit or delete any user's entry (with an "edited by admin" marker), delete campaigns, reopen for corrections.

## Transparency and competitive features

- All participants in a campaign can see everyone's stats during the campaign: totals, rank, and each person's daily entries (both fields), not just the leaderboard summary. Tapping a name on the leaderboard opens that person's day-by-day view.
- Movement indicators on the leaderboard: up/down arrows showing rank change since yesterday.
- Highlights panel on the campaign page: best single day so far, longest active logging streak, and biggest climber this week.
- Streak badge next to names for consecutive days logged.
- A "gap to next rank" hint on the user's own row (e.g. "2,300 steps behind #3") to fuel the chase.
- Daily average column, so late joiners can still compare fairly on effort per day.
- Optional shared campaign goal: captains can set a collective target (e.g. "together we walk to Paris: 1,200,000 steps") with a progress bar on the campaign page showing everyone's combined total.
- Reminders: opt-in email notification if a participant has not logged for the previous day during an active campaign. Design the notification layer so a Teams webhook/channel message can be added later.

## Behaviour details

- Ties on the leaderboard share a rank.
- Numeric inputs only, non-negative; steps as whole numbers, km with one decimal.
- Show a friendly nudge on the dashboard if the user has not logged anything for yesterday or today during an active campaign.
- Mobile-friendly: daily entry must be easy on a phone.

## Localisation

- The UI must be fully localised, with English (GB) and Danish available at launch. German should be easy to add later, so build it properly from the start:
  - All UI strings live in per-language resource files (e.g. en-GB.json, da-DK.json); no hard-coded text in components. Adding German is then just a de-DE file.
  - Campaign type field labels and help text are localisable too, per language.
- Each user picks their language in a profile/settings menu; default to Danish, remember the choice.
- Locale-aware formatting: dates (12/08/2026 for en-GB, 12.08.2026 or "12. aug. 2026" for da-DK), number separators (1,200 vs 1.200), and decimal comma for km in Danish.
- User-entered content (campaign names, descriptions) is not translated; it displays as written.

## Storage

Persist everything (users, campaigns, rosters, entries) so history survives across sessions and campaigns.
</pasted_text>

<!-- The user explicitly selected the following skills for this project, as attachments to their message. These are not optional context — they define how you work. Use them. -->
<attached-skill name="Design Components">
This project uses Design Components: every design is a single streaming `Name.dc.html` file. The full authoring spec is in your system prompt under "Writing code — Design Components" — follow it. Author and edit `.dc.html` content with the `dc_write`, `dc_html_str_replace`, `dc_js_str_replace`, and `dc_set_props` tools (not `write_file`; `str_replace_edit` works but won't stream); template edits stream into the live preview as you type.
</attached-skill>


<system-reminder>Auto-injected reminder (ignore if not relevant): do not recreate copyrighted or branded UI unless the user's email domain matches that company. Create original designs instead.</system-reminder>

## Assistant

_[tool: read_skill_prompt]_

_[tool: dc_write]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: show_html]_

_[tool: ready_for_verification]_

## User

Found issues — fixing…

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

Now the management column: give Type its own row and stop the pill buttons wrapping.

_[tool: dc_html_str_replace]_

_[tool: grep]_

_[tool: read_file]_

_[tool: dc_html_str_replace]_

Now nowrap on the management pill buttons.

_[tool: run_script]_

_[tool: ready_for_verification]_

## User

This looks pretty great in general, but I think I'd like to display the steps to enter as a calendar grid instead, so that you could enter multiple values (makes it easier if you forgot a day or three too).

## Assistant

_[tool: dc_js_str_replace]_

_[tool: read_file]_

_[tool: dc_html_str_replace]_

_[tool: run_script]_

_[tool: ready_for_verification]_

## User

The above was meant to be on the dashboard page, too.

## Assistant

_[tool: grep]_

_[tool: read_file]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

## User

Can we also hide the increment/decrement buttons inside the input fields?

## Assistant

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

Spinners are gone in all browsers now.

## User

It looks like on both the History and Admin pages we're missing margin to the sides.

## Assistant

_[tool: show_html]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: grep]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: read_file]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

## User

Found issues — fixing…

## Assistant

_[tool: run_script]_

_[tool: ready_for_verification]_

## User

Found issues — fixing…

## Assistant

_[tool: run_script]_

_[tool: run_script]_

_[tool: ready_for_verification]_

## User

I do think we have to change the dashboard slightly when we log in because there could in theory be an overlap between a biking campaign and a step tracking campaign.

Would it be better to have a list of campaigns you're participating in, with some flair similar to how you have the current goal, placement, etc, on each row. 

You could also display active, but not joined, as well as upcoming in the same manner.

## Assistant

_[tool: read_file]_

_[tool: run_script]_

Now the dashboard template: campaign list replaces the single-campaign panel.

_[tool: run_script]_

_[tool: run_script]_

_[tool: show_html]_

_[tool: multi_screenshot]_

_[tool: ready_for_verification]_

## User

Found issues — fixing…

## Assistant

_[tool: run_script]_

_[tool: get_webview_logs]_

_[tool: multi_screenshot]_

Layout intact at desktop width; narrow widths now wrap and the grids scroll instead of collapsing.

_[tool: ready_for_verification]_

## User

Found issues — fixing…

## Assistant

_[tool: run_script]_

_[tool: run_script]_

_[tool: ready_for_verification]_

## User

Are you done with the dashboard? It doesn't make sense to have the calendar showing now on the screen when we have a list of campaigns. The rows are good, but I'd do it differently:

Instead of having the shortcut to register activity, show that nice hero banner we had before about "walking to Paris" or something in that side of it, and make the row card a little shorter. When you click in on it, the first thing to see should be the calendar for registration. The entire card should basically be clickable.

## Assistant

_[tool: read_file]_

_[tool: run_script]_

_[tool: show_html]_

_[tool: multi_screenshot]_

_[tool: show_html]_

_[tool: multi_screenshot]_

_[tool: ready_for_verification]_

## User

That looks a lot better. Couple of things:
- Could we move the email reminder to just be a notification icon toggle next to the email address under the user's name? Bell and crossed bell.
- The statistics for a campaign, could that be inside the blue "common" goal thing instead? I also don't think we need the "steps behind #7" out here, that'd be better inside the campaign near the team stats.
- Could we also get rid of the status label? I'd rather we just have a "previous campaigns" list at the bottom of the page (perhaps paginated so the page doesn't grow to be miles long)
- The "open campaign" link also doesn't make sense, and rather than writing "yesterday's missing" maybe just a tracker under the common goal that says how many days are missing entries (of passed days)

## Assistant

_[tool: run_script]_

_[tool: run_script]_

Now the paginated previous-campaigns list at the bottom of the dashboard.

_[tool: run_script]_

_[tool: multi_screenshot]_

_[tool: multi_screenshot]_

_[tool: show_html]_

_[tool: multi_screenshot]_

All four changes are in.

_[tool: ready_for_verification]_

## User

Could we align the text on the campaigns to be top-left instead of middle-left?

## Assistant

_[tool: run_script]_

_[tool: ready_for_verification]_

Card text now starts at the top of each row.

## User

Much better. I think one thing we could move around a bit is on the campaign detail page. I know I said the calendar should be top, but I think it'd be nicer to have the common goal at the top, as it breaks the colours a bit, too.

## Assistant

_[tool: run_script]_

_[tool: ready_for_verification]_

## User

I think this is a very good starting point, thanks very much. Could I get you to make a tokens.css and a components sheet for what we've done here?

## Assistant

_[tool: write_file]_

_[tool: dc_write]_

_[tool: ready_for_verification]_

## User

Found issues — fixing…

## Assistant

_[tool: dc_html_str_replace]_

_[tool: grep]_

The drawer caption is the other bare one.

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

## User

Found issues — fixing…

## Assistant

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

