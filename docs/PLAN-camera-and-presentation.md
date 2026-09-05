# Plan — Camera capture & presentation view

Status: **Part 1 built in v3.0.0.** Part 2 (presentation view) still open.
Agreed in planning 2026-09-04.

## Why

The app assumes you arrive with an architect's PDF. The real work is mostly
**retrofit in finished homes** — hanging a TV where there isn't one, or upsizing
the one that's there. Cabinets, millwork, mantel and outlets are already in
place, and none of that is in a drawing.

It also has two audiences and currently serves one. The installer needs the
dimensioned elevation. The homeowner needs to see what a 75" looks like on their
wall. Same job, two outputs.

---

## Part 1 — Camera capture (the input)

`IMPORT ▾ → Photograph the wall`. The existing import pipeline (rasterise,
store in IndexedDB, calibrate, crop, blank, trace, mark up) is reused unchanged.

### The problem that decides everything

A photo of a wall is a **trapezoid**, not an elevation — you never shoot
square-on. Calibrating a trapezoid with two points is correct in one spot and
progressively wrong elsewhere. On a tool people drill from, that is the worst
kind of bug because nothing looks broken.

Fix: **four-corner perspective correction.** Tap the corners of a rectangle whose
real size is known, compute the homography, resample the bitmap. The stored
underlay is then a true flat elevation and everything downstream works unchanged.

Note this cannot be a CSS transform — those are affine, and affine cannot
express perspective. It has to be a real inverse-mapped resample with bilinear
sampling (~2.4M px at the 1800px cap, a few hundred ms, once per photo).

### Primary path — the existing TV (retrofit)

For an upsize the best reference is already hanging on the wall:

1. Photograph the wall with the existing TV in it
2. Tap the TV's four corners
3. Say what it is — "Sony 55"

The catalog already holds its exact panel dimensions. This rectifies, scales AND
positions in one gesture, with **no tape measure at all**. It is also more
accurate than tapping wall corners: a bezel is a crisp high-contrast edge, a
wall/ceiling corner is a soft shadow you are guessing at.

This is `SNAP TO TV` — which already exists for PDFs — pointed at a photograph.

### Secondary path — wall corners (empty wall, new construction)

Tap the four wall corners. Width comes from the tape (the measurement reliably
taken on site). Height is **derived from the camera's lens data** where possible
and offered as a measured value; where it cannot be derived the app **stops and
asks for a taped height** rather than proceeding.

That refusal is deliberate. If the height is a guess, the rectified photo is
vertically stretched by the same error: horizontal measurements stay perfect and
vertical ones are quietly wrong.

Side benefit: wall height already drives the recommended mount height, mantel
clearance and the fit warnings. Deriving or insisting on a real height improves
those too, independent of photos.

### Other references

Door (80" x 30/32/36), drywall sheet (48 x 96), custom. Perspective removal needs
the rectangle's **proportions**, not just one side — four corners of an unknown
rectangle are consistent with infinitely many shapes — so any reference must
have both dimensions known.

### Guards

- Warn on extreme obliquity: the far edge is reconstructed from too few pixels
- Warn when the reference occupies a small fraction of the frame — tap error
  multiplies across the wall (an outlet plate is a poor reference for this reason)
- Never proceed on an unverified vertical scale

### Handled by construction

EXIF rotation; HEIC (native capture returns JPEG — the web build cannot decode
HEIC off-iOS); barrel distortion is not corrected, so frame edges are the least
trustworthy region and framing advice says so.

### Verification

Take a known flat elevation, apply a **known** homography to synthesise an
angled photo, rectify it, and assert the recovered dimensions match. The test
knows the right answer independently — the same approach that caught the WB21
transposition.

---

## Part 2 — Presentation view (the output)

A view toggle, not a second app.

**Working drawing** — what exists today. Unchanged.

**Client view** — their wall, photographed, with the proposed TV on it at true
scale. Nothing else:

- Reference photo at full opacity
- Every annotation toggle off; no grid, no title block, no wall outline
- The TV drawn as a **rendered panel** — dark screen, thin bezel, soft drop
  shadow so it sits on the wall rather than floating over it
- Export as a clean image / PDF to text or email

Most of this is a preset of options that already exist. The genuinely new work is
the panel rendering — the difference between "a rectangle" and "a television".

### Upsize comparison

Existing TV ghosted, proposed TV solid, both on the photo. One image answers the
question the client is actually asking, and shows the part they cannot picture:
how much closer it comes to the mantel.

The thing tapped to calibrate is the same thing ghosted for comparison — one tap
does both jobs.

---

## Sequence

1. **Camera capture + presentation view** — one feature in two halves. A client
   view of a blueprint is not persuasive; a client view of their own wall is.
2. **Document model** — a job holds several walls. Photographing four rooms
   implies somewhere to put four of them.
3. **AR tape-out** — project the layout onto the real wall at install time.

## Parked

**Traced obstructions as real constraints.** Today anything traced from a photo
is decoration; the engine cannot see it. In a finished home the real constraint
is not a parametric fireplace but whatever is actually there — a floating shelf,
cabinet tops, crown, a window edge. Boxing an obstruction and having the app
enforce "TV bottom must clear this by 3 inches" would make tracing feed the
recommendation instead of annotating it. Only worth doing because the work is in
finished rooms.

## Still open

- The preset reference list — what is reliably dimensioned on site, especially
  pre-drywall where a door is only a rough opening
- Whether the known-object path needs a position tap or whether dragging with the
  existing snapping is good enough. A feel question; answer it after one use.


---

## Built — v3.0.0 (Part 1)

Camera capture needed **no native code**: `<input type="file" accept="image/*"
capture="environment">` opens the rear camera directly. The same realisation as
dictation — the platform already does it, so there is no bridge, no permission
string and no change to the "no network at any point" claim.

Rectification is `solveHomography` / `planRectify` / `rectifyBitmap`, all pure
except the last (which needs a canvas). Verified as the plan specified: a known
flat elevation pushed through a **known** homography, rectified, and the
dimensions asserted back — plus an end-to-end run through the real UI where a
synthetic oblique photo of a 32" × 80" door came back measuring 32.51" × 80.43",
with the residual accounted for by the drawn outline's own 0.78" thickness.

Interior points are what the corner test actually checks: four corners exactly
determine H, so corners matching is trivially true and proves nothing.

### Found while building

The file inputs lived **inside** the collapsible Reference Drawing section, so
`ref.current` was null whenever it was collapsed — which the v2.7.0 stage
stepper made the normal state. Every entry point that calls `.click()` on those
refs (the IMPORT menu, the start card) silently did nothing. They are now
mounted at the always-rendered header level. Worth remembering: a ref into a
conditionally-rendered subtree is a null waiting to happen.

The crop is dropped on rectify — it was expressed against the old pixel grid and
would cut the wrong region out of the squared-up image.

### Still open from Part 1

- Position after rectify is still a drag. Scale is true; the reference's
  real-world position on the wall is not knowable from the photo alone. The
  plan's open question — whether the known-object path needs a position tap —
  is now answerable after one real use.
- Wall-corner path with a derived camera height is NOT built. Only references
  with both dimensions known are offered, which is the safe subset.
