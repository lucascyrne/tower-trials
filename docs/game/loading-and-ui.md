# Loading flags e UI da batalha

## Semântica (`GameLoadingState`)

| Flag | Significado | Uso correto |
|------|-------------|-------------|
| `loadProgress` | Bootstrap: lista de personagens / fetch inicial no `GameProvider` | Skeleton da **rota** apenas no primeiro carregamento (ex.: [`battle/page.tsx`](../../src/app/(authenticated)/(tabs)/game/play/battle/page.tsx)). |
| `startGame` | Criação de novo personagem / fluxo pesado de entrada | Pode compor o skeleton inicial junto com `loadProgress`. |
| `performAction` | **Mutex**: uma ação de combate ou `continue` em andamento | Desabilitar botões e atalhos; **nunca** usar para trocar a árvore inteira por um loader que desmonta `GameBattle`. |

## Anti-padrão corrigido

Usar `loading.performAction === true` para renderizar apenas skeleton na página de batalha **desmontava** `GameBattle` a cada ataque. No remount, `selectCharacter` rodava de novo e regenerava o inimigo.

## UI de “carregando” em `GameBattle`

- Tela cheia “Preparando sua aventura” deve depender só do **carregamento inicial** do personagem (ex.: estado local `isLoading`), não de `performAction`.
- Feedback de turno: spinners nos botões / `CombinedBattleInterface` (`isDisabled = !isPlayerTurn || loading.performAction`).
