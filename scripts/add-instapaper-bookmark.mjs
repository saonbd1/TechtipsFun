#!/usr/bin/env node
/**
 * Add a single link to your Instapaper reading list.
 *
 * Prerequisites:
 * 1. Register an API consumer at https://instapaper.com/developers/
 *    -> get INSTAPAPER_CONSUMER_KEY + INSTAPAPER_CONSUMER_SECRET
 * 2. Set env vars:
 *    export INSTAPAPER_CONSUMER_KEY=...
 *    export INSTAPAPER_CONSUMER_SECRET=...
 *    export INSTAPAPER_EMAIL=...        (your Instapaper login email)
 *    export INSTAPAPER_PASSWORD=...     (your Instapaper password)
 *    export INSTAPAPER_FOLDER="Tech News"  (optional; defaults to "Tech News")
 * 3. Run:
 *    node scripts/add-instapaper-bookmark.mjs <url> [title] [description] [--folder="Tech News"]
 */
import { InstapaperClient } from "./instapaper.mjs";

const DEFAULT_FOLDER = "Tech News";

async function main() {
  const args = process.argv.slice(2);
  const folderFlag = args.find((arg) => arg.startsWith("--folder="));
  const positional = args.filter((arg) => !arg.startsWith("--"));
  const folderName =
    (folderFlag ? folderFlag.slice("--folder=".length) : "") ||
    process.env.INSTAPAPER_FOLDER ||
    DEFAULT_FOLDER;

  const url = positional[0];
  if (!url) {
    console.error(
      'Usage: node scripts/add-instapaper-bookmark.mjs <url> [title] [description] [--folder="Tech News"]',
    );
    process.exit(1);
  }
  const title = positional[1];
  const description = positional[2];

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

  const folder = await client.resolveFolder(user, folderName);
  if (!folder) {
    console.warn(
      `Instapaper folder "${folderName}" was not found — adding to the default (unread) list instead.`,
    );
  } else {
    console.log(`Adding to folder "${folder.title}" (folder_id=${folder.folder_id}).`);
  }

  console.log(`Adding: ${url}${title ? ` (${title})` : ""}...`);
  await client.addBookmark(user, { url, title, description, folderId: folder?.folder_id });

  console.log("Added to Instapaper.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
