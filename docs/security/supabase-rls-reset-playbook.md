# Supabase Security + Reset Playbook

## 1) Inventario atual de RLS e superficies criticas

Tabelas com RLS identificado nas migracoes atuais:

- `public.users`
- `public.characters`
- `public.dead_characters`
- `public.game_progress`
- `public.special_events`
- `public.game_rankings`
- `public.equipment`
- `public.character_equipment`
- `public.equipment_crafting_recipes`
- `public.equipment_crafting_ingredients`
- `public.monsters`
- `public.monster_drops`
- `public.monster_possible_drops`
- `public.character_drops`
- `public.crafting_recipes`
- `public.crafting_ingredients`

## 2) Matriz de acesso alvo (menor privilegio)

- **Cliente (chave publicável / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)**: mesmo modelo de JWT que o stack Supabase usa para sessão; políticas RLS tratam **usuário autenticado** vs **dados públicos** conforme o produto — não documentar fluxo em torno de “anon key” legada.
- **`authenticated`**: leitura/escrita apenas de dados do proprio usuario via `auth.uid()`.
- **Operações privilegiadas**: via `SUPABASE_SERVICE_ROLE_KEY` **somente no servidor** (ignora RLS); RPCs como `secure_grant_xp` são chamadas com esse client ou com sessão validada dentro da função — não criar políticas RLS “para service_role”.

Diretrizes obrigatorias:

- `REVOKE` explicito de `PUBLIC` em funcoes sensiveis.
- `SECURITY DEFINER` apenas em funcoes indispensaveis e com `search_path` fixo.
- toda escrita de progressao (`xp`, `level`, `gold`, `floor`, `inventory`) via RPC segura.

## 3) Hardening prioritario de funcoes

Aplicar em funcoes de progressao/combate:

- validar ranges por chamada (anti-spike).
- validar ownership (`auth.uid()` vs `user_id`) para chamadas com JWT de usuario; rotas admin server-side validam papel/chave fora do RLS.
- validar `source` com allowlist.
- registrar auditoria em tabela de log de atividade.
- evitar logica privilegiada em schema exposto sem controle de grants.

> O hardening de `secure_grant_xp` está em `supabase/migrations/20260421000001_secure_grant_xp_hardening.sql` (aplicado após o squash).

## 4) Checklist de validacao funcional + seguranca

### Funcional

- login/logout com refresh de sessao no SSR/middleware.
- fluxo de batalha completo.
- ganho de XP e level-up com multi-level correto.
- distribuicao de pontos de atributo apos level-up.

### Seguranca

- tentativa de ler/escrever personagem de outro usuario bloqueada.
- tentativa de executar update direto em tabelas sensiveis bloqueada por RLS.
- validação de inexistência de segredos (chave privilegiada do projeto) em `NEXT_PUBLIC_*`.
- confirmacao de grants/revokes nas funcoes sensiveis.

## 5) Rollout em fases com fallback

- Fase 1: SSR helpers + middleware + hardening de segredo.
- Fase 2: hardening de RPC e revisao completa de policies.
- Fase 3: reset/rebaseline em janela de manutencao controlada.
- Fallback: restore de snapshot completo e rollback para release anterior.

## 6) Estrategia de reset completo (com backup/rollback)

Antes do reset:

- congelar alteracoes de schema.
- exportar backup logico completo (schema + dados).
- classificar dados:
  - preservaveis: usuarios, personagens, inventario/equipamentos, progresso principal.
  - regeneraveis: logs transitorios, caches e dados de teste.
- registrar hash/versionamento dos dumps para auditoria.

Execucao:

- provisionar banco limpo paralelo.
- aplicar baseline consolidada.
- importar somente dados preservaveis.
- validar checklist funcional + seguranca.

Rollback:

- restaurar snapshot previo.
- reativar app com configuracao anterior.
- registrar causa raiz e ajustes antes da proxima janela.

## 7) Consolidacao de migracoes (baseline enxuta)

Estrutura alvo:

- `supabase/baseline/00000000000000_initial_baseline.sql`: schema final consolidado.
- `supabase/migrations/*`: migracao inicial enxuta (ex.: squash) + apenas incrementais novas apos baseline.

Criterios da baseline:

- schema final sem duplicidade de funcoes.
- indices, constraints e triggers finais.
- RLS habilitado e policies minimas por dominio.
- grants/revokes fechados para `PUBLIC`.

## 8) Bootstrap de banco limpo

Sequencia operacional:

1. Aplicar baseline consolidada.
2. Aplicar incrementais obrigatorias (se houver).
3. Aplicar seeds de catalogo do jogo.
4. Importar dados preservaveis.
5. Rodar smoke tests funcionais e testes de seguranca.
6. Liberar go-live somente sem bloqueadores.
