# Keeping the app bundle in sync with the web build

The iOS target ships the SAME files GitHub Pages serves. Do not fork them.

Add a **Run Script Phase** to the target, before "Copy Bundle Resources":

```sh
# Stage the web app into the bundle as a folder reference named "web"
SRC="$SRCROOT/.."
DEST="$SRCROOT/TellaVision/web"
rm -rf "$DEST" && mkdir -p "$DEST/vendor"
cp "$SRC/index.html" "$SRC/sw.js" "$SRC/favicon.png" "$SRC/apple-touch-icon.png" "$DEST/"
cp "$SRC"/vendor/*.js "$DEST/vendor/"
```

Then drag `TellaVision/web` into the project as a **folder reference** (blue
folder, not yellow group) so the directory structure is preserved — the custom
scheme handler resolves paths relative to it.

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
