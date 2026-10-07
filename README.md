# KonPDF

**Convert anything. Resize everything.**

KonPDF is an Android app that converts images, PDFs, documents and spreadsheets in any direction, resizes photos to the exact pixels, centimetres or kilobytes a form asks for, cleans up scans, and does the everyday PDF jobs (merge, split, compress, lock, watermark, number). Its built-in assistant **NW** understands plain requests in seven languages ("make this photo under 50 KB", "isko PDF bana do", "comprime este PDF a 1 MB") and turns them into steps you confirm with one tap. NW runs on KonPDF's own engine, with no API keys and no outside AI service.

No video, no audio, no OCR: on purpose.

The full spec, architecture and build plan are in **[detail.md](detail.md)**.

## Test the APK

A test build is in **[apk/KonPDF.apk](apk/KonPDF.apk)** (version 0.1.0, for ARM phones). It is not a release.

1. Start the engine on your computer (see [Run it](#run-it)) with `--host 0.0.0.0` so the phone can reach it.
2. Install `KonPDF.apk` on the phone (allow installing from this source when Android asks).
3. In KonPDF, open **Settings → Converter engine** and enter your computer's Wi-Fi address, for example `192.168.1.20:8000`, then tap **Test** and **Save**. The phone and the computer must be on the same Wi-Fi.

With the phone on USB, `adb reverse tcp:8000 tcp:8000` and the address `localhost:8000` work too.

## Repository layout

```
.
├── detail.md            what KonPDF is, every feature, architecture, build plan
├── engine/              Python conversion engine (FastAPI)
│   ├── model.py         NW, the assistant (core tier + optional local LLM)
│   ├── app/
│   │   ├── main.py      HTTP API and friendly error handling
│   │   ├── errors.py    error catalogue in 7 languages (no status codes for people)
│   │   ├── formats.py   format detection by content + conversion matrix
│   │   ├── convert.py   picks the right converter
│   │   ├── pipeline.py  runs single tools and NW's multi-step plans (whitelisted)
│   │   ├── converters/  images · pdf · documents · sheets · office (LibreOffice)
│   │   └── tools/       resize · enhance · pdf_tools
│   ├── tests/           567 tests
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

**Optional NW local model:** install `llama-cpp-python`, download a small instruction model in GGUF format (for example Qwen2.5-0.5B-Instruct), and set `NW_MODEL_PATH` to its path before starting the engine. Without it, NW's core tier answers on its own.

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
| `NW_MODEL_PATH` | – | Optional GGUF model for NW |
