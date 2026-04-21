# Domain Boundaries (Next.js App Router)

## Dominios

- `auth`: sessao, identidade, autorizacao.
- `user`: perfil e dados de conta.
- `game`: regras de combate/progressao e loop principal.
- `ui`: apresentacao e experiencia (components/app).
- `infra`: acesso a Supabase e integracoes externas.

## Fronteiras de dependencia

- `ui` -> `application` (casos de uso/facades)
- `application` -> `domain` + `ports`
- `infrastructure` -> implementa `ports`
- `domain` -> nao depende de infra

## Ports criticos materializados

- `AdminGamePort`
  - `secureGrantXp`
  - `secureGrantGold`
  - `secureAdvanceFloor`
  - `processCombatDrops`
  - `consumePotionFromSlot`

## Adaptador atual

- `SupabaseAdminGameRepository` implementa `AdminGamePort`.
- `CharacterService`, `SlotService` e `consumable-drops-crafting` agora consomem use cases, preservando compatibilidade por facade.
