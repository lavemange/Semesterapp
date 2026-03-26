// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: false },

  // CSS
  css: ['~/assets/css/main.css'],

  // All /api/* requests are handled by server/api/[...slug].ts, which
  // proxies to the Express backend at BACKEND_URL (read at runtime).

  compatibilityDate: '2024-04-03',
})
