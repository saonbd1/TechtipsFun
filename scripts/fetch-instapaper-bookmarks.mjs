#!/usr/bin/env node
/**
 * Fetch your Instapaper bookmarks using the Public API.
 *
 * Prerequisites:
 * 1. Register an API consumer at https://instapaper.com/developers/
 *    -> get INSTAPAPER_CONSUMER_KEY + INSTAPAPER_CONSUMER_SECRET
 * 2. Set env vars (or a .env file):
 *    export INSTAPAPER_CONSUMER_KEY=...
 *    export INSTAPAPER_CONSUMER_SECRET=...
 *    export INSTAPAPER_PASSWORD=...   (optional; if omitted you're prompted)
 * 3. Run:
 *    node scripts/fetch-instapaper-bookmarks.mjs your-email@example.com
 *    (then enter your Instapaper password when prompted)
 */
import { InstapaperClient } from "./instapaper.mjs";
import { createInterface } from "node:readline/promises";

function readPassword(prompt) {
  const { stdin, stdout } = process;
  if (!stdin.isTTY) {
    throw new Error(
      "No TTY to read your password securely. Set INSTAPAPER_PASSWORD env var instead.",
    );
  }
  const rl = createInterface({ input: stdin, output: stdout });
  return rl.question(prompt).then((answer) => {
    rl.close();
    stdout.write("\n");
    return answer;
  });
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: node scripts/fetch-instapaper-bookmarks.mjs <email>");
    process.exit(1);
  }

  const consumerKey = process.env.INSTAPAPER_CONSUMER_KEY;
  const consumerSecret = process.env.INSTAPAPER_CONSUMER_SECRET;
  if (!consumerKey || !consumerSecret) {
    console.error(
      "Set INSTAPAPER_CONSUMER_KEY and INSTAPAPER_CONSUMER_SECRET environment variables.",
    );
    process.exit(1);
  }

  const password = process.env.INSTAPAPER_PASSWORD || readPassword("Instapaper password: ");

  const client = new InstapaperClient({ consumerKey, consumerSecret });

  console.log("Authenticating via x_auth...");
  const user = await client.authenticateUser(email, password);
  console.log("Got user token. Fetching bookmarks...\n");

  const bookmarks = await client.listBookmarks(user);

  const list = Array.isArray(bookmarks) ? bookmarks : bookmarks.bookmarks || [];
  console.log(`${list.length} bookmark(s):\n`);
  for (const b of list) {
    console.log(`- ${b.title || "(no title)"}`);
    console.log(`  ${b.url}`);
    if (b.description) console.log(`  ${b.description}`);
    console.log(`  starred: ${b.is_starred}, type: ${b.type}, id: ${b.bookmark_id}`);
    console.log();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
