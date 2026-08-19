# TellaVision

**TV wall layout, mount selection and tape-out drawings for AV installers.**
Live at **<https://ryan-synergy.github.io/tellavision/>** — part of the
[Synergy Field Kit](https://ryan-synergy.github.io/).

Pick a wall, pick a TV, and TellaVision computes the mount height, VESA pattern,
back box, and power / low-voltage rough-in positions, then draws a dimensioned
front elevation you can hand to an installer or a GC. Import the architect's
elevation as a PDF and trace directly over it at true scale.

It runs entirely in the browser. No build step, no server, no account. Open the
page on a laptop or an iPad on site and it works offline after the first load.

---

## What it does

**Sizing and placement.** Enter wall dimensions and (optionally) a fireplace and
mantel. Choose a brand and size and it recommends a mount height from viewing
distance, honours clearance above a mantel or firebox, and flags sizes that will
not fit the wall.

**Real hardware, real dimensions.** Future Automation WB back boxes, SnapAV
Strong VersaBox / VersaBox Pro, and the Sanus in-wall mount ladder — with
capacity and VESA limits checked against the panel you picked. Every back box
dimension is traced to a manufacturer document (see [Data provenance](#data-provenance)).

**Trace over the architect's drawing.** Import a PDF or photo of an elevation,
calibrate it to true scale, and lay the TV, mount, box and dimensions over it.
Crop the sheet and blank out the clutter so the parts that matter read cleanly.

**Mark it up.** Pen, line, arrow, box, text and a measure tool that reads out in
real inches. Snap to the wall, floor, TV edges and centreline so measurements
land exactly. Select, drag, reshape and recolour anything after you have drawn
it.

**Hand it off.** Export a PDF submittal sheet with specs and a rough-in parts
list, a layered true-scale DXF for AutoCAD / Visio / Bluebeam, JSON for other
Field Kit apps, or PNG / SVG.

---

## Quick start

1. Open <https://ryan-synergy.github.io/tellavision/>.
2. **IMPORT ▾** — bring in a reference drawing (PDF or image) or a design /
   survey JSON. Or just start typing wall dimensions.
3. Set the wall, then pick a TV size from the strip.
4. Adjust mount height, offsets and hardware in the sidebar.
5. **EXPORT ▾ → FULL PACK** for PDF + JSON + DXF in one go.

Add it to your home screen on an iPad and it installs as an offline app.

---

## Working from a PDF elevation

The workflow that makes this worth using on a real job:

1. **IMPORT ▾ → Reference drawing.** Multi-page PDFs get a page picker.
2. **Calibrate** — two ways, both on the toolbar over the drawing:
   - **SNAP TO TV** — drag a box over the TV drawn on the elevation. One gesture
     sets the scale *and* parks the sheet so the drawn TV sits under yours.
   - **2-PT SCALE** — click both ends of a dimension you know and type its true
     length. Accepts `96`, `96"`, `8'`, `8' 6 1/2"`.
3. **CROP** to the part of the wall you care about — this kills border hatching,
   title blocks and the sheet's own dimension strings in one drag. It never
   touches your calibration.
4. **BLANK** patches over whatever clutter is left inside the working area.
5. **TRACE** (on by default) switches the screen to dark ink on white and
   hollows out the TV so you can align it to the drawing underneath.

Calibration and annotations are stored in **wall inches**, not pixels, so they
survive a window resize, the mobile layout and the print render.

---

## The Data screen

Every measurement table the app calculates from is editable under **DATA** —
back boxes, mounts, VESA patterns, exact panel dimensions, TV sizes, the mount
recommendation ladder, clearances, and the 16:9 size formula. You can also add
products that are not in the catalog at all.

Edits are an **overlay**, not a rewrite. The shipped catalog stays versioned and
read-only; your changes live separately and are merged over the top. So an app
update can improve the baseline without clobbering a field correction, and every
changed row stays visibly marked as yours. Per-row revert, per-table revert, and
a full reset are all one click. Export the overlay as JSON to carry corrections
between machines or share them with the team.

The physical invariants validate you as you type — set a back box wider than the
stud bay it claims to fit and the cell turns red and tells you why.

---

## Data provenance

Back box dimensions are the numbers someone cuts drywall from, so they are
traced to manufacturer documents rather than transcribed from a catalog page.

| Line | Verified | Source |
|---|---|---|
| Future Automation WB / WB-2S | 2026-08-19 | Manufacturer technical sheets + the WB21/26/31-2S installation guide |
| SnapAV Strong VersaBox / Pro | 2026-08-19 | Snap One installation manuals and dimensioned drawings |
| Sanus in-wall mounts | not verified | Catalog figures — treat capacity and VESA limits as indicative |

**A note worth reading if you edit this data.** Both back box manufacturers name
their products **height-first** — "WB21", "8 x 14", "14 x 20" — and both were
originally stored here transposed. Every one of these boxes is width-constrained
because it drops into a stud bay: Future Automation single-stud boxes are 13.9"
wide, `-2S` twin-stud boxes are 29.9", and every VersaBox is ~14.25". The
`studBay` self-tests now enforce that nothing can be wider than the framing it
claims to fit.

TV size ranges per box are *our* routing rule, not manufacturer data. The only
published screen range in the catalog is the WB80's 60"–90".

---

## Exports

| Format | What it is |
|---|---|
| **PDF** | Submittal sheet — elevation, specification table, rough-in parts list, field-verification notes |
| **DXF** | True-scale, layered (`WALL`, `TV`, `VESA`, `BACKBOX`, `ELECTRICAL`, `LOWVOLT`, `DIMENSIONS`, `MARKUP`…) for AutoCAD, Visio, Bluebeam |
| **JSON** | Design + computed values, so other apps can consume the results without reimplementing the engine |
| **PNG / SVG** | Blueline raster / vector image |
| **FULL PACK** | PDF + JSON + DXF in one action |

The reference drawing and markup appear in PDF, PNG and SVG. DXF carries markup
on its own layer; a raster underlay has no DXF equivalent.

---

## Development

There is no build toolchain and no package manager. The source of truth is
`tellavision.tsx`; `index.html` is the production build with the compiled JS
inlined and React loaded from a CDN.

```bash
python3 -m http.server 5173
```

- `dev.html` — live harness, transpiles `tellavision.tsx` in the browser with
  Babel standalone. Edit and reload; no build step.
- `index.html` — production build. Regenerate it from `tellavision.tsx` when
  shipping; see `PUBLISH-TO-FIELDKIT.md` for the exact procedure and the
  `</script>` escaping trap that silently blanks the page if you miss it.

### Health checks

The app self-tests on every load. The badge in the status bar is the contract:

- **✓ 92/92** embedded self-tests — golden hand-computed cases, catalog
  invariants, snapping, markup geometry, JSON interop. If this is red, do not
  trust the drawing.
- **SWEEP** in the diagnostics panel — 95 hostile configurations checked for
  label collisions. Must read `0 failing`.
- **Render audit** — measures every text bounding box for overlaps and
  clipping. Must read `0 overlaps · 0 clipped`.

Golden test constants are hand-derived, not pasted from output. If a catalog
change makes one fail, re-derive it — the arithmetic is in the inline comments.

### Layout rules

Three rules keep a dense drawing readable, and they are easy to break:

1. A measure label offsets along its line's normal, so it never sits on its own
   shaft.
2. Hand markup is spliced in **below** the annotation layer — a redline can
   never strike through a dimension.
3. Every label gets an opaque backing plate.

`PUBLISH-TO-FIELDKIT.md` has the full set of gotchas, including the React
batching trap that has bitten calibration, pen strokes, the lasso and the crop
gesture in turn.

---

## Storage

| What | Where | Why |
|---|---|---|
| Design | `localStorage` `tellavision-v1` | Small; legacy `tv-wall-planner-v1` still reads |
| Catalog overlay | `localStorage` `tellavision-catalog-v1` | Deltas only |
| Reference drawing bitmap | IndexedDB `tellavision` / `underlay` | 1–3 MB; will not fit in localStorage |

Nothing leaves the browser. There is no backend and no telemetry.

---

## Browser support

Any current Chrome, Safari, Edge or Firefox, desktop or tablet. Installable as a
PWA. Works offline after the first load; the PDF engine (pdf.js) is fetched on
first import and cached from then on, so import one drawing while online before
relying on it in the field.

---

*Built for Synergy AV. Dimensions are calculated from published specifications —
always verify VESA pattern and panel dimensions against the manufacturer spec
sheet before drilling.*
