# TellaVision

**TV wall layout, mount selection and tape-out drawings for AV installers.**
Live at **<https://ryan-synergy.github.io/tellavision/>** — part of the
[Synergy Field Kit](https://ryan-synergy.github.io/).

Pick a wall, pick a TV, and TellaVision computes the mount height, VESA pattern,
back box, and power / low-voltage rough-in positions, then draws a dimensioned
front elevation you can hand to an installer or a GC. Import the architect's
elevation as a PDF and trace directly over it at true scale.

It runs entirely in the browser. No build step, no server, no account, and no
CDN — React and pdf.js are vendored, so it works with the network off. Open the
page on a laptop or an iPad on site and it just works.

An iPhone/iPad app lives in [`ios/`](ios/README.md) — it builds, installs and
runs today. [Privacy policy](https://ryan-synergy.github.io/tellavision/privacy.html)
· [Support](https://ryan-synergy.github.io/tellavision/support.html)

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

**Ink that survives the export.** The first swatch is **AUTO**: it is not a
colour but a rule — draw with it and the stroke comes out near-white on the
blueprint and near-black on the printed sheet, because it resolves to whatever
the drawing it lands on uses for linework. The six fixed colours still behave
exactly as before; nothing is ever recoloured behind your back, because white
over a dark photo underlay is a legitimate thing to have meant.

Because a fixed colour can outlive the surface it was chosen against, two things
watch for it. A swatch that would be invisible — in the current theme, or on the
white export sheet, which is what PDF, PNG and SVG always print on — carries a
caution dot, and its tooltip says which of the two is failing. And a PDF, PNG,
SVG or Full Pack export that would lose a stroke stops first and names the
strokes, offering to switch just those to AUTO. You can always export anyway.

**One task at a time.** The view switcher in the header filters the drawing to
the job in front of you — **Layout**, **Rough-in**, **Mount**, **Tape-out**, or
**Full**. It filters the drawing only: the parts list, the specification table
and the DXF always describe the whole job, so no sheet can understate the scope.
Tape-out and Mount draw their own guides even when those are switched off in
Settings.

**Describe it instead of filling it in.** `IMPORT ▾ → DESCRIBE IT`, or the
*Describe it* card on the start panel. Type — or dictate, using the keyboard's
own mic — what you measured:

> wall is ten foot wide, eight foot ceiling, seventy-five inch Sony, mantel at fifty-four

It reads wall, fireplace and mantel, TV brand and size, heights and offsets, and
project/client. Mount and back box are deliberately left to the recommendation
engine, which already checks VESA and capacity limits.

**Nothing is applied until you confirm it.** The parse is shown as a checklist —
each value against the phrase that produced it, in your display units — and you
drop any row before it lands. This is a measurement tool for finished homes: a
misheard number is a hole in the wrong place. Two guards matter especially:

- *"five three"* and *"fifty three"* are one word and 48 inches apart. Two bare
  numbers with no unit between them are refused as ambiguous rather than
  resolved, with a note telling you which unit to say.
- A value outside the plausible range (`wall ten wide` → 10") is reported, not
  silently dropped — because you almost certainly meant ten feet.

It is a deterministic grammar, not a model: it runs in any browser and in the
Simulator, needs no Apple Intelligence hardware, and is pinned by 14 self-tests.
Dictation is an input method, not a feature — there is no speech code in the app.

**Photograph the wall.** `IMPORT ▾ → PHOTOGRAPH THE WALL` opens the camera
directly — no native code, the same trick as keyboard dictation. Most jobs are
retrofits in finished homes where cabinets, mantel and millwork are already
there and none of it is in a drawing.

**Then square up the perspective.** A photo of a wall is a trapezoid, not an
elevation — you never shoot square-on, and two-point calibration on a trapezoid
is right in one spot and progressively wrong everywhere else. On a tool people
drill from that is the worst kind of bug, because nothing looks broken.
`PDF ▾ → SQUARE UP A PHOTO` takes four taps on something of known size (the TV
already on the wall, a door, a drywall sheet, or your own dimensions) and
resamples the bitmap through a real homography. Both dimensions are required:
four corners of an unknown rectangle fit infinitely many shapes.

It warns when the shot is too oblique (the far edge is rebuilt from too few
pixels) or the reference is too small a fraction of the frame (tap error
multiplies across the wall). Scale comes out true; position is still yours to
drag.

**Tape-out is a checklist.** In the Tape-out view the four numbers you snap on
the wall get tick boxes — on the drawing and in a panel below it. Ticking dims
that label so what still reads at full strength is what is left to do. Ticks
stay with the job on the device but are never exported: **the printed sheet
always prints empty boxes**, because the person holding the tape ticks them with
a pen.

**Trace what is actually in the way.** The **OBSTRUCTION** tool boxes a shelf,
cabinet top, crown or sconce — and unlike every other markup, **the engine reads
it**. The recommended mount height lifts to clear it, and the placement warnings
say when you are too close. Name each one and give it its own clearance
(3" default); the drawing shows the keep-out band above it.

This is the point of the camera work. In a finished home the real constraint is
rarely a parametric fireplace — it is whatever is on that wall. A box traced on
a squared, height-pinned photo is a measurement, so tracing now feeds the
recommendation instead of annotating it. On a photo with no datum set the panel
says the positions are approximate.

**One measurement pins the photo.** Squaring a photo fixes its **scale** —
both reference dimensions are known, so inches-per-pixel is solved. It does not
fix its **position**: nothing in a photograph says how high off the floor
anything is. So the app asks for one height, and after that every AFF it reads
off the photo is measured rather than eyeballed.

If you squared up against a **door, it costs nothing** — a door slab stands on
the floor, so the answer is 0 and the app fills it in. Against a TV it is one
tape reading of the bottom edge. Skipping is allowed and says plainly that
heights are approximate until you set one; `PDF ▾ → SET THE HEIGHT` comes back
to it any time.

**The TV already on the wall does three jobs.** When you square up a photo by
tapping the existing panel, say which TV it actually is — **the one being
replaced, not the one you are proposing**. That one tap then gives you scale,
the upsize comparison, and a height reference:

- The old TV is **ghosted over the new one** in the Client view, so a single
  image shows exactly how much bigger the new panel is and how much closer it
  comes to the mantel — the part clients cannot picture.
- **MATCH IT** puts the new TV where the old one was, same centre height and
  same centreline. It refuses if the photo is not on the wall yet rather than
  copying a nonsense height into the design.

The existing TV is stored in the photo's own pixel space, so dragging the photo
into position carries the ghost with it.

**Show the client.** A sixth view, **Client** — their wall photographed, with
the proposed TV on it at true scale, and nothing else. No grid, no wall outline,
no dimensions, no title block, no parametric fireplace drawn over the real one.
The TV renders as a television rather than a rectangle: near-black screen, thin
bezel, and a real drop shadow so it sits on the wall instead of floating over
it. Exporting from this view gives a single clean page — the client sheet is
deliberately **not** part of the submittal pack, because it is a different
artifact for a different person and carries no specifications.

**One stage at a time.** The sidebar is a stepper — START, THE WALL, THE TV,
THE HARDWARE. Only the stage you are working in shows its controls; the others
collapse to a row carrying their summary (`120" × 108" · fireplace`, `Sony 75"`)
that you tap to jump to. Within a stage, sections are single-open. That takes
the sidebar from about 34 rows to 8. `ALL SECTIONS` at the bottom expands
everything if you want the old behaviour.

**Two densities.** Comfortable (default) and Compact, in Settings → Appearance.
Compact restores the older, tighter type and spacing — but **not** the older tap
targets. 44pt is a floor, not a preference: a control too small to hit reliably
is a defect at either density.

**Three themes.** **Dark** (the original), **Blueprint** (cyanotype — white
linework on deep blue), and **Paper** (ink on white, exactly what the PDF
prints). Settings → Appearance. Themes change the screen only: every export —
PDF, PNG, SVG, DXF — always uses the print palette, so the client gets the same
document whichever theme you happen to be working in. A self-test pins the
stronger claim, that a theme cannot move anything on the drawing, only recolour
it.

**Hand it off.** Export a PDF submittal sheet with specs and a rough-in parts
list, a layered true-scale DXF for AutoCAD / Visio / Bluebeam, JSON for other
Field Kit apps, or PNG / SVG. The PDF defaults to one sheet per task, so the
electrician can be handed the rough-in sheet and nothing else.

---

## Quick start

1. Open <https://ryan-synergy.github.io/tellavision/>.
2. **IMPORT ▾** — bring in a reference drawing (PDF or image) or a design /
   survey JSON. Or just start typing wall dimensions.
3. Set the wall, then pick a TV size from the strip.
4. Adjust mount height, offsets and hardware in the sidebar.
   Use the **⚙** gear for what appears on the drawing — annotations, labels,
   text size (S/M/L/XL), units and snapping.
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
| Sanus Black Series mounts | 2026-08-20 | SANUS Black Series literature (`SANBLK0919_web.pdf`) — every model's spec block |

A panel's VESA pattern must fall **inside** the mount's published min–max
range. Checking only the maximum reported a Sony 42" (100×100) as compatible
with a CILT1 whose minimum is 200×200 — it will not bolt up without an adapter.
The app now flags that, and SANUS does not publish a swivel figure for this
line, so none is shown.

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
| **PDF** | Submittal sheet — elevation, specification table, rough-in parts list, field-verification notes. With **Multi-page PDF** on (default), sheet 1 is the whole job and sheets 2–5 are Layout, Rough-in, Mount and Tape-out, one drawing each. Specs and parts appear on sheet 1 only — they describe the job, not the sheet, and each task sheet says so. Turn it off to export exactly the view on screen. |
| **DXF** | True-scale, layered (`WALL`, `TV`, `VESA`, `BACKBOX`, `ELECTRICAL`, `LOWVOLT`, `DIMENSIONS`, `MARKUP`…) for AutoCAD, Visio, Bluebeam |
| **JSON** | Design + computed values, so other apps can consume the results without reimplementing the engine |
| **PNG / SVG** | Blueline raster / vector image |
| **FULL PACK** | PDF + JSON + DXF in one action |

The reference drawing and markup appear in PDF, PNG and SVG. DXF carries markup
on its own layer; a raster underlay has no DXF equivalent.

Those three raster/vector exports serialise the print palette on white, so they
are the ones gated by the contrast warning above. JSON stores every markup
colour verbatim (`"auto"` included, as the sentinel) and DXF hands markup to the
CAD app on its own layer, so neither can lose a stroke and neither is gated.

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
- `build.html` — the recompiler. Open it over http, press **COMPILE AND
  DOWNLOAD**, and save the result over `index.html`. It applies the same
  transform `dev.html` does, adds the production shell and the mount/service-
  worker tail, and escapes any `</script` in the compiled output — the trap
  that silently blanks the page if you inline the JS by hand. It refuses to
  emit a file that still contains a raw closer.
- `index.html` — production build, generated by `build.html`. Never edit it
  directly: the next recompile overwrites it. See `PUBLISH-TO-FIELDKIT.md`.

### Health checks

The app self-tests on every load. The badge in the status bar is the contract:

- **✓ 118/118** embedded self-tests — golden hand-computed cases, catalog
  invariants, snapping, markup geometry, markup ink and contrast, JSON interop.
  If this is red, do not trust the drawing. The panel lists every group it
  actually ran; the list used to be hard-coded to four, which quietly hid the
  snapping, markup, stud-bay, mount and underlay groups from view.
- **SWEEP** in the diagnostics panel — 125 hostile configurations checked for
  label collisions, including runs at the largest text size and every task view
  under its worst label loads. Must read `0 failing`.

  Adding a view means adding its sweep configs in the same commit. A view
  repacks the leader rail from a different subset, so a page that is fine at
  Full can still collide — this is not theoretical, it is how the Tape-out rail
  bug was caught (see `docs/PLAN-views.md`).
- **Render audit** — every text bounding box checked for overlaps, clipping,
  and for sitting on linework without a backing plate. Must read
  `0 overlaps · 0 clipped · 0 unbacked`. It runs against the *active* theme, so
  switching theme re-audits the drawing.

Four DOM audits back the chrome, run in the browser against the live page over
3 themes × 2 densities × 4 stages, all currently at zero:

- **Contrast** — WCAG AA, 4.5:1 body / 3:1 large, main UI and settings panel.
- **Tap targets** — nothing interactive below 44×44, in either density. There
  used to be an exception here for the diagnostics badge at 40px, on the grounds
  that the status bar was a thin strip a 44px badge would dominate. That stopped
  being true when the density work moved the measured values into the bar: it is
  now ~118px tall and the badge is a third of it. The exception is gone.
- **Type floor** — nothing below 9.5px in the chrome. Text inside the `<svg>`
  is exempt and must be, because the drawing is a scale drawing that zooms —
  audit `el.closest("svg")` out or you will get 24 false hits and start
  enlarging dimension labels that are correct.
- **Reach** — no interactive element with `right > innerWidth`, swept across
  every iPad viewport: 744×1133 / 820×1180 / 834×1210 (portrait), 1133×744 /
  1180×820 / 1376×1032 (landscape), plus 390×844 for the phone. This one is
  worth running separately from the tap audit because it catches a different
  failure: a control that is the right *size* and simply not on screen.

That last audit exists because it found one. `UNDO` and `CLEAR` rode at the end
of the markup bar, which is `overflow-x: auto` with the scrollbar deliberately
hidden below the mobile breakpoint. On an iPad mini in portrait that put both
100px past the right edge, reachable only by a horizontal swipe on a bar that
looks like it simply ends. The actions now live in a pinned `.mk-acts` cluster
outside the scrolling strip, and the scroll behaviour was pulled back from
767px to 599px so a 744pt iPad wraps the tools instead of hiding them. **A
scrolling toolbar is a fine home for tools and a terrible home for actions** —
tools have visible state and you can hunt for them, but nobody scrolls sideways
looking for undo.

Two things to know before running these yourself. **Disable CSS transitions
first** (`transition: none !important`) — a hidden browser pane freezes them
mid-flight, so you sample interpolated colours and chase bugs that are not
there. And **measure interactive elements only**: a decorative `<span>` carrying
a control's class is not a target, and counting it sends you enlarging things
that were already fine.
Markup ink is the deliberate exception and is held to `MARKUP_MIN_CONTRAST`
(1.5), not to 3:1 — a saturated 2px amber redline reads perfectly well on white
at 1.83:1 because hue carries it, and the WCAG figure would flag four of the six
swatches until the warning became noise nobody reads. The self-tests pin the
measured ratio of every swatch on every palette, so retuning a palette that
pushes one across the line fails the harness rather than shipping. If
you add or retune a theme, measure it — the print palette's greys look fine on
paper and are too light on a backlit screen, which is exactly the trap the Paper
theme fell into first time. Note that measuring contrast in an automated browser
needs transitions disabled (`transition: none !important`), or you will sample
frozen mid-transition colours and chase bugs that are not there.

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
