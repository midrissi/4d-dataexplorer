---
title: Console panel
---

# Console panel

The console is a resizable bottom dock that shows application logs and every HTTP request Data Explorer makes. It shares the dock with the [ORDA Terminal](/guide/terminal) — switch tabs in the dock header.

![Console panel](/screenshots/22-console-panel.png)

## Open & resize

- Footer **Console** control, command palette (**Open Console**), or `⌘ `` ` / `Ctrl+`` ` (default preset)
- Drag the top edge of the dock to resize; double-click the handle to reset height
- Height and open state are saved per profile; the active dock tab (Console vs Terminal) is restored on reload

## Network log

Each REST call appears as a compact row: method, status, path, duration, size, and host.

- Expand a row to inspect request/response headers and bodies (secrets are redacted)
- **Open in HTTP Client** — send icon on the row seeds the [HTTP Client](/guide/http-client) for replay
- **Copy as** — code icon copies the request as 4D (`HTTPRequest` / `HTTP Request`), cURL, HTTP, JavaScript `fetch`, or Python `requests`
- Image responses can preview inline when the body is an image MIME type
- Filter by level: all, log, info, warn, error, or network
- **Collapse all** expanded rows and object trees; **Clear** empties the in-memory buffer
- Error and warning counts appear on the footer Console button

Use the console when debugging failed REST calls, inspecting payloads, or tracing what the app requested while you browse or run terminal snippets.

## Tips

- Terminal `ds.*` calls use the same logging fetch — open **Console → Network** to see the HTTP traffic behind a snippet
- On mobile, the dock fills the screen as an overlay; use **Done** / close to return to browsing

---
