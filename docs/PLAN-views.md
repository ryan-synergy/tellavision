# Plan — Task views & multi-page submittal

Status: **designed, not built.** Agreed in planning 2026-09-04.

## Why

Every annotation is on by default — TV dims, VESA, back box, power, low voltage,
tape-out, plus five or six callout pills. Correct as a *record*, overwhelming as
a thing you read.

Nobody needs all of it at once. The electrician wants rough-in. The installer
marking the wall wants four lines and four numbers. The homeowner wants to see
the TV. One drawing is currently trying to serve four people.

The data is already right. What is missing is **meaningful subsets**.

## The views

| View | Shows | Reader |
|---|---|---|
| **Layout** | TV, wall, heights, centreline | quoting |
| **Rough-in** | back box, power, low voltage, offsets | GC / electrician |
| **Mount** | VESA, mount plate, hardware, weight check | installer |
| **Tape-out** | the four lines and four numbers, nothing else | whoever marks the wall |
| **Full** | everything — today's behaviour | the record |
| **Client** | photo + rendered TV (see PLAN-camera-and-presentation.md) | homeowner |

## Rules that keep it honest

- **A view is a named set of the toggles that already exist.** Switching flips
  switches visible in Settings — nothing hidden, nothing new to reason about.
- **Tweaking a view makes it "Custom."** No silent divergence between what the
  chip says and what is drawn.
- **Markup persists across views.** Annotations belong to the job, not the view.
- **A view that would be empty is skipped**, not printed blank — e.g. rough-in
  with the back box and both services turned off.

## Where the control lives

A dropdown in the header — `View: Rough-in ▾` — beside the gear.

Not a strip. v2.2.0 removed the SHOW strip to reclaim ~49px of vertical space on
tablet, where chrome was taller than the drawing. A strip would hand that
straight back; a dropdown costs one button and replaces fiddling with six
toggles.

## Tape-out is not really a drawing

It is used at the wall, one hand on a tape, reading a number and marking it.
That is a **checklist**: four numbers, large type, high contrast, tick them off
as you mark them. Possibly the most useful item in this plan, and barely a
drawing at all.

On the printed sheet the same page carries the four numbers large, with
checkboxes to tick with a pencil.

## Multi-page submittal

`FULL PACK`'s PDF becomes one page per view:

1. **Layout** — elevation, TV specs, heights
2. **Rough-in** — box, power, low voltage, offsets, rough-in parts list
3. **Mount** — VESA, mount model, capacity and weight check, bracket
4. **Tape-out** — four numbers large, with checkboxes

Every page carries the same project header and a page number. Hand the
electrician page 2 and they never see the VESA pattern.

This is what actually dissolves "too much at once": no page has to carry
everything, so no page is crowded.

Client view stays a **separate export** — it is a different artifact for a
different person, and it is meaningless without a reference photo.

### Implementation notes

`buildSchematic` is a pure function of its inputs, so a page is just another
call with a different toggle set. N renders at export time, once.

**The trap:** the render audit only measures the on-screen schematic, and the
stress sweep does not know about view presets. Four new page layouts is four new
chances for labels to collide, unmeasured — exactly how the text-scale bug got
in. **Add sweep configs for each view preset** before trusting the output.

## Still open

- Which views belong in the pack by default, and whether that is configurable
- Whether tape-out tick-offs persist with the job or reset each time
- Whether Layout and Client are distinct enough to both exist, or whether Client
  is simply Layout over a photo with the annotations off

---

## Built — v2.5.0

Shipped as five views (`VIEW_PRESETS` / `VIEW_ORDER`) plus a multi-page PDF.
Three things in the plan above turned out to be wrong or incomplete, and the
corrections are the useful part of this record.

### 1. "A view is just a named set of the existing toggles" — no

`showOutlet` does not only draw the outlet. It also feeds `buildPartsList` and
the DXF notes. A preset that switched it off to declutter a page would have
silently dropped the outlet from that page's parts list, and the crew would have
worked a sheet that understated the job.

So a view is a **display-only filter**: gated booleans (`vPwr`, `vBox`, …)
derived inside `buildSchematic` from the view and the toggle together. The
design is never altered. The parts list, the spec table and the DXF always
describe the whole job, whatever page you are looking at.

### 2. Filtering alone makes the Tape-out page blank

`showTapeOut` defaults to off, so the one page whose entire purpose is tape-out
rendered nothing. Fixed with a `force` map on each preset — but only for
**derived aids** (tape lines, VESA pattern), which are computed from geometry
already on the page and add no scope. Scope facts (outlet, low voltage, back
box) are never forced: if the job has no outlet, a page that drew one would be
lying. Rule of thumb: a page dedicated to a derived aid should never be blank; a
page whose subject genuinely isn't in this job should be.

### 3. The sweep gap was real, and it caught a live bug

Adding per-view sweep configs (5 stress cases × 4 views, plus two "toggle off,
view forces it on" cases) took the suite from 103 to 125 configs and immediately
failed one: `view:tapeout mobile 375`, "VERTICALS FROM LEFT WALL" over
"108" H".

Not a layout tweak — a real defect. `hasRail`, which reserves **horizontal**
space for the callout rail, tested only vesa/box/pwr/lv. The packing simulation,
which reserves **vertical** space, tested those *and* tape *and* mount. The two
had drifted. Every view before Tape-out happened to have one of the four on, so
the rail was always reserved by accident. Tape-out is the first page whose rail
holds only a tape pill — nothing was reserved, and the pill landed on the
wall-height dimension.

Fixed by deriving one set of predicates (`railHasVesa`, `railHasBox`,
`railHasSanus`, `railHasTravel`) and using them in all three places that need to
agree: horizontal reservation, vertical simulation, and the rail pushes
themselves. They can no longer drift.

### 4. Multi-page PDF

Sheet 1 is the whole job — full drawing plus specs, parts and notes. Sheets 2–5
are Layout, Rough-in, Mount, Tape-out: one drawing each, a caption naming the
task, and the legend. The spec and parts tables are deliberately **not**
repeated; they describe the job, not the sheet, and a per-page copy invites
someone to work from a partial page they didn't notice was partial. Each sheet
says so in its caption.

Off-screen rendering (`renderViewSvg`) reuses the sweep's technique. One
prerequisite bug: `K()` keyed element ids on the palette alone, so all five
sheets emitted the same underlay `clipPath` id and every page would have clipped
to page one's crop. Ids are now scoped by view as well. Verified with a cropped
underlay: five sheets, five distinct clip ids, each image referencing its own.

Toggle: Settings → Multi-page PDF (default on). Off exports exactly the view on
screen.

## Still open

- Tape-out checklist treatment (tick-offs on the tape-out sheet)
- Whether tape-out tick-offs persist with the job or reset each time
- Client/presentation view — still blocked on the camera work in
  PLAN-camera-and-presentation.md
