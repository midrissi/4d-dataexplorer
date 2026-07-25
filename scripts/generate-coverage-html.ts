/**
 * Generate a styled HTML coverage dashboard from package LCOV files.
 * Run after merge-all-lcov or standalone (reads per-package lcov directly).
 *
 * Documentation coverage:
 *   bun scripts/generate-coverage-html.ts --docs
 *
 * Regenerate dark + light screenshots, then check docs coverage:
 *   bun scripts/generate-coverage-html.ts --screenshots --docs
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { analyzeDocumentation, DOC_FEATURES, type DocFeature } from './doc-features'
import { analyzeScreenshotCoverage, type ScreenshotCoverage } from './doc-screenshots'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_DIR = join(ROOT, 'coverage', 'html')
const DOCS_GUIDE_DIR = join(ROOT, 'apps/docs/guide')
const DOCS_DATA_DIR = join(ROOT, 'apps/docs/.vitepress/data')

function loadDocumentationContent(): string {
  const parts: string[] = []

  if (existsSync(DOCS_GUIDE_DIR)) {
    const files = readdirSync(DOCS_GUIDE_DIR)
      .filter((name) => name.endsWith('.md'))
      .sort()
    parts.push(...files.map((name) => readFileSync(join(DOCS_GUIDE_DIR, name), 'utf8')))
  }

  if (existsSync(DOCS_DATA_DIR)) {
    const dataFiles = readdirSync(DOCS_DATA_DIR).filter((name) => name.endsWith('.ts'))
    parts.push(...dataFiles.map((name) => readFileSync(join(DOCS_DATA_DIR, name), 'utf8')))
  }

  if (parts.length === 0) {
    console.error(`Documentation guide not found: ${DOCS_GUIDE_DIR}`)
    process.exit(1)
  }

  return parts.join('\n\n')
}

const PACKAGES: { prefix: string; label: string; accent: string }[] = [
  { prefix: 'apps/dataexplorer', label: 'dataexplorer', accent: '#7c9cff' },
  { prefix: 'packages/rest', label: 'rest', accent: '#6ee7b7' },
  { prefix: 'packages/rest-server', label: 'rest-server', accent: '#fbbf24' },
  { prefix: 'packages/ui', label: 'ui', accent: '#f472b6' },
]

const EXCLUDE_SUFFIXES = ['/test-setup.ts', '/test-rest-mock.ts', 'src/lib/storage.ts']

/** Exclude cross-imported package paths from dataexplorer coverage, not package-native lcov files. */
function shouldExcludePath(path: string, packageLabel: string): boolean {
  if (EXCLUDE_SUFFIXES.some((s) => path.endsWith(s))) return true
  if (packageLabel === 'dataexplorer' && path.includes('/packages/')) return true
  return false
}

type Metrics = { lf: number; lh: number; fnf: number; fnh: number; brf: number; brh: number }

type FileRecord = Metrics & { path: string; package: string }

type TreeNode = {
  name: string
  path: string
  children: TreeNode[]
  metrics: Metrics
  isFile: boolean
}

function emptyMetrics(): Metrics {
  return { lf: 0, lh: 0, fnf: 0, fnh: 0, brf: 0, brh: 0 }
}

function addMetrics(target: Metrics, source: Metrics): void {
  target.lf += source.lf
  target.lh += source.lh
  target.fnf += source.fnf
  target.fnh += source.fnh
  target.brf += source.brf
  target.brh += source.brh
}

function pct(hit: number, total: number): number {
  return total === 0 ? 100 : (hit / total) * 100
}

function pctLabel(hit: number, total: number): string {
  return `${pct(hit, total).toFixed(1)}%`
}

function coverageClass(value: number): string {
  if (value >= 80) return 'good'
  if (value >= 50) return 'warn'
  return 'bad'
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function parseLcov(content: string, pathPrefix: string, packageLabel: string): FileRecord[] {
  const records: FileRecord[] = []
  let current: Partial<FileRecord> = {}

  for (const line of content.split('\n')) {
    if (line.startsWith('SF:')) {
      current = { path: `${pathPrefix}/${line.slice(3).trim()}`, package: packageLabel }
    } else if (line.startsWith('FNF:')) current.fnf = Number(line.slice(4))
    else if (line.startsWith('FNH:')) current.fnh = Number(line.slice(4))
    else if (line.startsWith('LF:')) current.lf = Number(line.slice(3))
    else if (line.startsWith('LH:')) current.lh = Number(line.slice(3))
    else if (line.startsWith('BRF:')) current.brf = Number(line.slice(4))
    else if (line.startsWith('BRH:')) current.brh = Number(line.slice(4))
    else if (line === 'end_of_record' && current.path && current.package) {
      if (!shouldExcludePath(current.path, packageLabel)) {
        records.push({
          path: current.path,
          package: current.package,
          lf: current.lf ?? 0,
          lh: current.lh ?? 0,
          fnf: current.fnf ?? 0,
          fnh: current.fnh ?? 0,
          brf: current.brf ?? 0,
          brh: current.brh ?? 0,
        })
      }
      current = {}
    }
  }
  return records
}

function buildTree(files: FileRecord[]): TreeNode {
  const root: TreeNode = {
    name: 'project',
    path: '',
    children: [],
    metrics: emptyMetrics(),
    isFile: false,
  }

  for (const file of files) {
    // Keep full monorepo path (apps/dataexplorer/…, packages/rest/…) for package-aware tree
    const relative = file.path
    const segments = relative.split('/').filter(Boolean)
    let current = root

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      if (!segment) continue
      const isFile = i === segments.length - 1
      let child = current.children.find((c) => c.name === segment)

      if (!child) {
        const path = current.path ? `${current.path}/${segment}` : segment
        child = {
          name: segment,
          path,
          children: [],
          metrics: emptyMetrics(),
          isFile,
        }
        current.children.push(child)
      }

      if (isFile) {
        child.isFile = true
        child.metrics = {
          lf: file.lf,
          lh: file.lh,
          fnf: file.fnf,
          fnh: file.fnh,
          brf: file.brf,
          brh: file.brh,
        }
      }

      current = child
    }
  }

  const rollup = (node: TreeNode): Metrics => {
    if (node.isFile && node.metrics.lf + node.metrics.fnf > 0) return node.metrics
    const m = emptyMetrics()
    for (const child of node.children) addMetrics(m, rollup(child))
    node.metrics = m
    return m
  }
  rollup(root)

  const sortTree = (node: TreeNode): void => {
    node.children.sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1
      return a.name.localeCompare(b.name)
    })
    for (const child of node.children) sortTree(child)
  }
  sortTree(root)
  return root
}

function renderBar(value: number): string {
  const cls = coverageClass(value)
  return `<div class="bar ${cls}" style="--w:${Math.min(value, 100).toFixed(1)}%" aria-hidden="true"><span></span></div>`
}

function renderMetrics(m: Metrics): string {
  const linePct = pct(m.lh, m.lf)
  const fnPct = pct(m.fnh, m.fnf)
  const brPct = pct(m.brh, m.brf)
  return `<div class="metrics">
    <span class="metric ${coverageClass(linePct)}" title="Lines">${pctLabel(m.lh, m.lf)}</span>
    <span class="metric ${coverageClass(fnPct)}" title="Functions">${pctLabel(m.fnh, m.fnf)}</span>
    <span class="metric ${coverageClass(brPct)}" title="Branches">${pctLabel(m.brh, m.brf)}</span>
  </div>`
}

function renderTree(nodes: TreeNode[], depth = 0): string {
  return nodes
    .map((node) => {
      const linePct = pct(node.metrics.lh, node.metrics.lf)
      const id = `node-${node.path.replaceAll(/[^a-zA-Z0-9_-]/g, '_')}`
      const hasChildren = node.children.length > 0
      const rowClass = node.isFile ? 'row file' : 'row folder'

      const childrenHtml = hasChildren
        ? `<div class="children collapsed" id="${id}-children">${renderTree(node.children, depth + 1)}</div>`
        : ''

      const toggle = hasChildren
        ? `<button type="button" class="toggle" data-target="${id}-children" aria-expanded="false">+</button>`
        : `<span class="toggle-spacer"></span>`

      const icon = node.isFile ? '📄' : '📁'

      return `<div class="${rowClass}" data-name="${escapeHtml(node.name.toLowerCase())}" data-path="${escapeHtml(node.path.toLowerCase())}" style="--depth:${depth}">
        ${toggle}
        <span class="icon">${icon}</span>
        <span class="label">${escapeHtml(node.name)}</span>
        ${renderBar(linePct)}
        ${renderMetrics(node.metrics)}
      </div>${childrenHtml}`
    })
    .join('')
}

function renderSummaryCard(label: string, m: Metrics, accent: string): string {
  const linePct = pct(m.lh, m.lf)
  const fnPct = pct(m.fnh, m.fnf)
  const brPct = pct(m.brh, m.brf)
  return `<article class="pkg-card" style="--accent:${accent}">
    <header>
      <h3>${escapeHtml(label)}</h3>
      <span class="pkg-line-pct ${coverageClass(linePct)}">${linePct.toFixed(1)}%</span>
    </header>
    ${renderBar(linePct)}
    <dl class="pkg-stats">
      <div><dt>Lines</dt><dd>${m.lh}/${m.lf}</dd></div>
      <div><dt>Functions</dt><dd>${m.fnh}/${m.fnf}</dd></div>
      <div><dt>Branches</dt><dd>${m.brh}/${m.brf}</dd></div>
    </dl>
    <footer>
      <span class="chip ${coverageClass(fnPct)}">fn ${fnPct.toFixed(0)}%</span>
      <span class="chip ${coverageClass(brPct)}">br ${brPct.toFixed(0)}%</span>
    </footer>
  </article>`
}

function renderHtml(
  generatedAt: string,
  version: string,
  total: Metrics,
  packageCards: string,
  treeHtml: string
): string {
  const linePct = pct(total.lh, total.lf)
  const fnPct = pct(total.fnh, total.fnf)
  const brPct = pct(total.brh, total.brf)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>4D Coverage · ${linePct.toFixed(1)}% lines</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #0c0e12;
      --bg-elevated: #141820;
      --bg-hover: #1a2030;
      --border: rgba(255,255,255,0.08);
      --text: #e8eaef;
      --muted: #8b93a7;
      --good: #34d399;
      --warn: #fbbf24;
      --bad: #f87171;
      --good-dim: rgba(52,211,153,0.15);
      --warn-dim: rgba(251,191,36,0.15);
      --bad-dim: rgba(248,113,113,0.15);
      --radius: 14px;
      --mono: "IBM Plex Mono", ui-monospace, monospace;
      --sans: "Inter", system-ui, sans-serif;
      --serif: "Instrument Serif", Georgia, serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: var(--sans);
      color: var(--text);
      background:
        radial-gradient(1200px 600px at 10% -10%, rgba(124,156,255,0.12), transparent 55%),
        radial-gradient(900px 500px at 90% 0%, rgba(244,114,182,0.08), transparent 50%),
        var(--bg);
    }
    .wrap { max-width: 1180px; margin: 0 auto; padding: 2.5rem 1.5rem 4rem; }
    .hero { display: grid; grid-template-columns: 1.2fr 1fr; gap: 2rem; align-items: end; margin-bottom: 2.5rem; }
    @media (max-width: 860px) { .hero { grid-template-columns: 1fr; } }
    .eyebrow { font-family: var(--mono); font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); margin: 0 0 0.75rem; }
    h1 { font-family: var(--serif); font-size: clamp(2.4rem, 5vw, 3.6rem); font-weight: 400; line-height: 1.05; margin: 0 0 0.75rem; }
    h1 em { font-style: italic; color: #a5b4fc; }
    .subtitle { color: var(--muted); margin: 0; max-width: 36ch; line-height: 1.55; }
    .hero-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
    .stat {
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1rem 1.1rem;
      text-align: center;
    }
    .stat .value { display: block; font-family: var(--mono); font-size: 1.65rem; font-weight: 500; margin-bottom: 0.25rem; }
    .stat .label { font-size: 0.78rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
    .stat.good .value { color: var(--good); }
    .stat.warn .value { color: var(--warn); }
    .stat.bad .value { color: var(--bad); }
    .packages { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .pkg-card {
      background: linear-gradient(165deg, color-mix(in srgb, var(--accent) 8%, var(--bg-elevated)), var(--bg-elevated));
      border: 1px solid color-mix(in srgb, var(--accent) 25%, var(--border));
      border-radius: var(--radius);
      padding: 1rem 1.1rem;
    }
    .pkg-card header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.65rem; }
    .pkg-card h3 { margin: 0; font-family: var(--mono); font-size: 0.85rem; font-weight: 500; color: var(--accent); }
    .pkg-line-pct { font-family: var(--mono); font-size: 1.1rem; font-weight: 500; }
    .pkg-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin: 0.75rem 0; font-size: 0.75rem; }
    .pkg-stats dt { color: var(--muted); margin: 0; }
    .pkg-stats dd { margin: 0.15rem 0 0; font-family: var(--mono); }
    .pkg-card footer { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .chip { font-family: var(--mono); font-size: 0.68rem; padding: 0.2rem 0.45rem; border-radius: 999px; background: var(--bg-hover); }
    .chip.good { background: var(--good-dim); color: var(--good); }
    .chip.warn { background: var(--warn-dim); color: var(--warn); }
    .chip.bad { background: var(--bad-dim); color: var(--bad); }
    .panel {
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: calc(var(--radius) + 2px);
      overflow: hidden;
      box-shadow: 0 24px 80px rgba(0,0,0,0.35);
    }
    .panel-head {
      display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
      padding: 1rem 1.1rem; border-bottom: 1px solid var(--border);
      background: rgba(255,255,255,0.02);
    }
    .panel-head h2 { margin: 0; font-size: 1rem; font-weight: 600; }
    .controls { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    input[type="search"] {
      background: var(--bg); border: 1px solid var(--border); color: var(--text);
      border-radius: 999px; padding: 0.45rem 0.85rem; font: inherit; min-width: 220px;
    }
    input[type="search"]:focus { outline: 2px solid rgba(124,156,255,0.45); border-color: transparent; }
    button.ghost {
      background: transparent; border: 1px solid var(--border); color: var(--muted);
      border-radius: 999px; padding: 0.4rem 0.75rem; font: inherit; cursor: pointer;
    }
    button.ghost:hover { color: var(--text); border-color: rgba(255,255,255,0.18); }
    .legend { display: flex; gap: 0.75rem; font-size: 0.72rem; color: var(--muted); padding: 0.65rem 1.1rem; border-bottom: 1px solid var(--border); }
    .legend span::before { content: ""; display: inline-block; width: 0.55rem; height: 0.55rem; border-radius: 2px; margin-right: 0.35rem; vertical-align: middle; }
    .legend .g::before { background: var(--good); }
    .legend .w::before { background: var(--warn); }
    .legend .b::before { background: var(--bad); }
    .tree { font-size: 0.82rem; }
    .row {
      display: grid;
      grid-template-columns: 1.4rem 1.2rem minmax(180px, 1fr) minmax(100px, 140px) 9.5rem;
      gap: 0.45rem;
      align-items: center;
      padding: 0.42rem 1rem 0.42rem calc(1rem + var(--depth) * 0.8rem);
      border-bottom: 1px solid rgba(255,255,255,0.03);
    }
    .row:hover { background: var(--bg-hover); }
    .row.hidden { display: none; }
    .row.file .label { font-family: var(--mono); font-size: 0.78rem; color: #c5cad6; }
    .row.folder .label { font-weight: 500; }
    .toggle, .toggle-spacer { width: 1.4rem; text-align: center; }
    .toggle {
      border: none; background: transparent; color: var(--muted); cursor: pointer;
      font-family: var(--mono); font-size: 0.9rem; line-height: 1; padding: 0;
    }
    .icon { opacity: 0.75; font-size: 0.85rem; }
    .bar { height: 6px; background: rgba(255,255,255,0.06); border-radius: 999px; overflow: hidden; }
    .bar span { display: block; height: 100%; width: var(--w); border-radius: inherit; transition: width 0.35s ease; }
    .bar.good span { background: linear-gradient(90deg, #059669, var(--good)); }
    .bar.warn span { background: linear-gradient(90deg, #d97706, var(--warn)); }
    .bar.bad span { background: linear-gradient(90deg, #dc2626, var(--bad)); }
    .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.25rem; font-family: var(--mono); font-size: 0.72rem; text-align: right; }
    .metric.good { color: var(--good); }
    .metric.warn { color: var(--warn); }
    .metric.bad { color: var(--bad); }
    .children.collapsed { display: none; }
    footer.page { margin-top: 1.5rem; text-align: center; color: var(--muted); font-size: 0.75rem; font-family: var(--mono); }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <div>
        <p class="eyebrow">4D Data Explorer · v${escapeHtml(version)}</p>
        <h1>Coverage <em>report</em></h1>
        <p class="subtitle">Unit test line, function, and branch coverage across the monorepo. Generated ${escapeHtml(generatedAt)}.</p>
      </div>
      <div class="hero-stats">
        <div class="stat ${coverageClass(linePct)}"><span class="value">${linePct.toFixed(1)}%</span><span class="label">Lines</span></div>
        <div class="stat ${coverageClass(fnPct)}"><span class="value">${fnPct.toFixed(1)}%</span><span class="label">Functions</span></div>
        <div class="stat ${coverageClass(brPct)}"><span class="value">${brPct.toFixed(1)}%</span><span class="label">Branches</span></div>
      </div>
    </section>

    <section class="packages">${packageCards}</section>

    <section class="panel">
      <div class="panel-head">
        <h2>File explorer</h2>
        <div class="controls">
          <input type="search" id="filter" placeholder="Filter files & folders…" autocomplete="off" />
          <button type="button" class="ghost" id="expand-all">Expand all</button>
          <button type="button" class="ghost" id="collapse-all">Collapse all</button>
        </div>
      </div>
      <div class="legend">
        <span class="g">≥ 80%</span>
        <span class="w">50-79%</span>
        <span class="b">&lt; 50%</span>
        <span style="margin-left:auto">Columns: lines · functions · branches</span>
      </div>
      <div class="tree" id="tree">${treeHtml}</div>
    </section>

    <footer class="page">Generated by scripts/generate-coverage-html.ts</footer>
  </div>
  <script>
    const filter = document.getElementById('filter');
    const rows = [...document.querySelectorAll('.row')];
    filter?.addEventListener('input', () => {
      const q = filter.value.trim().toLowerCase();
      for (const row of rows) {
        const name = row.dataset.name || '';
        const path = row.dataset.path || '';
        row.classList.toggle('hidden', q.length > 0 && !name.includes(q) && !path.includes(q));
      }
    });
    document.querySelectorAll('.toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.dataset.target);
        if (!target) return;
        const collapsed = target.classList.toggle('collapsed');
        btn.textContent = collapsed ? '+' : '−';
        btn.setAttribute('aria-expanded', String(!collapsed));
      });
    });
    document.getElementById('collapse-all')?.addEventListener('click', () => {
      document.querySelectorAll('.children').forEach((el) => el.classList.add('collapsed'));
      document.querySelectorAll('.toggle').forEach((btn) => { btn.textContent = '+'; btn.setAttribute('aria-expanded', 'false'); });
    });
    document.getElementById('expand-all')?.addEventListener('click', () => {
      document.querySelectorAll('.children').forEach((el) => el.classList.remove('collapsed'));
      document.querySelectorAll('.toggle').forEach((btn) => { btn.textContent = '−'; btn.setAttribute('aria-expanded', 'true'); });
    });
  </script>
</body>
</html>`
}

function main(): void {
  if (process.argv.includes('--screenshots')) {
    runScreenshotCapture()
  }

  if (process.argv.includes('--docs')) {
    generateDocsCoverage()
    return
  }

  generateTestCoverage()
}

function runScreenshotCapture(): void {
  console.log('Capturing documentation screenshots (dark + light)…')
  const result = spawnSync('bun', ['run', 'scripts/capture-docs-screenshots.ts'], {
    cwd: join(ROOT, 'packages/e2e'),
    stdio: 'inherit',
    env: process.env,
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function generateDocsCoverage(): void {
  const content = loadDocumentationContent()
  const { documented, missing, coveragePct } = analyzeDocumentation(content)
  const screenshotCoverage = analyzeScreenshotCoverage()
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string }
  const generatedAt = new Date().toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  mkdirSync(OUT_DIR, { recursive: true })
  const html = renderDocsHtml(
    generatedAt,
    pkg.version,
    documented,
    missing,
    coveragePct,
    screenshotCoverage.items,
    screenshotCoverage.missing
  )
  writeFileSync(join(OUT_DIR, 'docs.html'), html)

  console.log(
    `Documentation coverage -> coverage/html/docs.html (${documented.length}/${DOC_FEATURES.length} features, ${coveragePct.toFixed(1)}%)`
  )

  const screenshotHits = screenshotCoverage.items.filter((item) => item.dark && item.light).length
  console.log(
    `Screenshot coverage -> ${screenshotHits}/${screenshotCoverage.items.length} captured in dark + light`
  )

  let failed = false

  if (missing.length > 0) {
    failed = true
    console.warn('\nUndocumented features:')
    for (const feature of missing) {
      console.warn(`  - [${feature.category}] ${feature.label} (${feature.id})`)
    }
  }

  if (screenshotCoverage.missing.length > 0) {
    failed = true
    console.warn('\nMissing themed screenshots:')
    for (const item of screenshotCoverage.missing) {
      const parts = [!item.dark ? 'dark' : null, !item.light ? 'light' : null].filter(Boolean)
      console.warn(`  - ${item.name}.png (${parts.join(', ')})`)
    }
    console.warn('\nRegenerate with: bun scripts/generate-coverage-html.ts --screenshots --docs')
  }

  if (failed) {
    process.exit(1)
  }
}

function generateTestCoverage(): void {
  const allFiles: FileRecord[] = []

  for (const { prefix, label } of PACKAGES) {
    const lcovPath = join(ROOT, prefix, 'coverage', 'lcov.info')
    if (!existsSync(lcovPath)) {
      console.warn(`No coverage found: ${lcovPath}`)
      continue
    }
    allFiles.push(...parseLcov(readFileSync(lcovPath, 'utf8'), prefix, label))
  }

  if (allFiles.length === 0) {
    console.error('No coverage data found. Run: bun run test:coverage')
    process.exit(1)
  }

  const total = emptyMetrics()
  for (const file of allFiles) addMetrics(total, file)

  const packageCards = PACKAGES.map(({ label, accent }) => {
    const pkgMetrics = emptyMetrics()
    for (const file of allFiles.filter((f) => f.package === label)) addMetrics(pkgMetrics, file)
    if (pkgMetrics.lf === 0 && pkgMetrics.fnf === 0) return ''
    return renderSummaryCard(label, pkgMetrics, accent)
  }).join('')

  const tree = buildTree(allFiles)
  const treeHtml = renderTree(tree.children)

  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string }
  const generatedAt = new Date().toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  mkdirSync(OUT_DIR, { recursive: true })
  const html = renderHtml(generatedAt, pkg.version, total, packageCards, treeHtml)
  writeFileSync(join(OUT_DIR, 'index.html'), html)
  console.log(`Coverage dashboard -> coverage/html/index.html (${allFiles.length} files)`)
}

function renderDocsFeatureRow(feature: DocFeature, documented: boolean): string {
  const cls = documented ? 'good' : 'bad'
  const status = documented ? 'Documented' : 'Missing'
  const patterns = feature.patterns.map((p) => escapeHtml(p)).join(', ')
  return `<tr class="doc-row ${cls}" data-category="${escapeHtml(feature.category.toLowerCase())}" data-label="${escapeHtml(feature.label.toLowerCase())}">
    <td><span class="chip ${cls}">${status}</span></td>
    <td>${escapeHtml(feature.category)}</td>
    <td class="mono">${escapeHtml(feature.id)}</td>
    <td>${escapeHtml(feature.label)}</td>
    <td class="patterns">${patterns}</td>
  </tr>`
}

function renderScreenshotRow(item: ScreenshotCoverage): string {
  const dark = item.dark ? 'good' : 'bad'
  const light = item.light ? 'good' : 'bad'
  const status = item.dark && item.light ? 'Complete' : 'Missing'
  const statusClass = item.dark && item.light ? 'good' : 'bad'
  return `<tr class="doc-row ${statusClass}" data-label="${escapeHtml(item.name.toLowerCase())}">
    <td><span class="chip ${statusClass}">${status}</span></td>
    <td class="mono">${escapeHtml(item.name)}</td>
    <td><span class="chip ${dark}">${item.dark ? 'yes' : 'no'}</span></td>
    <td><span class="chip ${light}">${item.light ? 'yes' : 'no'}</span></td>
  </tr>`
}

function renderDocsHtml(
  generatedAt: string,
  version: string,
  documented: DocFeature[],
  missing: DocFeature[],
  coveragePct: number,
  screenshots: ScreenshotCoverage[],
  missingScreenshots: ScreenshotCoverage[]
): string {
  const documentedSet = new Set(documented.map((f) => f.id))
  const rows = DOC_FEATURES.map((f) => renderDocsFeatureRow(f, documentedSet.has(f.id))).join('')
  const screenshotRows = screenshots.map((item) => renderScreenshotRow(item)).join('')
  const screenshotPct =
    screenshots.length === 0
      ? 100
      : (screenshots.filter((item) => item.dark && item.light).length / screenshots.length) * 100
  const categories = [...new Set(DOC_FEATURES.map((f) => f.category))]

  const categoryCards = categories
    .map((category) => {
      const inCategory = DOC_FEATURES.filter((f) => f.category === category)
      const hit = inCategory.filter((f) => documentedSet.has(f.id)).length
      const pct = inCategory.length === 0 ? 100 : (hit / inCategory.length) * 100
      return `<article class="pkg-card" style="--accent:#a5b4fc">
        <header>
          <h3>${escapeHtml(category)}</h3>
          <span class="pkg-line-pct ${coverageClass(pct)}">${pct.toFixed(0)}%</span>
        </header>
        ${renderBar(pct)}
        <dl class="pkg-stats">
          <div><dt>Documented</dt><dd>${hit}/${inCategory.length}</dd></div>
        </dl>
      </article>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Documentation coverage · ${coveragePct.toFixed(1)}%</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #0c0e12; --bg-elevated: #141820; --bg-hover: #1a2030; --border: rgba(255,255,255,0.08);
      --text: #e8eaef; --muted: #8b93a7; --good: #34d399; --warn: #fbbf24; --bad: #f87171;
      --radius: 14px; --mono: "IBM Plex Mono", ui-monospace, monospace;
      --sans: "Inter", system-ui, sans-serif; --serif: "Instrument Serif", Georgia, serif;
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; font-family: var(--sans); color: var(--text);
      background: radial-gradient(1200px 600px at 10% -10%, rgba(124,156,255,0.12), transparent 55%), var(--bg); }
    .wrap { max-width: 1180px; margin: 0 auto; padding: 2.5rem 1.5rem 4rem; }
    .hero { margin-bottom: 2rem; }
    .eyebrow { font-family: var(--mono); font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); }
    h1 { font-family: var(--serif); font-size: clamp(2rem, 4vw, 3rem); font-weight: 400; margin: 0.5rem 0; }
    h1 em { font-style: italic; color: #a5b4fc; }
    .subtitle { color: var(--muted); max-width: 50ch; line-height: 1.55; }
    .stat-row { display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 1.5rem; }
    .stat { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius); padding: 1rem 1.25rem; min-width: 140px; }
    .stat .value { font-family: var(--mono); font-size: 1.5rem; display: block; }
    .stat.good .value { color: var(--good); } .stat.bad .value { color: var(--bad); }
    .packages { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; margin: 2rem 0; }
    .pkg-card { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius); padding: 1rem; }
    .pkg-card header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.5rem; }
    .pkg-card h3 { margin: 0; font-size: 0.85rem; }
    .pkg-line-pct { font-family: var(--mono); font-weight: 500; }
    .pkg-line-pct.good { color: var(--good); } .pkg-line-pct.warn { color: var(--warn); } .pkg-line-pct.bad { color: var(--bad); }
    .pkg-stats { margin: 0.5rem 0 0; font-size: 0.75rem; }
    .pkg-stats dt { color: var(--muted); display: inline; } .pkg-stats dd { display: inline; font-family: var(--mono); margin: 0 0 0 0.35rem; }
    .bar { height: 6px; background: rgba(255,255,255,0.06); border-radius: 999px; overflow: hidden; margin: 0.5rem 0; }
    .bar span { display: block; height: 100%; width: var(--w); border-radius: inherit; }
    .bar.good span { background: var(--good); } .bar.warn span { background: var(--warn); } .bar.bad span { background: var(--bad); }
    .panel { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
    .panel-head { display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid var(--border); gap: 1rem; flex-wrap: wrap; }
    input[type="search"] { background: var(--bg); border: 1px solid var(--border); color: var(--text); border-radius: 999px; padding: 0.45rem 0.85rem; font: inherit; min-width: 220px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
    th, td { text-align: left; padding: 0.55rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: top; }
    th { color: var(--muted); font-weight: 500; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; }
    tr.doc-row.bad { background: rgba(248,113,113,0.06); }
    tr.doc-row.hidden { display: none; }
    td.mono { font-family: var(--mono); font-size: 0.78rem; color: #c5cad6; }
    td.patterns { color: var(--muted); font-size: 0.75rem; max-width: 280px; }
    .chip { font-family: var(--mono); font-size: 0.68rem; padding: 0.15rem 0.45rem; border-radius: 999px; }
    .chip.good { background: rgba(52,211,153,0.15); color: var(--good); }
    .chip.bad { background: rgba(248,113,113,0.15); color: var(--bad); }
    footer.page { margin-top: 1.5rem; text-align: center; color: var(--muted); font-size: 0.75rem; font-family: var(--mono); }
    a { color: #a5b4fc; }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <p class="eyebrow">Data Explorer docs · v${escapeHtml(version)}</p>
      <h1>Documentation <em>coverage</em></h1>
      <p class="subtitle">Tracks whether user-facing features in <a href="../../apps/docs/guide/">apps/docs/guide</a> are described. Generated ${escapeHtml(generatedAt)}.</p>
      <div class="stat-row">
        <div class="stat ${coverageClass(coveragePct)}"><span class="value">${coveragePct.toFixed(1)}%</span> features documented</div>
        <div class="stat"><span class="value">${documented.length}</span> documented</div>
        <div class="stat ${missing.length > 0 ? 'bad' : 'good'}"><span class="value">${missing.length}</span> missing</div>
        <div class="stat ${coverageClass(screenshotPct)}"><span class="value">${screenshotPct.toFixed(0)}%</span> screenshot pairs</div>
        <div class="stat ${missingScreenshots.length > 0 ? 'bad' : 'good'}"><span class="value">${missingScreenshots.length}</span> screenshot gaps</div>
      </div>
    </section>
    <section class="packages">${categoryCards}</section>
    <section class="panel">
      <div class="panel-head">
        <h2>Feature checklist</h2>
        <input type="search" id="filter" placeholder="Filter features…" autocomplete="off" />
      </div>
      <table>
        <thead><tr><th>Status</th><th>Category</th><th>ID</th><th>Feature</th><th>Match patterns</th></tr></thead>
        <tbody id="rows">${rows}</tbody>
      </table>
    </section>
    <section class="panel" style="margin-top: 1.25rem">
      <div class="panel-head">
        <h2>Screenshot pairs (dark + light)</h2>
      </div>
      <table>
        <thead><tr><th>Status</th><th>Screenshot</th><th>Dark</th><th>Light</th></tr></thead>
        <tbody>${screenshotRows}</tbody>
      </table>
    </section>
    <footer class="page">Generated by scripts/generate-coverage-html.ts --docs</footer>
  </div>
  <script>
    const filter = document.getElementById('filter');
    const rows = [...document.querySelectorAll('.doc-row')];
    filter?.addEventListener('input', () => {
      const q = filter.value.trim().toLowerCase();
      for (const row of rows) {
        const text = (row.dataset.category + ' ' + row.dataset.label).toLowerCase();
        row.classList.toggle('hidden', q.length > 0 && !text.includes(q));
      }
    });
  </script>
</body>
</html>`
}

main()
