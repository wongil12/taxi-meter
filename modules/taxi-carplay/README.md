# Native taxi meter / CarPlay

Expo autolinks this local module from the default `./modules` directory. The native
meter remains available on iOS whether or not the CarPlay entitlement is enabled.
Android and Expo Go use the optional-module fallback. All bridge operations return
snapshots asynchronously on the main queue; `onStateChange` carries the same shape.

Add `./plugins/withTaxiCarPlay` to Expo's plugins configuration. By default the
plugin does **not** add CarPlay scenes, background location mode, or the protected
`com.apple.developer.carplay-driving-task` entitlement.

Only after Apple approves the driving-task entitlement and the signing profiles
include it, set `TAXI_METER_CARPLAY_ENTITLEMENT=1` for native generation. This flag
is configuration, not approval. Use Apple's supported CarPlay simulator testing
workflow; never alter a provisioning profile or claim entitlement approval to
make a distribution build pass signing.

The opt-in config uses Expo 57's `EXExpoAppSceneDelegate` for the phone scene.
The plugin adds `ExpoReactNativeFactoryProvider` to the generated AppDelegate and
lets that scene create the React Native window, retaining Expo's scene lifecycle,
URL and user-activity forwarding. Legacy phone startup remains the fallback when
no scene manifest is present. Existing signing settings and App Group entitlements
are preserved. Custom AppDelegate startup requires explicit manual integration;
the plugin fails rather than guessing how to replace it.

The manifest declares background location only for opted-in builds. The runtime
must independently turn background GPS on only for an active CarPlay-connected
trip; declaring the capability alone does not start background tracking.

Run config tests with `node --test plugins/withTaxiCarPlay.test.js`. Native
compilation and device/CarPlay lifecycle testing must be coordinated with the
app's signing and provisioning setup. Expo 57 prebuild cleans by default: always use `npx expo prebuild --platform ios
--no-clean --no-install` and back up the manually signed project first. Do not
regenerate this project with a clean prebuild.

References: [Apple: Displaying Content in CarPlay](https://developer.apple.com/documentation/carplay/displaying-content-in-carplay),
and the installed `expo/ios/AppDelegates/ExpoAppSceneDelegate.swift` and
`ExpoReactNativeFactoryProvider.swift` (Expo 57).
