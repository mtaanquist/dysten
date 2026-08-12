# Design reference

The source-of-truth mockups this application was built from, exported from
Claude Design. They are **prototypes, not application code** — nothing here is
imported, built or deployed. They live in the repository so that the intended
visual result stays checkable against what the app actually renders.

## Files

| File | What it is |
| --- | --- |
| `Component Sheet.dc.html` | The design system: colour, typography, buttons, pills, surfaces, data displays, feedback, and the eight rules the system follows. The reference to check a component against. |
| `Activity Tracker.dc.html` | The full interactive prototype — every screen, in both languages. |
| `support.js` | The Design Components runtime the two `.dc.html` files need in order to render. |

## Viewing them

They are self-contained HTML. Serve the folder and open a file:

```bash
python3 -m http.server --directory .design 8080
# then open http://localhost:8080/Component%20Sheet.dc.html
```

Opening them directly from the filesystem also works in most browsers.

## Relationship to the code

- **Tokens.** The component sheet names a token for nearly every value. Those
  tokens are implemented in [`src/styles/tokens.css`](../src/styles/tokens.css),
  which is the version the app actually uses — treat it as canonical if the two
  ever disagree.
- **Structure.** The prototypes are a single streaming template with inline
  styles. The app deliberately does *not* mirror that structure; it matches the
  rendered output while using React components and CSS modules.
- **Company name.** The exported originals carried a specific company's name in
  the wordmark and in seeded e-mail addresses. Both have been replaced with
  neutral placeholders here. In the application the wordmark comes from
  `NEXT_PUBLIC_ORG_NAME`.

The conversation that produced these designs is not stored in the repository.
Several decisions from it are worth knowing, because the final files are their
result rather than their explanation:

- Daily entry became a **month calendar grid**, not a row-per-day list, so that
  a forgotten day or three can be backfilled in place.
- The dashboard became a **list of campaign cards**, because a step campaign and
  a bike campaign can run at once. The whole card is the link.
- Each card's right half is the **shared-goal panel**, carrying that campaign's
  stats and a count of days missing entries.
- Reminders became a **bell / crossed-bell toggle** beside the e-mail address.
- Status labels were dropped; finished campaigns became a **paginated
  "previous campaigns" list** at the foot of the dashboard.
- On the campaign page the shared-goal panel sits **above** the calendar.
