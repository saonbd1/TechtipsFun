import { createHmac, randomBytes } from "node:crypto";

/** Folder ids that the API understands in place of a numeric folder_id. */
export const SPECIAL_FOLDERS = ["unread", "starred", "archive"];

/**
 * Find a folder by title in the array returned by `folders/list`.
 * Matches `title` or `display_title`, case-insensitively.
 *
 * @returns {object|null} the folder (with a normalised `folder_id`), or null.
 */
export function findFolder(folders, name) {
  const target = String(name ?? "").trim().toLowerCase();
  if (!target) return null;

  for (const folder of folders ?? []) {
    const id = folder.folder_id ?? folder.id;
    if (id === undefined || id === null || id === "") continue;

    const titles = [folder.title, folder.display_title].filter(Boolean);
    if (titles.some((title) => String(title).trim().toLowerCase() === target)) {
      return { ...folder, folder_id: id };
    }
  }

  return null;
}

/** Normalise the several shapes the API can return for a list of folders. */
export function normaliseFolders(payload) {
  const list = Array.isArray(payload) ? payload : (payload?.folders ?? []);
  return list.filter((folder) => {
    const id = folder?.folder_id ?? folder?.id;
    return id !== undefined && id !== null && id !== "" && folder.type !== "meta";
  });
}

/** Normalise the several shapes the API can return for a list of bookmarks. */
export function normaliseBookmarks(payload) {
  const list = Array.isArray(payload) ? payload : (payload?.bookmarks ?? []);
  // `bookmarks/list` also returns a leading `{ type: "meta", ... }` row.
  return list.filter((item) => item && (item.type === "bookmark" || item.bookmark_id));
}

/**
 * Instapaper Public API (v1.1) OAuth 1.0a client, dependency-free.
 * Runs in Node and Cloudflare Workers (nodejs_compat).
 */
export class InstapaperClient {
  constructor({ consumerKey, consumerSecret, baseUrl = "https://www.instapaper.com/api/1.1" } = {}) {
    this.consumerKey = consumerKey;
    this.consumerSecret = consumerSecret;
    this.baseUrl = baseUrl;
  }

  /** Exchange username/password (x_auth) for a user OAuth token + secret. */
  async authenticateUser(username, password) {
    const params = new URLSearchParams({
      x_auth_username: username,
      x_auth_password: password,
    });

    const { header } = this.oauthSign("POST", `${this.baseUrl}/oauth/access_token`, params);
    const response = await fetch(`${this.baseUrl}/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: header,
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Instapaper auth failed (${response.status}): ${text}`);
    }

    const body = await response.text();
    const parsed = Object.fromEntries(new URLSearchParams(body));
    const oauthToken = parsed.oauth_token;
    const oauthTokenSecret = parsed.oauth_token_secret;

    if (!oauthToken || !oauthTokenSecret) {
      throw new Error(`Instapaper auth returned no token: ${body}`);
    }

    return {
      oauthToken,
      oauthTokenSecret,
      /** Pre-built OAuth1 Authorization header for subsequent user-scoped calls. */
      authFor: (method, path, extraParams) =>
        this.oauthSign(method, `${this.baseUrl}${path}`, extraParams, {
          token: oauthToken,
          tokenSecret: oauthTokenSecret,
        }).header,
    };
  }

  /**
   * List the authenticated user's bookmarks.
   *
   * `folderId` accepts `unread` (the API default), `starred`, `archive`, or a
   * numeric folder id from `folders/list`. Results are paged with `have`.
   *
   * @returns {Promise<object[]|object>} parsed JSON (array of bookmarks, incl. a `meta` row)
   */
  async listBookmarks(user, { folderId = "unread", limit = 500, have } = {}) {
    const params = new URLSearchParams({ format: "json", folder_id: String(folderId) });
    if (limit) params.set("limit", String(limit));
    if (have) params.set("have", have);

    const response = await fetch(`${this.baseUrl}/bookmarks/list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: user.authFor("POST", "/bookmarks/list", params),
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Instapaper bookmarks/list failed (${response.status}): ${text}`);
    }

    return response.json();
  }

  /**
   * Fetch every bookmark in a folder, following the API's `have` pagination.
   *
   * @returns {Promise<object[]>} bookmark rows only (no `meta` row)
   */
  async listAllBookmarks(user, { folderId = "unread", pageSize = 500, maxPages = 40 } = {}) {
    const collected = [];
    const seen = new Set();

    for (let page = 0; page < maxPages; page += 1) {
      const payload = await this.listBookmarks(user, {
        folderId,
        limit: pageSize,
        have: collected.map((b) => b.bookmark_id).join(","),
      });
      const items = normaliseBookmarks(payload);

      let added = 0;
      for (const item of items) {
        if (seen.has(item.bookmark_id)) continue;
        seen.add(item.bookmark_id);
        collected.push(item);
        added += 1;
      }

      // Stop when a short page or no new rows come back.
      if (added === 0 || items.length < pageSize) break;
    }

    return collected;
  }

  /** List the authenticated user's folders (custom folders, no special ones). */
  async listFolders(user) {
    const params = new URLSearchParams({ format: "json" });
    const response = await fetch(`${this.baseUrl}/folders/list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: user.authFor("POST", "/folders/list", params),
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Instapaper folders/list failed (${response.status}): ${text}`);
    }

    return normaliseFolders(await response.json());
  }

  /**
   * Resolve a folder name (`Tech News`) or special name (`unread`/`starred`/
   * `archive`) to a folder descriptor.
   *
   * @returns {Promise<{folder_id: string|number, title: string, special: boolean}|null>}
   *   null when the folder does not exist.
   */
  async resolveFolder(user, name) {
    const folderName = String(name ?? "").trim();
    if (!folderName) return null;

    const lowered = folderName.toLowerCase();
    if (SPECIAL_FOLDERS.includes(lowered)) {
      return { folder_id: lowered, title: lowered, special: true };
    }

    const folder = findFolder(await this.listFolders(user), folderName);
    if (!folder) return null;

    return {
      ...folder,
      title: folder.display_title || folder.title || folderName,
      special: false,
    };
  }

  /**
   * Resolve a folder name (`Tech News`) or special name (`unread`/`starred`/
   * `archive`) to a value usable as `folder_id`.
   *
   * @returns {Promise<string|number|null>} null when the folder does not exist.
   */
  async resolveFolderId(user, name) {
    const folder = await this.resolveFolder(user, name);
    return folder ? folder.folder_id : null;
  }

  /** Add a single bookmark to the authenticated user's Instapaper list. */
  async addBookmark(user, { url, title, description, folderId }) {
    const params = new URLSearchParams({ url, format: "json" });
    if (title) params.set("title", title);
    if (description) params.set("description", description);
    if (folderId !== undefined && folderId !== null && folderId !== "") {
      params.set("folder_id", String(folderId));
    }

    const response = await fetch(`${this.baseUrl}/bookmarks/add`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: user.authFor("POST", "/bookmarks/add", params),
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Instapaper bookmarks/add failed (${response.status}): ${text}`);
    }

    return response.text();
  }

  /* ---------------- OAuth 1.0a signing ---------------- */

  /**
   * Build the OAuth 1.0a Authorization header and sign the request.
   * Only oauth_* parameters go in the Authorization header; all body params
   * (including x_auth_*) are included in the signature base but NOT in the header.
   *
   * @returns {{ header: string, signatureBase: string }}
   */
  oauthSign(method, path, params, token) {
    // --- Signature base: ALL params (oauth + body/x_auth) ---
    const signatureParams = {
      oauth_consumer_key: this.consumerKey,
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_nonce: randomBytes(16).toString("hex"),
      oauth_version: "1.0",
    };

    if (token) {
      signatureParams.oauth_token = token.token;
    }

    // Decode body param values first so encodeURIComponent only encodes once.
    for (const [key, value] of params) {
      try {
        signatureParams[key] = decodeURIComponent(value);
      } catch {
        signatureParams[key] = value;
      }
    }

    const signatureBase = this.signatureBase(method, path, signatureParams);

    // --- Sign ---
    const signingKey =
      encodeURIComponent(this.consumerSecret) +
      "&" +
      (token ? encodeURIComponent(token.tokenSecret) : "");
    const signature = createHmac("sha1", signingKey)
      .update(signatureBase)
      .digest("base64");

    // --- Authorization header: oauth_* params ONLY ---
    const headerParams = {
      oauth_consumer_key: this.consumerKey,
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: signatureParams.oauth_timestamp,
      oauth_nonce: signatureParams.oauth_nonce,
      oauth_version: "1.0",
      oauth_signature: signature,
    };

    if (token) {
      headerParams.oauth_token = token.token;
    }

    const headerParts = Object.entries(headerParams)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([key, value]) =>
          `${encodeURIComponent(key)}="${encodeURIComponent(value)}"`,
      );

    return {
      header: `OAuth ${headerParts.join(", ")}`,
      signatureBase,
    };
  }

  signatureBase(method, path, params) {
    const encoded = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .sort()
      .join("&");
    return `${method.toUpperCase()}&${encodeURIComponent(path)}&${encodeURIComponent(encoded)}`;
  }
}
