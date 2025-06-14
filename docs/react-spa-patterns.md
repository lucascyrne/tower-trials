# Padrões React para SPAs - Evitando Loops de Renderização

## Resumo dos Problemas Resolvidos

Este documento contém os padrões implementados para resolver loops de renderização e requisições duplicadas na SPA Tower Trials.

## 🔧 Padrões Implementados

### 1. **Hook de Inicialização Única**

```typescript
// ✅ PADRÃO: Hook personalizado para inicialização controlada
function useBattleInitialization(characterId?: string, userId?: string) {
  const initializationStateRef = useRef({
    isInitialized: false,
    isInitializing: false,
    lastCharacterId: null,
    initPromise: null,
  });

  const initializeBattle = useCallback(async () => {
    const state = initializationStateRef.current;

    // Evitar múltiplas inicializações
    if (state.isInitializing || (state.isInitialized && state.lastCharacterId === characterId)) {
      if (state.initPromise) {
        await state.initPromise;
      }
      return;
    }

    // Lógica de inicialização...
  }, [characterId, userId]);

  return { initializeBattle, isInitialized: state.isInitialized };
}
```

### 2. **Sistema de Cache Robusto**

```typescript
// ✅ PADRÃO: Cache com invalidação e controle de concorrência
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  isValid: boolean;
}

interface PendingRequest<T> {
  promise: Promise<ServiceResponse<T>>;
  abortController: AbortController;
}

class ServiceWithCache {
  private static cache = new Map<string, CacheEntry<any>>();
  private static pendingRequests = new Map<string, PendingRequest<any>>();

  static async getData(key: string) {
    // 1. Verificar cache
    const cached = this.cache.get(key);
    if (this.isCacheValid(cached)) {
      return cached.data;
    }

    // 2. Verificar requisição pendente
    const pending = this.pendingRequests.get(key);
    if (pending) {
      return await pending.promise;
    }

    // 3. Fazer nova requisição
    const abortController = new AbortController();
    const promise = this.fetchFromServer(key, abortController.signal);

    this.pendingRequests.set(key, { promise, abortController });

    try {
      const result = await promise;
      this.cache.set(key, { data: result, timestamp: Date.now(), isValid: true });
      return result;
    } finally {
      this.pendingRequests.delete(key);
    }
  }
}
```

### 3. **useEffect com Dependências Estáveis**

```typescript
// ❌ PROBLEMÁTICO: Dependências instáveis
useEffect(() => {
  initializeBattle(); // Função que muda a cada render
}, [initializeBattle, gameState.battleRewards]);

// ✅ CORRETO: Dependências específicas e estáveis
useEffect(() => {
  if (mountedRef.current && !isInitialized) {
    initializeBattle().catch(console.error);
  }
}, []); // Array vazio para execução única

// ✅ CORRETO: Dependências específicas para updates
useEffect(() => {
  if (!gameState.battleRewards?.xp && !gameState.battleRewards?.gold) return;

  setVictoryRewards({
    xp: gameState.battleRewards.xp,
    gold: gameState.battleRewards.gold,
    // ...
  });
}, [gameState.battleRewards?.xp, gameState.battleRewards?.gold]); // Dependências específicas
```

### 4. **Hooks Personalizados para Dados**

```typescript
// ✅ PADRÃO: Hook personalizado com controle de estado
function usePotionSlots(playerId?: string) {
  const [potionSlots, setPotionSlots] = useState<PotionSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);

  const slotsStateRef = useRef({
    isLoaded: false,
    isLoading: false,
    lastPlayerId: null,
  });

  const loadPotionSlots = useCallback(async () => {
    if (!playerId) return;

    const state = slotsStateRef.current;

    // Evitar carregamentos duplicados
    if (state.isLoading || (state.isLoaded && state.lastPlayerId === playerId)) {
      return;
    }

    // Carregar dados...
  }, [playerId]);

  // Reset quando player muda
  useEffect(() => {
    const state = slotsStateRef.current;
    if (state.lastPlayerId !== playerId) {
      state.isLoaded = false;
      // Reset state...
    }
  }, [playerId]);

  return { potionSlots, loadingSlots, loadPotionSlots };
}
```

## 🚫 Anti-Padrões a Evitar

### 1. **Dependências Instáveis em useEffect**

```typescript
// ❌ PROBLEMÁTICO
const someFunction = () => {
  /* ... */
}; // Nova função a cada render

useEffect(() => {
  someFunction();
}, [someFunction]); // Executa a cada render

// ✅ SOLUÇÃO
const someFunction = useCallback(() => {
  /* ... */
}, [deps]);
// OU
useEffect(() => {
  const fn = () => {
    /* ... */
  };
  fn();
}, [deps]); // Dependências estáveis
```

### 2. **Cache Sem Controle de Concorrência**

```typescript
// ❌ PROBLEMÁTICO
static async getData(id: string) {
  const cached = cache.get(id);
  if (cached) return cached;

  // Múltiplas requisições podem ser feitas simultaneamente
  const data = await fetch(`/api/${id}`);
  cache.set(id, data);
  return data;
}

// ✅ SOLUÇÃO: Ver padrão de cache robusto acima
```

### 3. **Estados Desnecessários que Triggeram Re-renders**

```typescript
// ❌ PROBLEMÁTICO
const [data, setData] = useState(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

// ✅ MELHOR: Usar um objeto para estado relacionado
const [state, setState] = useState({
  data: null,
  loading: false,
  error: null,
});

// ✅ AINDA MELHOR: Hook personalizado
const { data, loading, error } = useAsyncData(fetchFunction);
```

## 🎯 Padrões para React Strict Mode

### 1. **Inicialização Única com Delay**

```typescript
// ✅ PADRÃO: Delay para evitar dupla execução no Strict Mode
useEffect(() => {
  const timer = setTimeout(() => {
    if (mountedRef.current && !isInitialized) {
      initializeBattle();
    }
  }, 100); // Delay mínimo

  return () => clearTimeout(timer);
}, []); // Array vazio
```

### 2. **Cleanup Adequado**

```typescript
// ✅ PADRÃO: Cleanup completo
useEffect(() => {
  const abortController = new AbortController();

  const fetchData = async () => {
    try {
      const data = await api.getData({ signal: abortController.signal });
      if (!abortController.signal.aborted) {
        setData(data);
      }
    } catch (error) {
      if (!abortController.signal.aborted) {
        setError(error);
      }
    }
  };

  fetchData();

  return () => {
    abortController.abort(); // Cancelar requisição
  };
}, []);
```

## 📋 Checklist de Implementação

### ✅ Componentes

- [ ] useEffect com dependências estáveis
- [ ] Cleanup adequado de listeners e timers
- [ ] Refs para controle de montagem (`mountedRef`)
- [ ] Estados agrupados quando relacionados
- [ ] Hooks personalizados para lógicas complexas

### ✅ Serviços

- [ ] Cache com timestamp e validade
- [ ] Controle de requisições concorrentes
- [ ] Timeout em requests longos
- [ ] Cancelamento via AbortController
- [ ] Invalidação de cache após mutações

### ✅ Context/State Management

- [ ] Memoização de valores computados
- [ ] Providers estáveis (não recriam objetos)
- [ ] Separação de contextos por responsabilidade
- [ ] Estados normalizados

## 🔍 Debugging de Loops

### 1. **Identificar Renders Excessivos**

```typescript
// Adicionar em componentes problemáticos
useEffect(() => {
  console.log('Component rendered:', { props, state });
});
```

### 2. **Usar React DevTools Profiler**

```bash
# Instalar extensão React DevTools
# Ir para aba "Profiler"
# Gravar durante interação problemática
# Identificar componentes que re-renderizam
```

### 3. **Log de Dependências**

```typescript
// Verificar quais dependências estão mudando
useEffect(() => {
  console.log('Effect triggered', { dep1, dep2, dep3 });
}, [dep1, dep2, dep3]);
```

## 📈 Métricas de Sucesso

- **Zero loops infinitos** em desenvolvimento e produção
- **Máximo 1 requisição** por dados únicos durante montagem
- **Cache hit rate > 80%** para dados frequentes
- **Tempo de inicialização < 2s** para componentes complexos
- **Re-renders < 5** durante interações típicas

## 🔗 Recursos Adicionais

- [React.dev - useEffect](https://react.dev/reference/react/useEffect)
- [React.dev - useCallback](https://react.dev/reference/react/useCallback)
- [React.dev - useMemo](https://react.dev/reference/react/useMemo)
- [Padrões de Cache em JavaScript](https://web.dev/cache-api-quick-guide/)

## Soluções para Problemas Comuns

### 🔄 **CORREÇÃO: Loop Infinito no GameBattle** (2024-12-20)

#### **Problema Identificado**

Loop infinito de montagem/desmontagem no componente `GameBattle` causado por:

1. **Cadeia de mudanças de contexto**:

   ```
   GameBattle monta → initializeBattle() → setSelectedCharacter() + setGameState()
       ↑                                                                        ↓
   CharacterProvider re-renderiza ← contexto muda ← GameBattle desmonta/remonta
   ```

2. **Pontos críticos**:
   - `useEffect` com dependências incorretas em `GameBattle.tsx`
   - `setSelectedCharacter()` desnecessário em `character.provider.tsx`
   - `CharacterService.getCharacterForGame()` sempre fazendo requisições
   - Falta de verificações de inicialização

#### **Soluções Aplicadas**

1. **Hook de controle de inicialização**: `useBattleInitializationGuard`
2. **Cache inteligente**: Reutilização de dados já carregados
3. **Verificações robustas**: Evitar re-inicializações desnecessárias
4. **Dependências estáveis**: `useEffect` com dependências corretas

---

### 🔄 **CORREÇÃO: Loop Infinito no GameHub** (2024-12-20)

#### **Problema Identificado**

Loop infinito de loading no componente `GameHub` (`hub.tsx`) causado por:

1. **Cadeia de mudanças de contexto**:

   ```
   Hub useEffect → CharacterService.getCharacterForGame() → loadCharacterForHub()
       ↑                                                                        ↓
   player.id/player.name muda ← gameState atualizado ← CharacterProvider re-renderiza
   ```

2. **Pontos críticos**:
   - **Linha 151**: `useEffect` com dependências instáveis `[characterId, navigate, loadCharacterForHub, player.id, player.name]`
   - **Linha 76**: Verificação insuficiente para determinar se deve carregar
   - **Linha 88**: **SEMPRE** chamava `CharacterService.getCharacterForGame()` mesmo com dados válidos
   - **Linha 130**: `loadCharacterForHub()` causava mudanças no contexto

#### **Soluções Aplicadas**

##### **1. Dependências Estáveis**

```typescript
// ❌ ANTES: Dependências instáveis
}, [characterId, navigate, loadCharacterForHub, player.id, player.name]);

// ✅ DEPOIS: Dependências mínimas e estáveis
}, [characterId, navigate]);
```

##### **2. Verificação Robusta de Estado**

```typescript
// ❌ ANTES: Verificação insuficiente
if (player.id === characterId && player.name) {
  setIsLoading(false);
  return;
}

// ✅ DEPOIS: Verificação completa
if (
  player.id === characterId &&
  player.name &&
  gameState.mode === 'hub' &&
  lastLoadedCharacterRef.current === characterId
) {
  console.log('[GameHub] Personagem já carregado e no hub:', player.name);
  setIsLoading(false);
  return;
}
```

##### **3. Reutilização Inteligente de Dados**

```typescript
// NOVO: Reutilizar dados quando possível
if (player.id === characterId && player.name && gameState.mode !== 'hub') {
  console.log('[GameHub] Reutilizando dados do personagem em contexto:', player.name);
  characterData = player;
} else {
  // Buscar dados apenas se necessário
  const response = await CharacterService.getCharacterForGame(characterId);
  characterData = response.data;
}
```

##### **4. Carregamento Condicional**

```typescript
// CRÍTICO: Só carregar para o hub se realmente necessário
const needsHubLoad = gameState.mode !== 'hub' || player.id !== characterId || !player.name;

if (needsHubLoad) {
  await loadCharacterForHub(characterData as Character);
} else {
  console.log('[GameHub] Contexto já correto para o hub - pulando loadCharacterForHub');
}
```

##### **5. Proteção Anti-Loop**

```typescript
// NOVO: Ref para controlar carregamentos por personagem
const lastLoadedCharacterRef = useRef<string | null>(null);

// Proteção contra múltiplas execuções
if (loadingRef.current && lastLoadedCharacterRef.current === characterId) {
  console.log('[GameHub] Já carregando este personagem, aguardando...');
  return;
}
```

#### **Resultado**

- **Eliminação** do loop infinito de loading
- **Redução drástica** de requisições desnecessárias ao banco
- **Melhoria** na performance e experiência do usuário
- **Reutilização** inteligente de dados já carregados em contexto

---

## Padrões Gerais Identificados

### 🚨 **Causas Comuns de Loops Infinitos**

1. **Dependências instáveis** em `useEffect`
2. **Mudanças desnecessárias** de contexto/estado
3. **Verificações insuficientes** de estado atual
4. **Requisições redundantes** ao banco de dados
5. **Falta de cache** ou cache mal implementado

### ✅ **Soluções Padrão**

1. **Dependências mínimas** e estáveis em `useEffect`
2. **Verificações robustas** antes de executar ações
3. **Cache inteligente** com verificações de validade
4. **Refs de controle** para evitar execuções múltiplas
5. **Logs detalhados** para debugging

## Padrões Recomendados para Evitar Loops Futuros

### ✅ **DOs (Fazer)**

- Sempre incluir todas as dependências nos useEffect
- Verificar cache antes de fazer requisições
- Usar verificações condicionais antes de mudar contexto
- Implementar contadores/guards para detectar loops
- Reutilizar dados já carregados quando possível

### ❌ **DON'Ts (Não Fazer)**

- useEffect com dependências incompletas `[]`
- Mudanças de contexto incondicionais
- Requisições ao banco sem verificar cache
- Ignorar sinais de loops (logs repetitivos)
- Forçar recarregamento de dados já disponíveis
