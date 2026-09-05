# TellaVision for iPhone & iPad

Native shell around the existing web app. The engine, catalog, self-tests and
drawing code are shared verbatim with the browser build — there is no fork.

## Before you can build

1. **Install Xcode** from the Mac App Store (~10 GB). This machine currently has
   only Command Line Tools, so `xcodebuild` is missing.
2. **Enrol in the Apple Developer Program** — $99/yr, developer.apple.com.
   - **Individual** enrolment is near-instant, but your personal legal name is
     shown as the seller on the App Store listing.
   - **Organization** enrolment shows "Synergy AV" as the seller and requires a
     free **D-U-N-S number**. Apple's lookup can take a few days to a couple of
     weeks. **Start this first — it gates everything else.**

## Creating the project

Xcode → New Project → iOS → App
- Product Name `TellaVision`, Interface **SwiftUI**, Language **Swift**
- Bundle identifier e.g. `com.synergyav.tellavision`
- Delete the generated `ContentView.swift`

Then add from this folder:
- `TellaVision/TellaVisionApp.swift` (replaces the generated one)
- `TellaVision/WebHost.swift`
- `TellaVision/PrivacyInfo.xcprivacy`
- `TellaVision/Assets/AppIcon-1024.png` → drop into the asset catalog's AppIcon slot

Set the Info.plist keys listed in `INFO-PLIST-KEYS.md`, and add the run-script
phase from `BUILD-NOTES.md` so the web bundle is staged into the app.

## How it works

`WebHost.swift` serves the bundled web app over a custom `tellavision://`
scheme rather than `file://`. That matters: a `file://` origin gives WKWebView
an opaque origin where **localStorage and IndexedDB are unreliable**, and saved
layouts, the catalog overlay and imported reference drawings all live there.

Exports cross a message bridge. In a browser `a[download]` and `window.print()`
work; inside a WKWebView neither does, so `saveFile()` in `tellavision.tsx`
detects the host and posts to it instead. The Swift side writes a temp file and
opens the system share sheet. PDFs are rendered natively with
`WKPDFConfiguration` from the same print HTML the browser build uses.

## App Store review — Guideline 4.2

A plain website wrapper gets rejected. The native value here is real, and the
review notes should say so plainly:

- **Apple Pencil** — pressure-modulated stroke weight and palm rejection while
  marking up a drawing
- **Native document export** — PDF, DXF, JSON, PNG, SVG through the share sheet
  into Files, Mail or AirDrop
- **Fully offline** — every asset is bundled, no network calls at all
- **Durable on-device storage** for imported drawings, which a Safari tab can
  have evicted

## Submission checklist

- [ ] Screenshots: 6.7" iPhone and 13" iPad (required sizes)
- [ ] Privacy policy URL (required even though nothing is collected)
- [ ] Category: Productivity, or Graphics & Design
- [ ] Age rating questionnaire: all No → 4+
- [ ] `ITSAppUsesNonExemptEncryption` = NO
- [ ] Support URL
- [ ] Review notes explaining the native capabilities above
- [ ] Demo not required — no login
