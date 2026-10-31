import { createHmac, randomBytes } from "node:crypto";

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

    const response = await fetch(`${this.baseUrl}/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: this.oauthHeader("POST", "/oauth/access_token", params),
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
        this.oauthHeader(method, path, extraParams, {
          token: oauthToken,
          tokenSecret: oauthTokenSecret,
        }),
    };
  }

  /** List the authenticated user's bookmarks. Returns parsed JSON. */
  async listBookmarks(user) {
    const params = new URLSearchParams({ format: "json" });
    const response = await fetch(`${this.baseUrl}/bookmarks/list`, {
      method: "POST",
      headers: {
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

  /** Add a single bookmark to the authenticated user's Instapaper list. */
  async addBookmark(user, { url, title, description }) {
    const params = new URLSearchParams({ url });
    if (title) params.set("title", title);
    if (description) params.set("description", description);

    const response = await fetch(`${this.baseUrl}/bookmarks/add`, {
      method: "POST",
      headers: {
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

  oauthHeader(method, path, params, token) {
    const oauthParams = {
      oauth_consumer_key: this.consumerKey,
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_nonce: randomBytes(16).toString("hex"),
      oauth_version: "1.0",
    };

    if (token) {
      oauthParams.oauth_token = token.token;
    }

    // All request body params are included in the signature base.
    // Decode values first so encodeURIComponent in signatureBase only
    // encodes once (prevents double-encoding of % and other chars).
    for (const [key, value] of params) {
      try {
        oauthParams[key] = decodeURIComponent(value);
      } catch {
        oauthParams[key] = value;
      }
    }

    const signatureBase = this.signatureBase(method, path, oauthParams);
    const signingKey =
      encodeURIComponent(this.consumerSecret) +
      "&" +
      (token ? encodeURIComponent(token.tokenSecret) : "");
    const signature = createHmac("sha1", signingKey)
      .update(signatureBase)
      .digest("base64");

    oauthParams.oauth_signature = signature;

    const headerParts = Object.entries(oauthParams)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${encodeURIComponent(key)}="${encodeURIComponent(value)}"`);

    return `OAuth ${headerParts.join(", ")}`;
  }

  signatureBase(method, path, params) {
    const encoded = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .sort()
      .join("&");
    return `${method.toUpperCase()}&${encodeURIComponent(path)}&${encodeURIComponent(encoded)}`;
  }
}
