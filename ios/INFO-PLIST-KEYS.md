# Info.plist keys to set

Xcode generates most of these in the target's **Info** tab. Add / confirm:

| Key | Value | Why |
|---|---|---|
| `CFBundleDisplayName` | `TellaVision` | Home-screen name |
| `CFBundleShortVersionString` | matches `APP_VERSION` in `tellavision.tsx` | keep them in step |
| `ITSAppUsesNonExemptEncryption` | `NO` | skips the export-compliance prompt on every upload |
| `UISupportedInterfaceOrientations` | Portrait + both Landscape | iPad review requires landscape |
| `UISupportedInterfaceOrientations~ipad` | all four | |
| `UIRequiresFullScreen` | `NO` | iPad multitasking — required for review |
| `UIStatusBarStyle` | `UIStatusBarStyleLightContent` | dark UI |
| `UILaunchScreen` | empty dict, background `#0B1622` | modern launch screen, no storyboard needed |

**No usage-description strings are needed.** The app has no camera, microphone,
location, contacts or photo-library access. Importing a drawing uses the
document picker, which needs no permission.
