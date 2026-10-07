/**
 * Build-time settings.
 *
 * Release builds rewrite this file (scripts/write-build-env.mjs):
 * `KONPDF_ENGINE_URL` makes the APK talk to the hosted engine out of the box.
 * Keep it `null` in source control: local builds then use the emulator address.
 */
export const HOSTED_API_URL: string | null = null;
