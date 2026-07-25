import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import type { Context } from 'elysia'

// MIME type mapping
const mimeTypes: Record<string, string> = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json',
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  return mimeTypes[ext] || 'application/octet-stream'
}

function sanitizePath(requestPath: string, basePath: string): string | null {
  // Remove query string and hash
  const cleanPath = requestPath.split('?')[0].split('#')[0]

  // Resolve the full path
  const fullPath = path.resolve(basePath, cleanPath)

  // Ensure the resolved path is within the base directory (prevent directory traversal)
  if (!fullPath.startsWith(path.resolve(basePath))) {
    return null
  }

  return fullPath
}

export function serveStatic(basePath: string, prefix: string = '/') {
  return async (context: Context): Promise<Response | undefined> => {
    // Get path from request URL - Elysia's context.path might not include the full path
    const url = new URL(context.request.url)
    const requestPath = url.pathname

    // Normalize prefix (ensure it ends with /)
    const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`
    const prefixWithoutSlash = normalizedPrefix.slice(0, -1)

    // Debug logging (remove in production)
    // console.log('Static server:', { requestPath, normalizedPrefix, prefixWithoutSlash, basePath })

    // Only handle requests that start with the prefix
    if (!requestPath.startsWith(normalizedPrefix) && requestPath !== prefixWithoutSlash) {
      return undefined
    }

    // Remove prefix from path
    let relativePath: string
    if (requestPath === prefixWithoutSlash || requestPath === normalizedPrefix) {
      // Request is exactly the prefix (e.g., /dataexplorer or /dataexplorer/)
      relativePath = 'index.html'
    } else {
      // Request starts with prefix (e.g., /dataexplorer/index.html)
      relativePath = requestPath.slice(normalizedPrefix.length) || 'index.html'
    }

    // Debug logging
    // console.log('Resolved relative path:', relativePath)

    // Sanitize and resolve the file path
    const filePath = sanitizePath(relativePath, basePath)
    if (!filePath) {
      return undefined
    }

    // Check if file exists
    if (!existsSync(filePath)) {
      // If it's a directory, try index.html
      if (existsSync(path.join(filePath, 'index.html'))) {
        const indexPath = path.join(filePath, 'index.html')
        const stats = statSync(indexPath)
        const content = readFileSync(indexPath)
        const mimeType = getMimeType(indexPath)

        return new Response(content, {
          headers: {
            'Content-Type': mimeType,
            'Content-Length': stats.size.toString(),
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          },
        })
      }
      return undefined
    }

    const stats = statSync(filePath)

    // If it's a directory, try index.html
    if (stats.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html')
      if (existsSync(indexPath)) {
        const indexStats = statSync(indexPath)
        const content = readFileSync(indexPath)
        const mimeType = getMimeType(indexPath)

        return new Response(content, {
          headers: {
            'Content-Type': mimeType,
            'Content-Length': indexStats.size.toString(),
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          },
        })
      }
      return undefined
    }

    // Serve the file
    const content = readFileSync(filePath)
    const mimeType = getMimeType(filePath)

    return new Response(content, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': stats.size.toString(),
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      },
    })
  }
}
