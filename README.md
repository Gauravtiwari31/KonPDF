# KonPDF

**Convert anything. Resize everything.**

KonPDF is an Android app that scans paper into clean PDFs, reads the text on photos and scans, converts images, PDFs, documents and spreadsheets in any direction, resizes photos to the exact pixels, centimetres or kilobytes a form asks for, cleans up scans, and does the everyday PDF jobs (merge, split, compress, lock, watermark, number). Its built-in assistant **NW** understands plain requests in seven languages ("make this photo under 50 KB", "isko PDF bana do", "comprime este PDF a 1 MB") and turns them into steps you confirm with one tap. NW runs on KonPDF's own engine, with no API keys and no outside AI service.

No video, no audio: on purpose. Scanning and reading text happen on the phone (Scan tab); an optional on-phone AI reader (Qwen3-VL 2B) is available in **Settings → Developer Mode**.

**Optional Google Drive backup:** sign in with Google in **Settings → Google Drive** and the PDFs and results you make are kept in a KonPDF folder in your own Drive, automatically or with one tap. KonPDF asks only for `drive.file`, so it sees just the files it creates there. It needs a one-time, free registration in Google Cloud: **[docs/google-drive-setup.md](docs/google-drive-setup.md)**.

The full spec, architecture and build plan are in **[detail.md](detail.md)**.

## Test the APK

Download the latest APK from the [Releases page](https://github.com/NotWork-world/KonPDF/releases) (also at [apk/KonPDF.apk](apk/KonPDF.apk)). It runs on ARM Android phones, Android 7.0 and newer.

Install it (allow installing from this source when Android asks) and open it: from v0.0.4 it connects to the KonPDF engine on Render (`https://konpdf-engine.onrender.com`) by itself, on Wi-Fi or mobile data. Nothing to set up.

To use a different engine (your own Render service, or your computer while developing), change it in **Settings → Converter engine**; that choice is saved and kept across updates.

## Google Play

The project is ready for Google Play: target API 36, 16 KB page support, a signed app bundle (`bundleRelease`, with your upload key), a [privacy policy](docs/privacy-policy.md), and the store listing (text, icon, feature graphic) in `mobile/fastlane/metadata/android/en-US/`. The steps that need the owner (developer account, upload key, screenshots, Play Console forms with the Data safety answers) are in **[docs/play-store.md](docs/play-store.md)**.

## Repository layout

```
.
├── detail.md            what KonPDF is, every feature, architecture, build plan
├── docs/                Render deployment, Google Drive setup, Google Play guide, privacy policy
├── engine/              Python conversion engine (FastAPI)
│   ├── model.py         NW, the assistant (built in: no API key, no download)
│   ├── app/
│   │   ├── main.py      HTTP API and friendly error handling
│   │   ├── errors.py    error catalogue in 7 languages (no status codes for people)
│   │   ├── formats.py   format detection by content + conversion matrix
│   │   ├── convert.py   picks the right converter
│   │   ├── pipeline.py  runs single tools and NW's multi-step plans (whitelisted)
│   │   ├── converters/  images · pdf · documents · sheets · office (LibreOffice)
│   │   └── tools/       resize · enhance · pdf_tools
│   ├── tests/           842 tests
│   └── Dockerfile       Python + LibreOffice + Noto fonts
└── mobile/              React Native app (Android)
    ├── android/         native project; app/src/main/java/com/konpdf/device = file module
    ├── fastlane/        Google Play listing: text, icon, feature graphic, release notes
    ├── scripts/         build settings, Play Store graphics
    └── src/
        ├── screens/     Welcome · Home · Convert · Resize · Enhance · PDF tools · NW · Result · History · Settings · Google Drive
        ├── components/  DoAll's neo-brutalist UI kit, recoloured "Ink & Volt"
        ├── api/         engine client + friendly error mapper
        ├── features/    history, preferences, scan, Developer Mode, Google Drive backup
        ├── services/    files (native module), engine address, storage, Google Drive
        └── theme/       palette, typography, light/dark themes
```

## Run it

**Engine** (Python 3.10+):

```bash
cd engine
python -m venv .venv
.venv/Scripts/pip install -r requirements-dev.txt      # macOS/Linux: .venv/bin/pip
.venv/Scripts/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

API docs are then at <http://localhost:8000/api/docs>. Run the tests with `.venv/Scripts/python -m pytest`. Installing LibreOffice (or using the Docker image) enables DOC, ODT, RTF and PowerPoint, and gives full-fidelity Word → PDF.

**App** (Node 22, JDK 17, Android SDK):

```bash
cd mobile
npm install
npm run llama:libs     # only if npm skipped llama.rn's install script (its prebuilt Android libraries)
npm run android
```

The emulator talks to the engine at `10.0.2.2:8000`. On a phone, set the address in **Settings → Converter engine**.

## Engine settings

| Variable | Default | Meaning |
|---|---|---|
| `KON_MAX_FILE_MB` | 50 | Largest file accepted |
| `KON_MAX_FILES` | 20 | Files per job |
| `KON_MAX_PIXELS` | 80 | Megapixels per image (guards against image bombs) |
| `KON_JOB_TTL_MIN` | 30 | Minutes before uploads and results are deleted |
| `KON_JOB_TIMEOUT_S` | 120 | Time limit per job |
| `KON_MAX_PARALLEL` | 2 | Jobs running at once |
| `KON_RATE_LIMIT` | 120 | Requests per minute per IP (0 = off) |
| `KON_SOFFICE` | auto | Path to LibreOffice |
