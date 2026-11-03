#!/usr/bin/env node
/**
 * Sync the bookmarks in one Instapaper folder into a local JSON file so the
 * /read page can render them at build time.
 *
 * The folder is taken from (highest priority first):
 *   1. the first CLI argument  (node scripts/sync-instapaper-bookmarks.mjs "Tech News")
 *   2. --folder=<name>         (node scripts/sync-instapaper-bookmarks.mjs --folder="Tech News")
 *   3. INSTAPAPER_FOLDER env var
 *   4. the default, "Tech News"
 *
 * Prerequisites (env vars):
 *   INSTAPAPER_CONSUMER_KEY, INSTAPAPER_CONSUMER_SECRET,
 *   INSTAPAPER_EMAIL, INSTAPAPER_PASSWORD
 *   INSTAPAPER_FOLDER (optional, defaults to "Tech News")
 *
 * Run:
 *   node scripts/sync-instapaper-bookmarks.mjs
 */
import { InstapaperClient, normaliseBookmarks } from "./instapaper.mjs";
import { writeFileSync, mkdirSync } from "node:fs";

const ROOT = process.cwd();
const DATA_DIR = `${ROOT}/data`;
const OUT_PATH = `${DATA_DIR}/instapaper-bookmarks.json`;
const DEFAULT_FOLDER = "Tech News";

/** Resolve the folder name from CLI args, falling back to env and the default. */
function resolveFolderName(argv = process.argv.slice(2)) {
  const flag = argv.find((arg) => arg.startsWith("--folder="));
  if (flag) return flag.slice("--folder=".length);

  const positional = argv.find((arg) => !arg.startsWith("--"));
  if (positional) return positional;

  return process.env.INSTAPAPER_FOLDER || DEFAULT_FOLDER;
}

async function main() {
  const consumerKey = process.env.INSTAPAPER_CONSUMER_KEY;
  const consumerSecret = process.env.INSTAPAPER_CONSUMER_SECRET;
  const email = process.env.INSTAPAPER_EMAIL;
  const password = process.env.INSTAPAPER_PASSWORD;

  if (!consumerKey || !consumerSecret || !email || !password) {
    console.error(
      "Set INSTAPAPER_CONSUMER_KEY, INSTAPAPER_CONSUMER_SECRET, INSTAPAPER_EMAIL and INSTAPAPER_PASSWORD.",
    );
    process.exit(1);
  }

  const folderName = resolveFolderName();
  const client = new InstapaperClient({ consumerKey, consumerSecret });
  console.log("Authenticating to Instapaper...");
  const user = await client.authenticateUser(email, password);

  console.log(`Resolving folder "${folderName}"...`);
  const folder = await client.resolveFolder(user, folderName);
  if (!folder) {
    const folders = await client.listFolders(user);
    const available = folders.map((f) => `"${f.display_title || f.title}"`).join(", ");
    console.error(`Instapaper folder "${folderName}" was not found.`);
    console.error(available ? `Available folders: ${available}` : "This account has no custom folders.");
    console.error("Pick one with INSTAPAPER_FOLDER=<name> or: node scripts/sync-instapaper-bookmarks.mjs \"<name>\"");
    process.exit(1);
  }

  console.log(`Fetching bookmarks from folder "${folder.title}" (folder_id=${folder.folder_id})...`);
  const bookmarks = await client.listAllBookmarks(user, { folderId: folder.folder_id });
  const list = normaliseBookmarks(bookmarks);

  console.log(`Found ${list.length} bookmark(s).`);

  // Normalise to a simple array of { bookmark_id, title, url, description, time, is_starred, type }
  const normalised = list.map((b) => ({
    bookmark_id: b.bookmark_id,
    title: b.title || "",
    url: b.url || "",
    description: b.description || "",
    time: b.time || 0,
    is_starred: b.is_starred || 0,
    type: b.type || "",
  }));

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(normalised, null, 2) + "\n");
  console.log(`Wrote ${normalised.length} bookmark(s) from "${folder.title}" to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
