# Interface languages

- Supported choices: simplified Chinese (`zh-CN`), English (`en-US`), and Russian (`ru-RU`).
- The first supported browser language is used initially, with English as the fallback. An explicit choice is stored as `daymark.language` in localStorage. If storage is blocked, the choice works for the current page and a translated message explains that it could not be saved.
- Language is a device/browser preference; it is not synchronized to the account.
- Switching does not reload the page, reset sign-in, translate user notes, discard drafts, or alter date keys. Saved password visibility state is retained while its button label is translated.

## Calendar notation

GanZhi characters are the reference notation in every language. Day details add pinyin for English and Cyrillic transcription for Russian, for example `甲子 · Jiǎ-Zǐ` and `甲子 · Цзя-цзы`. Compact month cells retain the characters to avoid crowding. The Russian transcription follows the terminology listed in [Гань чжи — Синология.Ру](https://www.synologia.ru/a/Гань_чжи).

Chinese lunar labels remain traditional. English and Russian use numeric month/day labels, with an explicit leap-month label. The browser's Chinese calendar provides the numeric month and leap-month flag. Gregorian date formatting and weekday names follow the selected interface language. Weeks still start on Sunday.

Solar-term names retain Chinese characters alongside translated meanings and pinyin. All existing estimate notices remain visible. Language selection does not change the calendar's timezone or calculations.

## Maintenance and verification

`translations.js` contains English source-message keys and complete Chinese/Russian translations. Templates use named placeholders shared across languages. `i18n.js` localizes original interface text and attributes, and tracks explicitly registered status messages so they update in place. Note text and imported content never enter the translation registry. Unknown backend error details retain their original wording; common authentication errors are translated.

Both translation scripts are bundled with the static deployment and offline cache. Native date-picker dialogs and browser validation messages may follow the phone/browser language rather than the app's selection. The installed app's manifest name remains Daymark Calendar.

Tests cover translation completeness, placeholder parity, Chrome/WebKit mobile layouts, language persistence and blocked storage, leap-month labels, GanZhi pronunciation, and preservation of note drafts, saved text, date routes, and signed-in accounts. Real phone testing remains necessary.
