// Cyrillic names and addresses in Latin letters, by Bulgaria's official system (the
// Transliteration Act, also what Google uses in its English addresses). For what Google has no
// English version of: "площад „Света Неделя“" → 'ploshtad "Sveta Nedelya"'. Text without
// Cyrillic comes back as it was.

const LETTERS: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sht',
  ъ: 'a',
  ь: 'y',
  ю: 'yu',
  я: 'ya',
};

const CYRILLIC = /[Ѐ-ӿ]/;
const CYRILLIC_WORD = /[Ѐ-ӿ]+/g;
// Bulgarian quotes, „like this“, become the plain ones Google's English addresses use
const BULGARIAN_QUOTES = /[„“]/g;

export function toLatin(text: string): string {
  if (!CYRILLIC.test(text)) return text;
  return text.replace(CYRILLIC_WORD, wordToLatin).replace(BULGARIAN_QUOTES, '"');
}

// A letter Bulgarian doesn't have (Russian "ы", Serbian "љ") stays as it is
function wordToLatin(word: string): string {
  const allCaps = word.length > 1 && word === word.toUpperCase();
  return [...word]
    .map((char, i) => {
      const lower = char.toLowerCase();
      // "-ия" at the end of a word is "ia", not "iya": "София" → "Sofia"
      const endsInIa = lower === 'я' && i === word.length - 1 && word[i - 1]?.toLowerCase() === 'и';
      const latin = endsInIa ? 'a' : (LETTERS[lower] ?? char);
      if (char === lower) return latin;
      // "Ж" is "ZH" in a word in capitals ("ЖК" → "ZHK"), otherwise "Zh" ("Жеравна" → "Zheravna")
      return allCaps ? latin.toUpperCase() : latin.charAt(0).toUpperCase() + latin.slice(1);
    })
    .join('');
}
