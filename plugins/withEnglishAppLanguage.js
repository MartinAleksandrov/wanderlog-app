// Local config plugin: the Android app always runs in English, whatever language the phone is in.
// Google's map draws its own labels (streets, districts, landmarks) in the app's language, and
// JavaScript can't change that, so MainActivity sets Android's per-app language when it opens.
// Only this app changes; the rest of the phone keeps its language. Expo Go is a separate app, so
// it keeps the phone's language there.
const { withMainActivity } = require('expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

// The same as APP_LOCALE in src/lib/locale.ts
const LANGUAGE = 'en-GB';

const IMPORTS = `import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat`;

// After super.onCreate: AppCompat needs a running activity to reach Android's locale service.
// Set only when it differs, because a change restarts the activity once in the new language.
const SET_LANGUAGE = `    val english = LocaleListCompat.forLanguageTags("${LANGUAGE}")
    if (AppCompatDelegate.getApplicationLocales().toLanguageTags() != english.toLanguageTags()) {
      AppCompatDelegate.setApplicationLocales(english)
    }`;

module.exports = function withEnglishAppLanguage(config) {
  return withMainActivity(config, (config) => {
    if (config.modResults.language !== 'kt') {
      throw new Error('withEnglishAppLanguage expects a Kotlin MainActivity');
    }
    let contents = config.modResults.contents;
    contents = mergeContents({
      tag: 'wandr-english-imports',
      src: contents,
      newSrc: IMPORTS,
      anchor: /^import android\.os\.Bundle$/m,
      offset: 1,
      comment: '//',
    }).contents;
    contents = mergeContents({
      tag: 'wandr-english-language',
      src: contents,
      newSrc: SET_LANGUAGE,
      anchor: /super\.onCreate\(/,
      offset: 1,
      comment: '//',
    }).contents;
    config.modResults.contents = contents;
    return config;
  });
};
