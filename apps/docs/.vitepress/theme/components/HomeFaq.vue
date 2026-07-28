<script setup lang="ts">
import { withBase } from 'vitepress'

const REPO = 'midrissi/4d-dataexplorer'
const LATEST_WEB_ZIP = `https://github.com/${REPO}/releases/latest/download/DataExplorer.zip`
const LATEST_SCRIPT = `https://github.com/${REPO}/releases/latest/download/fix-macos-quarantine.sh`
const RELEASES = `https://github.com/${REPO}/releases`
const ISSUES = `https://github.com/${REPO}/issues`

interface FaqItem {
  id: string
  num: string
  topic: string
  question: string
  answerKey: string
}

const faqs: FaqItem[] = [
  {
    id: 'macos-quarantine',
    num: '01',
    topic: 'macOS',
    question: 'Why does macOS block the desktop app, and how do I fix it?',
    answerKey: 'macos',
  },
  {
    id: 'docker-or-zip',
    num: '02',
    topic: 'Install',
    question: 'I prefer Docker or the web ZIP — how do I install those?',
    answerKey: 'dockerZip',
  },
  {
    id: 'signature-failed',
    num: '03',
    topic: 'Updates',
    question: 'Desktop update failed with a signature error — what can I do?',
    answerKey: 'signature',
  },
  {
    id: 'which-download',
    num: '04',
    topic: 'Desktop',
    question: 'Which desktop download should I pick?',
    answerKey: 'whichDownload',
  },
  {
    id: 'channels',
    num: '05',
    topic: 'Channels',
    question: 'What’s the difference between desktop, Docker, and DataExplorer.zip?',
    answerKey: 'channels',
  },
  {
    id: 'open-4d',
    num: '06',
    topic: '4D',
    question: 'How do I open Data Explorer from 4D or with an access key?',
    answerKey: 'open4d',
  },
  {
    id: 'safe',
    num: '07',
    topic: 'Trust',
    question: 'Is the macOS build safe if it isn’t notarized?',
    answerKey: 'safe',
  },
  {
    id: 'help',
    num: '08',
    topic: 'Support',
    question: 'Where can I get help or report a bug?',
    answerKey: 'help',
  },
]
</script>

<template>
  <section class="home-faq" aria-labelledby="home-faq-heading">
    <div class="home-faq__header">
      <p class="home-faq__eyebrow">Install &amp; troubleshooting</p>
      <h2 id="home-faq-heading" class="home-landing__section-label">FAQ</h2>
      <p class="home-faq__intro">
        Gatekeeper on macOS, Docker and the web ZIP, desktop downloads, updater signatures, and
        where to get help.
      </p>
    </div>

    <div class="home-faq__list">
      <details v-for="item in faqs" :id="item.id" :key="item.id" class="home-faq__item">
        <summary class="home-faq__summary">
          <span class="home-faq__num" aria-hidden="true">{{ item.num }}</span>
          <span class="home-faq__summary-main">
            <span class="home-faq__topic">{{ item.topic }}</span>
            <span class="home-faq__question">{{ item.question }}</span>
          </span>
          <span class="home-faq__chevron" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </summary>

        <div class="home-faq__body">
          <template v-if="item.answerKey === 'macos'">
            <p>
              Release builds are <strong>ad-hoc signed</strong> but not Apple-notarized. After you
              download the ZIP, Gatekeeper may say the app can’t be opened or is damaged.
            </p>
            <p>In Terminal, clear quarantine yourself or run this release’s fix script:</p>
            <pre class="home-faq__code"><code>xattr -cr "/Applications/Data Explorer.app"

# or (per-release script):
curl -fsSL {{ LATEST_SCRIPT }} | bash</code></pre>
            <p class="home-faq__actions">
              <a class="home-faq__link" :href="withBase('/guide/macos-desktop')">macOS first-launch guide</a>
              <span class="home-faq__sep" aria-hidden="true">·</span>
              <span>ZIP also includes <code>README.html</code> and <code>fix-macos-quarantine.sh</code></span>
            </p>
          </template>

          <template v-else-if="item.answerKey === 'dockerZip'">
            <ul class="home-faq__bullets">
              <li>
                <strong>Web ZIP (4D)</strong> —
                <a :href="LATEST_WEB_ZIP" rel="noopener"><code>DataExplorer.zip</code></a>
                → extract into <code>Resources/WEBJS/</code> so files land in
                <code>DataBrowser/</code> →
                <strong>Records → Data Explorer In Browser</strong>.
              </li>
              <li>
                <strong>Docker</strong> — pull
                <code>ghcr.io/midrissi/4d-dataexplorer:latest</code>, set
                <code>BACKEND_URL</code> to your 4D REST host, open
                <code>http://localhost:8080/dataexplorer/</code> (default).
              </li>
            </ul>
            <p class="home-faq__actions">
              <a class="home-faq__link" :href="withBase('/guide/getting-started')">Getting started</a>
              <span class="home-faq__sep" aria-hidden="true">·</span>
              <span>Use <strong>Run with Docker</strong> above for a copy-paste command</span>
            </p>
          </template>

          <template v-else-if="item.answerKey === 'signature'">
            <p class="home-faq__callout" role="note">
              <strong>Reinstall — don’t keep retrying the in-app update.</strong>
              Signature failures mean the release signing key no longer matches the public key in
              your installed build (key rotation or mismatched channel).
            </p>
            <ol class="home-faq__steps">
              <li>
                Download a fresh installer from
                <a :href="RELEASES" target="_blank" rel="noopener">GitHub Releases</a>
                for your platform.
              </li>
              <li>Quit the old app and replace it (macOS: clear quarantine again if needed).</li>
              <li>Launch the new build — auto-update should work from that install onward.</li>
            </ol>
          </template>

          <template v-else-if="item.answerKey === 'whichDownload'">
            <p>
              Use <strong>Download</strong> above — it prefers your current platform. On macOS pick
              <strong>Apple Silicon</strong> (<code>aarch64</code>) or <strong>Intel</strong>
              (<code>x86_64</code>) ZIP; Windows MSI/EXE; Linux AppImage / deb / rpm. Prefer the ZIP
              app bundle on macOS over DMG for these ad-hoc builds.
            </p>
            <p class="home-faq__actions">
              <a class="home-faq__link" :href="RELEASES" target="_blank" rel="noopener">All releases &amp; checksums</a>
            </p>
          </template>

          <template v-else-if="item.answerKey === 'channels'">
            <ul class="home-faq__bullets">
              <li>
                <strong>Desktop</strong> — native Tauri shell with optional auto-update. Standalone
                app.
              </li>
              <li>
                <strong>DataExplorer.zip</strong> — web assets served by 4D at
                <code>/dataexplorer/</code>. Best when users already work in the browser from 4D.
              </li>
              <li>
                <strong>Docker</strong> — same web UI in a container proxying REST to your 4D host.
                Demos, CI, or hosts without unpacking into <code>WEBJS</code>.
              </li>
            </ul>
          </template>

          <template v-else-if="item.answerKey === 'open4d'">
            <p>
              After the web ZIP: in 4D choose
              <strong>Records → Data Explorer In Browser</strong> so your session is passed through.
            </p>
            <p>
              Opening the URL directly with REST auth required? Enter your
              <strong>access key</strong> on the login screen.
            </p>
            <p class="home-faq__actions">
              <a class="home-faq__link" :href="withBase('/guide/getting-started')">Getting started</a>
            </p>
          </template>

          <template v-else-if="item.answerKey === 'safe'">
            <p>
              Builds are ad-hoc code-signed in CI; checksums ship with each release. Without Apple
              notarization, Gatekeeper is cautious about internet downloads — that warning is
              expected, not proof of malware. Only clear quarantine for builds from this project’s
              <a :href="RELEASES" target="_blank" rel="noopener">official Releases</a>.
            </p>
          </template>

          <template v-else-if="item.answerKey === 'help'">
            <p>
              Support is on GitHub (no Discord). Open an issue, browse the guide, or read release
              notes for what changed.
            </p>
            <p class="home-faq__actions">
              <a class="home-faq__link" :href="ISSUES" target="_blank" rel="noopener">GitHub Issues</a>
              <span class="home-faq__sep" aria-hidden="true">·</span>
              <a class="home-faq__link" :href="withBase('/guide/')">Guide</a>
              <span class="home-faq__sep" aria-hidden="true">·</span>
              <a class="home-faq__link" :href="withBase('/release-notes/')">Release notes</a>
            </p>
          </template>
        </div>
      </details>
    </div>
  </section>
</template>
