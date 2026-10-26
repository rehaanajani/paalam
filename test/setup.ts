/**
 * Imported first by every test: no .env, no keys, a throwaway data folder. Tests
 * exercise Paalam's own logic offline, so they pass anywhere, including CI.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.PAALAM_ENV_FILE = join(tmpdir(), "paalam-no-env");
process.env.PAALAM_DATA_DIR = mkdtempSync(join(tmpdir(), "paalam-test-"));
for (const k of ["GOOGLE_CLOUD_PROJECT", "GEMINI_API_KEY", "GOOGLE_MAPS_API_KEY", "GOOGLE_CLOUD_API_KEY", "GOOGLE_APPLICATION_CREDENTIALS", "MODEL_ARMOR_TEMPLATE", "TELEGRAM_BOT_TOKEN"]) process.env[k] = "";
