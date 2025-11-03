# P1: Mapeamento de Acesso Direto a Stores

> **Status:** Em Progresso  
> **Data Início:** 2025-10-20

## Resumo Executivo

**Total de Ocorrências:** 81 (vs. ~25 estimadas)

## Distribuição por Arquivo

| Arquivo                 | Ocorrências | Stores Acessadas                                                          | Prioridade    |
| ----------------------- | ----------- | ------------------------------------------------------------------------- | ------------- |
| `event.service.ts`      | 16          | `useEventStore`, `useGameStateStore`                                      | 🔴 Alta       |
| `equipment.service.ts`  | 13          | `useCharacterStore`, `useGameStateStore`                                  | 🔴 Alta       |
| `cache.service.ts`      | 12          | Todos os stores                                                           | 🟡 Especial\* |
| `battle.service.ts`     | 8           | `useCharacterStore`, `useBattleStore`, `useGameStateStore`, `useLogStore` | 🔴 Alta       |
| `monster.service.ts`    | 8           | `useMonsterStore`, `useGameStateStore`                                    | 🟠 Média      |
| `cemetery.service.ts`   | 7           | `useCharacterStore`, `useGameStateStore`, `useLogStore`                   | 🟠 Média      |
| `character.service.ts`  | 4           | `useCharacterStore`, `useGameStateStore`                                  | 🔴 Alta       |
| `reward.service.ts`     | 4           | `useGameStateStore`                                                       | 🟠 Média      |
| `skill-xp.service.ts`   | 4           | `useGameStateStore`, `useCharacterStore`                                  | 🟠 Média      |
| `consumable.service.ts` | 2           | `useCharacterStore`, `useGameStateStore`                                  | 🟢 Baixa      |
| `ranking.service.ts`    | 2           | `useGameStateStore`                                                       | 🟢 Baixa      |
| `game.service.ts`       | 1           | `useGameStateStore`                                                       | 🟢 Baixa      |

\* `cache.service.ts` é um caso especial - sua função é gerenciar stores, então pode ser deprecado ao invés de refatorado (P3)

## Estratégia de Refatoração

### Fase 1: Arquivos Simples (Baixa Complexidade)

1. ✅ `ranking.service.ts` (2 ocorrências)
2. ✅ `game.service.ts` (1 ocorrência)
3. ✅ `consumable.service.ts` (2 ocorrências)

### Fase 2: Arquivos Médios

4. `reward.service.ts` (4 ocorrências)
5. `skill-xp.service.ts` (4 ocorrências)
6. `monster.service.ts` (8 ocorrências)
7. `cemetery.service.ts` (7 ocorrências)

### Fase 3: Arquivos Complexos

8. `character.service.ts` (4 ocorrências, mas crítico)
9. `battle.service.ts` (8 ocorrências, lógica complexa)
10. `equipment.service.ts` (13 ocorrências)
11. `event.service.ts` (16 ocorrências)

### Fase 4: Especial

12. `cache.service.ts` - Deprecar conforme P3

## Padrão de Refatoração

### Antes (❌ Ruim)

```typescript
export class SomeService {
  static async doSomething(id: string) {
    const store = useCharacterStore.getState();
    const character = store.selectedCharacter;

    // lógica usando character
  }
}
```

### Depois (✅ Bom)

```typescript
// Service: Puro, sem acesso a stores
export class SomeService {
  static async doSomething(
    id: string,
    character: Character | null
  ): Promise<ServiceResponse<Result>> {
    // lógica usando character (sem acesso a store)
  }
}

// Hook: Orquestra store + service
export function useSomeOperation() {
  const selectedCharacter = useCharacterStore(state => state.selectedCharacter);
  const updateCharacter = useCharacterStore(state => state.updateCharacter);

  const doSomething = useCallback(
    async (id: string) => {
      const result = await SomeService.doSomething(id, selectedCharacter);

      if (result.success) {
        updateCharacter(result.data);
      }

      return result;
    },
    [selectedCharacter, updateCharacter]
  );

  return { doSomething };
}
```

## Progresso

### Fase 1: Arquivos Simples ✅

- [x] `ranking.service.ts` - 2 ocorrências eliminadas ✅
  - Criado `useRanking` hook
  - Métodos agora recebem parâmetros explícitos
- [x] `consumable.service.ts` - 2 ocorrências eliminadas ✅
  - Removido `updateStoresAfterSale`
  - Services retornam dados, não modificam stores

**Subtotal Fase 1:** 4/81 ocorrências eliminadas (5%)

### Fase 2: Arquivos Médios (Em Progresso)

- [ ] `reward.service.ts` (4 ocorrências)
- [ ] `skill-xp.service.ts` (4 ocorrências)
- [ ] `monster.service.ts` (8 ocorrências)
- [ ] `cemetery.service.ts` (7 ocorrências)

### Fase 3: Arquivos Complexos (Pendente)

- [ ] `game.service.ts` (1 ocorrência - mas crítica)
- [ ] `character.service.ts` (4 ocorrências)
- [ ] `battle.service.ts` (8 ocorrências)
- [ ] `equipment.service.ts` (13 ocorrências)
- [ ] `event.service.ts` (16 ocorrências)

### Fase 4: Especial

- [ ] `cache.service.ts` (12 ocorrências) - Deprecar conforme P3

### Hooks Criados

- [x] `useRanking.ts` - Orquestração de ranking ✅

## Observações Importantes

1. **React 19**: Usando Zustand (compatível) + hooks nativos do React 19 (`use`, `useCallback`, etc)
2. **Sem complexidade adicional**: Services puros são mais simples que services com dependências de stores
3. **Código limpo**: Separação clara de responsabilidades (service = lógica pura, hook = orquestração)
4. **Testabilidade**: Services puros são facilmente testáveis sem mocks de stores
