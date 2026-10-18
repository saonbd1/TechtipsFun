---
title: "Build a Bulk 10 URL Shortener Platform Using Next.JS"
description: "Follow Easy Steps on Next.js for URL redirect route; Learn more about URL shortener API validation; dynamic short URL route."
heroImage: "/article-media/bulk-url-shortner.png"
pubDate: "Aug 16 2026"
category: "Web Development"
tags: ["Next JS", "Tools", "Frontend"]
---

## Introduction

A URL shortener accepts a long URL and returns a shorter URL. The short URL must still point to the original destination.

I just implemented and published a url shortener on (https://eslotmain.xyz). Anyone can try this tool now with 2 ways:
 - A single url submitter for quick generation. No login or signup needed to generate .
 - A bulk url submitter for batch submission. Up to 10 urls can be shortened from a single submission.   

This project uses the Next.js App Router for this process. The project has an API route, local link storage, a dynamic redirect route, and a client form. The production build passed. A generated short code also returned an HTTP 307 redirect to its original destination.

Here I explain the project structure and the main design choices. I do not claim production deployment, traffic growth, or permanent storage. The project stores links in a local JSON file. Replace this file with a durable database before production use.

## What the project builds

The user submits a URL such as `www-ton/asd`. The browser sends the URL to `POST /api/shorten`.

![Check the project build.](/article-media/link-shortner2.jpg)

The API validates the URL and checks the stored destinations. It creates a six-character code when no matching link exists. It then stores the link and returns a short URL.

A visitor who opens `/<code>` reaches the dynamic route. The route finds the code and returns a redirect.

Next.js supports redirects in Route Handlers. Its documentation describes HTTP 307 as the normal temporary redirect status for `redirect` behavior. Read the [Next.js redirecting guide](https://nextjs.org/docs/app/guides/redirecting) and the [redirect API reference](https://nextjs.org/docs/app/api-reference/functions/redirect).

## Step 1: Validate the destination URL

Validate the URL on the server. Do not depend only on browser validation.

A caller can send a request directly to the API. The API must apply the same rules to every request.

The route uses the platform `URL` class. It accepts only `http:` and `https:` protocols:

```
function normalizeUrl(value: unknown  ) {
  if (typeof value !== 'string') throw new Error('Each item must be a URL.')

  const trimmed = value.trim()
  const destination = new URL(trimmed)

  if (!['http:', 'https:'].includes(destination.protocol  )) {
    throw new Error('Only http:// and https:// URLs are supported.'  )
  }

  return destination.toString()
}
```

An empty value, malformed value, or unsupported protocol returns HTTP 400. The API does not create a record for that value.

The project test sent `not-a-url`. The API returned HTTP 400.

## Step 2: Generate and store a short code

The storage module uses three fields for each link: `code`, `destination`, and `createdAt`.

The project creates a short random base-36 string. It then compares the code with the stored codes:

```
let code = ''
do {
  code = Math.random().toString(36).slice(2, 8)
} while (links.some((link) => link.code === code))
```

The comparison prevents a new code from matching an existing code. Random generation alone does not provide this protection.

The project also compares the normalized destination with stored destinations. If the destination exists, the API returns the existing record.

This rule prevents repeated submissions from creating duplicate records during local use.

## Step 3: Deliver the short URL

The API builds the result from the request origin. It does not use a fixed development hostname:

```
const origin = request.headers.get('origin') ?? new URL(request.url).origin
return NextResponse.json({
  code: link.code,
  shortUrl: `${origin}/${link.code}`,
  destination: link.destination,
})
```

This behavior helps during local development. The result can use the active port.

Control the host value in production. A production deployment can use a fixed public site URL or a trusted-host rule.

Do not accept arbitrary origin values without a policy for trusted hosts.

## Step 4: Resolve the dynamic route

The redirect handler is in `app/[code]/route.ts`. The `[code]` segment passes the short code to the handler.

```
export async function GET(_request: Request, context: Context) {
  const { code } = await context.params
  const link = await getLink(code)

  if (!link) return new NextResponse('Short link not found', { status: 404 })

  return NextResponse.redirect(link.destination, 307)
}
```

A missing code returns HTTP 404. A known code returns HTTP 307 and the saved destination.

The project test created a link for `https://example.com/hello`. It requested the code without following redirects.

The test returned `REDIRECT_STATUS 307`. The `Location` header was `https://example.com/hello`.

Next.js states that HTTP 307 keeps the request method. HTTP 302 has different method behavior in many browsers. [2]

For a normal short-link GET request, the result is a direct redirect to the destination.

New update for advance analytics system. 

## Step 5: Connect the form to the API

The client form sends the submitted value to the API. It reads the returned `shortUrl` and displays it to the user.

The copy action copies the returned URL. It does not copy a fixed demo link.

The client manages loading state, errors, and display state. The server manages URL rules, code creation, storage, and redirects.

This separation keeps the main security rules on the server.

## Common problems and fixes

### The project deployment is Okay, but the short link does not redirect

A successful build shows that the application compiles. It does not show that the dynamic route finds a stored record.

Run the complete flow. Create a link, save its code, request `/<code>` without following redirects, and read the status and `Location` header.

### Repeated submissions create many records

Normalize the destination before you compare it. Then find an existing record before you create a new code.

The project uses this process in its local storage module.

### Local JSON storage does not persist after deployment

The project writes to `.data/links.json`. This method is suitable for a local prototype.

Many serverless environments do not provide durable local files. Next.js describes database or key-value storage for larger redirect maps. [1]

Move the `readLinks` and `writeLinks` operations to a durable database before production use. For a basic server deployment path after you make that change, see our [guide to self-hosting a web app](/blog/self-hosting-your-first-web-app-no/).

### The API accepts an unsafe or unusable destination

Do not depend only on an HTML `type="url"` input. Keep URL parsing and protocol rules in the API.

For a public service, add rate limits, abuse controls, destination screening, and a takedown process.

These controls were not part of the verified project work.

## Test results

The project used the following test sequence:

![URL shortner routing](/article-media/linkshortner-next-js.png)

## Conclusion

The main pattern has five parts. Validate the destination on the server. Create and compare the short code. Store the mapping. Resolve the code through a dynamic route. Test the redirect without following it.

This pattern gives the project a clear path from local JSON storage to a durable database.

The next features can include authentication, analytics, rate limits, and durable storage. Add these features after the create-and-redirect flow has automated tests.


