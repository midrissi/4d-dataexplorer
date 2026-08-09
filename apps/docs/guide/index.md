---
title: Introduction
---

<script setup>
import { introMetaRows, metaColumns } from '../.vitepress/data/tables'
</script>

# Data Explorer — User Documentation

**Data Explorer** (4D REST Explorer) is a web, desktop, and mobile application for browsing, querying, and managing data in a 4D database through the REST API. It provides a tabbed interface, visual structure graph, query builder, Method Executor, HTTP Client, REST Export (Postman / OpenAPI), console and ORDA terminal, AI assistant and dataclass AI actions, and rich customization options.

<DocTable :columns="metaColumns" :rows="introMetaRows" variant="meta" hide-header />

## Explore the guide

The sidebar is grouped by topic:

- **Getting started** — install, open from 4D, or [run with Docker](/guide/getting-started#run-with-docker); [macOS desktop first launch](/guide/macos-desktop); [mobile apps](/guide/mobile)
- **Basics** — layout, home, sidebar, tabs, modes
- **Working with data** — browse, query, view, methods, structure graph
- **AI** — chat assistant, [AI actions & tasks](/guide/ai-actions), metadata
- **Tools** — command palette, [console](/guide/console), [ORDA terminal](/guide/terminal), HTTP Client, [REST Export](/guide/rest-export), schema builder
- **Configuration** — settings, shortcuts, language, profiles
- **Development** — contributing and local setup

Start with [Getting started](/guide/getting-started) or [macOS desktop first launch](/guide/macos-desktop).

## Related resources

- [4D REST API documentation](https://developer.4d.com/docs/REST/gettingStarted)
- [Release notes](/release-notes/)
- [E2E test suite](https://github.com/midrissi/4d-dataexplorer/tree/main/packages/e2e)
