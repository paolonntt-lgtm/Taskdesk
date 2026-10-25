# Mobile icon display notes

## Splash screen

`assets/images/taskdesk-app-icon.png` is the single opaque 1024×1024 source for
the Expo app icon, splash image, and web favicon. The splash plugin renders it
in `contain` mode at 220 dp on a white background in both appearances. Its
white image background matches the splash background, so it does not introduce
a visible box or crop the mark.

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

## Verification scope

The shared source asset and Expo configuration were checked for both
appearances. The mark is centered within the splash image's `contain` bounds;
the Android notification image has the required dimensions, white foreground,
and transparent background. A native build and physical device screenshot
are still needed to confirm manufacturer-specific Android status-bar and
notification-tray rendering on installed devices.
