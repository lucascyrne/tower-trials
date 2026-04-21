# Baseline consolidada do banco

Este diretório é o **espaço de authoring** para o schema “alvo” (documentação +, opcionalmente, um único script SQL completo). O que o Supabase CLI aplica por defeito em `supabase db reset` é **`supabase/migrations/`**.

## Relação `baseline/` ↔ `migrations/`

| Artefacto | Função |
|-----------|--------|
| `migrations/20260421000000_squashed_schema.sql` + `20260421000001_secure_grant_xp_hardening.sql` | Estado inicial executável (greenfield / reset local): squash + endurecimento de `secure_grant_xp`. |
| `baseline/00000000000000_initial_baseline.sql` | Rascunho/checklist para consolidar DDL final por secção; quando preenchido, deve espelhar o squash (ou substituí-lo numa futura janela de rebaseline). |
| `baseline/post_bootstrap_smoke.sql`, `post_seed_integrity_checks.sql` | Validação pós-seed, independentemente de ter aplicado squash ou baseline manual. |

## Quando usar cada um

1. **Dia a dia / CI / `db reset`:** só `supabase/migrations/*.sql` (squash + incrementais novas).
2. **Documentar ou preparar uma futura linha de base única:** editar `baseline/00000000000000_initial_baseline.sql` e `preserved-data-mapping.md`, validar com `post-baseline-checklist.md`.
3. **Reset operacional com seeds:** seguir `docs/database/reset-and-seed-runbook.md` e correr os SQL de verificação em `baseline/`.

## Regras

- Toda correção de schema após o squash entra em **ficheiro novo** em `migrations/` (timestamp crescente).
- Evitar duplicar verdade: ou mantém o squash como fonte aplicada e o baseline como espelho documentado, ou numa janela futura substitui-se o squash por baseline gerada a partir de `db dump` de um banco dourado.
