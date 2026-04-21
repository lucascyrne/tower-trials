# Layout dos serviços de jogo

## Objetivo

Reduzir acoplamento dos arquivos grandes em `src/resources/game` mantendo contratos públicos estáveis (`GameService`, `CharacterService`, `SpellService`, `ConsumableService`).

## Estrutura atual

- `src/resources/game/game-service/`
  - `floor-and-enemy.ts`
  - `combat-math.ts`
  - `battle-player.ts`
  - `battle-enemy.ts`
  - `persistence.ts`
  - `special-events.ts`
- `src/resources/game/spell-service/`
  - `spell-repository.ts`
  - `spell-combat.ts`
  - `spell-ui-helpers.ts`
  - `types.ts`
- `src/resources/game/consumable-service/`
  - `consumable-inventory.ts`
  - `consumable-drops-crafting.ts`
  - `types.ts`
- `src/resources/game/character-service/`
  - `crud-cache.ts`
  - `progression.ts`
  - `combat-time.ts`
  - `stats-build.ts`
- `src/resources/game/game-provider-hooks/`
  - `use-game-bootstrap.ts`
  - `use-perform-action.ts`
  - `use-game-permadeath-effect.ts`

## Regra de manutenção

- Implementação nova deve entrar primeiro em módulos temáticos.
- As classes/fachadas públicas continuam sendo o ponto de entrada para o restante da aplicação.
- Migrações devem ser incrementais, com smoke test de `hub`, `play` e `battle` em cada fase.
