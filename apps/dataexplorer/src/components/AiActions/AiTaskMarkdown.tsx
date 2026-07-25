import { MarkdownContent } from '@4djs/assistant'
import { useEffect, useRef } from 'react'

const IMAGE_OFF_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="markdown-image-fallback__icon"><path d="m2 2 20 20"/><path d="M10.41 10.41a2 2 0 1 1-2.83-2.83"/><line x1="13.5" x2="6" y1="13.5" y2="21"/><line x1="18" x2="21" y1="12" y2="15"/><path d="M3.59 3.59A1.99 1.99 0 0 0 3 5v14a2 2 0 0 0 2 2h14c.55 0 1.05-.22 1.41-.59"/><path d="M21 15V5a2 2 0 0 0-2-2H9"/></svg>`

function replaceBrokenImage(img: HTMLImageElement) {
  if (img.dataset.mdFallback === '1') return
  img.dataset.mdFallback = '1'

  const label = (img.alt || img.title || 'Image unavailable').trim() || 'Image unavailable'
  const placeholder = document.createElement('span')
  placeholder.className = 'markdown-image-fallback'
  placeholder.setAttribute('role', 'img')
  placeholder.setAttribute('aria-label', label)
  placeholder.title = label
  placeholder.innerHTML = IMAGE_OFF_SVG

  img.replaceWith(placeholder)
}

function isBrokenImage(img: HTMLImageElement): boolean {
  return img.complete && img.naturalWidth === 0
}

type AiTaskMarkdownProps = {
  content: string
  streaming?: boolean
  className?: string
}

/**
 * Markdown for AI task detail — same as MarkdownContent, but always swaps
 * failed/empty images for a muted placeholder (works even if the assistant
 * package's img override is stale in the Vite dep cache).
 */
export function AiTaskMarkdown({ content, streaming = false, className }: AiTaskMarkdownProps) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    // Re-bind when markdown `content` changes (new images may appear).
    void content

    const onError = (event: Event) => {
      const target = event.target
      if (target instanceof HTMLImageElement && host.contains(target)) {
        replaceBrokenImage(target)
      }
    }

    host.addEventListener('error', onError, true)

    const scan = () => {
      for (const img of host.querySelectorAll('img')) {
        if (isBrokenImage(img)) replaceBrokenImage(img)
      }
    }

    scan()
    // Markdown may paint images after React commit (lazy / decode).
    const timers = [50, 200, 500].map((ms) => window.setTimeout(scan, ms))
    const observer = new MutationObserver(scan)
    observer.observe(host, { childList: true, subtree: true })

    return () => {
      host.removeEventListener('error', onError, true)
      observer.disconnect()
      for (const timer of timers) window.clearTimeout(timer)
    }
  }, [content])

  return (
    <div ref={hostRef} className="min-w-0 max-w-full">
      <MarkdownContent content={content} streaming={streaming} className={className} />
    </div>
  )
}
