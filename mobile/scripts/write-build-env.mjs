#!/usr/bin/env node
/**
 * Writes src/env.ts for a release build from environment variables (CI sets
 * them from repository variables):
 *
 *   KONPDF_ENGINE_URL   the hosted engine, e.g. https://konpdf-engine.onrender.com
 *                       (unset: the app defaults to an engine on your computer)
 *
 * Usage, from mobile/:  node scripts/write-build-env.mjs
 * For a local release build, run it with the variable set and restore
 * src/env.ts afterwards; don't commit the result.
 */
import { writeFileSync } from 'node:fs';

const engineUrl = process.env.KONPDF_ENGINE_URL?.trim() || null;

const source = `// Written by scripts/write-build-env.mjs for this build. See the version in git for details.
export const HOSTED_API_URL: string | null = ${JSON.stringify(engineUrl)};
`;
writeFileSync(new URL('../src/env.ts', import.meta.url), source);
process.stdout.write(source);
