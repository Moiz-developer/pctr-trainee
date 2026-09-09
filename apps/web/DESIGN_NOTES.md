# Frontend Design Notes

Reference: `panel-design.png` (repo root) — a User Portal Dashboard mockup for "Professional
Careers Training & Recruitment". This is **implementation guidance only**; no UI from this
reference has been built yet. Treat these as directional notes for the design system work in
a later frontend step (see `SYSTEM_PLAN.md` §22/§34 for the fuller design-system spec this
should feed into).

## What the reference shows

- **Layout**: fixed-width left sidebar (logo + vertical icon/label navigation) beside a fluid
  main content area. A colored top bar spans the main content only (not full-width) with a
  menu-toggle icon, a search input, and a circular user-avatar icon.
- **Navigation**: sidebar items pair an icon with a label; the active item is a solid,
  rounded-pill highlight in the brand color with white text, inactive items are plain dark-gray
  text/icons with no background.
- **Color direction**: one dominant deep indigo/navy brand color, used for the sidebar's active
  item, the top bar, and the primary "stat" cards. Page background is near-white/light gray.
  Secondary cards are plain white. A small warm gold/orange accent appears as a decorative
  corner shape on stat cards. A red/coral tone is used for "important" announcement content —
  read as a semantic urgent/attention color, not a general accent.
- **Cards**: consistently rounded corners (medium-large radius), generous internal padding.
  Two card treatments observed: solid-navy "stat" cards (label + large bold value + icon) and
  white cards with a subtle border/shadow for progress and content (announcements).
- **Typography hierarchy**: small, muted "eyebrow"-style labels above bold, larger values
  (e.g. stat numbers); moderate-weight section headers (e.g. "Dashboard", "Important
  Announcements"); plain body text for descriptions.
- **Progress indicators**: thin, rounded horizontal bars, brand-color fill on a light track,
  with the percentage right-aligned beside a small caption.
- **Composition patterns**: an equal-width card grid for at-a-glance stats, a two-column grid
  for progress indicators, and a numbered list (small circular badge numbers) for announcements.
- **Density/spacing**: generous whitespace between sections and inside cards — not a dense,
  compressed admin-table style.

## Implementation guidance for later steps

- Treat the indigo/navy as the primary brand color token, gold as a rare decorative accent, and
  red/coral as a reserved semantic "important/urgent" color — not for general UI use.
- Reuse one rounded-corner scale across all cards; don't mix radii ad hoc per component.
- Build the sidebar and top bar as distinct, reusable layout primitives (per
  `SYSTEM_PLAN.md` §27's `layouts/` folder) — the active-nav-item "filled pill" treatment should
  be one shared style, not repeated per page.
- Two card variants are enough for now: a solid brand-color "stat" card and a plain white
  content card. Avoid introducing more card styles than the reference actually shows.
- No responsive/mobile view is shown in the reference. The card grids (3-up stats, 2-up
  progress) should be treated as candidates for stacking to a single column on small screens,
  and the sidebar as a candidate for an off-canvas/collapsible pattern (the top bar's
  menu-toggle icon implies this was anticipated) — both per `SYSTEM_PLAN.md` §23, not as
  something this reference image confirms directly.
- Do not invent additional colors, gradients, or card types beyond what's described above when
  the real UI is eventually built from this reference.
