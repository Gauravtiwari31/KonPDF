# The KonPDF website (konpdf.notwork.world)

The website is in [`web/`](../web): KonPDF's tools in the browser (convert, resize, enhance, PDF tools and NW), the Android app's download page, and the privacy policies and terms. It's a static site, so it runs free on **Cloudflare Pages**. The tools send files to the same KonPDF engine as the app, which stays on Render's free plan ([deploy-render.md](deploy-render.md)). Cloudflare's free plan can't run the engine: it needs Python and LibreOffice, which only Cloudflare Containers can run, and that needs the paid Workers plan.

The camera scanner, Read text, the on-phone AI reader and Google Drive backup are only in the app. On the website, NW points people to the app when they ask for them.

| Address | What |
|---|---|
| `/` | Home: all tools, NW, how it works, questions |
| `/convert`, `/resize`, `/enhance`, `/pdf-tools`, `/nw` | The tools |
| `/download` | The Android app |
| `/privacy` | Website privacy policy (files, ads, cookies) |
| `/app-privacy` | Android app privacy policy (shows [privacy-policy.md](privacy-policy.md); use this link for Google Play and Google sign-in) |
| `/terms`, `/about` | Terms of use, about and contact |

Every page is built to plain HTML, so Google and AdSense can read it without running scripts. Settings are in [`web/site.config.json`](../web/site.config.json).

## 1. Put it on Cloudflare Pages

1. Cloudflare dashboard → **Workers & Pages** → **Create** → the **Pages** tab → **Connect to Git**. Cloudflare's GitHub app is already installed on NotWork-world; make sure it can see **KonPDF**.
2. Pick **NotWork-world/KonPDF** and use these settings:

   | Setting | Value |
   |---|---|
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | `web` |

   Node 22 comes from `web/.node-version`.
3. **Save and Deploy.** The first build takes a minute or two.
4. Optional: under **Settings → Build → Build watch paths**, include `web/*` and `docs/privacy-policy.md`, so app-only and engine-only commits don't rebuild the site.

## 2. Your domain

In the Pages project, go to **Custom domains → Set up a custom domain** and enter `konpdf.notwork.world`. Because notwork.world's DNS is already on Cloudflare, it adds the record and the HTTPS certificate by itself. Give it a few minutes.

## 3. Optional: the engine on your domain too

The site uses `https://konpdf-api.notwork.world`, set up like this (to go back, put `https://konpdf-engine.onrender.com` in `web/site.config.json`):

1. Render → **konpdf-engine → Settings → Custom Domains → Add**: `konpdf-api.notwork.world`.
2. Cloudflare → **notwork.world → DNS → Add record**: type `CNAME`, name `konpdf-api`, target `konpdf-engine.onrender.com`, **Proxy status: DNS only** (grey cloud), so Render can issue the certificate.
3. When Render shows the domain as verified, set `"engine": "https://konpdf-api.notwork.world"` in `web/site.config.json` and push.

The app keeps using the onrender.com address, which keeps working.

## 4. AdSense

1. Sign up at [adsense.google.com](https://adsense.google.com) and add your site. AdSense normally asks for the main domain, **notwork.world**, which also covers konpdf.notwork.world. Google reviews the site you add, so notwork.world should have real content or a clear link to KonPDF.
2. Copy your publisher ID (`pub-` or `ca-pub-` followed by 16 digits; either works) into `"adsenseClient"` in `web/site.config.json`, and push. Every page then loads the AdSense script, and `konpdf.notwork.world/ads.txt` is created. If AdSense says ads.txt is missing on **notwork.world**, put the same line at `notwork.world/ads.txt` on whatever hosts the main domain: `google.com, pub-<your 16 digits>, DIRECT, f08c47fec0942fa0`.
3. Once approved: **Ads → By site → konpdf…** → turn on **Auto ads**. Google then places the ads itself; the pages need no ad code of their own.
4. **Privacy & messaging → European regulations → Create message**, and publish it. Google requires a consent message for visitors in the EEA, the UK and Switzerland, and the website's privacy policy says one is shown.
5. Optional: put a contact email in `"contactEmail"` in `web/site.config.json`, so the privacy, terms and about pages show it. Otherwise they point to GitHub issues.

Until an ID is set, the site shows no ads and has no ads.txt.

## Run it on your computer

```bash
cd web
npm install
npm run dev                                       # http://localhost:5173, using the engine on Render
VITE_ENGINE_URL=http://localhost:8000 npm run dev # or a local engine
npm run build                                     # what Cloudflare runs: type check, build, pre-render into dist/
```
