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
- `build.html` — the recompiler, and the answer to "recompile index.html" every
  step below assumes. Serve the repo over http, open `build.html`, press
  **COMPILE AND DOWNLOAD**, save the file over `index.html`. It is the ONLY
  supported way to regenerate the build: it pairs the transform with the shell
  that provides `React` and the destructured hooks the compiled body closes
  over, and it escapes `</script` in the output rather than leaving you to
  remember. It needs the network (Babel comes from unpkg) and is not in the SW
  cache, so it is a workstation tool, not a field one — the repo root is the
  Pages source, so it does ship, but nothing links to it and nothing loads it.
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

- Status-bar badge reads **✓ 118/118**
- No CDN: `grep -c unpkg index.html` must be **0**. React and pdf.js are
  vendored in `vendor/`; the app must run with the network off. (embedded self-tests; if red the math is
  broken — click the badge → COPY REPORT and stop).
- In the diagnostics panel, run **SWEEP** → **0 failing / 125 configs**
  (label-collision audit — includes L and XL type runs).
- Render audit reads **0 overlaps · 0 clipped · 0 unbacked** in all three
  themes (it audits the ACTIVE theme, so switch and re-read).
- Settings → Appearance: switch **Density** to Compact and back. Type and
  spacing tighten; tap targets do NOT shrink — 44pt holds in both.
- Sidebar shows one stage at a time, collapsed stages carry a live summary
  (`120.0" × 108.0"`, `Sony 75"`), and `ALL SECTIONS` expands everything.
- EXPORT → FULL PACK produces a JSON download, a DXF download, and opens the
  PDF print window.
- Mobile width shows the SETUP / DRAWING / SPECS tabs.
- With a legacy `tv-wall-planner-v1` localStorage entry present, the design
  loads (migration path).
- Reference drawing: import a PDF → SNAP TO TV across the drawn panel → the
  drawing's wall lands on the app's wall. Reload → the underlay comes back
  (IndexedDB) with its calibration and markup intact.
- EXPORT → PDF contains the underlay `<image>` and the markup strokes; the DXF
  contains a `MARKUP` layer.
- Draw one stroke with the **white** swatch: the swatch shows a caution dot, a
  `▲ 1 INVISIBLE ON PAPER` chip appears beside EXPORT, and EXPORT → PDF/PNG/SVG
  stops and names the stroke. JSON and DXF are NOT gated and must not be.
- Draw one stroke with the **AUTO** swatch, then switch theme: it is near-white
  on Dark and Blueprint and near-black on Paper, and the exported SVG contains
  it as `#102A43`. It must never appear in the warning on any theme.

## Chrome budget — options hide, tools stay

Measured on a tablet (768x1024) before v2.2.0: 443px of chrome sat above the
drawing and the canvas got 432px. More chrome than drawing. The drawing itself
was clean (0 overlaps in the densest case buildable), so density was always a
controls problem, not a layout one.

- **The gear (⚙, header) holds set-once options**: the six annotation toggles
  (PWR, LV, VESA, TV DIMS, BOX DIMS, TAPE-OUT), FULL WORDS, LEGEND, units and
  SNAP. The permanent SHOW strip is gone. If you add a display option, it goes
  here, not into a strip.
- **The six reference-drawing controls collapsed into one `PDF ▾` menu** —
  SNAP TO TV, 2-POINT SCALE, MOVE, CROP, UNCROP, TRACE. They were already
  duplicated in the sidebar's Reference Drawing section; the toolbar now carries
  one button instead of six.
- **Colour and weight are inline on desktop, collapsed into one style button on
  tablet/mobile** (`!isMobile && !isTablet`). A tablet's main column is only
  ~460px with the sidebar; inline swatches forced a third row.
- Result: tablet chrome 443 -> 359px, markup bar 3 rows -> 2, desktop unchanged
  at one 40px row.
- Units moved out of the status bar into Settings. The status bar is now just
  computed values plus the health badge.

## Information architecture — the app reads start-to-finish

The header is ordered as the job runs: name, then `IMPORT ▾` / `DATA` / `RESET`
on the left, and `EXPORT ▾` pushed to the far right as the terminal action and
the only filled button. Do not move EXPORT back to the left — it used to sit
first, which made the finish line the first thing on screen.

- **One way in, two labelled choices.** `IMPORT ▾` offers "Reference drawing
  (PDF/image)" and "Design / survey data (JSON)". There is no longer a second,
  differently-named import buried in the sidebar.
- **`routeFiles()` is the single entry point** for the menu, drag-drop and the
  start panel. It routes on file type: drawing -> underlay, JSON -> design,
  neither -> a banner naming the file and what the app does accept. Dropping
  both at once works.
- **Drag-drop** anywhere on `.main-col`; `.dropping` gives the dashed outline.
- **Start panel** (`.startp`) renders only when there is no size AND no
  underlay, and hides permanently once anything is imported or "Start blank" is
  clicked. It must stay out of the way for daily use.
- **The sidebar is grouped into narrative stages** — START (project, reference
  drawing) / THE WALL (wall, fireplace) / THE TV (brand, viewing) / THE HARDWARE
  (mount, back box, VESA). Reference Drawing belongs in START, not buried mid-
  list; that placement is what made it undiscoverable before.

## Markup editing (SELECT tool)

- `SELECT` picks an existing annotation and lets you drag it or reshape it,
  rather than undo-and-redraw. Hit testing, handles and moves all work in wall
  inches; `grabIn()` converts a 9px grab radius into inches so the target feels
  identical at any drawing scale.
- Handles: a box exposes all four corners even though only two points are
  stored (`moveHandle` maps corner index -> which stored component moves);
  lines / arrows / measures expose both ends; pen strokes and text labels are
  move-only, because reshaping those handle-by-handle is worse than redrawing.
- Hit testing walks the list backwards so the TOPMOST item wins, matching what
  the user sees. A box is grabbed by its edge, not its empty middle.
- With something selected, the colour swatches and THIN/MED/BOLD retarget the
  selection instead of only the next stroke, and a `DELETE` chip appears.
  Delete/Backspace and Escape work when focus is not in a text field.
- A measure label recomputes from its points, so dragging an end updates the
  dimension live — no stale numbers.

## Making a busy reference drawing readable

Three layers, in paint order: underlay -> crop -> blanking patches -> schematic
-> ink markup. Patches and crop therefore never hide our own TV, dimensions or
callouts, which is the whole point of where they sit.

- **CROP** (`underlay.crop`, wall inches) is an SVG `clipPath` on the underlay
  image. It does NOT touch calibration — cropping and re-cropping never moves
  the sheet. Use it to kill border hatching, title blocks and the architect's
  own dimension strings in one gesture. `UNCROP` clears it.
- **BLANK** patches are `markup` entries of `type: "mask"`, painted in the
  palette's `maskFill` (paper colour, not white) so they vanish in both the
  blueprint and trace views. They are filled, so SELECT grabs them anywhere
  inside, not just on the edge, and they expose four corner handles.
- Label plates go **fully opaque** in trace mode (`halo: "#FFFFFF"`). At 82%
  the architect's linework bled through the callout pills and dimension text.
- BLANK is hidden unless a reference drawing is loaded — there is nothing to
  blank otherwise.

## Drawing type size

Settings → Text size (S / M / L / XL) scales every glyph on the drawing and the
PDF. `TEXT_SCALES` defines the factors; `S.textScale` reaches `buildSchematic`,
which derives `FS(n)` from it.

**Scaling the fontSize attributes alone is not enough and will look fine until
it does not.** Everything derived from a text measurement has to scale with it:

- `textW(str, FS(n))` in every pad and plate-width calculation
- `packRail(..., TS)` line height and the pad-simulation copy of that maths
- `railW` — the space reserved for the callout rail. This one is easy to miss;
  unscaled it lets the wall-height dimension collide with the pills at XL.
- text baselines and sub-label offsets (`dhMidY + FS(19)`, `wdY + FS(16)`, ...)
- backing plate heights and offsets

The stress sweep now re-runs the densest shapes at 1.15 and 1.3 for exactly this
reason — it caught two collisions the manual pass missed. If you add a label,
add a config here too.

Tape-out vertical labels tuck INWARD from their lines (a centred right-edge
label bleeds into the callout rail 16px away) and stagger vertically when the TV
is too narrow to hold both side by side.

## Label collisions — three rules that keep the drawing readable

1. **A measure label never sits on its own shaft.** `measureLabelPos()` offsets
   it along the line's NORMAL, so a vertical measure puts its text to the side
   instead of centring it on the line and reading as struck through. Pinned by
   a self-test for vertical, horizontal and diagonal runs.
2. **Hand markup is spliced in BELOW the annotation layer**, not appended.
   `labelStart` marks where the callout pills and dimension labels begin;
   `elements.splice(labelStart, 0, ...inkEls)` puts redlines above the geometry
   but under every dimension, so a scribble can never strike through a number
   the installer has to read. Geometry (wall, TV, box) still sits under markup.
3. **Every label gets an opaque backing plate — sized to the WIDEST line it
   covers, not the first one.** A callout pill's coloured rect only ever spanned
   line 1, so every sub-line ("SnapAV Strong", "15-1/8\" ABV TV BTM") sat as
   bare text on top of wall edges and the TV outline. `pushPill` now draws a
   full-height plate first and the coloured pill over its first line. Likewise
   the mount-height plate was sized on the value text, so a longer "TO CENTER"
   sub-label hung off its left edge. `120.0" WALL` and `108.0" H`
   had none; the mount-height plate stopped short of its "TO CENTER" sub-label;
   markup text and measure labels had none at all. All fixed — if you add a new
   label, give it a plate.

## Snapping and multi-select

- **SNAP** snaps each axis independently to anchors that mean something on this
  drawing — wall edges and centre, floor, ceiling, TV left/right/centreline,
  TV top/bottom/centre, box edges, outlet height — then applies an ortho lock so
  a two-point shape stays exactly level or plumb. An anchor always beats the
  ortho lock. **Hold Alt to override** for one gesture; the checkbox persists.
  A dashed amber guide names whichever anchor it grabbed.
- **Lasso is not a separate tool.** In SELECT, dragging empty space rubber-bands
  a selection; dragging an item moves it; shift-click adds/removes. `sel` is an
  array — handles only render when exactly one item is picked (`solo`).
- Rubber-band rectangles (lasso AND crop) are held in **refs**, not state. A
  fast flick fires down/move/up inside one React batch and a stale closure loses
  the gesture — the same trap that already bit calibration and pen strokes.
- `interactive` must include `cropping`, or the pointer handler bails before the
  crop drag is ever seen.

## Catalog data screen (DATA button)

- Every measurement table is **shipped baseline + local overlay**. `BASE_*` are
  the versioned, provenance-carrying source of truth and are NEVER written to at
  runtime; user edits land in `localStorage` under `tellavision-catalog-v1` and
  are merged over the baseline by `applyOverlay()` at load. This is deliberate:
  an app update can improve the baseline without clobbering a field correction,
  and a changed row stays identifiable instead of impersonating a spec figure.
- The effective tables (`BACK_BOXES`, `VESA_DATA`, ... and derived `BRANDS`) are
  `let`, reassigned by `applyOverlay()`. Nothing may capture them at module init.
- **`catalogRev` is a dependency of every memo that reads the catalog** —
  recommendations, centre height, recommended box/mount, sanusMount, layout, and
  both schematics. Miss one and an edit silently shows stale geometry.
- Self-tests run against the **baseline**, so a bad local edit can never turn the
  health badge red. The same validators re-run against effective data inside the
  Data screen and surface as red cells there.
- `TABLE_SCHEMAS` drives one generic grid across four shapes (`record`, `list`,
  `nested2`, `scalars`). Adding a table later is a schema entry, not a screen.
- Overlay export/import is a JSON file (`app: "tellavision-catalog"`) so
  corrections travel between machines. Per-row REVERT, per-table revert, and
  RESET ALL all return to shipped values.
- Local changes are flagged **in-app only** (DATA button count, nav badges, row
  tags). Exports render exactly as they always did — by design.

## Acceptance addition

- Open DATA, change a back box width, close: the drawing must repaint. Reload:
  the change must persist. RESET ALL: it must return to the shipped value.

## Sanus mount data

- **Verified 2026-08-20** against SANUS's own Black Series literature
  (`sanus.com/assets/literature/pdf/SANBLK0919_web.pdf`). Unlike the back boxes,
  all seven models were already correct — nothing was transposed. Do not
  "correct" these from a retailer page; one listed CILL1 as VESA 600x400 when
  SANUS publishes 690x415, and another listed CILT1 as 37"-90" when the
  literature says 37"-95".
- `plateW`/`plateH` are the PRODUCT dimensions (the mount's physical extent,
  which is what the elevation draws). SANUS also prints a separate wall-plate
  drawing — do not mix the two.
- `depth` is the spec-block DEPTH, which differs slightly from the
  product-dimension depth on some models (CILT1 2.2 vs 2.18, CIXT1 2.5 vs 2.41).
  The DEPTH field is what SANUS quotes, so it is what we use.
- `list` is LIST PRICE, not MSRP.
- **`vesaMin` is not decoration.** A panel below the mount's minimum pattern
  will not bolt up without an adapter. Checking only the max passed a Sony 42"
  (100x100) on a CILT1 whose minimum is 200x200. `vesaFitsMount()` is the single
  predicate for both the recommender and the manual picker — keep it that way so
  they cannot diverge.
- **SANUS publishes no swivel figure for this line.** Two invented values (55
  and 49) were removed rather than shipped; a self-test now asserts no mount
  carries one. If you find an official figure, cite it in the comment.
- CIXT1 ships with extender brackets, so its footprint is a RANGE —
  `plateWMax`/`plateHMax` carry the extended size (52.93 x 32.49).

## Back box data

- Future Automation WB dimensions were **verified 2026-08-19** against FA's own
  technical sheets (`futureautomation.co.uk/Tech/<model>-tech.pdf`) and the
  WB21/26/31-2S installation guide. Before that audit the whole non-2S line had
  **w/h transposed** and every `-2S` row was a duplicate of its single-stud
  sibling.
- **The model number is the HEIGHT, not the width.** Non-2S boxes recess into a
  single stud bay so their width is pinned at 353mm (13.9") to pass studs at
  406mm (16") centres — they are portrait. `-2S` boxes span twin studs: the
  install guide specifies a 762mm [30.0"] wide cut-out by DIM X high
  (540/668/795mm for WB21/26/31-2S). WB80 is stated `WxHxD` and spans three
  bays, so it is `studs: "multi"`.
- The `studBay` self-tests pin all of this: nothing may be wider than the
  framing it claims to fit, no `-2S` may equal its base, single-bay WB boxes
  must be taller than wide, and WB21 / WB21-2S / WB80 are asserted against the
  published millimetre figures. If you edit `BACK_BOXES`, those tests are the
  contract — do not "fix" them to match new numbers without a spec sheet.
- `tvMin`/`tvMax` are OUR routing rule, not FA data — the only screen range FA
  publishes is WB80's 60"-90".
- **SnapAV Strong VersaBox verified 2026-08-19** against Snap One's own
  installation manuals and dimensioned drawings. Same transposition trap as the
  FA line: marketing names them "8 x 14" / "14 x 14" / "14 x 20" with the
  HEIGHT first, and the XL was stored here as 20w x 14h. Every VersaBox is
  ~14.25" WIDE — they all drop into ONE 16" o.c. bay; height is what varies.
  The manuals label the figures `(W)` and `(H)` explicitly, so there is no
  ambiguity to re-litigate.
- The catalog keys were invented (`SB-RBX-*`); real Snap One SKUs are
  `SM-RBX-*`, and the XL is `SM-RBX-PRO-20`. `LEGACY_BOX_KEYS` / `canonBoxKey()`
  map the old keys forward on load and on JSON import, so saved designs and
  previously exported files keep their box instead of silently reverting to the
  default. Do not delete that map.
- Correcting these dimensions moved six **golden** constants (box centre,
  box bottom, PWR/LV positions in cases A, B and C). Each new value was
  re-derived by hand from the verified figures, not pasted from output — the
  inline comments show the arithmetic. If a catalog change makes a golden test
  fail, re-derive it the same way; never just paste what the code now prints.

## Reference drawing (imported PDF / image)

- pdf.js **3.11.174 UMD** is injected from unpkg on first import only, and the
  service worker caches it at runtime — one online use makes it work offline
  afterwards. Bump `CACHE` in `sw.js` when that version changes.
- The underlay and every markup point are stored in **wall inches**, never
  screen pixels. That is what keeps calibration true across a window resize,
  the mobile layout, and the separate print render. Do not "optimise" this into
  pixel coordinates.
- The page bitmap lives in **IndexedDB** (`tellavision` / `underlay` / key
  `current`); only its calibration rides in localStorage and the design JSON.
  A shared JSON therefore restores scale and annotations but not the drawing.
- Calibration picks and the in-progress stroke are held in **refs**, not state:
  a fast tap or flick can fire pointerdown/move/up inside one React batch,
  where a stale closure silently drops the gesture.
- By default the root `<svg>` clips the sheet so the schematic keeps its full
  size. "Show whole sheet" grows the canvas instead, capped at 1.5x the wall
  per side so a mis-scaled import can't shrink the TV to a dot.
- **Trace mode** (`TRACE`, on by default whenever a drawing is showing): the
  blueprint palette is near-white ink and disappears on a white scan, so
  `tracePalette()` re-bases the screen render on `PRINT_PALETTE` — dark ink on
  a light canvas, already tuned for paper — bumps `dimW` 1 -> 1.6, drops label
  plates to 82% white so the scan reads through them, and hollows every solid
  (`wallFill`/`tvFill`/`screenFill`/`mantel`/`fbFill` -> `none`) so the TV is an
  outline you can align to the drawn panel. Canvas chrome (background, grid,
  corner titles, mobile mini-preview) reads `screenSchem.P`, NOT
  `SCREEN_PALETTE` — keep it that way or the background stops following the
  mode. With no drawing showing, the blueprint look is byte-for-byte unchanged.

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
- **Markup colour resolves at RENDER time, never on the stored stroke.**
  `color: "auto"` is what goes to localStorage and to exported JSON;
  `resolveMarkupColor` turns it into the palette's `line` inside
  `renderMarkupEls`. Resolving on the way IN would bake one theme's colour into
  the saved design, and resolving on the way OUT would rewrite the user's
  choice — a stroke stored as a literal `#FFFFFF` must still export as
  `#FFFFFF`, because white over a dark photo underlay is a real intent. The
  export guard reports and offers; it recolours only when the user presses the
  button.
- `renderMarkupEls` needs BOTH `paper` and `ink` from the palette it is drawing
  into. The live in-progress stroke gets them from `screenSchem.P` — miss that
  and an `auto` stroke flips colour the instant the drag ends and it moves from
  the draft overlay into the schematic.
- `MARKUP_MIN_CONTRAST` is **1.5, not the WCAG 3:1**. Amber (1.83), green
  (1.91) and blue (2.75) are all below 3:1 on white and all read fine as 2px
  linework; holding markup to the text threshold flags four of six swatches and
  the warning stops meaning anything. Self-tests pin the measured ratio of every
  swatch, so retuning a palette across the line fails the harness.
- The diagnostics panel derives its group list from the results. It used to be
  a hard-coded `["golden","format","interop","invariant"]`, so five groups ran
  and counted toward the badge while never appearing in the panel. Do not put
  the literal back.
