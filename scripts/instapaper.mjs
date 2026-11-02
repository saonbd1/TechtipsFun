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
    const params = new URLSearchParams({ url, format: "json" });
    if (title) params.set("title", title);
    if (description) params.set("description", description);

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
