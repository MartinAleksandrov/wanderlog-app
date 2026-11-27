import type { DeviceInfo } from '@convex/schema';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// What this phone is, sent to the backend on each start (users.store) for the admin dashboard.
// Read from React Native's own Platform.constants rather than a library such as expo-device:
// on Android it has the same model and maker (Android's Build.MODEL and Build.MANUFACTURER),
// with no extra native module, so no rebuild and it works in Expo Go too.
// The same for the whole run, so it's worked out once.
export const DEVICE_INFO: DeviceInfo = readDeviceInfo();

function readDeviceInfo(): DeviceInfo {
  // From app.config.ts, built into the app
  const appVersion = Constants.expoConfig?.version;

  if (Platform.OS === 'android') {
    const { Model, Manufacturer, Release } = Platform.constants;
    return {
      platform: 'android',
      model: Model,
      manufacturer: Manufacturer,
      osVersion: `Android ${Release}`,
      appVersion,
    };
  }
  if (Platform.OS === 'ios') {
    // iOS doesn't tell apps the exact model without a native module, only phone or tablet
    const { interfaceIdiom, osVersion } = Platform.constants;
    return {
      platform: 'ios',
      model: interfaceIdiom === 'pad' ? 'iPad' : 'iPhone',
      manufacturer: 'Apple',
      osVersion: `iOS ${osVersion}`,
      appVersion,
    };
  }
  return {
    platform: Platform.OS,
    model: 'unknown',
    osVersion: String(Platform.Version),
    appVersion,
  };
}
