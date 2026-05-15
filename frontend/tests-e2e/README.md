# Playwright E2E + Visual Regression

## Comandos

```bash
# Correr todos los tests (desktop + mobile)
npm run e2e

# Modo interactivo UI
npm run e2e:ui

# Regenerar baseline de screenshots cuando un cambio visual es intencional
npm run e2e:update-snapshots

# Ver el reporte HTML después de una corrida fallida
npm run e2e:report
```

## Primera vez (generar baseline)

Cuando arranques en una máquina nueva:

```bash
cd frontend
npm install
npx playwright install chromium
npm run e2e:update-snapshots
git add tests-e2e/__screenshots__/
git commit -m "test(visual): baseline screenshots"
```

Los screenshots PNG en `__screenshots__/` SÍ se commitean — son la baseline contra
la que se compara cada PR. Si un cambio visual rompe el baseline, el test falla
con un diff PNG adjunto al reporte HTML.

## Estructura

- `visual.spec.js` — pixel-match de las 8 pantallas v2 en desktop + mobile (16 snapshots).
- `auth.spec.js` — flujo de bypass dev login.
- `inventory-mobile.spec.js` — fidelidad del shell mobile (hero + tabs + bottom nav + FAB, sin search).
- `helpers/auth.js` — `loginAsDev()` para que cada test arranque autenticado.

## Cómo agregar nuevos tests

1. Si es **visual**: agrega entrada al array `PAGES` en `visual.spec.js`.
2. Si es **E2E flow** (login → acción → resultado): crea `<flow>.spec.js` nuevo.
3. Reusa `loginAsDev(page)` del helper.
4. Para tests **solo mobile** o **solo desktop**, usa:
   ```js
   test.skip(({ }, info) => info.project.name !== 'mobile-iphone12', 'Solo mobile');
   ```

## Por qué visual regression > unit tests para validar diseño

Unit tests con RTL/Vitest verifican que elementos existan en el DOM. Eso atrapa
"borré un botón sin querer" pero NO atrapa "moví un padding y rompí el layout".

Visual regression captura el render real del navegador como PNG. Cualquier cambio
visual (espaciado, color, fuente, alineación) se ve en el diff. Es la única forma
realista de detectar regresiones del diseño Claude Design automáticamente.

Cuando Claude Design rediseña algo y se aplica al repo, regenerás baseline una vez
y a partir de ahí cualquier deriva accidental se detecta en CI.
