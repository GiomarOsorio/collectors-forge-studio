import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
  resolve: {
    // Alias EXPLÍCITO a los entry points de @dnd-kit/* dentro de
    // node_modules. Sin esto, vite/rollup en alpine (node:20) falla
    // intermitentemente con "Rollup failed to resolve" pese a que
    // npm ls + node require.resolve lo encuentran (bug ya verificado
    // en logs de deploy). El alias bypassa toda la magia de resolución
    // de package.json `module`/`exports` fields.
    alias: [
      { find: '@dnd-kit/core', replacement: path.resolve(__dirname, 'node_modules/@dnd-kit/core/dist/index.js') },
      { find: '@dnd-kit/sortable', replacement: path.resolve(__dirname, 'node_modules/@dnd-kit/sortable/dist/index.js') },
      { find: '@dnd-kit/utilities', replacement: path.resolve(__dirname, 'node_modules/@dnd-kit/utilities/dist/index.js') },
      { find: '@dnd-kit/accessibility', replacement: path.resolve(__dirname, 'node_modules/@dnd-kit/accessibility/dist/index.js') },
      // void-elements CJS sin exports field; html-parse-stringify (dep de
      // react-i18next) lo importa desde su ESM bundle — Rollup 7 no lo
      // resuelve sin alias explícito (mismo patrón que @dnd-kit).
      { find: 'void-elements', replacement: path.resolve(__dirname, 'node_modules/void-elements/index.js') },
      // `gcode-preview` importa "three" desde su bundle ESM propio; en
      // alpine (node:20) Rollup falla con "failed to resolve import three"
      // pese a que npm ls + node require.resolve lo encuentran (mismo bug
      // de @dnd-kit/void-elements de arriba). El alias también dedupea:
      // gcode-preview declara three@^0.159.0 como dependencia propia, pero
      // el resto de la app usa three@^0.175.0 (ver vendor-three en
      // manualChunks) — forzar el mismo three.module.js para todos evita
      // cargar dos copias de three.js (rompería contextos WebGL/instancias).
      // find debe ser EXACTO (regex ^three$): "three" como prefix-string
      // también matchearía "three/addons/*" (usado por ModelViewer3D) y
      // rompería esos imports.
      { find: /^three$/, replacement: path.resolve(__dirname, 'node_modules/three/build/three.module.js') },
      // `gcode-preview` también importa "lil-gui" (dependencia transitiva
      // suya, no directa de esta app) desde su bundle ESM — mismo bug de
      // resolución en Alpine que "three" arriba. lil-gui expone `module`
      // (ESM) y `main` (UMD) separados; forzar el ESM.
      { find: /^lil-gui$/, replacement: path.resolve(__dirname, 'node_modules/lil-gui/dist/lil-gui.esm.js') },
    ],
  },
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
          // `@dnd-kit/*` debe estar explícito en manualChunks. Sin esto
          // el build en alpine (node 20) intermitentemente falla con
          // "Rollup failed to resolve import @dnd-kit/core" pese a que
          // npm ls + node require.resolve lo encuentran. Forzar el chunk
          // hace que Rollup lo trate como vendor y resuelva 1ra pasada.
          'vendor-dnd':   ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          'vendor-ui':    ['lucide-react'],
          'vendor-misc':  ['axios', 'react-hot-toast'],
        },
      },
    },
  },
  // Pre-bundle @dnd-kit en dev también — defensivo, mantiene paridad.
  optimizeDeps: {
    include: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities', 'void-elements'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/__tests__/setup.js',
    css: false,
    // Vitest sólo corre unit tests en src/. Los tests Playwright en tests-e2e/
    // los corre `npm run e2e` (script aparte) con su propio runner.
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    exclude: ['tests-e2e/**', 'node_modules/**', 'dist/**'],
  },
})
