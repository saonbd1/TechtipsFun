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
 * 3. Run:
 *    node scripts/add-instapaper-bookmark.mjs <url> [title] [description]
 */
import { InstapaperClient } from "./instapaper.mjs";

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: node scripts/add-instapaper-bookmark.mjs <url> [title] [description]");
    process.exit(1);
  }
  const title = process.argv[3];
  const description = process.argv[4];

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

  console.log(`Adding: ${url}${title ? ` (${title})` : ""}...`);
  await client.addBookmark(user, { url, title, description });

  console.log("Added to Instapaper.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
