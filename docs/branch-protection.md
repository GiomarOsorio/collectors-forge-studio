# Branch protection (workaround para GitHub Free)

GitHub Free **no permite branch protection** en repositorios privados. Las
opciones serverside (Rulesets, Required status checks) requieren GitHub Pro
($4/mes/usuario) o que el repo sea público.

Mientras estemos en Free + privado, la protección se aplica por convención
y herramientas locales:

## Capas de defensa actuales

### 1. Pre-commit hook (local, automático)
`frontend/.husky/pre-commit` corre en cada `git commit`:
- ESLint sobre `.js`/`.jsx` staged
- `python -c "ast.parse"` sobre `.py` staged
- Verificación rápida de migrations Alembic

Auto-instalado en cada clon vía el script `prepare` de
`frontend/package.json` (`npm install` configura `core.hooksPath`).

Bypass de emergencia: `git commit --no-verify`.

### 2. CI workflow (server-side, no bloqueante)
`.github/workflows/deploy.yml` corre 4 jobs en cada PR + push:
- `lint`: ESLint + Python syntax
- `test-backend`: pytest + Postgres real, coverage ≥80%
- `test-frontend`: Vitest + coverage
- `e2e-frontend`: Playwright + visual regression (solo en PR)
- `deploy`: depende de los 3 primeros, sólo corre en push a main

Sin branch protection, alguien puede igual mergear con CI rojo. Acordamos
no hacerlo (memory `feedback-branch-pr-workflow`).

### 3. Workflow obligatorio (memoria del agente)
Nunca push directo a main. Siempre:
```
git checkout -b feat/algo  →  cambios  →  push  →  gh pr create  →  CI verde  →  merge
```

## Si actualizan a GitHub Pro

Aplicar este ruleset con `gh api`:

```bash
gh api -X POST /repos/GiomarOsorio/collectors-forge-studio/rulesets \
  --input - <<'EOF'
{
  "name": "main branch protection",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/main"], "exclude": [] } },
  "rules": [
    {"type": "deletion"},
    {"type": "non_fast_forward"},
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": true,
        "required_review_thread_resolution": true
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          {"context": "Lint"},
          {"context": "Tests Backend"},
          {"context": "Tests Frontend"}
        ]
      }
    }
  ]
}
EOF
```

Esto:
- Prohibe push directo a `main` (sólo via PR)
- Requiere PR aprobado (0 reviewers porque proyecto solo-Giomar)
- Bloquea merge si `Lint`/`Tests Backend`/`Tests Frontend` fallan
- Bloquea force push y delete

## Mientras tanto, disciplina

El agente Claude y Giomar acuerdan tratar este workflow como obligatorio.
Si alguien aplica un push directo a main por error, revertir con
`git revert <sha>` (no `git reset --hard` en main remoto).
