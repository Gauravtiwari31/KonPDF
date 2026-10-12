# Publish KonPDF on Google Play

Everything in the code is ready for Google Play. What's left are the steps only the app's owner can do: the developer account, the upload key, screenshots, and the Play Console forms. This guide walks through them in order, with the answers KonPDF needs.

## Already done in the project

| Requirement | Status |
|---|---|
| Target API level (new apps and updates from 31 Aug 2026: Android 16, API 36) | `targetSdkVersion 36` |
| 16 KB memory pages (all updates since Nov 2025) | All 64-bit native libraries checked: 16 KB-aligned (React Native, llama.rn, ML Kit) |
| Android App Bundle | `bundleRelease`, shrunk with R8; the deobfuscation map and native debug symbols are packed into the bundle for crash reports |
| Version code that always grows | Taken from `mobile/package.json` (`1.2.3` → `10203`) |
| Signing | Your upload key, read from Gradle properties; bundles refuse to build without it |
| Permissions | Internet, network state and vibration only. No storage, camera, location or contacts permission; files come from Android's own pickers |
| Privacy policy | [docs/privacy-policy.md](privacy-policy.md) (also what Google's sign-in screen links to) |
| Store listing text and graphics | `mobile/fastlane/metadata/android/en-US/`: title, short and full description, release notes, 512 px icon, 1024 × 500 feature graphic |

Screenshots are the one listing item still to make: they need the app running on a phone (see [Store listing](#5-store-listing)).

## 1. Developer account

1. Sign up at <https://play.google.com/console> (one-time fee of US $25) and complete identity verification.
2. **New personal accounts** must run a **closed test with at least 12 testers, opted in for 14 days in a row**, before they can publish to everyone. Plan for this: start the closed test as soon as the first bundle is accepted.

## 2. Create the upload key (once)

Google Play re-signs the app with its own key (Play App Signing). You sign each upload with your **upload key**. Create it once, outside the repository:

```bash
keytool -genkeypair -v -keystore konpdf-upload.jks -alias konpdf-upload -keyalg RSA -keysize 2048 -validity 10000
```

`keytool` asks for a password and your name; remember the password. Keep `konpdf-upload.jks` and its password **backed up somewhere safe** (a password manager, a private cloud folder). `*.jks` and `*.keystore` are git-ignored, but don't put the key in the project folder anyway. If you lose it, Play can reset the upload key, but that takes days.

Then tell Gradle where it is. Add four lines to `~/.gradle/gradle.properties` (on Windows: `C:\Users\<you>\.gradle\gradle.properties`, create the file if it doesn't exist), **not** to the project's own `gradle.properties`:

```properties
KONPDF_UPLOAD_STORE_FILE=C:/keys/konpdf-upload.jks
KONPDF_UPLOAD_STORE_PASSWORD=your-keystore-password
KONPDF_UPLOAD_KEY_ALIAS=konpdf-upload
KONPDF_UPLOAD_KEY_PASSWORD=your-key-password
```

The same four names also work as environment variables (for CI).

## 3. Build the bundle

1. Raise the version in `mobile/package.json` for every upload (Play refuses a version code it has seen before): `0.0.5` → `0.0.6`, or `1.0.0` for the first public release.
2. Build:

   ```bash
   cd mobile/android
   ./gradlew bundleRelease          # Windows: gradlew.bat bundleRelease
   ```

3. The bundle is `mobile/android/app/build/outputs/bundle/release/app-release.aab`.

`assembleRelease` still makes an APK for testing on your own phone (signed with your upload key when it is set up, otherwise the debug key).

## 4. Create the app in Play Console

**Create app:** name `KonPDF`, default language English (United States), **App**, **Free**. Accept the declarations.

**Release → Testing → Internal testing** first (instant, up to 100 testers), then **Closed testing** for the 12-tester, 14-day requirement, then **Production**. On the first upload, keep **Play App Signing** on (the default).

## 5. Store listing

**Grow → Store presence → Main store listing.** Copy from `mobile/fastlane/metadata/android/en-US/`:

| Field | File |
|---|---|
| App name (30) | `title.txt` |
| Short description (80) | `short_description.txt` |
| Full description (4000) | `full_description.txt` |
| App icon, 512 × 512 | `images/icon.png` |
| Feature graphic, 1024 × 500 | `images/featureGraphic.png` |
| Release notes (500) | `changelogs/default.txt` |

The icon and feature graphic are drawn from the app's own icon and fonts: after changing the icon, run `../engine/.venv/Scripts/python scripts/make-store-graphics.py` from `mobile/`.

**Screenshots:** 2 to 8 phone screenshots (portrait, 1080 × 1920 or the phone's own size). Good ones for KonPDF: the Convert tab, a scan with its pages, the Resizer showing "about 48 KB", NW turning a request into a plan, a Result card with the size change, and Settings → Google Drive. Take them on the phone (power + volume down), in light mode, with tidy file names. Save them in `images/phoneScreenshots/` next to the others to keep everything in one place.

**Category:** Productivity. **Contact details:** an email address (required and shown publicly) and the website `https://github.com/Gauravtiwari31/KonPDF`.

## 6. App content (Policy → App content)

| Form | Answer |
|---|---|
| **Privacy policy** | `https://github.com/Gauravtiwari31/KonPDF/blob/main/docs/privacy-policy.md` |
| **Ads** | No ads |
| **App access** | All functionality is available without special access. Google Drive backup is optional and works with any Google account (see the note below) |
| **Content rating** | Category: Utility, Productivity, Communication, or Other. No violence, sexuality, language, drugs, gambling. Users don't interact with each other and the app shares no location. Expected rating: Everyone / 3+ |
| **Target audience** | 13 and over (not designed for children, so the Families policy doesn't apply) |
| **News app / COVID-19 / Government app / Financial features / Health** | No / not applicable |
| **Data safety** | See below |

**Note for App access:** reviewers may try Google Drive backup. Move the Google Cloud consent screen to **In production** first ([google-drive-setup.md](google-drive-setup.md#4-testing-then-everyone)); while it is in Testing, only your listed test users can connect.

### Data safety answers

Play counts data as **collected** when it leaves the phone for you or a service working for you (the converter on Render). Transfers the person starts to a service of their choice (their own Google Drive) are not "sharing".

| Question | Answer | Why |
|---|---|---|
| Collects or shares required data types? | Yes | Files sent to the converter |
| Encrypted in transit? | Yes | The hosted converter, Google Drive and the model download are HTTPS (a self-hosted engine on plain HTTP is the person's own choice) |
| Way to request deletion? | Explain that nothing is kept | Files are deleted automatically after 30 minutes and there's no account; the privacy policy says so |
| **Photos and videos → Photos** | Collected, not shared, **processed ephemerally**, required for the feature, purpose: App functionality | Photos sent to resize, enhance or convert |
| **Files and docs** | Collected, not shared, processed ephemerally, required for the feature, purpose: App functionality | PDFs, documents and sheets sent to convert |
| **App activity → Other user-generated content** | Collected, not shared, processed ephemerally, optional, purpose: App functionality | What people type to NW |
| Name, email address | Not collected | Shown in the app after connecting Google Drive, but kept on the phone; KonPDF has no server that receives them |
| Location, contacts, device IDs, diagnostics, analytics | Not collected | None of these are used |

These match the privacy policy. You are responsible for the final answers, so re-check them whenever the app changes what it sends.

## 7. After the first upload

- **Google Drive backup:** Play signs the app with its own key, so Google's sign-in won't recognise the Play version until you register that key. Copy the **SHA-1 of the app signing key** from **Test and release → App integrity → App signing** and add it as another Android OAuth client ([google-drive-setup.md, step 3](google-drive-setup.md#3-register-the-android-app-the-client)). Add your **upload key's** SHA-1 too, so APKs you build and install yourself can connect:

  ```bash
  keytool -list -v -keystore konpdf-upload.jks -alias konpdf-upload
  ```

- **People with the GitHub APK** (signed with the debug key) can't update to the Play version over it: Android requires the same signature. They uninstall the GitHub version first (History stays only if they backed it up to Drive), or keep using GitHub releases.
- **Pre-launch report** (Play Console → Testing): Google runs the app on real devices; check it for crashes after each upload.

## Policy notes

- **The AI reader's model download** (Developer Mode, 1.55 GB from Hugging Face) is data, not code, which Play allows. The app's code all ships in the bundle.
- **AI-generated content:** the AI reader writes out text it reads from the person's own pages. If a reviewer treats it as generative AI, Play expects a way to report offensive output inside the app; adding a "Report a problem" link on AI-reader results would cover it.
- **Google Drive** uses only `drive.file`, a non-sensitive scope: no restricted-scope security assessment.

## Optional: upload from the command line

The `mobile/fastlane/metadata` folder follows fastlane's layout, so `fastlane supply` can upload the listing and bundle once you add a Play Console service account (free): <https://docs.fastlane.tools/actions/supply/>.
