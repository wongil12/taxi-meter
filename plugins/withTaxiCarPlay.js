const { withInfoPlist, withEntitlementsPlist, withAppDelegate } = require('expo/config-plugins');

const CARPLAY_ROLE = 'CPTemplateApplicationSceneSessionRoleApplication';
const PHONE_ROLE = 'UIWindowSceneSessionRoleApplication';
const ENTITLEMENT = 'com.apple.developer.carplay-driving-task';
const PHONE_DELEGATE = 'EXExpoAppSceneDelegate';

function configureInfoPlist(input, enabled) {
  const plist = structuredClone(input);
  plist.NSLocationWhenInUseUsageDescription = enabled
    ? '운행 기록을 위해 이동 거리와 시간을 측정합니다. CarPlay 연결 중 주행할 때는 휴대폰 화면이 꺼져도 측정을 계속합니다.'
    : '운행 기록을 위해 이동 거리와 시간을 측정합니다. 미터기에서는 거리와 저속 시간으로 요금을 계산합니다.';
  if (!enabled) {
    // Undo only this plugin's previous scene setup when changing the opt-in flag.
    if (plist.TaxiCarPlayConfiguration) {
      const configurations = plist.UIApplicationSceneManifest?.UISceneConfigurations;
      if (configurations) {
        configurations[CARPLAY_ROLE] = (configurations[CARPLAY_ROLE] || []).filter(
          scene => scene.UISceneDelegateClassName !== 'TaxiCarPlaySceneDelegate');
        if (!configurations[CARPLAY_ROLE].length) delete configurations[CARPLAY_ROLE];
        configurations[PHONE_ROLE] = (configurations[PHONE_ROLE] || []).filter(
          scene => scene.UISceneConfigurationName !== 'TaxiPhone');
        if (!configurations[PHONE_ROLE].length) delete configurations[PHONE_ROLE];
        if (!Object.keys(configurations).length) delete plist.UIApplicationSceneManifest;
      }
      if (plist.TaxiCarPlayConfiguration.addedLocationMode) {
        plist.UIBackgroundModes = (plist.UIBackgroundModes || []).filter(mode => mode !== 'location');
        if (!plist.UIBackgroundModes.length) delete plist.UIBackgroundModes;
      }
      delete plist.TaxiCarPlayConfiguration;
    }
    return plist;
  }
  plist.TaxiCarPlayConfiguration = plist.TaxiCarPlayConfiguration || {
    addedLocationMode: !(plist.UIBackgroundModes || []).includes('location'),
  };
  const manifest = plist.UIApplicationSceneManifest || {};
  const configurations = { ...manifest.UISceneConfigurations };
  configurations[CARPLAY_ROLE] = [{
    UISceneClassName: 'CPTemplateApplicationScene',
    UISceneConfigurationName: 'TaxiCarPlay',
    UISceneDelegateClassName: 'TaxiCarPlaySceneDelegate',
  }];
  if (!configurations[PHONE_ROLE]?.length) {
    configurations[PHONE_ROLE] = [{
      UISceneClassName: 'UIWindowScene',
      UISceneConfigurationName: 'TaxiPhone',
      UISceneDelegateClassName: PHONE_DELEGATE,
    }];
  }
  plist.UIApplicationSceneManifest = {
    ...manifest,
    UIApplicationSupportsMultipleScenes: true,
    UISceneConfigurations: configurations,
  };
  plist.UIBackgroundModes = [...new Set([...(plist.UIBackgroundModes || []), 'location'])];
  return plist;
}

function configureEntitlements(input, enabled) {
  const result = { ...input };
  // A build flag never grants Apple approval. Enable only after entitlement approval
  // and provisioning, including Apple's supported simulator testing workflow.
  if (enabled) result[ENTITLEMENT] = true;
  else delete result[ENTITLEMENT];
  return result;
}

function configureAppDelegate(source) {
  if (source.includes('// taxi-carplay: Expo scene lifecycle')) return source;
  if (!source.includes('class AppDelegate: ExpoAppDelegate')) {
    throw new Error('TaxiCarPlay requires an Expo Swift AppDelegate; preserve custom scene lifecycle manually.');
  }
  let output = source.replace(
    /class AppDelegate: ExpoAppDelegate(?!, ExpoReactNativeFactoryProvider)/,
    'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider',
  );
  const start = output.indexOf('    window = UIWindow(frame: UIScreen.main.bounds)');
  const endMarker = '      launchOptions: launchOptions)';
  const end = output.indexOf(endMarker, start);
  if (start < 0 || end < 0) {
    throw new Error('TaxiCarPlay could not identify the Expo window startup block; refusing to replace custom lifecycle.');
  }
  const stop = end + endMarker.length;
  const original = output.slice(start, stop);
  output = output.slice(0, start)
    + '    // taxi-carplay: Expo scene lifecycle\n'
    + '    // ExpoAppSceneDelegate starts React Native for phone scenes.\n'
    + '    if Bundle.main.object(forInfoDictionaryKey: "UIApplicationSceneManifest") == nil {\n'
    + original.split('\n').map(line => '  ' + line).join('\n') + '\n    }'
    + output.slice(stop);
  return output;
}

function withTaxiCarPlay(config) {
  const enabled = process.env.TAXI_METER_CARPLAY_ENTITLEMENT === '1';
  config = withInfoPlist(config, mod => {
    mod.modResults = configureInfoPlist(mod.modResults, enabled);
    return mod;
  });
  config = withEntitlementsPlist(config, mod => {
    mod.modResults = configureEntitlements(mod.modResults, enabled);
    return mod;
  });
  if (enabled) {
    config = withAppDelegate(config, mod => {
      if (mod.modResults.language !== 'swift') throw new Error('TaxiCarPlay requires Swift AppDelegate.');
      mod.modResults.contents = configureAppDelegate(mod.modResults.contents);
      return mod;
    });
  }
  return config;
}

module.exports = withTaxiCarPlay;
module.exports.configureInfoPlist = configureInfoPlist;
module.exports.configureEntitlements = configureEntitlements;
module.exports.configureAppDelegate = configureAppDelegate;
