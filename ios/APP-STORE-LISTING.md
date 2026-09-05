# App Store Connect — ready to paste

## Identity

| Field | Value |
|---|---|
| App Name (30 char max) | `TellaVision` |
| Subtitle (30 char max) | `TV wall layout & tape-out` |
| Bundle ID | `com.synergyav.tellavision` |
| SKU | `TELLAVISION-001` |
| Primary category | Productivity |
| Secondary category | Graphics & Design |
| Age rating | 4+ (answer No to every questionnaire item) |
| Price | Free |
| Privacy Policy URL | `https://ryan-synergy.github.io/tellavision/privacy.html` |
| Support URL | `https://ryan-synergy.github.io/tellavision/support.html` |
| Marketing URL | `https://ryan-synergy.github.io/tellavision/` |

## Promotional text (170 char max)

```
Trace over the architect's elevation at true scale, then hand the installer a
dimensioned drawing with the mount height, VESA pattern and rough-in already
worked out.
```

## Description

```
TellaVision turns a wall and a TV into an installation drawing.

Enter the wall, pick a brand and screen size, and it works out the mount height
from viewing distance, holds the clearance above a mantel, picks the back box
and mount, and places the power and low-voltage rough-in. Then it draws a
dimensioned front elevation you can hand to an installer or a GC.

TRACE THE ARCHITECT'S DRAWING
Import a PDF or photo of an elevation and calibrate it to true scale — box the
TV shown on the drawing and it scales and positions in one gesture, or click a
known dimension and type its real length. Crop the sheet to the wall that
matters and blank out the clutter so your layout reads clearly.

MARK IT UP
Pen, line, arrow, box, text, and a measure tool that reads out in real inches.
Snapping locks to the wall, floor, TV edges and centreline so a dimension lands
exactly where you meant it. Draw with Apple Pencil — pressure sets the line
weight and your palm is ignored. Select anything afterwards to move, reshape,
recolour or delete it.

REAL HARDWARE, REAL DIMENSIONS
Future Automation WB wall boxes, SnapAV Strong VersaBox and VersaBox Pro, and
the Sanus Black Series mount range — each dimension traced to a manufacturer
document, with the mount's weight capacity and VESA range checked against the
panel you picked. Anything that does not fit is flagged before you order it.

Every table is editable if your catalog differs, and your corrections are kept
separate from the shipped data so an update never overwrites them.

HAND IT OFF
Export a PDF submittal sheet with the specification and rough-in parts list, a
true-scale layered DXF for AutoCAD, Visio or Bluebeam, JSON for other tools, or
a PNG or SVG image — straight into Files, Mail or AirDrop.

WORKS WITH NO SIGNAL
Everything is built into the app. No account, no sign-in, and no network
connection at any point. It works in a basement.

Dimensions are calculated from published specifications and may vary by model
variant. Always verify the VESA pattern and panel dimensions against the
manufacturer's spec sheet before drilling.
```

## Keywords (100 char max, comma separated, no spaces)

```
tv,mount,install,av,elevation,vesa,drawing,dxf,tape-out,integrator,cad,measure,wall,bracket
```

## What's New (first release)

```
First release.
```

## App Review notes — IMPORTANT

Guideline 4.2 rejects apps that are only a website in a wrapper. Paste this so
the reviewer sees the native functionality up front:

```
TellaVision is an offline engineering tool for AV installers. It is not a web
view of a website — the entire application is bundled and it makes no network
requests at any point. You can verify this in Airplane Mode: every feature works.

Native capabilities:

• Apple Pencil — pressure-sensitive markup with palm rejection, so an installer
  can rest a hand on the iPad while redlining a drawing.
• Document export — PDF, DXF, JSON, PNG and SVG are generated on device and
  handed to the system share sheet for Files, Mail or AirDrop. PDFs are rendered
  natively.
• Document import — reference drawings come in through the system document
  picker and are stored on device.
• Fully offline — bundled assets, no network, no account, no sign-in.

No demo account is needed. To exercise the core flow: pick a TV size from the
strip, then EXPORT to produce a drawing.
```

## Screenshots required

| Device | Pixels | Note |
|---|---|---|
| iPad 13" | 2064 x 2752 | the iPad Pro 13-inch simulator outputs this exactly |
| iPhone 6.7" | 1290 x 2796 | iPhone 17 Pro Max simulator |

Suggested set: the drawing with a TV placed and callouts visible; a reference
drawing traced with the TV overlaid; the markup tools in use; the Data screen;
an export in progress.

## Pre-submit checklist

- [ ] Apple Developer enrolment approved
- [ ] Signing certificate created (Xcode → Settings → Accounts → Manage Certificates)
- [ ] Screenshots captured at both sizes
- [ ] `MARKETING_VERSION` matches `APP_VERSION` in `tellavision.tsx`
- [ ] Archive → Distribute → App Store Connect
- [ ] Export compliance: already answered by `ITSAppUsesNonExemptEncryption = NO`
