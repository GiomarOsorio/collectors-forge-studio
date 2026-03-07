import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Plugin que añade data-cfasync="false" a todos los <script> del index.html.
 *
 * Cloudflare Rocket Loader reescribe los <script type="module"> como scripts
 * inline para diferirlos, rompiendo la carga de módulos ES y causando React
 * error #130 al renderizar componentes lazy. El atributo data-cfasync="false"
 * le indica a Cloudflare que NO procese esos tags.
 */
function cfAsyncFalse() {
  return {
    name: 'cf-async-false',
    transformIndexHtml(html) {
      return html.replace(/<script /g, '<script data-cfasync="false" ')
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cfAsyncFalse()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  build: {
    // Deshabilitar el polyfill de modulepreload: genera un inline script que
    // viola script-src 'self' del CSP de nginx. Los navegadores modernos
    // soportan modulepreload de forma nativa.
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-three': ['three', '@react-three/fiber', '@react-three/drei'],
          'vendor-ui':    ['lucide-react'],
          'vendor-misc':  ['axios', 'react-hot-toast'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/__tests__/setup.js',
    css: false,
  },
})
