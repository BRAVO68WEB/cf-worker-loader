/**
 * Load root .env so one shared file works for the whole monorepo.
 * Call this before any other code that reads process.env.
 */
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnv = path.resolve(__dirname, "../../../.env");
config({ path: rootEnv });
