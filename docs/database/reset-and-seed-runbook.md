# Reset and Seed Runbook

## Pré-condições

- Baseline consolidada validada em homologação.
- Checklist de segurança aprovado.
- Janela de manutenção definida.

## Reset

- Local:
  - `./scripts/reset-db.sh local --confirm`
- Linked/remoto:
  - `./scripts/reset-db.sh linked --confirm`

## Aplicação de seeds no SQL Editor

Aplicar nesta ordem:

1. `supabase/seed.sql`
2. `supabase/seed_craftable_equipment.sql`
3. `supabase/clean_spells.sql`
4. `supabase/spells.sql`

## Verificação pós-seed

- Executar:
  - `supabase/baseline/post_seed_integrity_checks.sql`
- Resultado esperado:
  - sem duplicidades,
  - sem órfãos de receitas/drops,
  - sem ranges inválidos.

## Critério de continuidade

- Se qualquer check falhar, corrigir SQL (baseline/seed) e repetir em homologação.
- Somente avançar para go-live com todos os checks verdes.
