# Pull-request CDP proof

Date: 2026-09-04

The Electron process exposed `http://127.0.0.1:9222/json/version` with protocol version `1.3` and a WebSocket debugger URL.

Playwright connected through CDP and clicked the pull-request button named:

`Refactor the site from Astro to Next.js with SSR blog posts RyanHaraki/blog-website #11`

The resulting DOM assertions passed:

```json
{
  "title": "Refactor the site from Astro to Next.js with SSR blog posts",
  "repository": "RyanHaraki/blog-website #11",
  "author": "app/devin-ai-integration",
  "changes": "+4,239 -4,912"
}
```

Screenshot: [pull-request-list-cdp.png](pull-request-list-cdp.png)
