import type { DocTableColumn, DocTableRow } from '../theme/doc-table'

export const areaColumns: DocTableColumn[] = [
  { key: 'area', label: 'Area', width: '28%' },
  { key: 'purpose', label: 'Purpose' },
]

export const areaRows: DocTableRow[] = [
  {
    area: '**Header**',
    purpose: 'Global search (opens [command palette](/guide/command-palette)), edit/read-only mode',
  },
  {
    area: '**Sidebar**',
    purpose: 'Navigate dataclasses; collapse to icon-only mode',
  },
  {
    area: '**Tab bar**',
    purpose: 'Switch between Home, dataclass tabs, Structure, Settings, tools',
  },
  {
    area: '**Footer**',
    purpose:
      'Quick access to console, terminal, assistant, shortcuts, structure, tools, profiles, theme',
  },
]

export const footerColumns: DocTableColumn[] = [
  { key: 'control', label: 'Control', width: '30%', icons: true },
  { key: 'action', label: 'Action' },
]

export const footerRows: DocTableRow[] = [
  { control: 'Sidebar chevron', action: 'Collapse / expand sidebar' },
  {
    control: 'Console',
    action: 'Toggle the [console panel](/guide/console) (network + app logs)',
  },
  {
    control: 'Terminal',
    action: 'Toggle the [ORDA terminal](/guide/terminal) (`ds.*` expressions)',
  },
  {
    control: 'Chord buffer',
    action:
      'Shows the first key while waiting for a chord shortcut (see [Chord shortcuts](/guide/keyboard-shortcuts#chord-shortcuts))',
  },
  { control: 'Version link', action: 'Open [release notes](/release-notes/)' },
  { control: 'Sparkles', action: 'Toggle [AI assistant](/guide/assistant)' },
  { control: 'Command icon', action: 'Open [command palette](/guide/command-palette)' },
  { control: 'Keyboard', action: 'Open shortcuts reference modal' },
  { control: 'Network', action: 'Open [structure graph](/guide/structure-graph)' },
  {
    control: 'Wrench',
    action: '**Tools** menu (HTTP Client, REST Export, Schema Builder, Assistant Metadata)',
  },
  {
    control: 'Environment',
    action:
      'Switch active profile/database environments; open the [environment editor](/guide/environments)',
  },
  { control: 'Profile badge', action: 'Switch profile (when multiple profiles exist)' },
  { control: 'Gear', action: 'Open **Settings**' },
  { control: 'Languages', action: 'Change UI language' },
  { control: 'Palette', action: 'Pick a color theme' },
  { control: 'Sun / Moon', action: 'Toggle light / dark mode' },
]

export const shortcutColumns: DocTableColumn[] = [
  { key: 'shortcut', label: 'Shortcut', kbd: true },
  { key: 'action', label: 'Action' },
]

export const generalShortcuts: DocTableRow[] = [
  { shortcut: '`⌘ P`', action: 'Open command palette' },
  { shortcut: '`⌘ K` `⌘ P`', action: 'Focus sidebar search (search dataclasses)' },
  { shortcut: '`⌘ K` `?` or `⌘ /`', action: 'Show keyboard shortcuts' },
  { shortcut: '`⌘ ,` or `⌘ K` `,`', action: 'Open settings' },
  { shortcut: '`⇧ ⌘ R`', action: 'Toggle read-only mode' },
  { shortcut: '`⌘ ⇧ A`', action: 'Toggle AI assistant' },
]

export const viewShortcuts: DocTableRow[] = [
  { shortcut: '`⌘ B` or `⌘ K` `B`', action: 'Toggle sidebar' },
  { shortcut: '⌘ ` / Ctrl+`', action: 'Toggle console' },
  { shortcut: '`⌘ J` / `Ctrl+J`', action: 'Toggle ORDA terminal' },
  { shortcut: '`⇧ ⌘ D` or `⌘ K` `D`', action: 'Toggle light / dark theme' },
  { shortcut: '`⌘ 1`', action: 'Card view (active dataclass tab)' },
  { shortcut: '`⌘ 2`', action: 'Table view (active dataclass tab)' },
]

export const navigationShortcuts: DocTableRow[] = [
  { shortcut: '`⌘ H`', action: 'Open Home' },
  { shortcut: '`⇧ ⌘ S`', action: 'Open structure graph' },
  { shortcut: '`⇧ ⌘ M`', action: 'Open Assistant Metadata Editor' },
  { shortcut: '`⌘ O`', action: 'Open dataclass data (`/` palette mode)' },
  { shortcut: '`⇧ ⌘ G`', action: 'Open dataclass select (`>` palette mode)' },
  { shortcut: '`↑` / `↓`', action: 'Previous / next entity' },
  { shortcut: '`⌥ PageUp` / `⌥ PageDown`', action: 'First / last page' },
  { shortcut: '`←` / `→`', action: 'Previous / next page' },
]

export const entityShortcuts: DocTableRow[] = [
  { shortcut: '`⌥ ⌘ R`', action: 'Refresh entities' },
  { shortcut: '`N`', action: 'New entity' },
  { shortcut: '`⌘ G`', action: 'Go to entity (`:` palette mode)' },
  { shortcut: '`E`', action: 'Edit selected entity' },
  { shortcut: '`⌘ S`', action: 'Save entity (while editing)' },
  { shortcut: '`Esc`', action: 'Cancel edit' },
  { shortcut: '`D`', action: 'Duplicate entity' },
  { shortcut: '`Delete`', action: 'Delete selected entity' },
]

export const tabShortcuts: DocTableRow[] = [
  {
    shortcut: '`⌃ ⇧ T` (Mac) / `Ctrl+Alt+T` (Win/Linux)',
    action: 'Switch tabs grid',
  },
  { shortcut: '`Ctrl+Alt+W`', action: 'Close tab' },
  { shortcut: '`⇧ ⌘ P`', action: 'Pin / unpin tab' },
  { shortcut: '`Ctrl+Alt+→` / `Ctrl+Alt+←`', action: 'Next / previous tab' },
  { shortcut: '`Ctrl+Alt+1` … `9`', action: 'Switch to tab 1-9' },
]

export const metaColumns: DocTableColumn[] = [
  { key: 'label', label: '', width: '32%' },
  { key: 'value', label: '' },
]

export const introMetaRows: DocTableRow[] = [
  { label: '**Version**', value: '1.4.0' },
  {
    label: '**URL**',
    value: '`http://localhost:7080/dataexplorer/` (or your 4D server path)',
  },
  { label: '**Authentication**', value: 'Automatic when opened from 4D' },
]

export const panelColumns: DocTableColumn[] = [
  { key: 'panel', label: 'Panel', width: '28%' },
  { key: 'description', label: 'Description' },
]

export const browsingPanelRows: DocTableRow[] = [
  { panel: '**Entity list**', description: 'Paginated cards or table of entities' },
  { panel: '**Query bar**', description: 'Filter, sort, limit, entity set binding' },
  {
    panel: '**Entity viewer**',
    description: 'Form, tree, or JSON detail for the selected entity',
  },
]

export const queryColumns: DocTableColumn[] = [
  { key: 'parameter', label: 'Parameter', width: '22%' },
  { key: 'rest', label: 'REST equivalent', width: '22%' },
  { key: 'description', label: 'Description' },
]

export const queryRows: DocTableRow[] = [
  { parameter: '**Filter**', rest: '`$filter`', description: 'OData-style filter expression' },
  { parameter: '**Order by**', rest: '`$orderby`', description: 'Sort fields and direction' },
  {
    parameter: '**Attributes**',
    rest: '`$attributes`',
    description: 'Limit returned fields (also drives table columns)',
  },
  { parameter: '**Top / Limit**', rest: '`$top` / `$limit`', description: 'Maximum rows' },
  {
    parameter: '**Entity set ID**',
    rest: '`$entityset`',
    description: 'Bind to a server-side entity set',
  },
  {
    parameter: '**Parameters**',
    rest: '—',
    description: 'Typed parameters for filter expressions',
  },
]

export const viewModeColumns: DocTableColumn[] = [
  { key: 'mode', label: 'Mode', width: '22%' },
  { key: 'bestFor', label: 'Best for' },
]

export const entityViewModeRows: DocTableRow[] = [
  { mode: '**Form**', bestFor: 'Editing scalar fields with type-aware inputs' },
  { mode: '**Tree**', bestFor: 'Navigating nested objects and relations' },
  { mode: '**JSON**', bestFor: 'Raw JSON with Monaco editor and schema completion' },
]

export const entityActionColumns: DocTableColumn[] = [
  { key: 'action', label: 'Action', width: '22%' },
  { key: 'how', label: 'How' },
]

export const entityActionRows: DocTableRow[] = [
  {
    action: '**Edit**',
    how: 'Toolbar or `E` — opens Form or JSON editor depending on **Default edit mode**',
  },
  { action: '**Save**', how: 'Toolbar or `⌘ S` while editing' },
  { action: '**Cancel edit**', how: 'Toolbar or `Esc`' },
  {
    action: '**Duplicate**',
    how: 'Command palette or card menu — opens create dialog with copied data',
  },
  {
    action: '**Delete**',
    how: 'Toolbar, card menu, or `Delete` key — confirms before removing',
  },
]

export const structureToolbarColumns: DocTableColumn[] = [
  { key: 'control', label: 'Control', width: '34%' },
  { key: 'description', label: 'Description' },
]

export const structureToolbarRows: DocTableRow[] = [
  { control: '**Auto-organize**', description: 'Re-layout nodes with ELK for a clean grid' },
  { control: '**Show all relations**', description: 'Display every relation edge' },
  {
    control: '**Selected relations only**',
    description: 'Show edges for the selected dataclass',
  },
  { control: '**Hide relations**', description: 'Hide all relation edges' },
]

export const paletteModeColumns: DocTableColumn[] = [
  { key: 'prefix', label: 'Prefix', width: '12%', kbd: true },
  { key: 'mode', label: 'Mode', width: '30%' },
  { key: 'shortcut', label: 'Shortcut', width: '28%', kbd: true },
  { key: 'example', label: 'Example', width: '18%', kbd: true },
]

export const paletteModeRows: DocTableRow[] = [
  { prefix: '`:`', mode: 'Go to entity by index', shortcut: '`⌘ G`', example: '`:42`' },
  {
    prefix: '`>`',
    mode: 'Pick dataclass for structure',
    shortcut: '`⇧ ⌘ G`',
    example: '`>Employee`',
  },
  { prefix: '`/`', mode: 'Open dataclass data', shortcut: '`⌘ O`', example: '`/Customer`' },
  {
    prefix: '`@`',
    mode: 'Switch tabs grid',
    shortcut: '`⌃ ⇧ T` (Mac) / `Ctrl+Alt+T` (Win/Linux)',
    example: '`@Settings`',
  },
]

export const modeColumns: DocTableColumn[] = [
  { key: 'mode', label: 'Mode', width: '28%' },
  { key: 'behavior', label: 'Behavior' },
]

export const editModeRows: DocTableRow[] = [
  { mode: '**Edit mode**', behavior: 'Create, update, and delete entities' },
  { mode: '**Read only**', behavior: 'Browse safely; all mutations disabled' },
]

export const metadataFeatureColumns: DocTableColumn[] = [
  { key: 'feature', label: 'Feature', width: '32%' },
  { key: 'description', label: 'Description' },
]

export const metadataFeatureRows: DocTableRow[] = [
  { feature: '**Editor / JSON tabs**', description: 'Visual editor or raw JSON' },
  {
    feature: '**Generate all**',
    description: 'AI-generated descriptions for missing entries',
  },
  {
    feature: '**Missing indicators**',
    description: 'Orange dots on undocumented items',
  },
  { feature: '**Export JSON**', description: 'Download the metadata schema file' },
  { feature: '**Filter**', description: 'Show only items missing descriptions' },
]

export const tabsPageShortcuts: DocTableRow[] = [
  { shortcut: '`Ctrl+Alt+→` / `Ctrl+Alt+←`', action: 'Next / previous tab' },
  { shortcut: '`Ctrl+Alt+1` … `Ctrl+Alt+9`', action: 'Jump to tab 1-9' },
  {
    shortcut: '`⌃ ⇧ T` / `Ctrl+Alt+T`',
    action: 'Switch tabs grid in command palette',
  },
]
