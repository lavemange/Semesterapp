import { proxyRequest } from 'h3'

/**
 * Catch-all server route: proxies all /api/* requests to the Express backend.
 * BACKEND_URL is read from process.env at request time (not baked in at build).
 */
export default defineEventHandler((event) => {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001'
  return proxyRequest(event, `${backendUrl}${event.path}`)
})
