#!/usr/bin/env node
/**
 * Daily automation: pick the next unposted link from the read queue and
 * add it to your Instapaper reading list.
 *
 * Reads:   data/read-queue.json   (array of { url, title, description? })
 * State:   data/read-queue-state.json  ({ lastIndex: number })
 *
 * Prerequisites (env vars or .dev.vars):
 *   INSTAPAPER_CONSUMER_KEY, INSTAPAPER_CONSUMER_SECRET,
 *   INSTAPAPER_EMAIL, INSTAPAPER_PASSWORD
 *
 * Run:
 *   node scripts/daily-read-link.mjs
 */
import { InstapaperClient } from "./instapaper.mjs";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ROOT = process.cwd();
const QUEUE_PATH = `${ROOT}/data/read-queue.json`;
const STATE_PATH = `${ROOT}/data/read-queue-state.json`;

function loadQueue() {
  if (!existsSync(QUEUE_PATH)) {
    console.error(`Queue file not found: ${QUEUE_PATH}`);
    console.error("Create data/read-queue.json with an array of { url, title, description? }");
    process.exit(1);
  }
  return JSON.parse(readFileSync(QUEUE_PATH, "utf8"));
}

function loadState() {
  if (!existsSync(STATE_PATH)) return { lastIndex: -1 };
  return JSON.parse(readFileSync(STATE_PATH, "utf8"));
}

function saveState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n");
}

async function main() {
  const queue = loadQueue();
  if (!Array.isArray(queue) || queue.length === 0) {
    console.error("Read queue is empty. Add links to data/read-queue.json.");
    process.exit(1);
  }

  const state = loadState();
  const nextIndex = (state.lastIndex + 1) % queue.length;
  const link = queue[nextIndex];

  console.log(`Daily read link #${nextIndex + 1}/${queue.length}: ${link.url}`);

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
  const user = await client.authenticateUser(email, password);

  await client.addBookmark(user, {
    url: link.url,
    title: link.title,
    description: link.description,
  });

  // Advance the queue cursor
  saveState({ lastIndex: nextIndex });
  console.log("Added to Instapaper. Cursor advanced to", nextIndex);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
