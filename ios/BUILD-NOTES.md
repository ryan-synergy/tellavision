# Keeping the app bundle in sync with the web build

The iOS target ships the SAME files GitHub Pages serves. Do not fork them.

A **Run Script Phase** named "Stage web bundle" does this automatically, before
"Copy Bundle Resources". It copies `index.html`, `sw.js`, the icons and
`vendor/` from the repo root into `TellaVision/web`, and then **fails the build**
if the staged `APP_VERSION` does not match `MARKETING_VERSION`.

> This paragraph used to describe the phase as something to add by hand, and
> nobody had. `TellaVision/web` was a manual copy that went stale at v2.4.0 while
> the web app reached v3.4.0 — five releases. The simulator quietly ran the old
> bundle, and an archive would have shipped it. The phase is now in the project,
> and the version check is there so this fails loudly instead of silently.

`TellaVision/web` is in the project as a **folder reference** (blue folder, not
yellow group) so the directory structure is preserved — the custom scheme
handler resolves paths relative to it.

`TellaVision/web` is committed even though the build regenerates it, so a fresh
clone builds byte-identically without first running the web build. It is
generated output: never hand-edit it, and expect it in the diff of every
release.

If the build stops with `web bundle is X but MARKETING_VERSION is Y`, rebuild
`index.html` from `tellavision.tsx` or fix the version — do not edit the staged
copy, it is overwritten every build.

## Release checklist

1. Rebuild `index.html` from `tellavision.tsx` (see `PUBLISH-TO-FIELDKIT.md`).
2. Confirm the health badge: self-tests, sweep `0 failing`, audit `0 unbacked`.
3. Bump `APP_VERSION` and `MARKETING_VERSION` together, and increment
   `CURRENT_PROJECT_VERSION`. These drifted four releases once (the project sat
   at 2.4.0 while the web app shipped 2.8.0) because nothing checked. Verify
   from the repo root — it prints nothing when they agree:

   ```bash
   diff <(grep -o 'APP_VERSION = "[0-9.]*"' tellavision.tsx | head -1 | grep -o '[0-9][0-9.]*') <(grep -o 'MARKETING_VERSION = [0-9.]*' ios/TellaVision.xcodeproj/project.pbxproj | head -1 | grep -o '[0-9][0-9.]*')
   ```

   `project.pbxproj` is hand-maintained; run `plutil -lint` on it after any edit.
4. Archive → Distribute → App Store Connect.
