# Migration Clusters Keep/Drop Map

**Estado atual:** o histórico incremental (202404–202412) foi consolidado em `supabase/migrations/20260421000000_squashed_schema.sql`, seguido de `20260421000001_secure_grant_xp_hardening.sql` (substitui alterações locais não commitadas de `secure_grant_xp`). Novas alterações de schema entram como **novos ficheiros incrementais** depois destes timestamps.

Mapa de consolidação por cluster de timestamp/tema (referência do que foi absorvido no squash; não reaplicar ficheiros antigos).

## Cluster A — Fundação (manter como base lógica)

- Intervalo: `20240406*` até `20240601*`
- Tema: schema inicial (`users`, `characters`, `monsters`, `floors`, `consumables`, `equipment`, `spells`, `ranking`, `game_progress`)
- Estratégia: **KEEP como referência de origem**, mas no rebaseline vira DDL final consolidada (não replay literal dos arquivos).

## Cluster B — Ranking (alto retrabalho, alta redução)

- Intervalo: `20241201000001` até `20241202000014`
- Sinais de redundância: sequência de `fix_*`, `definitive_*`, otimizações e correções de tipo/segurança.
- Estratégia: **DROP transições intermediárias**, **KEEP somente estado final** das funções/policies/índices de ranking.
- Observação crítica: validar `refresh_all_rankings` (chamada no código) no estado final.

## Cluster C — Checkpoint/Floor fixes

- Intervalo: `20241202000017`, `20241202000019`, `20241202000020`
- Tema: checkpoint + race condition de avanço.
- Estratégia: consolidar em um bloco final de funções/check constraints.

## Cluster D — Derived stats + critical chain

- Intervalo: `20241204000002` até `20241204000010`
- Sinais: `fix`, `force_fix`, `final_fix` para mesma superfície de cálculo.
- Estratégia: manter apenas versão final de `calculate_derived_stats` e funções relacionadas.

## Cluster E — secure functions e anti-cheat

- Intervalo histórico (absorvido): `20241202000016`, `20241202000018`, `20241205000003`; endurecimento final em `20260421000001_secure_grant_xp_hardening.sql`.
- Tema: segurança de progresso (`secure_grant_xp/gold/floor`) e validações.
- Estratégia: baseline nasce já com hardening final (ownership, limits, source validation, grants/revokes).

## Cluster F — Monster cycles/rebalance

- Intervalo: `20241203000010` até `20241205000005` + `20241220000002`
- Tema: balanceamento/ciclos/integração de sistema.
- Estratégia: consolidar por último, após checkpoints de gameplay.

## Cluster G — Cleanup

- Arquivo: `20241205000007_cleanup_redundant_functions.sql`
- Estratégia: absorver no baseline; objetos legados já não serão criados.

## Ordem de execução recomendada

1. Ranking  
2. Derived stats + critical  
3. secure functions / anti-cheat  
4. checkpoint/floor  
5. monster cycles/rebalance  
6. cleanup implícito na baseline

## Regras de consolidação

- Não editar o squash já aplicado em ambientes que dependem dele; corrigir só em **nova** migration incremental.
- Rebaseline / authoring: pasta `supabase/baseline/` (ver `README.md` lá) alinha documentação e DDL “alvo”; `migrations/` é o que o CLI aplica em `db reset`.
- Toda decisão keep/drop deve manter contrato congelado em `docs/database/runtime-contract-matrix.md`.
