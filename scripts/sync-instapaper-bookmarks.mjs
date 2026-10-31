#!/usr/bin/env node
/**
 * Sync your Instapaper bookmarks into a local JSON file so the /read page
 * can render them at build time.
 *
 * Reads Instapaper via the Public API (x_auth) and writes
 * data/instapaper-bookmarks.json.
 *
 * Prerequisites (env vars):
 *   INSTAPAPER_CONSUMER_KEY, INSTAPAPER_CONSUMER_SECRET,
 *   INSTAPAPER_EMAIL, INSTAPAPER_PASSWORD
 *
 * Run:
 *   node scripts/sync-instapaper-bookmarks.mjs
 */
import { InstapaperClient } from "./instapaper.mjs";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const DATA_DIR = `${ROOT}/data`;
const OUT_PATH = `${DATA_DIR}/instapaper-bookmarks.json`;

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

  const client = new InstapaperClient({ consumerKey, consumerSecret });
  console.log("Authenticating to Instapaper...");
  const user = await client.authenticateUser(email, password);

  console.log("Fetching bookmarks...");
  const bookmarks = await client.listBookmarks(user);

  // Normalise to a simple array of { bookmark_id, title, url, description, time, is_starred, type }
  const list = Array.isArray(bookmarks) ? bookmarks : (bookmarks.bookmarks || []);
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
  console.log(`Wrote ${normalised.length} bookmark(s) to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
