# KonPDF

**Convert anything. Resize everything.**

KonPDF is an Android app that converts images, PDFs, documents and spreadsheets in any direction, resizes photos to the exact pixels, centimetres or kilobytes a form asks for, cleans up scans, and does the everyday PDF jobs (merge, split, compress, lock, watermark, number). Its built-in assistant **NW** understands plain requests in seven languages ("make this photo under 50 KB", "isko PDF bana do", "comprime este PDF a 1 MB") and turns them into steps you confirm with one tap. NW runs on KonPDF's own engine, with no API keys and no outside AI service.

No video, no audio, no OCR: on purpose.

The full spec, architecture and build plan are in **[detail.md](detail.md)**.

## Test the APK

The newest test build is **[apk/KonPDF.apk](apk/KonPDF.apk)** (0.0.2); published releases are on the [Releases page](https://github.com/Gauravtiwari31/KonPDF/releases). It runs on ARM Android phones, Android 7.0 and newer.

1. Deploy the engine on Render once: **[docs/deploy-render.md](docs/deploy-render.md)** (about 15 minutes, free).
2. Install the APK on your phone (allow installing from this source when Android asks). If an older KonPDF test build is installed, uninstall it first.
3. In KonPDF, open **Settings → Converter engine**, enter your Render address (for example `https://konpdf-engine.onrender.com`), tap **Test**, then **Save**.

The app then works on Wi-Fi or mobile data. For local testing you can still point it at your computer instead (see [Run it](#run-it)).

## Repository layout

```
.
├── detail.md            what KonPDF is, every feature, architecture, build plan
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
│   ├── tests/           752 tests
│   └── Dockerfile       Python + LibreOffice + Noto fonts
└── mobile/              React Native app (Android)
    ├── android/         native project; app/src/main/java/com/konpdf/device = file module
    └── src/
        ├── screens/     Welcome · Home · Convert · Resize · Enhance · PDF tools · NW · Result · History · Settings
        ├── components/  DoAll's neo-brutalist UI kit, recoloured "Ink & Volt"
        ├── api/         engine client + friendly error mapper
        ├── services/    files (native module), engine address, storage
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
