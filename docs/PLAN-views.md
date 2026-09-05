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
