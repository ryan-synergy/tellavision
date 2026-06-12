# Publishing TellaVision to Synergy Field Kit

Handoff doc for the agent that maintains the Field Kit hub
(`ryan-synergy/ryan-synergy.github.io`). The production build in this repo is
ready to deploy.

**Naming:** the app is **TellaVision** (wordmark `TellaVision`, all-caps
lockup `TELL·A·VISION` — spoken, it reads "television"; that's the point).
Internal IDs keep working under both names on purpose: localStorage migrates
from `tv-wall-planner-v1` to `tellavision-v1`, and JSON imports accept
`app: "tellavision"` or the legacy `"tv-wall-planner"`.

## What's in this repo (`ryan-synergy/tellavision`)

- `index.html` — **production build**: pre-compiled app, PWA meta, offline
  service worker registration, Field Kit icons. Self-contained; deploy this.
  ⚠ Needs a recompile from the latest `tellavision.tsx` (several engine
  releases landed since the last compile) and its `<title>`/PWA name set to
  **"TellaVision — Synergy AV"**.
- `sw.js`, `favicon.png`, `apple-touch-icon.png` — ship alongside it.
- `dev.html` + `tellavision.tsx` — the dev harness (Babel-in-browser).
  **Edits happen in the tsx**: test via dev.html, then recompile index.html.
- `tellavision-legacy.tsx` — pre-rebuild reference only. Never deploy.

## Recommended deploy: Pages on THIS repo

The repo is named `tellavision`, so GitHub Pages on it serves at
`https://ryan-synergy.github.io/tellavision/` — name, repo, and URL all line
up, and deploying = pushing a recompiled index.html. One repo, no copy step.

1. Recompile `index.html` from `tellavision.tsx`; run the acceptance checks.
2. Flip the repo public and enable Pages (content is the app plus public
   mount/TV spec data — nothing sensitive):
   ```
   gh repo edit ryan-synergy/tellavision --visibility public --accept-visibility-change-consequences
   gh api -X POST repos/ryan-synergy/tellavision/pages --input - <<< '{"build_type":"legacy","source":{"branch":"main","path":"/"}}'
   ```
   Add `.nojekyll` if Pages mangles anything.
3. Check the service-worker registration path under the `/tellavision/`
   subpath.
4. Update the hub (`ryan-synergy/ryan-synergy.github.io`) in BOTH
   `index.html` and `tools.json`: replace the `tvcalc` card with
   **"TellaVision"**, url `https://ryan-synergy.github.io/tellavision/`, desc
   e.g. *"TV layout + tape-out — rough-in drawings, PDF / DXF / JSON export"*.
5. Archive the superseded Next.js calculator
   (`gh repo archive ryan-synergy/tv-wall-calculator -y`); its Pages site can
   stay up until the hub card moves.

(Alternative if this repo must stay private: copy the four production files
into the public `tv-wall-calculator` repo at its existing URL — works, but the
URL won't match the name. Prefer Pages-on-this-repo.)

## Acceptance checks — do not publish if any fail

- Status-bar badge reads **✓ 54/54** (embedded self-tests; if red the math is
  broken — click the badge → COPY REPORT and stop).
- In the diagnostics panel, run **SWEEP** → **0 failing / ~89 configs**
  (label-collision audit).
- EXPORT → FULL PACK produces a JSON download, a DXF download, and opens the
  PDF print window.
- Mobile width shows the SETUP / DRAWING / SPECS tabs.
- With a legacy `tv-wall-planner-v1` localStorage entry present, the design
  loads (migration path).

## Gotchas

- localStorage: writes go to **`tellavision-v1`**; reads fall back to legacy
  `tv-wall-planner-v1`. Keep both behaviors or field users lose saved designs.
- JSON interop: emit `app: "tellavision"`, accept both ids on import — other
  Field Kit apps may still emit the legacy id.
- The dev harness injects only `useState/useMemo/useRef/useEffect`; if the tsx
  ever uses other hooks, update `dev.html` too.
- All math lives in the pure ENGINE section of the tsx — display code never
  does arithmetic. The self-tests assume it.
- TV/mount spec data (`TV_OVERRIDES`, `VESA_DATA`, `SANUS_MOUNTS`) comes from
  manufacturer spec sheets supplied by Ryan — never invent SKU specs. Sony 115
  has NO VESA entry on purpose (unpublished); add it only from a real sheet.
- After ANY schematic change, rerun SWEEP and keep it at 0 failures.
