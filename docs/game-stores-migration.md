# Migração dos Providers de Jogo para Zustand - Guia Completo

## 🎯 Objetivo da Migração

Migrar os providers de contexto do sistema de jogo (`GameProvider`, `GameStateProvider`) para stores Zustand para obter:

- Melhor performance e controle de re-renders
- Separação clara de responsabilidades
- Estado global acessível sem Provider Hell
- Mutações imutáveis simplificadas com Immer

## 📁 Estrutura Criada

### 1. `useGameStateStore.tsx` - Estado da Partida

**Responsabilidade**: Gerenciar o estado específico da partida em curso

#### Estados Gerenciados:

- `gameState: GameState` - Estado completo da partida atual
- `loading: GameLoadingState` - Estados de carregamento por operação
- `error: string | null` - Controle de erros global

#### Principais Ações:

- `setGameState()` - Atualizar estado completo
- `updateGameState()` - Mutações específicas com Immer
- `updateLoading()` - Controlar loading por tipo de operação
- `setGameMode()` - Mudar modo do jogo (menu, battle, hub, etc.)
- `updatePlayerStats()` - Atualizar HP/Mana do jogador
- `setError()` / `resetError()` - Gerenciar erros

#### Seletores Incluídos:

```tsx
// Estados básicos
const gameState = useGameState();
const loading = useGameLoading();
const error = useGameError();

// Estados específicos
const player = useGamePlayer();
const mode = useGameMode();
const message = useGameMessage();

// Estado de batalha
const { currentEnemy, isPlayerTurn, battleRewards } = useBattleState();
```

### 2. `useGameStore.tsx` - Orquestrador Principal

**Responsabilidade**: Coordenar ações complexas e gerenciar sessão de jogo

#### Estados Gerenciados:

- `isProcessingAction: boolean` - Controle de debounce para ações
- `lastActionTimestamp: number` - Timestamp da última ação
- `availableCharacters: Character[]` - Cache de personagens disponíveis
- `sessionId: string | null` - ID da sessão atual
- `isInitialized: boolean` - Status de inicialização

#### Principais Ações:

- `initializeGame()` - Inicializar sistema de jogo
- `startGame(characterId)` - Iniciar jogo com personagem
- `performAction(action, spellId?, consumableId?)` - Processar ações do jogador
- `saveProgress()` - Salvar progresso do personagem
- `returnToMenu()` - Voltar ao menu principal
- `refreshCharacterData()` - Atualizar dados de personagem

#### Seletores Incluídos:

```tsx
// Controle de sessão
const { sessionId, isInitialized, isProcessingAction } = useGameSession();

// Ações principais
const { startGame, performAction, saveProgress } = useGameActions();

// Cache de dados
const availableCharacters = useAvailableCharacters();
```

## 🔄 Separação de Responsabilidades

### `useGameStateStore` (Estado da Partida)

✅ **Foca no "O QUE"** - estado atual da partida

- Estado do jogador (HP, Mana, Level, etc.)
- Inimigo atual, andar atual
- Modo de jogo (menu, battle, hub)
- Estados de loading específicos
- Controle de erros

### `useGameStore` (Orquestração)

✅ **Foca no "COMO"** - ações e coordenação

- Inicialização do sistema
- Coordenação entre different stores
- Controle de debounce e processamento
- Cache de dados auxiliares
- Integração com serviços externos

## 📖 Como Usar

### Opção 1: Hooks Especializados (Recomendado)

```tsx
// Para componentes que só precisam do estado
import { useGameState, useGamePlayer, useBattleState } from '../stores/useGameStateStore';

function BattleComponent() {
  const player = useGamePlayer();
  const { currentEnemy, isPlayerTurn } = useBattleState();

  return <div>{/* UI de batalha */}</div>;
}

// Para componentes que fazem ações
import { useGameActions, useGameSession } from '../stores/useGameStore';

function ActionComponent() {
  const { performAction, saveProgress } = useGameActions();
  const { isProcessingAction } = useGameSession();

  const handleAttack = () => {
    if (!isProcessingAction) {
      performAction('attack');
    }
  };

  return (
    <button onClick={handleAttack} disabled={isProcessingAction}>
      Atacar
    </button>
  );
}
```

### Opção 2: Acesso Direto aos Stores

```tsx
import { useGameStateStore } from '../stores/useGameStateStore';
import { useGameStore } from '../stores/useGameStore';

function ComplexComponent() {
  const gameStateStore = useGameStateStore();
  const gameStore = useGameStore();

  // Acesso completo a todo o estado e ações
  return <div>{/* Componente complexo */}</div>;
}
```

### Opção 3: Provider de Transição (Migração Gradual)

```tsx
// Para facilitar migração gradual
import { GameStoreProvider } from '../components/providers/GameStoreProvider';

function App() {
  return <GameStoreProvider>{/* Seus componentes existentes */}</GameStoreProvider>;
}
```

## ⚡ Garantindo Performance

### 1. **Seletores Granulares**

Use seletores específicos ao invés do estado completo:

```tsx
// ❌ Re-render desnecessário
const { gameState, loading } = useGameStateStore();

// ✅ Re-render apenas quando player mudar
const player = useGamePlayer();
const isLoading = useLoadingState('performAction');
```

### 2. **Debounce Automático**

O `useGameStore` já implementa debounce para ações:

```tsx
// Múltiplos cliques são automaticamente filtrados
const { performAction } = useGameActions();
performAction('attack'); // Primeira ação processada
performAction('attack'); // Segunda ação ignorada (debounce)
```

### 3. **Subscriptions Inteligentes**

Use `subscribeWithSelector` para observar mudanças específicas:

```tsx
// Subscribe apenas a mudanças no modo de jogo
useGameStateStore.subscribe(
  state => state.gameState.mode,
  mode => {
    console.log('Modo mudou para:', mode);
  }
);
```

## 🔄 Desacoplamento entre Stores

### 1. **Comunicação Unidirecional**

- `useGameStore` → `useGameStateStore` ✅
- `useGameStateStore` → `useGameStore` ❌ (evitado)

### 2. **Integração via Actions**

```tsx
// GameStore coordena, GameStateStore executa
const performAction = async action => {
  const gameStateStore = useGameStateStore.getState();

  // Atualizar loading
  gameStateStore.updateLoading('performAction', true);

  try {
    // Processar ação
    const result = await GameService.processAction(action);

    // Atualizar estado
    gameStateStore.updateGameState(draft => {
      draft.player.hp = result.newHp;
      draft.gameMessage = result.message;
    });
  } finally {
    gameStateStore.updateLoading('performAction', false);
  }
};
```

### 3. **Estados Independentes**

Cada store mantém seu próprio estado sem dependências circulares.

## 🎉 Benefícios Obtidos

✅ **Performance**: Zustand + seletores granulares = menos re-renders  
✅ **Manutenibilidade**: Separação clara de responsabilidades  
✅ **Simplicidade**: Sem Provider Hell, acesso direto ao estado  
✅ **Type Safety**: TypeScript completo em todos os stores  
✅ **DevTools**: Integração nativa com Redux DevTools  
✅ **Immer**: Mutações imutáveis simplificadas  
✅ **Debounce**: Controle automático de ações duplicadas  
✅ **Flexibilidade**: Múltiplas formas de usar (hooks, stores diretos)

## 🧹 Próximos Passos

1. **Migrar componentes** gradualmente dos contexts para stores
2. **Remover providers antigos** após migração completa
3. **Otimizar seletores** conforme necessidade
4. **Implementar persistência** se necessário (localStorage)
5. **Adicionar testes** para stores críticos

A migração mantém **100% da funcionalidade** mas com arquitetura moderna e performática! 🚀
