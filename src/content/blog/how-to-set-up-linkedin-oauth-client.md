---
title: "How to Set Up a LinkedIn OAuth Client for Posting"
description: "I set up a LinkedIn OAuth client to post articles automatically. Here is the app, the scopes, the token, and the 422 trap I hit."
pubDate: "Oct 04 2026"
heroImage: "/article-media/linkedin-oauth-client-setup.png"
category: "Web Development"
tags: ["LinkedIn", "OAuth", "API", "Developer Guide"]
---

<!-- SEO: title 51/60 chars, description 128/160 chars. Focus keyword: how to setup a linkedin oauth client -->

I needed a LinkedIn OAuth client to automate cross-posting from my blog, the same way I had earlier set up Google OAuth credentials for [Blogger automation](/blog/setting-up-google-oauth-credentials-for-blogger/). This is the setup I actually used, step by step, including the trap that broke my first requests. To see how it fits into an end-to-end workflow, read our guide to [automating LinkedIn posts with GitHub Actions](/blog/automate-linkedin-posts-github-actions/).

## Before you begin

- A LinkedIn account (a personal account; Company Page admin access helps if you create the app under an organization).
- A redirect URI for your application — `http://localhost` is fine for a personal project.
- Somewhere secure to store the client secret and access token (I use GitHub Actions secrets).

Create a separate LinkedIn app for each application. This keeps credentials and API usage separate.

## Step 1: Create a LinkedIn developer app

1. Open the [LinkedIn Developer Portal](https://developer.linkedin.com/).
2. Select **Create App**.
3. Fill in the app name, description, and your application's logo.
4. Note the **Client ID** and **Client Secret** on the app's auth page.

I created my app under a Company Page. Remember this choice — it matters in the troubleshooting section below.

## Step 2: Add the products

On the app's **Products** page, request:

- **Sign In with LinkedIn** — provides the OpenID Connect identity, including the `sub` claim you need to build the owner URN.
- **Share on LinkedIn** — the product that grants the `w_member_social` scope for posting to your own profile.

## Step 3: Configure the auth settings

1. Open the **Auth** page for your app.
2. Add your redirect URL to the allowed redirect URLs list (for example `http://localhost`).
3. Save the changes.

The redirect URI in your OAuth request must exactly match an authorized redirect URI — check the scheme, host, and port.

## Step 4: Choose the scopes

Request these three scopes:

```text
openid profile w_member_social
```

- `openid` and `profile` identify the member.
- `w_member_social` lets the app share content on the member's behalf.

Request only the access the application needs.

## Step 5: Run the OAuth flow once

1. Build the authorization URL with your client ID, redirect URI, state, and the scopes above.
2. Sign in and consent on LinkedIn.
3. LinkedIn redirects to your redirect URI with an authorization code.
4. Exchange the code for an access token at the token endpoint, using your client ID and client secret.
5. Store the access token.

My access token expires about 60 days after issue (mine runs to 2026-12-04). When it expires, re-run the flow to get a fresh one.

## Step 6: Store the token securely

- Do not commit the client secret or the access token to a repository.
- Store the access token as a GitHub Actions secret (I name mine `LINKEDIN_TOKEN`).
- If a secret becomes public, regenerate it in the Developer Portal and update the workflow.

## Step 7: Test the connection

1. Call the userinfo endpoint to confirm the token works and read the `sub` claim:

```http
GET https://api.linkedin.com/v2/userinfo
Authorization: Bearer ACCESS_TOKEN
```

2. Create a test share with the legacy shares endpoint:

```http
POST https://api.linkedin.com/v2/shares
Authorization: Bearer ACCESS_TOKEN
```

## Troubleshooting

### Error: `422` on `POST /v2/ugcPosts`

The modern ugcPosts endpoint expects an organization URN when your app was created under a Company Page. Sending a `urn:li:person` URN returns a 422. Either post to `urn:li:organization` (needs `w_organization_social`) or use the legacy `/v2/shares` endpoint, which accepts `owner: urn:li:person:{sub}`.

### Error: `401` / invalid token

The access token expired (about 60 days) or the scope is missing. Re-run the OAuth flow and confirm `w_member_social` was granted.

### Error: `redirect_uri_mismatch`

Make sure the redirect URI in the request exactly matches an authorized redirect URI.

### The numeric member ID is missing

Older tutorials build `urn:li:member:{id}`. OpenID sign-in no longer exposes that legacy numeric ID — use the `sub` claim from `/v2/userinfo` with the `/v2/shares` endpoint instead.

## Security checklist

- Request only the scopes the application needs.
- Keep the client secret on the server, never in browser code.
- Store access tokens in secure storage or CI secrets.
- Do not commit credentials to source control.
- Use HTTPS for production redirect URIs.

To set up a LinkedIn OAuth client for posting, create a developer app, add Sign In with LinkedIn and Share on LinkedIn, configure the redirect URI, request `openid profile w_member_social`, and complete the OAuth flow once. Then store the token securely and test it against `/v2/userinfo` and `/v2/shares`.