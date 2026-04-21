# Progressão de andar e transição visual

## Avanço lógico

1. Inimigo derrotado → `processEnemyDefeat` → estado com `battleRewards`.
2. Jogador confirma continuação → `performAction('continue')` → [`GameService.advanceToNextFloor`](../../src/resources/game/game.service.ts):
   - Persiste `player.floor` no banco (`CharacterService.updateCharacterFloor`).
   - Limpa caches, gera dados do novo piso e novo inimigo.
3. Provider limpa `battleRewards` e define `isPlayerTurn: true`.

## Transição de UI (`withFloorTransition`)

- Observa `gameState.player.floor` e compara com o último valor em ref.
- Só exibe overlay quando o andar **sobe** (não em retrocesso nem sem mudança).
- Logs de debug ficam restritos a `NODE_ENV === 'development'` ([`floor-transition-hoc.tsx`](../../src/components/hocs/floor-transition-hoc.tsx)).

## Integração com torre “infinita”

O número do andar é monotônico no fluxo normal de vitória; bosses/eventos podem alterar `FloorType` via `getFloorData` / regras no serviço sem quebrar o HOC, desde que `player.floor` só aumente ao avançar.
