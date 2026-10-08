/**
 * Build-time settings.
 *
 * HOSTED_API_URL is the engine every fresh install talks to: the KonPDF
 * engine on Render (render.yaml). People can still point the app at another
 * engine in Settings → Converter engine; that choice is saved and wins.
 * Set it to null to make builds default to an engine on your own computer
 * (10.0.2.2:8000 from the Android emulator). scripts/write-build-env.mjs can
 * rewrite this file from KONPDF_ENGINE_URL for other deployments.
 */
export const HOSTED_API_URL: string | null =
  'https://konpdf-engine.onrender.com';
