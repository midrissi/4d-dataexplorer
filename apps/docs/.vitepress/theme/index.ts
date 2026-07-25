import DefaultTheme from 'vitepress/theme'
import type { App } from 'vue'
import AppLayoutDiagram from './components/AppLayoutDiagram.vue'
import DocScreenshot from './components/DocScreenshot.vue'
import DocTable from './components/DocTable.vue'
import DownloadDesktop from './components/DownloadDesktop.vue'
import DownloadStats from './components/DownloadStats.vue'
import HomeLanding from './components/HomeLanding.vue'
import RunDocker from './components/RunDocker.vue'
import ScreenshotFrame from './components/ScreenshotFrame.vue'
import Layout from './Layout.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }: { app: App }) {
    app.component('AppLayoutDiagram', AppLayoutDiagram)
    app.component('DocScreenshot', DocScreenshot)
    app.component('DocTable', DocTable)
    app.component('DownloadDesktop', DownloadDesktop)
    app.component('DownloadStats', DownloadStats)
    app.component('HomeLanding', HomeLanding)
    app.component('RunDocker', RunDocker)
    app.component('ScreenshotFrame', ScreenshotFrame)
  },
}
