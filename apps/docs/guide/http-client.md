---
title: HTTP Client
---

# HTTP Client

Build and send HTTP requests from a dedicated tab — against the current connection or a custom origin. Open it from the **Tools** menu or the command palette (**HTTP Client**).

![HTTP Client](/screenshots/27-http-client.png)

### Address bar

The top bar mirrors a browser/API client URL bar:

| Part | Purpose |
|------|---------|
| **Method** | HTTP verb (`GET`, `POST`, …) with autocomplete |
| **Server** | Current connection origin, or a custom base URL you type |
| **URL path** | Path and query (for example `/rest/Car` or `/rest/$catalog`) with catalog-aware suggestions |
| **Send** | Run the request (or **Cancel** while in flight) |

The full resolved URL is shown under the bar. Use **⌘/Ctrl+Enter** to send when the request is valid. **Copy as** (code icon next to Export) copies the current request as 4D, cURL, HTTP, JavaScript `fetch`, or Python `requests`.

### Request tabs

| Tab | Purpose |
|-----|---------|
| **Params** | Query string key/value pairs (for example `$filter`, `$top`); table rows can be reordered |
| **Headers** | Custom request headers; same sortable table as params |
| **Body** | None, form data (Key / Type / Value table), `x-www-form-urlencoded`, raw (Monaco), or binary file |
| **Settings** | Cookies, timeout, redirects, desktop TLS, and optional 4D REST query plan/path |

![HTTP Client settings](/screenshots/28-http-client-settings.png)

### Response

After **Send**, the right panel shows status, timing, size, content type, headers, cookies, and body. Copy helpers are available on response sections. Use **Preview** / **Raw** when a structured preview is available.

When **Query plan & path** is enabled in Settings (or `$queryplan` / `$querypath` are in Params) and the JSON body includes `__queryPlan` or `__queryPath`, a **Plan** tab visualizes the same tree as the Query builder.

#### Text and structured bodies

| Format | Preview |
|--------|---------|
| **JSON** | Collapsible tree (entities and entity selections open in the same result panel as Method Executor) |
| **HTML** | Sandboxed iframe preview |
| **CSV** | Table preview |
| **Plain text** | Read-only code editor |

Plain text example (`GET http://localhost/text.txt`):

![HTTP Client text response](/screenshots/29-http-client-response-text.png)

HTML example (`GET http://localhost/html.html`):

![HTTP Client HTML response](/screenshots/31-http-client-response-html.png)

CSV example (`GET http://localhost/CSV.csv`):

![HTTP Client CSV response](/screenshots/32-http-client-response-csv.png)

#### Binary bodies

Binary responses (images, PDF, audio/video, or unknown types such as `application/octet-stream`) open in a dedicated binary panel:

- **Images** and **PDF** render in-app when the payload is small enough (PDF uses PDF.js)
- **Video / audio** and oversized files are **not buffered** (to keep the desktop client responsive) — download instead, or opt in to preview when offered
- Unknown binaries can be opened as **text** (with Code / HTML / Markdown / JSON / CSV modes) or as a **hex** dump

Markdown often arrives as `application/octet-stream` from a static WebFolder. Use **Preview as text**, then switch the view to **Markdown**:

![HTTP Client markdown response](/screenshots/30-http-client-response-markdown.png)

PDF example (`GET http://localhost/PDF.pdf`):

![HTTP Client PDF response](/screenshots/33-http-client-response-pdf.png)

Image example (`GET http://localhost/JPG.png`):

![HTTP Client image response](/screenshots/34-http-client-response-image.png)

#### Network errors

Failed fetches (CORS, mixed content, cancelled, or offline targets) show a structured error panel with causes and what to check — not only a raw exception string.

![HTTP Client network error](/screenshots/36-http-client-network-error.png)

### Export

Use **Export** to download the current request (or favourites) as a **Collection v2.1** or **OpenAPI 3.1** document. For a full catalog toolkit, use [REST Export](/guide/rest-export).

### History

Use **History** to reopen recent requests (method, URL, and seed). Adjust how many entries to keep, remove individual rows, or clear the list.

![HTTP Client history](/screenshots/35-http-client-history.png)

### Open from the Console

In the [Console panel](/guide/console) network log, use **Open in HTTP Client** on a row to seed a new tab with that request (method, URL, headers, and body when available). Secrets stay redacted; replay notes appear when something could not be restored fully.

### Tips

- Prefer the **desktop** app for requests that need unrestricted cookies, redirects, or TLS options — browser builds are limited by CORS and cookie rules.
- Clear the **Server** field to leave a blank custom origin; it does not snap back until you choose a matching origin again.
- Connection cookies apply only when targeting the **current** server (see **Settings → Session**).
- For 4D REST `$filter` / `$orderby`, the client matches Query Builder encoding: the expression is wrapped in quotes, spaces stay spaces (not `+`), and only `&` / `=` are percent-encoded. You can paste the Query Builder expression with or without surrounding quotes.
- To try response previews locally, point **Server** at your 4D WebFolder origin (for example `http://localhost`) and request paths such as `/text.txt`, `/markdown.md`, `/html.html`, `/CSV.csv`, `/PDF.pdf`, or `/JPG.png`.
