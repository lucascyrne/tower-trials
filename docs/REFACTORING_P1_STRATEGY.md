# Estratégia de Refatoração P1 - Acesso a Stores

> **Data:** 2025-10-20  
> **Status:** Em Revisão

## Análise Estratégica

Após análise detalhada das **81 ocorrências**, identificamos 3 categorias:

### Categoria A: Fácil de Refatorar ✅ (FEITO)

**Padrão:** Services que acessam stores apenas para ler dados simples

- `ranking.service.ts` (2 ocorrências) ✅
- `consumable.service.ts` (2 ocorrências) ✅

**Solução Aplicada:**

- Services recebem dados via parâmetros
- Hooks fazem ponte entre stores e services
- **ROI:** Alto (melhora testabilidade sem risco)

### Categoria B: Refatoração Complexa ⚠️ (MARCAR PARA DEPOIS)

**Padrão:** Services que modificam múltiplas stores e têm lógica de negócio acoplada

- `event.service.ts` (16 ocorrências)
- `equipment.service.ts` (13 ocorrências)
- `battle.service.ts` (8 ocorrências)
- `monster.service.ts` (8 ocorrências)
- `cemetery.service.ts` (7 ocorrências)
- `skill-xp.service.ts` (4 ocorrências)
- `reward.service.ts` (4 ocorrências)
- `character.service.ts` (4 ocorrências)

**Exemplo de Complexidade (`event.service.ts`):**

```typescript
// Service faz TUDO:
// 1. Lê configurações de eventStore
// 2. Verifica cooldowns via store
// 3. Busca dados do backend
// 4. Atualiza eventStore
// 5. Atualiza gameStore
// 6. Registra erros em stores
```

**Por que NÃO refatorar agora:**

- ❌ **Alto risco** de quebrar funcionalidades críticas
- ❌ **Complexidade** exigiria reescrever lógica de negócio
- ❌ **Contra princípio** "evitar aumentar complexidade"
- ❌ **ROI baixo** no curto prazo

**Estratégia Recomendada:**

1. **Marcar com comentários** `// TODO: P1 - Refatorar para remover acesso direto a stores`
2. **Documentar padrão** de como deveria ser após refatoração
3. **Adiar** para quando houver:
   - Testes automatizados abrangentes
   - Tempo para reescrever com calma
   - Necessidade de manutenção nessas áreas

### Categoria C: Caso Especial - Cache Service 🔄

**Service:** `cache.service.ts` (12 ocorrências)

**Análise:** Este service TEM QUE acessar stores - sua função é gerenciá-los!

**Solução:** Deprecar conforme **P3: Unificar Sistema de Cache**

- Mover lógica de cache para dentro dos próprios stores
- Eliminar `cache.service.ts` completamente

## Decisão Estratégica

### O Que Fazer AGORA ✅

1. ✅ **Completar Categoria A** (4/81 ocorrências - FEITO)
2. ✅ **Documentar padrão** claro para refatorações futuras
3. ✅ **Seguir para P2** (Consolidar performAction) - maior ROI

### O Que Fazer DEPOIS ⏭️

1. **P2:** Consolidar `performAction` duplicado (esforço: 1-2 dias, ROI: médio)
2. **P3:** Unificar cache (elimina 12 ocorrências de `cache.service.ts`)
3. **P4:** Quebrar services grandes (facilita refatoração futura)
4. **P1 - Fase 2:** Retomar refatoração de Categoria B quando houver:
   - Testes automatizados
   - Tempo dedicado
   - Necessidade de manutenção

## Métricas de Sucesso

| Métrica         | Antes | Agora | Meta Final      |
| --------------- | ----- | ----- | --------------- |
| **Categoria A** | 4     | 0 ✅  | 0               |
| **Categoria B** | 65    | 65 ⚠️ | 0 (longo prazo) |
| **Categoria C** | 12    | 12 🔄 | 0 (via P3)      |
| **Total**       | 81    | 77    | 0               |

**Progresso:** 5% eliminado de forma **segura** e **sem aumentar complexidade** ✅

## Padrão de Refatoração (Para Futura Aplicação)

### Antes (❌ Anti-padrão)

```typescript
// service.ts
static async doSomething(id: string) {
  const store = useGameStateStore.getState();
  const player = store.gameState.player;

  // lógica usando player
  const result = await api.save(player);

  // atualizar store
  store.updateGameState(draft => {
    draft.player = result;
  });

  return result;
}
```

### Depois (✅ Padrão Correto)

```typescript
// service.ts (PURO - sem acesso a stores)
static async doSomething(id: string, player: GamePlayer) {
  // lógica usando player (parâmetro)
  const result = await api.save(player);
  return result; // apenas retorna dados
}

// useGameOperations.ts (HOOK - orquestra stores + service)
export function useGameOperations() {
  const player = useGameStateStore(state => state.gameState.player);
  const updateGameState = useGameStateStore(state => state.updateGameState);

  const doSomething = useCallback(async (id: string) => {
    if (!player) return null;

    const result = await Service.doSomething(id, player);

    updateGameState(draft => {
      draft.player = result;
    });

    return result;
  }, [player, updateGameState]);

  return { doSomething };
}
```

## Conclusão

**Refatoração P1 - Fase 1: COMPLETA ✅**

- 4 ocorrências eliminadas de forma segura
- Padrão estabelecido para refatorações futuras
- Sem aumento de complexidade
- Testabilidade melhorada nos arquivos refatorados

**Próximo Passo:** P2 - Consolidar `performAction` duplicado

---

**Princípios Seguidos:**

- ✅ Mudanças incrementais
- ✅ Evitar aumento de complexidade
- ✅ Priorizar estabilidade
- ✅ Pragmatismo sobre perfeição
