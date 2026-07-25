import { expect, test } from '@playwright/test'
import { createLargeStructureCatalog } from '../fixtures/large-structure-catalog'
import { waitForAppReady } from './helpers/app'
import { login } from './helpers/auth'

const STRICT_PERFORMANCE = process.env.GRAPH_PERF_ASSERT === '1'
const catalog = createLargeStructureCatalog()

type GraphMetrics = {
  selectionMs: number
  layoutMs: number
  layoutMaxFrameGapMs: number
  layoutLongTasks: number[]
  viewportMaxFrameGapMs: number
  viewportLongTasks: number[]
}

test.describe('Structure graph performance', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Performance metrics are Chromium-only'
  )

  test('keeps a 500 dataclass / 1500 relation graph interactive', async ({ page }, testInfo) => {
    test.setTimeout(120_000)

    await page.route('**/rest/$catalog**', async (route) => {
      const url = new URL(route.request().url())
      if (url.pathname.endsWith('/$catalog/$all')) {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(catalog) })
        return
      }
      if (url.pathname.endsWith('/$catalog')) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            __UNIQID: catalog.__UNIQID,
            __BASEID: catalog.__BASEID,
            dataClasses: catalog.dataClasses.map(({ name, uri, dataURI }) => ({
              name,
              uri,
              dataURI,
            })),
          }),
        })
        return
      }
      await route.continue()
    })

    await page.addInitScript(() => {
      const longTasks: number[] = []
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) longTasks.push(entry.duration)
      }).observe({ type: 'longtask', buffered: true })
      ;(globalThis as typeof globalThis & { __graphLongTasks: number[] }).__graphLongTasks =
        longTasks
    })

    await login(page)
    await waitForAppReady(page)
    await page.getByRole('button', { name: 'Structure', exact: true }).click()

    const graph = page.locator('.react-flow')
    await expect(graph).toBeVisible({ timeout: 30_000 })
    await expect(graph.getByText('500 dataclasses', { exact: true })).toBeVisible({
      timeout: 30_000,
    })
    await expect(graph.getByText('1500 relations', { exact: true })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.locator('.react-flow__node').first()).toBeVisible()

    const firstNode = page.locator('.react-flow__node').first()
    const selectionStarted = await page.evaluate(() => performance.now())
    await firstNode.click()
    await expect(firstNode).toHaveClass(/selected/)
    const selectionMs = (await page.evaluate(() => performance.now())) - selectionStarted

    const startFrameMeasurement = () =>
      page.evaluate(() => {
        const samples: number[] = []
        let previous = performance.now()
        const tick = (now: number) => {
          samples.push(now - previous)
          previous = now
          if (
            (globalThis as typeof globalThis & { __measureGraphFrames?: boolean })
              .__measureGraphFrames
          ) {
            requestAnimationFrame(tick)
          }
        }
        ;(globalThis as typeof globalThis & { __graphFrameSamples: number[] }).__graphFrameSamples =
          samples
        ;(
          globalThis as typeof globalThis & { __graphLongTasks: number[] }
        ).__graphLongTasks.length = 0
        ;(
          globalThis as typeof globalThis & { __measureGraphFrames: boolean }
        ).__measureGraphFrames = true
        requestAnimationFrame(tick)
      })
    const stopFrameMeasurement = () =>
      page.evaluate(() => {
        ;(
          globalThis as typeof globalThis & { __measureGraphFrames: boolean }
        ).__measureGraphFrames = false
        return {
          frameSamples: (globalThis as typeof globalThis & { __graphFrameSamples: number[] })
            .__graphFrameSamples,
          longTasks: (globalThis as typeof globalThis & { __graphLongTasks: number[] })
            .__graphLongTasks,
        }
      })

    await startFrameMeasurement()

    const organizeButton = page.getByRole('button', { name: /auto organize graph layout/i })
    const graphRoot = page.locator('.structure-graph')
    const previousLayout = await graphRoot.getAttribute('data-layout-completed')
    const layoutStarted = Date.now()
    await organizeButton.click()
    await expect(graphRoot).not.toHaveAttribute('data-layout-completed', previousLayout ?? '0', {
      timeout: 90_000,
    })
    await expect(organizeButton).toBeEnabled({ timeout: 5_000 })
    await page.waitForTimeout(600)
    const layoutMs = Date.now() - layoutStarted
    const layoutMetrics = await stopFrameMeasurement()

    const graphBox = await graph.boundingBox()
    if (!graphBox) throw new Error('Structure graph has no bounds')
    await startFrameMeasurement()
    await page.mouse.move(graphBox.x + graphBox.width / 2, graphBox.y + graphBox.height / 2)
    for (let index = 0; index < 6; index += 1) {
      await page.mouse.wheel(0, index % 2 === 0 ? -100 : 100)
    }
    await page.waitForTimeout(300)

    const viewportMetrics = await stopFrameMeasurement()
    const metrics: GraphMetrics = {
      selectionMs,
      layoutMs,
      layoutMaxFrameGapMs: Math.max(0, ...layoutMetrics.frameSamples),
      layoutLongTasks: layoutMetrics.longTasks,
      viewportMaxFrameGapMs: Math.max(0, ...viewportMetrics.frameSamples),
      viewportLongTasks: viewportMetrics.longTasks,
    }

    await testInfo.attach('structure-graph-metrics.json', {
      contentType: 'application/json',
      body: Buffer.from(JSON.stringify(metrics, null, 2)),
    })
    testInfo.annotations.push({
      type: 'performance',
      description: JSON.stringify(metrics),
    })
    console.info(`[structure-graph-performance] ${JSON.stringify(metrics)}`)

    await expect(page.locator('.structure-graph')).not.toHaveAttribute('data-graph-moving', 'true')
    await expect(page.locator('.structure-graph')).toHaveAttribute('data-graph-detail', 'overview')
    await expect(page.getByRole('button', { name: /show selected only/i })).toBeEnabled()

    if (STRICT_PERFORMANCE) {
      expect(metrics.selectionMs).toBeLessThan(100)
      expect(metrics.layoutMaxFrameGapMs).toBeLessThan(100)
      expect(Math.max(0, ...metrics.layoutLongTasks)).toBeLessThan(100)
      expect(metrics.viewportMaxFrameGapMs).toBeLessThan(100)
      expect(Math.max(0, ...metrics.viewportLongTasks)).toBeLessThan(100)
    }
  })
})
