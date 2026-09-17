# Chrome Web Store English listing

## Name

ChatGPT Message Tracker

## Short description

Count your ChatGPT web messages by mode, with local history and detection for multiple ChatGPT interface languages.

## Detailed description

Keep track of the messages you send on the ChatGPT website, grouped by the mode you selected.

ChatGPT Message Tracker provides a floating counter and a toolbar popup, separate counts for Instant, Medium, High, Extra High and Pro, manual corrections and undo, recent time-window and daily statistics, and a JSON export of settings and usage metadata.

Mode detection uses the language declared by the ChatGPT page and labels taken from original ChatGPT frontend resources. The bundled vocabulary covers 21 language/region variants: English; Simplified Chinese, Traditional Chinese for Taiwan and Hong Kong; Spanish for Spain and Latin America; Portuguese for Brazil and Portugal; French for France and Canada; German, Japanese, Korean, Arabic, Hindi, Russian, Indonesian, Italian, Turkish, Vietnamese and Thai.

English by default, with two independent language preferences under Settings → Languages: Interface language controls the popup, floating counter, settings, prompts and date/number formatting; ChatGPT mode-label language controls the mode names displayed within the extension. Both offer the 21 language/region choices above. Changes save automatically, custom names and existing history are preserved, and Arabic interfaces use right-to-left layout. These preferences do not change your ChatGPT account language or force the detector to use a different page language.

Privacy: settings and count metadata stay in the current browser profile. To confirm sends, the extension temporarily compares the composer draft with newly rendered user-message text in page memory and reads relevant mode controls, conversation paths and send events. It does not persist conversation bodies or upload them to the developer or an AI service. There are no ads, telemetry, cloud sync, or API keys to configure.

Limitations:
- This is an independent personal counter, not an official OpenAI usage meter. It cannot show or guarantee your remaining quota or bypass usage limits.
- Counts apply only to ChatGPT web sends in the Chrome profile where the extension runs. Mobile apps, other devices, other browsers and sends made before installation are not included.
- Page structures and server-provided labels vary by account. Some fallback labels originate in other settings modules of the official frontend; automatic detection is not guaranteed for every account. Unknown labels use clearly indicated manual mode selection.
- A message appearing in the webpage is not proof of successful server processing or billable usage. Do not use these counts for billing or official quota decisions.
- Requires desktop Chrome and your own access to ChatGPT. No ChatGPT account or subscription is provided.

ChatGPT Message Tracker is not affiliated with or endorsed by OpenAI. ChatGPT belongs to its respective owner.

Privacy policy: https://github.com/Neptuneeeeeeee/Chatgpt-message-tracker/blob/main/PRIVACY.md
Support: https://github.com/Neptuneeeeeeee/Chatgpt-message-tracker/issues
