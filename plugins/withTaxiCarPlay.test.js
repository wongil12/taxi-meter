const { test } = require('node:test');
const assert = require('node:assert/strict');
const { configureInfoPlist, configureEntitlements, configureAppDelegate } = require('./withTaxiCarPlay');
const role = 'CPTemplateApplicationSceneSessionRoleApplication';
const key = 'com.apple.developer.carplay-driving-task';

test('unapproved builds do not add CarPlay scene, background GPS or protected entitlement', () => {
  const input = { NSLocationWhenInUseUsageDescription: 'old' };
  const output = configureInfoPlist(input, false);
  assert.equal(output.UIApplicationSceneManifest, undefined);
  assert.equal(output.UIBackgroundModes, undefined);
  assert.deepEqual(configureEntitlements({ 'com.apple.security.application-groups': ['group.a'], [key]: true }, false), {
    'com.apple.security.application-groups': ['group.a'],
  });
  assert.equal(input.NSLocationWhenInUseUsageDescription, 'old');
});

test('approved configuration preserves existing scene roles and capabilities, and is idempotent', () => {
  const phone = [{ UISceneDelegateClassName: 'CustomPhoneDelegate' }];
  const input = { UIBackgroundModes: ['audio'], UIApplicationSceneManifest: {
    UISceneConfigurations: { UIWindowSceneSessionRoleApplication: phone, customRole: [{ name: 'preserved' }] },
  } };
  const output = configureInfoPlist(input, true);
  assert.deepEqual(configureInfoPlist(output, true), output);
  assert.deepEqual(output.UIBackgroundModes, ['audio', 'location']);
  assert.deepEqual(output.UIApplicationSceneManifest.UISceneConfigurations.UIWindowSceneSessionRoleApplication, phone);
  assert.equal(output.UIApplicationSceneManifest.UISceneConfigurations[role][0].UISceneDelegateClassName, 'TaxiCarPlaySceneDelegate');
  assert.deepEqual(configureEntitlements({ 'com.apple.security.application-groups': ['group.a'] }, true), {
    'com.apple.security.application-groups': ['group.a'], [key]: true,
  });
});

test('Expo scene configuration uses the installed Expo delegate without a duplicate RN startup', () => {
  const result = configureInfoPlist({}, true);
  assert.equal(result.UIApplicationSceneManifest.UISceneConfigurations.UIWindowSceneSessionRoleApplication[0].UISceneDelegateClassName, 'EXExpoAppSceneDelegate');
  const source = `class AppDelegate: ExpoAppDelegate {
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
}`;
  const patched = configureAppDelegate(source);
  assert.match(patched, /ExpoReactNativeFactoryProvider/);
  assert.match(patched, /UIApplicationSceneManifest/);
  assert.equal(configureAppDelegate(patched), patched);
  assert.equal((patched.match(/factory.startReactNative/g) || []).length, 1);
  assert.throws(() => configureAppDelegate('class CustomDelegate {}'));
});

test('turning opt-in off removes plugin-owned configuration without removing existing background capabilities', () => {
  const disabled = configureInfoPlist(configureInfoPlist({}, true), false);
  assert.equal(disabled.UIApplicationSceneManifest, undefined);
  assert.equal(disabled.UIBackgroundModes, undefined);
  const original = { UIBackgroundModes: ['location', 'audio'] };
  assert.deepEqual(configureInfoPlist(configureInfoPlist(original, true), false).UIBackgroundModes, ['location', 'audio']);
});
