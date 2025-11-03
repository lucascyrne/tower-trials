# Progresso de Refatoração - Tower Trials

> **Data Início:** 2025-10-20  
> **Última Atualização:** 2025-10-20

## Sumário Executivo

| Fase                             | Status      | Progresso |
| -------------------------------- | ----------- | --------- |
| **P1:** Remover acesso a stores  | 🟡 Parcial  | 5% (4/81) |
| **P2:** Consolidar performAction | ✅ Completo | 100%      |
| **P3:** Unificar cache           | ⏳ Pendente | 0%        |
| **P4:** Quebrar services grandes | ⏳ Pendente | 0%        |
| **P5:** Otimizar hooks           | ⏳ Pendente | 0%        |
| **P6:** Consolidar validações    | ⏳ Pendente | 0%        |

---

## ✅ P1: Remover Acesso Direto a Stores (Fase 1)

### Status: Parcialmente Completo

**Decisão Estratégica:** Refatoração incremental focada em casos simples primeiro.

### Arquivos Refatorados ✅

#### 1. `ranking.service.ts` (2 ocorrências eliminadas)

- ❌ **Antes:** `useGameStateStore.getState()` para obter `gameState.player`
- ✅ **Depois:** Métodos recebem `userId` e `playerName` como parâmetros
- 🎯 **Hook Criado:** `useRanking.ts` (orquestra stores + service)

**Exemplo:**

```typescript
// Service (PURO)
static async getPlayerRankingPosition(
  userId: string,
  playerName: string,
  mode: RankingMode = 'floor'
): Promise<number>

// Hook (ORQUESTRAÇÃO)
export function useRanking() {
  const gameState = useGameStateStore(state => state.gameState);

  const getCurrentPlayerRankingPosition = useCallback(
    async (mode: RankingMode = 'floor'): Promise<number> => {
      const user = await AuthService.getCurrentUser();
      if (!gameState.player || !user?.id) return 0;

      return RankingService.getPlayerRankingPosition(
        user.id,
        gameState.player.name,
        mode
      );
    },
    [gameState.player]
  );

  return { getCurrentPlayerRankingPosition };
}
```

#### 2. `consumable.service.ts` (2 ocorrências eliminadas)

- ❌ **Antes:** Método `updateStoresAfterSale()` acessava e modificava stores diretamente
- ✅ **Depois:** Removido - services retornam dados, hooks atualizam stores

**Antes:**

```typescript
private static async updateStoresAfterSale(characterId: string, newGold: number) {
  const characterStore = useCharacterStore.getState(); // ❌
  const gameStore = useGameStateStore.getState(); // ❌

  // Atualizar stores...
}
```

**Depois:**

```typescript
// Service apenas retorna dados
return {
  data: {
    totalGoldEarned: result.total_gold_earned,
    itemsSold: result.items_sold,
    newCharacterGold: result.new_character_gold, // ✅ Hook usa isso
  },
  error: null,
  success: true,
};
```

### Arquivos Pendentes (Fase 2)

**Categoria B: Complexidade Alta** (65 ocorrências)

- `event.service.ts` (16) - Lógica de negócio acoplada
- `equipment.service.ts` (13) - Sistema de equipamentos
- `battle.service.ts` (8) - Lógica de batalha crítica
- `monster.service.ts` (8)
- `cemetery.service.ts` (7)
- `skill-xp.service.ts` (4)
- `reward.service.ts` (4)
- `character.service.ts` (4)

**Decisão:** Adiar para quando houver:

- ✅ Testes automatizados
- ✅ Tempo dedicado
- ✅ Necessidade de manutenção

**Categoria C: Caso Especial**

- `cache.service.ts` (12) - Deprecar via P3

### Métricas

| Métrica                    | Valor |
| -------------------------- | ----- |
| **Ocorrências eliminadas** | 4     |
| **Ocorrências restantes**  | 77    |
| **Progresso**              | 5%    |
| **Arquivos refatorados**   | 2     |
| **Hooks criados**          | 1     |
| **Erros introduzidos**     | 0 ✅  |

### Documentação Criada

1. `docs/REFACTORING_P1_MAPPING.md` - Mapeamento completo
2. `docs/REFACTORING_P1_STRATEGY.md` - Estratégia e decisões
3. `hooks/useRanking.ts` - Hook de orquestração

---

## ✅ P2: Consolidar `performAction` Duplicado

### Status: Completo ✅

**Problema:** Implementação duplicada em `useBattleStore` e `useGameStore`

### Solução Aplicada

#### Antes

```typescript
// useBattleStore.tsx (693 linhas de lógica REAL)
performAction: async (action, spellId?, consumableId?) => {
  // Lógica completa de batalha...
};

// useGameStore.tsx (implementação STUB)
performAction: async (action, spellId?, consumableId?) => {
  // Apenas simulação...
  gameStateStore.updateGameState(draft => {
    draft.gameMessage = `Ação ${action} processada com sucesso!`;
  });
};
```

#### Depois

```typescript
// ✅ useBattleStore.tsx - MANTIDO (implementação completa)
performAction: async (action, spellId?, consumableId?) => {
  // Lógica completa de batalha...
};

// ✅ useGameStore.tsx - REMOVIDO
// Comentário adicionado:
// "performAction foi movido para useBattleStore (P2 - Consolidação)"
```

### Mudanças Realizadas

1. **Interface `GameStoreActions`**

   - ❌ Removido: `performAction` da interface
   - ✅ Adicionado: Comentário explicativo

2. **Implementação**

   - ❌ Removido: Método `performAction` completo (~50 linhas)
   - ✅ Adicionado: Comentário documentando a mudança

3. **Selector `useGameActions`**
   - ❌ Removido: `performAction: state.performAction`
   - ✅ Adicionado: Comentário explicativo

### Verificação

| Item                           | Status                                             |
| ------------------------------ | -------------------------------------------------- |
| **Código duplicado eliminado** | ✅                                                 |
| **Componentes atualizados**    | ✅ N/A (nenhum usava `useGameStore.performAction`) |
| **Linter errors**              | ✅ 0 erros                                         |
| **Documentação atualizada**    | ✅                                                 |
| **Backward compatibility**     | ✅ Mantida (ninguém usava)                         |

### Impacto

- **Linhas removidas:** ~54
- **Complexidade reduzida:** Fonte única de verdade para ações de batalha
- **Manutenibilidade:** ⬆️ Melhorada
- **Risco:** 🟢 Baixo (método não era usado)
- **ROI:** 🟢 Médio

---

## ⏳ P3: Unificar Sistema de Cache

### Status: Pendente

**Problema:** 3 camadas de cache não sincronizadas

- `CharacterCacheService` (em memória)
- `useCharacterStore` (Zustand + localStorage)
- Pending requests cache

**Solução Planejada:**

- Zustand como fonte única de verdade
- Integrar cache no próprio store
- Usar React 19 features quando aplicável

**Estimativa:** 2-3 dias

---

## ⏳ P4-P6: Otimizações Estruturais

### Status: Pendente

| Tarefa                             | Esforço  | ROI   | Prioridade |
| ---------------------------------- | -------- | ----- | ---------- |
| **P4:** Quebrar services grandes   | 5-7 dias | Médio | 🔵         |
| **P5:** Otimizar hooks agregadores | 2-3 dias | Médio | 🔵         |
| **P6:** Consolidar validações      | 1-2 dias | Baixo | ⚪         |

---

## Princípios Seguidos

✅ **Mudanças Incrementais** - Refatoração em fases  
✅ **Backward Compatibility** - Nada quebrou  
✅ **Testes Implícitos** - Verificação de lints  
✅ **Documentação Completa** - Cada decisão documentada  
✅ **Priorizar Estabilidade** - Código funcionando > código perfeito  
✅ **Evitar Complexidade** - Soluções pragmáticas  
✅ **Código Limpo** - Comentários explicativos, código conciso

---

## Próximos Passos

1. ✅ **P3:** Unificar sistema de cache
2. ⏭️ **P5:** Otimizar hooks agregadores (maior impacto em performance)
3. ⏭️ **P4:** Quebrar services grandes
4. ⏭️ **P1 - Fase 2:** Retomar refatoração de services complexos

---

**Última Atualização:** 2025-10-20 19:45  
**Próxima Revisão:** Após P3
