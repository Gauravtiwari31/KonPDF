# KonPDF Privacy Policy

**Effective date:** 12 October 2026

KonPDF is an Android app for scanning, converting, resizing and editing everyday files, made by Gaurav Tiwari at NotWork.world ([github.com/NotWork-world](https://github.com/NotWork-world)). This policy explains what happens to your information when you use it. In short: **no account, no ads, no tracking**, and your files are only ever used to do what you asked.

## What stays on your phone

- **Scanning and reading text.** Documents are scanned by Google's document scanner and their text is read by Google ML Kit, both running on your phone through Google Play services. The optional AI reader (Settings → Developer Mode) also runs entirely on your phone. Pages you scan or read are not sent to us for this.
- **History, settings and saved results** are stored only on your phone. They are excluded from Android's cloud backups and phone-to-phone transfers, and you can clear History at any time in the app.

## Files you send to the converter

Converting, resizing, enhancing and the PDF tools are done by the KonPDF converter, a server we run on Render (Singapore). When you use them:

- The files you chose are sent over an encrypted connection (HTTPS), processed, and the results are sent back to your phone.
- Uploaded files and results are kept in a private folder with a random name and **deleted automatically after 30 minutes**.
- File contents are never logged, never looked at by people, never shared and never used to train anything.
- Passwords you give for protecting or unlocking a PDF are used for that one job only and are never stored.
- The assistant NW sees only the names, types and sizes of your files, not what is in them, and what you type to it is used only to answer you.
- Your IP address is held in memory for about a minute to stop abuse (rate limiting). Like any web server, ours and our host keep standard request logs (IP address, time and the address requested, never file contents) for a short time to keep the service running and secure.

If you point the app at a converter you run yourself (Settings → Converter engine), your files go to that server instead, and this section applies to whoever runs it.

## Google Drive backup (optional)

Drive backup is off unless you connect it in Settings → Google Drive.

- **Signing in** happens in Google's own screens, through Google Play services. KonPDF never sees your Google password.
- **What KonPDF can access:** only the `drive.file` permission, which lets KonPDF see and change **only the files it creates in your Drive** (its "KonPDF" folder and the results it saves there). It cannot see or read anything else in your Drive.
- **What KonPDF receives from Google:** an access token, used only to save your results to your Drive, and your name and email address, shown in the app so you know which account is connected. These stay on your phone; we don't receive them.
- **Where your files go:** straight from your phone to your own Google Drive. They don't pass through the KonPDF converter or any other server of ours.
- **Disconnecting** (Settings → Google Drive → Disconnect) withdraws KonPDF's access with Google and removes the account from the app. Files already in your Drive stay there and remain yours. You can also remove KonPDF's access at any time at [myaccount.google.com/connections](https://myaccount.google.com/connections).

KonPDF's use and transfer of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements. Google user data is used only to provide the Drive backup you turned on; it is not used for advertising, not sold, not shared with anyone else, and not read by people.

## Downloads from other services

- **AI reader model** (Developer Mode, only if you choose to download it): the model files come from Hugging Face. Like any download, Hugging Face sees your IP address. Nothing you scan is sent there.
- **Google Play services** may fetch the scanner's and text reader's components from Google the first time you use them. Google's handling of that is covered by [Google's Privacy Policy](https://policies.google.com/privacy).

## What we don't do

- No accounts or sign-up for KonPDF itself.
- No advertising, analytics or tracking tools, and no selling or renting of any data.
- No access to your contacts, location, camera roll or other files: you pick each file yourself in Android's own picker.

## Children

KonPDF is a general-purpose tool and is not directed at children under 13.

## Changes

If this policy changes, the new version will be posted here with a new effective date. The full history of this page is in the [project's repository](https://github.com/NotWork-world/KonPDF/commits/main/docs/privacy-policy.md).

## Contact

Questions or requests about privacy: open an issue at [github.com/NotWork-world/KonPDF/issues](https://github.com/NotWork-world/KonPDF/issues), or use the developer email shown on KonPDF's Google Play page.
