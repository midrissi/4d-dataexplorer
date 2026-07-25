---
title: AI actions & tasks
---

# AI actions & tasks

Dataclass-scoped **AI actions** run in the background so you can keep browsing while the model works. Results appear in the **AI tasks** history in the footer.

These actions require a configured LLM (same settings as the [AI assistant](/guide/assistant)).

## Open AI actions

When an LLM is configured, a sparkles **AI** control appears on:

- Dataclass entity list header
- Sidebar dataclass row
- Structure graph selection

![AI actions menu](/screenshots/23-ai-actions-menu.png)

Choose:

| Action | Purpose |
| --- | --- |
| **Generate data** | Create sample entities in the selected dataclass |
| **Ask dataclass** | Filter, inspect, or change data with natural language |

In **read-only mode**, Generate data is disabled. Ask dataclass stays available for read-only work (queries, filters, schema info); write tools are blocked.

## Generate data

1. Open **AI** → **Generate data**
2. Set how many entities to create (presets or custom count, 1-50)
3. Pick one or more styles (hover for hints):
   - **Realistic** — production-like values
   - **Edge cases** — boundaries, empties, extremes, unicode
   - **Minimal** — required / common fields only
4. Optionally add extra instructions
5. Click **Generate**

![Generate data modal](/screenshots/24-ai-generate-data.png)

The task starts immediately and opens in **AI tasks**. After creation, the current view refreshes so new rows appear.

## Ask dataclass

1. Open **AI** → **Ask dataclass**
2. Describe what you want for the selected table, for example:
   - Show recent records in a new tab
   - How many records are there, and what are the main fields?
   - Delete all records in this dataclass
3. Click **Ask** (or pick an example chip)

![Ask dataclass modal](/screenshots/25-ai-ask-dataclass.png)

The agent can:

- Query and summarize the dataclass
- Plan relation analysis first (entity counts → start from the smaller side → minimize requests)
- Chart distributions across relations with `@widgets/render` (pie/bar/KPI)
- Open filtered results in a **new tab** (entity set / filtered tab)
- Create, update, or delete records when not in read-only mode

Destructive steps (for example deleting all records) prompt a **confirmation dialog**. Confirm or cancel there to continue the task.

## AI tasks history

Open **AI tasks** from the app footer (next to Console).

![AI tasks history](/screenshots/26-ai-tasks-history.png)

- Running tasks show a spinner and count
- When the agent waits for confirmation, a **dot** appears on **AI tasks**
- Open a task to see input, tools & activity, response, and result summary
- Tool rows are collapsed by default; expand a row to inspect args and results
- JSON results render as a compact tree when valid JSON is available

### Cancel

- **Cancel** on the task detail stops that run (including pending confirmations)
- **Cancel all** on the task list stops every running task
- Hover a running row for a quick stop control

### Clear history

Use **Clear** to remove finished tasks from local history. Running tasks are not persisted across app reloads; interrupted runs are marked cancelled.

## Tips

- Prefer **Ask dataclass** for table-scoped work; use the [chat assistant](/guide/assistant) for broader multi-step help across the app
- Document your schema in the [Assistant Metadata Editor](/guide/metadata-editor) so Generate and Ask produce better field values and filters
- Enable or disable assistant tools under **Settings → AI Assistant Tools** if a tool should not be available globally

---
