/**
 * @file Mock de `/api/*` en Playwright para que los tests E2E corran sin
 * backend real.
 *
 * Intercepta cualquier llamada a `/api/...` y retorna fixtures mínimas
 * realistas (mayormente arrays vacíos). Las páginas v2 manejan el caso
 * vacío con empty states, así que el shell visual + estructura quedan
 * intactos.
 *
 * @module tests-e2e/helpers/apiMock
 */

const EMPTY_LIST = JSON.stringify([]);
const EMPTY_STATS = JSON.stringify({ used_bytes: 0, quota_bytes: 1073741824, percent: 0 });
const EMPTY_QUEUE = JSON.stringify([]);
const EMPTY_PAGINATED = JSON.stringify({ items: [], total: 0, page: 1, page_size: 20 });
const COMPANY = JSON.stringify({
  id: '00000000-0000-0000-0000-000000000001',
  name: 'The Collector Forge',
  pdf_palette: [],
});
const ME = JSON.stringify({
  id: 0,
  username: 'giomar-dev',
  email: 'dev@local',
  role: 'admin',
});

/**
 * Mapa endpoint pattern → body JSON. Cualquier endpoint no listado retorna
 * el default vacío.
 */
const ROUTES = [
  { match: /\/api\/auth\/me$/,                        body: ME },
  { match: /\/api\/inventory\/items\/?(\?.*)?$/,      body: EMPTY_LIST },
  { match: /\/api\/inventory\/prints\/?(\?.*)?$/,     body: EMPTY_LIST },
  { match: /\/api\/inventory\/purchases\/?(\?.*)?$/,  body: EMPTY_LIST },
  { match: /\/api\/inventory\/categories\/?(\?.*)?$/, body: EMPTY_LIST },
  { match: /\/api\/printers\/?(\?.*)?$/,              body: EMPTY_LIST },
  { match: /\/api\/queue\/history(\?.*)?$/,           body: EMPTY_QUEUE },
  { match: /\/api\/queue\/?(\?.*)?$/,                 body: EMPTY_QUEUE },
  { match: /\/api\/maintenance\/summary\/?$/,         body: EMPTY_LIST },
  { match: /\/api\/maintenance\/logs\/?(\?.*)?$/,     body: EMPTY_LIST },
  { match: /\/api\/quotes\/?(\?.*)?$/,                body: EMPTY_LIST },
  { match: /\/api\/client-quotes\/?(\?.*)?$/,         body: EMPTY_LIST },
  { match: /\/api\/vault\/stats$/,                    body: EMPTY_STATS },
  { match: /\/api\/vault\/?(\?.*)?$/,                 body: EMPTY_PAGINATED },
  { match: /\/api\/company\/templates\/?(\?.*)?$/,    body: EMPTY_LIST },
  { match: /\/api\/company\/?$/,                      body: COMPANY },
  { match: /\/api\/settings\/?$/,                     body: JSON.stringify({}) },
  { match: /\/api\/tariff\/.*$/,                      body: JSON.stringify({ cop_rate_used: 700 }) },
  { match: /\/api\/exchange-rate\/.*$/,               body: JSON.stringify({ usd_to_cop: 4200 }) },
];

/**
 * Activa el mock de API sobre una `page`. Llamar en `beforeEach` antes de
 * cualquier `page.goto()`.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function mockApi(page) {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    const path = new URL(url).pathname + (new URL(url).search || '');

    // Buscar match por regex
    for (const r of ROUTES) {
      if (r.match.test(path)) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: r.body,
        });
      }
    }

    // Fallback: array vacío para GET, 200 vacío para otros métodos
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: EMPTY_LIST,
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}
