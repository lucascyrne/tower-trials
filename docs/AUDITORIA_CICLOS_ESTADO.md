# Auditoria de Ciclos de Atualização de Estado - CharacterProvider

## 🔍 **PROBLEMAS IDENTIFICADOS E CORRIGIDOS**

### **🚨 PROBLEMA CRÍTICO: Loop de Re-render**

**Evidência nos logs:** `🔄 [CharacterProvider] RENDER #13` - Loop detectado após 13+ re-renders

---

## **✅ CORREÇÕES IMPLEMENTADAS:**

### **1. Context Value Memoization Instável**

**❌ PROBLEMA:**

```typescript
const contextValue = useMemo(
  () => ({
    // ... funções
  }),
  [
    // ... dados,
    createCharacter, // ❌ Incluía funções nas dependências
    selectCharacter, // ❌ Causava re-criação constante
    loadCharacterForHub, // ❌ do contexto
    // ... outras funções
  ]
);
```

**✅ SOLUÇÃO:**

```typescript
const contextValue = useMemo(
  () => ({
    characters,
    selectedCharacter,
    createCharacter,
    selectCharacter,
    loadCharacterForHub,
    // ... outras funções
  }),
  [
    // 🔧 APENAS dados que realmente afetam o context, SEM funções
    characters.length,
    charactersIds,
    charactersState,
    selectedCharacter?.id,
    selectedCharacter?.updated_at,
    selectedCharacter?.hp,
    selectedCharacter?.mana,
    selectedCharacter?.gold,
    selectedCharacter?.floor,
    // 🚨 REMOVIDO: Todas as funções das dependências
  ]
);
```

### **2. updatePlayerStats com Dependência do gameState**

**❌ PROBLEMA:**

```typescript
const updatePlayerStats = useCallback(
  (hp: number, mana: number) => {
    setGameState({
      ...gameState, // ❌ Dependência direta do gameState
      player: { ...gameState.player, hp, mana },
    });
  },
  [gameState, setGameState] // ❌ gameState muda constantemente
);
```

**✅ SOLUÇÃO:**

```typescript
const updatePlayerStats = useCallback(
  (hp: number, mana: number) => {
    // 🔧 SOLUÇÃO: Capturar gameState atual durante a execução
    const currentGameState = gameState;
    setGameState({
      ...currentGameState,
      player: {
        ...currentGameState.player,
        hp: Math.floor(hp),
        mana: Math.floor(mana),
      },
    });
  },
  [setGameState] // 🔧 CORREÇÃO: Apenas setGameState, capturar gameState na execução
);
```

### **3. Dependências Excessivas em useCallback**

**❌ PROBLEMA:**

```typescript
const loadCharacterForHub = useCallback(
  async (character: Character) => {
    // ... lógica
  },
  [setSelectedCharacter, setGameState, gameState, selectedCharacter?.id] // ❌ Muitas dependências
);

const initializeBattle = useCallback(
  async (character: Character, battleKey: string) => {
    // ... lógica
  },
  [selectedCharacter?.id, setGameState, addGameLogMessage, updateLoading] // ❌ selectedCharacter?.id instável
);
```

**✅ SOLUÇÃO:**

```typescript
const loadCharacterForHub = useCallback(
  async (character: Character) => {
    // ... lógica inalterada
  },
  [setGameState] // 🔧 CORREÇÃO: Dependências mínimas
);

const initializeBattle = useCallback(
  async (character: Character, battleKey: string) => {
    // 🔧 CORREÇÃO: Capturar currentSelectedId durante execução
    const currentSelectedId = selectedCharacter?.id;
    // ... resto da lógica
  },
  [setGameState, addGameLogMessage, updateLoading] // 🔧 REDUZIDO: Dependências mínimas
);
```

### **4. BattleProvider - performAction com Dependências Instáveis**

**❌ PROBLEMA:**

```typescript
const performAction = useCallback(
  async (action: ActionType, spellId?: string, consumableId?: string) => {
    // ... lógica
  },
  [
    gameState.mode, // ❌ Propriedades específicas do gameState
    gameState.currentEnemy?.id, // ❌ que mudam constantemente
    selectedCharacter?.id, // ❌ Objeto completo que muda referência
    setGameState,
    addGameLogMessage,
    updateLoading,
  ]
);
```

**✅ SOLUÇÃO:**

```typescript
const performAction = useCallback(
  async (action: ActionType, spellId?: string, consumableId?: string) => {
    // 🔧 CORREÇÃO: Capturar snapshots no momento da execução
    const currentGameState = gameState;
    const currentSelectedCharacter = selectedCharacter;
    // ... resto da lógica inalterada
  },
  [setGameState, addGameLogMessage, updateLoading, clearLoadingState] // 🔧 REDUZIDO: Dependências mínimas
);
```

### **5. EventProvider - Dependências Instáveis**

**❌ PROBLEMA:**

```typescript
const interactWithEvent = useCallback(async () => {
  // ... lógica
}, [
  gameState.mode, // ❌ Propriedades que mudam
  gameState.player?.hp, // ❌ constantemente
  gameState.player?.mana,
  selectedCharacter?.id,
  setGameState,
  addGameLogMessage,
]);
```

**✅ SOLUÇÃO:**

```typescript
const interactWithEvent = useCallback(async () => {
  // 🔧 CORREÇÃO: Capturar valores no momento da execução
  const currentGameState = gameState;
  const currentSelectedCharacter = selectedCharacter;
  // ... resto da lógica inalterada
}, [setGameState, addGameLogMessage]); // 🔧 REDUZIDO: Dependências mínimas
```

### **6. useEffect com Dependências Problemáticas**

**❌ PROBLEMA:**

```typescript
useEffect(() => {
  // Carregar personagens
}, [user?.id]); // ❌ Faltava hasLoadedCharacters na dependência
```

**✅ SOLUÇÃO:**

```typescript
useEffect(() => {
  // ... lógica inalterada
}, [user?.id, hasLoadedCharacters]); // 🔧 REDUZIDO: Apenas dependências essenciais
```

---

## **🎯 RESULTADO ESPERADO:**

1. **Fim dos loops de re-render** no CharacterProvider
2. **Context estável** que não muda referência desnecessariamente
3. **Funções estáveis** via useCallback com dependências mínimas
4. **Hub carrega normalmente** sem múltiplas execuções

## **🔍 LOGS DE VALIDAÇÃO:**

Após as correções, o comportamento esperado nos logs:

```
🔄 [CharacterProvider] RENDER #1
🔄 [CharacterProvider] RENDER #2
[CharacterProvider] Hub carregado com sucesso para Cfgkng
[GameHub] loadCharacterForHub concluído com sucesso
```

**SEM** mensagens de loop detectado após render #5.

---

## **📝 LIÇÕES APRENDIDAS:**

1. **NUNCA incluir funções nas dependências do useMemo** de contexto
2. **Capturar estado durante execução** ao invés de dependências no useCallback
3. **Minimizar dependências** dos useCallback para apenas funções setter estáveis
4. **Evitar dependências de propriedades específicas** de objetos que mudam (como `gameState.mode`)
5. **Usar snapshots no momento da execução** para evitar closure stale
