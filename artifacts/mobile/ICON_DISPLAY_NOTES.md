# Mobile icon display notes

## Splash screen

`assets/images/taskdesk-app-icon.png` is the single opaque 1024×1024 source for
the Expo app icon and splash image. The splash plugin renders it in `contain`
mode at 220 dp on a white background in both appearances. Its white image
background matches the splash background, so it does not introduce a visible
box or crop the mark.

The plugin generates Android night resources for dark appearance and iOS
appearance-specific launch-screen assets on iOS 13 and later. Older Android or
iOS versions that do not support a system dark appearance use the light splash
configuration.

## Notifications

Android's small notification icon must be a monochrome white silhouette with
transparency. `assets/images/notification-icon.png` is 96×96 pixels and uses
the full TaskDesk mark rather than the launcher artwork. The Android
notifications plugin applies the existing `#0f62fe` tint.
That tint measures 5.00:1 against the light palette background (`#ffffff`) and
3.03:1 against the dark card background (`#262626`), just above the 3:1
non-text contrast target. Android notification surfaces and status-bar
rendering can vary by OS version and manufacturer.

The plugin's icon setting is Android-only. iOS does not use this image for
notification banners or the notification center; iOS displays the app's
system-managed icon. Android adaptive launchers use a separate transparent
foreground image, `taskdesk-adaptive-foreground.png`.

## Launcher icon masks

The shared app icon is a square, opaque 1024×1024 PNG. The Android adaptive
foreground is transparent and checked against both the central 66/108 safe-zone
bounds and its circular radius, so the monogram stays intact in circular and
rounded launcher masks.

## Browser favicon

The browser favicon is the one platform-specific exception to the shared opaque
app icon. That icon produces a visible white square in dark browser tabs, so
`assets/images/taskdesk-favicon.png` uses the same monogram cropped from the
transparent `taskdesk-adaptive-foreground.png` source. This keeps one mark
source while allowing the browser tab background to show through, including
inside the monogram. Keep this derivative limited to the web favicon; do not
replace the app icon or splash source with it.

## Browser favicon verification

The exported `static-build/favicon.ico` contains 16×16, 32×32, and 48×48
frames. On 2026-10-26 it was opened with Chromium 152.0.7977.64 in headless
mode and displayed at 16×16 and 32×32 against light (`#f1f3f4`) and dark
(`#202124`) tab-like backgrounds. The monogram remains recognizable at both
sizes, and transparent corners show the background rather than a white square.
No Chromium-specific difference or additional workaround was observed; the
transparent favicon derived from `taskdesk-adaptive-foreground.png` is the
solution.

This environment has Chromium only. Firefox is not installed, and Safari is
unavailable on this Linux environment, so their native tab rendering has not
been verified. Chromium was headless, so this check exercised its ICO decoding
and image scaling in a tab-like preview, not a screenshot of the native browser
tab bar. Do not treat this as confirmation for Firefox or Safari.

## Other icon checks

The shared app source and splash configuration remain unchanged. The Android
notification image has the required dimensions, white foreground, and
transparent background. A native build and physical device screenshot are
still needed to confirm manufacturer-specific Android status-bar and
notification-tray rendering on installed devices.
