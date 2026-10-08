# Deploy the KonPDF engine on Render (free)

Once the engine runs on Render, the app works anywhere, on Wi-Fi or mobile data. Your laptop no longer needs to be on.

The repository already has everything Render needs: [`render.yaml`](../render.yaml) (the service settings) and [`engine/Dockerfile`](../engine/Dockerfile) (Python, LibreOffice and fonts for Hindi and other scripts).

## 1. Create the service

1. Sign in at <https://dashboard.render.com> (signing in with GitHub is easiest).
2. Click **New +** → **Blueprint**.
3. Connect your GitHub account if asked, and give Render access to the **KonPDF** repository.
4. Pick **Gauravtiwari31/KonPDF**, branch **main**. Render reads `render.yaml` and shows one service, **konpdf-engine** (Docker, Free, Singapore).
5. Click **Apply** (or **Deploy Blueprint**).

The first build takes about 10 minutes, because it installs LibreOffice. Later builds are faster.

## 2. Check that it works

1. Open the service in the dashboard. When the status says **Live**, copy its address at the top. It looks like `https://konpdf-engine.onrender.com` (Render adds a few letters if that name is taken).
2. Open `https://<your-address>/api/health` in a browser. You should see:

   ```json
   {"ok":true,"status":"ok","version":"0.0.4","office":true,"nw":"core"}
   ```

   `"office": true` means LibreOffice is installed, so Word, PowerPoint and old Office files convert with full quality.
3. Optional: `https://<your-address>/api/docs` shows every endpoint.

## 3. Point the app at it

The app has `https://konpdf-engine.onrender.com` built in (`mobile/src/env.ts`), so a service with that name needs nothing more.

If Render gave your service a different address, either:

- enter it in KonPDF: **Settings → Converter engine**, `https://<your-address>` (the app adds `/api` itself), **Test**, then **Save**; or
- build it into the APK, so nobody has to type it:

  ```bash
  cd mobile
  KONPDF_ENGINE_URL=https://<your-address> node scripts/write-build-env.mjs
  ```

## Things to know about the free plan

- **It sleeps.** After 15 minutes without requests the service goes to sleep, and the next request wakes it in 30–60 seconds. The app pings the engine when it opens, and shows "Waking up the converter" instead of an error if you're quicker than that.
  To stop it sleeping, add a free uptime monitor (for example UptimeRobot or Pulsetic) that opens `https://<your-address>/api/health` every 10 minutes. One always-on service fits in the free 750 hours a month.
- **512 MB of memory.** That's why `render.yaml` sets `KON_MAX_PARALLEL=1` (one conversion at a time). Very large files may run out of memory; if that happens, move to a paid instance and raise `KON_MAX_PARALLEL`.
- **Files are temporary.** Uploads and results live on the instance's own disk and are deleted after 30 minutes, or sooner when the service restarts.
- **Updates deploy themselves.** Every push that changes `engine/` redeploys it. App-only changes don't.

## Settings you can change

In the dashboard: **konpdf-engine → Environment**.

| Variable | Default | Meaning |
|---|---|---|
| `KON_MAX_FILE_MB` | 50 | Largest file accepted |
| `KON_MAX_FILES` | 20 | Files per job |
| `KON_MAX_PARALLEL` | 1 | Conversions running at once |
| `KON_JOB_TTL_MIN` | 30 | Minutes before files are deleted |
| `KON_JOB_TIMEOUT_S` | 120 | Time limit per job |
| `KON_RATE_LIMIT` | 120 | Requests per minute per phone (0 = off) |

## If something goes wrong

| What you see | What to do |
|---|---|
| Build fails | Open **Events → the failed deploy → Logs**; the last red lines say why. |
| `/api/health` never loads | The service may still be waking up: wait a minute and reload. |
| App says "Can't reach the converter" | Check the address in Settings starts with `https://` and has no typo; open `/api/health` on the phone's browser. |
| "This one is taking too long" on big files | The free instance is slow. Try smaller files, or raise `KON_JOB_TIMEOUT_S`. |
