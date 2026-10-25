import { join } from "node:path";

/** Where Paalam writes (Bridges, notes, caches). The desktop app points this at its user-data folder. */
export const DATA_DIR = process.env.PAALAM_DATA_DIR || join(process.cwd(), "data");
