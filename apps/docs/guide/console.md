---
title: Console panel
---

# Console panel

The console is a resizable bottom panel that shows application logs and every HTTP request made by Data Explorer.

![Console panel](/screenshots/22-console-panel.png)

Open from the footer **Console** control or the command palette (**Open Console**). Drag the top edge to resize; double-click the handle to reset height. Height is saved per profile.

### Capabilities

- **Network log** — compact rows with method, status, path, duration, size, and host; expand a row to inspect headers and bodies (secrets are redacted)
- **Open in HTTP Client** — replay a captured request in the [HTTP Client](/guide/http-client) (send icon on the row)
- **Filter** by level: all, log, info, warn, error, or network
- **Collapse all** expanded rows and object trees
- **Clear** the in-memory log buffer
- Error and warning counts appear on the footer Console button

Use the console when debugging failed REST calls, inspecting payloads, or tracing what the app requested while you browse.

---
