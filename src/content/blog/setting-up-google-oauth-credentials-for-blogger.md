---
title: "Setting Up Google OAuth Credentials for Blogger Automation"
description: "In this post I explained how to create a secure admin dashboard by Google OAuth credentials for an application."
pubDate: "September 27 2026"
heroImage: "/article-media/google_auth_blogger_automation.png"
category: "Web Development"
tags: [ "Web Apps", "Deployment", "Beginner Guide", "Frontend", ]

---

I created an application which post automatically on a [daily cricket match fixture publish website](https://watchnowcricket.blogspot.com). This website get daily update from an application and post the updated fixture in a table. 

Why I am using OAuth 2.0? When your application needs access to create, edit, or delete a post you have to login securly to blogger by using a Blogger API key. OAuth 2.0 is required for login to blogger platform.  https://developers.google.com/identity/protocols/oauth2

## Before you begin make sure you have

- A Google Account.
- A Google Cloud project.
- The web address of your application.
- The OAuth callback URL for your application.

Use a separate Google Cloud project for each application when possible. This choice keeps the application credentials and API usage separate.

## Step 1: Create or select a Google Cloud project

1. Open the Google Cloud Console from https://console.cloud.google.com
2. Select the project menu at the top of the page.
3. Select an existing project.
4. Select **New Project** if you need a new project.
5. Enter a project name.
6. Select **Create**.
7. Select the new project from the project menu.

## Step 2: Enable the Blogger API

1. Open the API Library https://console.cloud.google.com/apis/library
2. Search for **Blogger API v3**.
3. Select **Blogger API v3** from the search results.
4. Select **Enable**.

The application cannot call the Blogger API until you enable the API in the selected project.

## Step 3: Configure the OAuth consent screen

The OAuth consent screen tells users which application requests access to their Google Account.

1. Open **Google Auth platform** in the Google Cloud Console.
2. Select **Branding**.
3. Enter the application name.
4. Select the user support email.
5. Enter the application home page when Google requests it.
6. Enter the application privacy policy URL when Google requests it.
7. Enter the developer contact email.
8. Select **Save and Continue**.

### Configure the audience

1. Open the **Audience** page.
2. Select **External** if people outside your Google Workspace organization will use the application.
3. Select **Internal** if only people in your Google Workspace organization will use the application.
4. Add test users when the application is in testing mode.
5. Select **Save and Continue**.

Use test accounts during development. Do not add users who do not need access.

### Add the Blogger scope

1. Open the **Data Access** page.
2. Select **Add or Remove Scopes**.
3. Search for the Blogger API scope.
4. Select `https://www.googleapis.com/auth/blogger`.
5. Select **Update**.
6. Select **Save and Continue**.

This scope gives the application access to Blogger data that the user authorizes. Request only the access that the application needs.

## Step 4: Create the OAuth client ID

Choose the client type that matches the application.

### For a server-side web application

1. Open **Google Auth platform**.
2. Select **Clients**.
3. Select **Create Client**.
4. Select **Web application** as the application type.
5. Enter a name for the client.
6. Under **Authorized redirect URIs**, select **Add URI**.
7. Enter the exact callback URL from your application.
8. Select **Create**.
9. Copy the client ID.
10. Copy the client secret.

The callback URL must match the URL in the OAuth request. A different scheme, host, port, path, or trailing slash can cause a redirect URI error.

Example callback URL:

```text
https://watchnowcricket.blogspot.com/oauth2/callback
```

For local development, use the exact local URL that your application uses.

```text
http://localhost:3000/oauth2/callback
```

### For a browser-only JavaScript application

1. Open **Google Auth platform**.
2. Select **Clients**.
3. Select **Create Client**.
4. Select **Web application** as the application type.
5. Enter a name for the client.
6. Under **Authorized JavaScript origins**, select **Add URI**.
7. Enter the origin of your application.
8. Select **Create**.
9. Copy the client ID.

An origin contains the scheme, host, and port. It does not contain a path.

Example origin:

```text
https://watchnowcricket.blogspot.com
```

Do not place a client secret in browser code. Store a client secret only on a trusted server.

## Step 5: Store the credentials safely

Store the client ID and client secret in environment variables or a secret manager.

Example:

```text
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://watchnowcricket.blogspot.com/oauth2/callback
```

If you use github, do not commit the client secret to a source code repository. Do not place the client secret in browser code. Restrict access to the secret.

If a client secret becomes public, create a new secret in Google Cloud Console and update the application.

## Step 6: Add the OAuth flow to the application

The application must complete these actions:

1. Create an authorization URL.
2. Include the Blogger scope.
3. Redirect the user to Google.
4. Receive the authorization response at the callback URL.
5. Exchange the authorization code for tokens.
6. Store the refresh token in secure storage when the flow returns one.
7. Send the access token in the `Authorization` header.
8. Refresh the access token when it expires.

Use a Google OAuth client library when one is available for your programming language. Google recommends client libraries because they reduce errors in the authorization flow. [3]

The Blogger OAuth scope is:

```text
https://www.googleapis.com/auth/blogger
```

Example authorization header:

```http
Authorization: Bearer ACCESS_TOKEN
```

## Step 7: Test the connection

1. Start the application.
2. Open the application sign-in page.
3. Select the Google sign-in button.
4. Sign in with a test Google Account.
5. Read the requested permissions.
6. Select **Allow**.
7. Make sure that Google redirects you to the configured callback URL.
8. Make sure that the application receives an access token.
9. Call a Blogger API endpoint.

For a private Blogger request, send the access token with the request. For example:

```http
GET https://www.googleapis.com/blogger/v3/users/self/blogs
Authorization: Bearer ACCESS_TOKEN
```

## Troubleshooting

### Error: `redirect_uri_mismatch`

Make sure that the redirect URI in the OAuth request exactly matches an authorized redirect URI. Check the scheme, host, port, path, and trailing slash.

### Error: `access_denied`

The user did not grant access, or the user is not in the test-user list. Add the test account to the OAuth audience or use an approved account.

### Error: `403 PERMISSION_DENIED`

Make sure that the Blogger API is enabled. Make sure that the access token includes the required Blogger scope. Make sure that the signed-in user can access the requested blog.

### The refresh token is missing

Use the authorization settings required by your OAuth library to request offline access. Store the refresh token securely when Google returns it.

### The application works for public data but not private data

An API key can identify requests for public data. An API key does not authorize access to private user data. Use an OAuth 2.0 access token for private data.

## Security checklist

Before you release the application, complete these checks:

- Enable only the APIs that the application needs.
- Request only the Blogger scope that the application needs.
- Keep the client secret on the server.
- Keep access tokens and refresh tokens in secure storage.
- Do not commit credentials to source control.
- Use HTTPS for production redirect URIs.
- Remove test users before you publish the application.
- Review the OAuth consent screen before you request verification.

To create Google OAuth credentials for Blogger, create a Google Cloud project, enable Blogger API v3, configure the OAuth consent screen, and create a web application client. Add the correct redirect URI or JavaScript origin. Store the credentials securely. Then implement the OAuth flow with the Blogger scope.
