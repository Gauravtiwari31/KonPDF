# Set up Google Drive backup (free)

KonPDF can back up results to the person's own Google Drive (**Settings → Google Drive**). It is optional: nothing changes for anyone who doesn't connect it.

Before it works, Google has to know the app once. That takes about 10 minutes in the Google Cloud console, costs nothing, and needs no billing account. Nothing goes into the app's code: **no client ID, no secret, no rebuild**. Google recognises KonPDF by its package name and the certificate it is signed with.

Until this is done, tapping **Connect Google Drive** shows "Google Drive isn't set up in this version" (and `adb logcat -s KonDrive` shows `status 10`, Google's DEVELOPER_ERROR).

## What the app asks for

One permission (scope): `https://www.googleapis.com/auth/drive.file`. With it, KonPDF can see and change **only the files it creates itself**: its "KonPDF" folder and what it uploads. It can't see anything else in someone's Drive. Google classes this scope as non-sensitive, so it needs no security assessment.

## 1. Create a project and turn on the Drive API

1. Open <https://console.cloud.google.com> and sign in with the Google account that will own the app.
2. Project picker (top left) → **New project** → name it `KonPDF` → **Create**. Select it.
3. **APIs & Services → Library** → search **Google Drive API** → **Enable**.

## 2. Describe the app (consent screen)

Open **Google Auth Platform** (also reachable as **APIs & Services → OAuth consent screen**) and click **Get started** if asked.

1. **Branding:** app name `KonPDF`, user support email, developer contact email. Home page: `https://github.com/NotWork-world/KonPDF`. Privacy policy: `https://github.com/NotWork-world/KonPDF/blob/main/docs/privacy-policy.md` (it already covers Drive and Google's Limited Use rules).
2. **Audience:** **External**.
3. **Data access → Add or remove scopes:** add `.../auth/drive.file` ("See, edit, create and delete only the specific Google Drive files you use with this app"). **Save**.

## 3. Register the Android app (the client)

**Clients → Create client → Application type: Android**

| Field | Value |
|---|---|
| Name | `KonPDF Android` |
| Package name | `io.github.gauravtiwari31.konpdf` |
| SHA-1 certificate fingerprint | see below |

The SHA-1 is the fingerprint of the certificate the APK is signed with. Today every KonPDF build (debug, and release too while no upload key is configured) is signed with `mobile/android/app/debug.keystore`:

```text
C7:AA:94:FE:F1:5C:D4:2F:01:D8:78:E0:BF:D3:AF:B0:DC:31:4B:5D
```

To print it yourself (or for another keystore):

```bash
keytool -list -v -keystore mobile/android/app/debug.keystore -storepass android -alias androiddebugkey
```

Each signing certificate needs its own Android client with the same package name. Add one later for:

- **your upload key**, once the `KONPDF_UPLOAD_*` settings are in use;
- **Google Play's app signing key**, if KonPDF goes on Google Play: Play Console → your app → **Test and release → App integrity** shows its SHA-1.

New or changed clients can take a few minutes, sometimes longer, to start working.

## 4. Testing, then everyone

A new app starts in **Testing**:

- Only the **test users** you add under **Audience** (up to 100 Google accounts) can connect. Add your own account first.
- Google ends a test user's access after **7 days**. KonPDF then shows "Drive access has ended" with a **Reconnect** button. That's expected while testing.

When it works, **Audience → Publish app** moves it to **In production**: anyone with a Google account can connect, and access no longer runs out after a week. Because `drive.file` is non-sensitive, people see no "unverified app" warning and no security review is needed. Google may ask you to verify the app's branding (free) before your app name and logo appear on its permission screen.

## 5. Try it

1. Install the APK on a phone with Google Play services.
2. **Settings → Google Drive → Connect Google Drive** → pick an account → **Continue**.
3. Make anything (a scan, a conversion). The Result screen shows **Saved in Google Drive**, and the file is in **My Drive → KonPDF**.

## If it doesn't work

| What you see | Why | Fix |
|---|---|---|
| "Google Drive isn't set up in this version" (logcat: `status 10`) | The package name or SHA-1 doesn't match an Android client | Check both in **Clients**; the SHA-1 must match the certificate of the APK you installed. Wait a few minutes after changes. |
| Same message after connecting | The Drive API is off for the project | **APIs & Services → Library → Google Drive API → Enable** |
| Google says the app is in testing / access blocked | Your account isn't a test user | **Audience → Test users → Add users**, or publish the app |
| "Drive access has ended" every week | The app is still in Testing | Publish the app (step 4) |
| No Drive option at all | The phone has no Google Play services | Nothing to fix: everything else in KonPDF works |

Logs: `adb logcat -s KonDrive` (the app's own Drive messages, with Google's status codes).
