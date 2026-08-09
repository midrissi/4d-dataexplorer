---
title: REST Export
---

# REST Export

Build a **Postman Collection v2.1** or **OpenAPI 3.1** toolkit from the connected 4D REST catalog. Open it from the **Tools** menu or the command palette (**REST Export**).

![REST Export](/screenshots/39-rest-export.png)

HTTP Client and Method Executor can also export the current request or favourites as Postman or OpenAPI — see [HTTP Client](/guide/http-client) and [Method Executor](/guide/method-executor).

## Wizard

The tab is a four-step wizard. Use **Next** / **Back** (or the step indicator) to move between steps. Catalog and export preferences persist per profile.

| Step | Purpose |
|------|---------|
| **Selection** | Choose **Expanded** or **Collection variable** dataclass mode, then dataclasses and singletons. Refresh the catalog if the structure changed. |
| **Categories** | Toggle request groups (auth, catalog, CRUD, entity sets, functions, …). Core and advanced groups each have select / unselect all. |
| **Variables** | Collection name, description, base URL, and login variables (access key, username / password). Optionally include an access-key login request. |
| **Preview** | Review the folder tree, then export as Postman or OpenAPI. |

**Dataclass mode** (Selection step, first choice):

- **Expanded** (default) — one folder per selected dataclass with concrete paths (`/rest/Agency`) and `Functions/{dataclass|entity|entitySelection}`.
- **Collection variable** — one shared `DataClass` CRUD/catalog template using `{{Dataclass}}` (`/rest/$catalog/{{Dataclass}}`, `/rest/{{Dataclass}}`, …). The dataclass list only includes classes with member functions; those export as direct `dataclass` / `entity` / `entitySelection` subfolders (no `Functions` wrapper). The Postman collection includes a `Dataclass` variable (defaults to the first selected dataclass). Use this for large catalogs so the export stays small.

**Directory login** and **include non-exposed methods** are off by default. Turn them on under **Advanced** on the Categories step if you need them.

## Preview

The preview tree starts **collapsed**. Expand or collapse a folder, or use the toolbar control to expand / collapse all (including a mixed state when only some folders are open).

### Emojis

- Toggle **Emojis** on or off for the whole export.
- **Folder emoji on dataclasses** is off by default.
- Click an emoji (or the + control) on a request or folder to change or remove it. The picker includes a **Professional** tab for REST-oriented symbols.
- **Shift-click** an emoji or **No emoji** to apply or clear that choice for every item in the same category.

### 4D docs

When **4D docs** is on, each request links to the official [4D REST API](https://developer.4d.com/docs/category/rest-api) page. Postman request **Docs** include that page’s markdown; OpenAPI uses a short summary plus `externalDocs` and the known REST response statuses (200, 401, 402, 404, 500).

## Export

Choose **Postman** or **OpenAPI** in the preview toolbar, then **Export**. Empty query parameters such as `$filter`, `$orderby`, and `$attributes` are **disabled** in Postman by default so they are not sent until you fill them in.

### Tips

- Select only the dataclasses you need — the tree and file size stay smaller.
- Use **Collection variable** dataclass mode for large 4D bases so CRUD is not duplicated per dataclass.
- Uncheck categories you do not use (for example delete-all or compute / upload) before preview.
- Collection name and variables are reused the next time you open REST Export.
