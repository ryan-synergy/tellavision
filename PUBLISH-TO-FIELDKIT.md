# Publishing the TV Wall Planner to Synergy Field Kit

Handoff doc for the agent that maintains the Field Kit hub
(`ryan-synergy/ryan-synergy.github.io`). The production build in this repo is
ready to deploy — verified 2026-06-11 (see acceptance checks below).

## What's in this repo

- `index.html` — **production build**: pre-compiled app, PWA meta, offline
  service worker registration, Field Kit icons. Self-contained; deploy this.
- `sw.js`, `favicon.png`, `apple-touch-icon.png` — ship alongside it.
- `dev.html` + `tv-wall-planner.tsx` — the dev harness (Babel-in-browser,
  transpiles the tsx at runtime). **This is where edits happen**: change the
  tsx, test via dev.html, then re-compile into index.html before deploying.
- `tv-wall-planner-legacy.tsx` — pre-rebuild version, reference only. Never deploy.
- Repo: `https://github.com/ryan-synergy/tv-wall-planner` (private)

## Remaining steps to go live (as of 2026-06-11 none of this is done)

Field Kit's "TV Wall Calculator" card points at
`https://ryan-synergy.github.io/tv-wall-calculator/` — still serving the old
Next.js calculator (separate repo `ryan-synergy/tv-wall-calculator`). This app
supersedes it. Recommended: swap in place so the hub URL stays stable.

1. In `tv-wall-calculator`: tag the old app
   (`git tag legacy-nextjs-calculator && git push origin --tags`), then delete
   all tracked content **including `.github/workflows/`** (the Next.js deploy
   workflow must not run against static files).
2. Copy in from this repo: `index.html`, `sw.js`, `favicon.png`,
   `apple-touch-icon.png`; add an empty `.nojekyll`.
3. Switch Pages from workflow-build to branch-build:
   ```
   gh api -X PUT repos/ryan-synergy/tv-wall-calculator/pages \
     --input - <<< '{"build_type":"legacy","source":{"branch":"main","path":"/"}}'
   ```
4. Push, wait for Pages, verify the live `<title>` is
   **"TV Wall Planner — Synergy AV"**.
5. Update the hub (`ryan-synergy/ryan-synergy.github.io`) in BOTH `index.html`
   and `tools.json`: rename the `tvcalc` card to **"TV Wall Planner"**, desc
   e.g. *"Blueprint Edition — rough-in drawings, PDF / DXF / JSON export"*.
6. Check the service worker scope works under the `/tv-wall-calculator/`
   subpath (sw.js registration path may need the subpath prefix).

## Acceptance checks — do not publish if any fail

- Status-bar badge reads **✓ 39/39** (embedded self-tests; if red the math is
  broken — click the badge → COPY REPORT and stop).
- In the diagnostics panel, run **SWEEP** → **0 failing / ~79 configs**
  (label-collision audit).
- EXPORT → FULL PACK produces a JSON download, a DXF download, and opens the
  PDF print window.
- Mobile width shows the SETUP / DRAWING / SPECS tabs.

Verified passing on the production build at commit `1f19faf`.

## Gotchas

- User designs persist in localStorage key **`tv-wall-planner-v1`** — keep the
  key stable across releases or users lose saved work in the field.
- The dev harness injects only `useState/useMemo/useRef/useEffect`; if the tsx
  ever uses other hooks, update `dev.html` too.
- The engine/UI rule: all math lives in the pure ENGINE section of the tsx —
  display code never does arithmetic. Keep it that way; the self-tests assume it.
- After ANY schematic change, rerun SWEEP and keep it at 0 failures.
