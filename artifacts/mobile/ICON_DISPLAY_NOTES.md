# Mobile icon display notes

## Splash screen

`assets/images/icon.png` contains the full-color TaskDesk mark on a transparent
background. Its visible mark is centered in the 1024×1024 canvas and has a
788×588 pixel content bound. The `expo-splash-screen` plugin renders it in
`contain` mode at 220 dp, so neither iOS nor Android crops the horizontal mark.
The matching background is white in light appearance and `#161616` in dark
appearance; the mark's internal negative spaces remain transparent in both.

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
system-managed icon. The launcher icons remain separate:
`taskdesk-app-icon.png` for the standard app icon and
`taskdesk-adaptive-foreground.png` for Android adaptive launchers.

## Verification scope

The source assets and Expo native configuration were checked for both
appearances. The splash mark is centered and inside the splash image's
`contain` bounds; the Android notification image has the required dimensions,
white foreground, and transparent background. A native build and physical
device screenshot are still needed to confirm manufacturer-specific Android
status-bar and notification-tray rendering on installed devices.
