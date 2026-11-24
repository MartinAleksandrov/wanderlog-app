import type { ConfigContext, ExpoConfig } from 'expo/config';

// Dynamic app config: Expo reads app.json first and passes it in as `config`; this file adds
// what can't live in JSON. app.json can't read environment variables, and the Google Maps key
// must stay out of git, so the key comes from .env.local (Expo CLI loads it before running this).
//
// GOOGLE_MAPS_ANDROID_API_KEY is deliberately not EXPO_PUBLIC_: it's written into the Android
// manifest at build time (where Google's map SDK reads it), not into the JavaScript bundle.
// Expo Go ignores it and uses Expo's own key, so only our native builds need it.
const googleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

if (!googleMapsApiKey) {
  console.warn(
    'GOOGLE_MAPS_ANDROID_API_KEY is not set: native Android builds will crash when the map opens.',
  );
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  // app.json always has these; repeated here because ExpoConfig requires them
  name: config.name ?? 'Wandr',
  slug: config.slug ?? 'wandr',
  plugins: [
    ...(config.plugins ?? []),
    ['react-native-maps', { androidGoogleMapsApiKey: googleMapsApiKey }],
  ],
});
