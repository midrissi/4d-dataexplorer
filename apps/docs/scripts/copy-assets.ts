import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { syncScreenshotsToDocsPublic } from '../../../scripts/doc-screenshots'

const __dirname = dirname(fileURLToPath(import.meta.url))
const docsRoot = join(__dirname, '..')
const contentDir = join(docsRoot, '../dataexplorer/src/content')
const releaseNotesDir = join(docsRoot, 'release-notes')
const screenshotsSrc = join(docsRoot, '../dataexplorer/docs/screenshots')
const screenshotsDest = join(docsRoot, 'public/screenshots')

mkdirSync(screenshotsDest, { recursive: true })
mkdirSync(releaseNotesDir, { recursive: true })

const RELEASE_NOTES = [
  { file: 'release-notes.md', out: 'en.md', title: 'Release notes' },
  { file: 'release-notes.fr.md', out: 'fr.md', title: 'Notes de version' },
  { file: 'release-notes.es.md', out: 'es.md', title: 'Notas de la versión' },
]

for (const { file, out, title } of RELEASE_NOTES) {
  const src = join(contentDir, file)
  if (!existsSync(src)) {
    console.warn(`Release notes source not found: ${src}`)
    continue
  }
  const body = readFileSync(src, 'utf8')
  writeFileSync(join(releaseNotesDir, out), `---\ntitle: ${title}\n---\n\n${body}`)
}

if (!existsSync(screenshotsSrc)) {
  console.warn(`Screenshots source not found: ${screenshotsSrc}`)
} else {
  syncScreenshotsToDocsPublic()
}
