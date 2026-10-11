---
title: "Self-hosting your first web app — the no-nonsense guide"
description: "I spent way too long being intimidated by self-hosting. It seemed like something only sysadmin wizards did. Then I actually tried it — and it took on"
pubDate: "Jul 17 2026"
heroImage: "/self-hosting.webp"
category: "Self-Hosting"
tags: ["Self-Hosting", "Web Apps", "Deployment", "Beginner Guide"]

---

![Self-hosting server setup](/self-hosting.webp)

I spent way too long being intimidated by self-hosting. It seemed like something only sysadmin wizards did. Then I actually tried it — and it took one afternoon. Here’s the exact process I followed.

## What you need

- A cheap VPS (I use Hetzner — €4/month for a 2-core, 4GB RAM instance)
- A domain name (~$10/year)
- Basic comfort with the terminal

## Step 1 — Point your domain

Add an A record in your DNS provider pointing to your VPS IP. Propagation usually takes under 5 minutes with Cloudflare.

## Step 2 — Install Nginx and Certbot

```
sudo apt update && sudo apt install nginx certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com
```

## Step 3 — Deploy your app

For a Node.js app, use PM2 to keep it alive. For a Python app, use gunicorn + a systemd service. The pattern is always the same: run your app on a local port, then proxy it through Nginx.

```
# Nginx config snippet
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Host $host;
}
```

> The hardest part isn’t the setup — it’s convincing yourself you can do it.

That’s genuinely it. You now have a live app with HTTPS, served from your own server, at a fraction of what AWS or Vercel would cost at scale. If you are comparing managed hosting instead, see our [Netlify vs Vercel comparison](/blog/netlify-vs-vercel-what-my-emails-revealed-after-using-both/).
