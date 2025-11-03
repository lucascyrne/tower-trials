# Guia de Refatoração - Tower Trials

> **Versão:** 1.0  
> **Data:** 2025-01-20  
> **Status:** Plano de Refatoração Aprovado

## Índice

1. [Visão Geral](#visão-geral)
2. [Priorização: Impacto vs Esforço](#priorização-impacto-vs-esforço)
3. [Fase 1: Correções Críticas](#fase-1-correções-críticas-alta-prioridade)
4. [Fase 2: Refatorações Estruturais](#fase-2-refatorações-estruturais-média-prioridade)
5. [Fase 3: Otimizações](#fase-3-otimizações-baixa-prioridade)
6. [Métricas de Sucesso](#métricas-de-sucesso)
7. [Checklist de Validação](#checklist-de-validação)

---

## Visão Geral

Este guia detalha o plano de refatoração para melhorar a **arquitetura**, **manutenibilidade** e **performance** do Tower Trials, sem comprometer a estabilidade da aplicação.

### Princípios Fundamentais

🎯 **Mudanças Incrementais** - Nunca fazer refatorações "big bang"  
🎯 **Backward Compatibility** - Manter compatibilidade onde possível  
🎯 **Testes Antes e Depois** - Validar que nada quebrou  
🎯 **Documentar Decisões** - Registrar o "porquê" de cada mudança  
🎯 **Priorizar Estabilidade** - Código funcionando > código perfeito

---

## Priorização: Impacto vs Esforço

### Matriz de Priorização

```
IMPACTO ALTO │ ████ P1: Services acessando  │ ██ P4: Arquivos grandes
             │      stores diretamente      │
             │                               │
             │ ███ P2: performAction duplo   │
             │                               │
             │ ███ P3: Cache em 3 camadas   │ █ P6: Hooks agregadores
─────────────┼───────────────────────────────┼────────────────────────
IMPACTO      │ █ P7: Validações repetidas   │ █ P8: Conversões
BAIXO        │                               │     duplicadas
             │                               │
             └───────────────────────────────┴────────────────────────
               ESFORÇO BAIXO                  ESFORÇO ALTO
```

### Legenda de Prioridades

| Prioridade | Descrição                             | Quando Fazer       |
| ---------- | ------------------------------------- | ------------------ |
| **P1** 🔴  | Crítico - Impacto alto, esforço baixo | **IMEDIATO**       |
| **P2** 🟠  | Alto - Impacto alto, esforço médio    | Esta sprint        |
| **P3** 🟡  | Médio - Impacto médio, esforço médio  | Próximas 2 sprints |
| **P4** 🔵  | Baixo - Impacto médio, esforço alto   | Quando possível    |
| **P5** ⚪  | Opcional - Nice to have               | Backlog            |

---

## Fase 1: Correções Críticas (Alta Prioridade)

### P1: Remover Acesso Direto a Stores dos Services 🔴

**Problema:** ~25 services acessando stores via `.getState()`

#### Análise de Impacto

| Métrica          | Antes      | Depois   |
| ---------------- | ---------- | -------- |
| Acoplamento      | ALTO       | BAIXO    |
| Testabilidade    | DIFÍCIL    | FÁCIL    |
| Reutilização     | IMPOSSÍVEL | POSSÍVEL |
| Manutenibilidade | BAIXA      | ALTA     |

#### Arquivos Afetados

```
services/
├── character.service.ts            ✅ 4 ocorrências (COMPLETO)
├── character-healing.service.ts    ✅ 7 ocorrências (COMPLETO)
├── character-progression.service.ts ✅ 6 ocorrências (COMPLETO)
├── character-checkpoint.service.ts ✅ 5 ocorrências (COMPLETO)
├── equipment.service.ts            ✅ 13 ocorrências (COMPLETO)
├── battle.service.ts               ⚠️ 12 ocorrências
├── game.service.ts                 ⚠️ 3 ocorrências
└── ...outros                       ⚠️ ~5 ocorrências
```

#### Plano de Ação

**Passo 1: Identificar Todos os Usos**

```bash
# Buscar por .getState() em services
grep -r "\.getState()" src/services/
```

**Passo 2: Criar Camada de Abstração**

```typescript
// ❌ ANTES: Service acessa store diretamente
export class CharacterService {
  static async updateCharacter(id: string, data: Partial<Character>) {
    const store = useCharacterStore.getState(); // ❌ Ruim
    const currentChar = store.selectedCharacter;

    // ... lógica
  }
}

// ✅ DEPOIS: Service recebe dados via parâmetros
export class CharacterService {
  static async updateCharacter(
    id: string,
    data: Partial<Character>,
    currentCharacter: Character | null // ✅ Parâmetro explícito
  ) {
    // ... lógica (sem acessar store)
  }
}
```

**Passo 3: Criar Hooks de Orquestração**

```typescript
// hooks/useCharacterOperations.ts
export function useCharacterOperations() {
  const selectedCharacter = useCharacterStore(state => state.selectedCharacter);
  const updateStore = useCharacterStore(state => state.updateCharacter);

  const updateCharacter = useCallback(
    async (id: string, data: Partial<Character>) => {
      // Hook faz a ponte entre store e service
      const result = await CharacterService.updateCharacter(
        id,
        data,
        selectedCharacter // ✅ Hook passa dados do store
      );

      if (result.success) {
        updateStore(result.data);
      }

      return result;
    },
    [selectedCharacter, updateStore]
  );

  return { updateCharacter };
}
```

**Passo 4: Migração Gradual**

```typescript
// Fase de transição: Suportar ambos os métodos
export class CharacterService {
  // ✅ Novo método (preferido)
  static async updateCharacter(
    id: string,
    data: Partial<Character>,
    currentCharacter: Character | null
  ) {}

  // ⚠️ Método legado (deprecated, será removido)
  /** @deprecated Use updateCharacter com parâmetro currentCharacter */
  static async updateCharacterLegacy(id: string, data: Partial<Character>) {
    const store = useCharacterStore.getState();
    return this.updateCharacter(id, data, store.selectedCharacter);
  }
}
```

**Passo 5: Atualizar Chamadas**

Converter uma por vez, testar, commit.

#### Checklist de Validação

- [ ] Todas as ocorrências de `.getState()` mapeadas
- [ ] Hooks de orquestração criados
- [ ] Testes unitários dos services passando
- [ ] Componentes funcionando corretamente
- [ ] Performance não degradou
- [ ] Documentação atualizada

#### Estimativa

- **Esforço:** 3-5 dias
- **Risco:** Médio
- **ROI:** MUITO ALTO (melhora drasticamente testabilidade)

---

### P2: Consolidar `performAction` 🟠

**Problema:** Lógica duplicada em `useBattleStore` e `useGameStore`

#### Análise

```typescript
// useBattleStore.tsx - linha 90 (693 linhas de lógica)
performAction: async (action, spellId?, consumableId?) => {
  // Validações
  // Controle de debounce
  // Processamento de turno do jogador
  // Processamento de turno do inimigo
  // Gerenciamento de estado de batalha
};

// useGameStore.tsx - linha 154 (implementação simplificada)
performAction: async (action, spellId?, consumableId?) => {
  // Apenas debounce básico
  // Simulação simples
  // Sem lógica real de batalha
};
```

#### Decisão de Design

**Manter apenas:** `useBattleStore.performAction` (versão completa)

**Razão:** É a implementação real e robusta

#### Plano de Ação

**Passo 1: Deprecar em `useGameStore`**

```typescript
// useGameStore.tsx
performAction: async (action, spellId?, consumableId?) => {
  console.warn(
    '[DEPRECATED] useGameStore.performAction está obsoleto. Use useBattleStore.performAction'
  );

  // Delegar para useBattleStore
  const battleStore = useBattleStore.getState();
  return battleStore.performAction(action, spellId, consumableId);
};
```

**Passo 2: Atualizar Chamadas**

```bash
# Encontrar todos os usos
grep -r "useGameStore.*performAction" src/
```

**Passo 3: Migrar Componentes**

```typescript
// ❌ ANTES
import { useGameStore } from '@/stores/useGameStore';

function Component() {
  const { performAction } = useGameStore();
}

// ✅ DEPOIS
import { useBattleActions } from '@/stores/useBattleStore';

function Component() {
  const { performAction } = useBattleActions();
}
```

**Passo 4: Remover Código Morto**

Após migração completa, remover método de `useGameStore`.

#### Checklist

- [ ] Todas as chamadas identificadas
- [ ] Migração para `useBattleStore` completada
- [ ] Testes de batalha passando
- [ ] UI funcionando corretamente
- [ ] Código morto removido

#### Estimativa

- **Esforço:** 1-2 dias
- **Risco:** Baixo
- **ROI:** Médio (evita bugs de inconsistência)

---

### P3: Unificar Sistema de Cache 🟡

**Problema:** 3 camadas de cache não sincronizadas

#### Camadas Atuais

```
┌─────────────────────────────────────┐
│ CharacterCacheService (em memória)  │
│ - Map<id, Character>                │
│ - Timestamps de expiração           │
│ - Requisições pendentes             │
└─────────────────────────────────────┘
          ↕️ (sem sincronização)
┌─────────────────────────────────────┐
│ useCharacterStore (Zustand)         │
│ - characters: Character[]           │
│ - selectedCharacter                 │
│ - Persist no localStorage           │
└─────────────────────────────────────┘
          ↕️ (sincronização manual)
┌─────────────────────────────────────┐
│ Pending Requests Cache              │
│ - Map<id, Promise>                  │
└─────────────────────────────────────┘
```

#### Solução: Zustand como Fonte Única de Verdade

```
┌─────────────────────────────────────┐
│ useCharacterStore (Zustand)         │
│ ┌─────────────────────────────────┐ │
│ │ State:                          │ │
│ │ - characters: Character[]       │ │
│ │ - selectedCharacter             │ │
│ │ - cacheTimestamps: Map          │ │
│ │ - pendingRequests: Map          │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ Actions:                        │ │
│ │ - fetchCharacter()              │ │
│ │ - invalidateCache()             │ │
│ │ - getCached()                   │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

#### Plano de Ação

**Passo 1: Estender `useCharacterStore`**

```typescript
// useCharacterStore.tsx
interface CharacterState {
  characters: Character[];
  selectedCharacter: Character | null;

  // ✅ NOVO: Gerenciamento de cache integrado
  cacheTimestamps: Record<string, number>;
  pendingRequests: Map<string, Promise<ServiceResponse<Character>>>;
  cacheMaxAge: number; // 5 minutos padrão
}

interface CharacterActions {
  // ... ações existentes

  // ✅ NOVO: Ações de cache
  getCachedCharacter: (id: string) => Character | null;
  isCacheValid: (id: string) => boolean;
  invalidateCharacterCache: (id: string) => void;
  invalidateAllCache: () => void;
}
```

**Passo 2: Migrar Lógica de `CharacterCacheService`**

```typescript
// useCharacterStore.tsx
getCachedCharacter: (id: string) => {
  const state = get();
  const character = state.characters.find(c => c.id === id);

  if (!character) return null;

  const timestamp = state.cacheTimestamps[id];
  const age = Date.now() - (timestamp || 0);

  if (age > state.cacheMaxAge) {
    return null;
  }

  return character;
};
```

**Passo 3: Deprecar `CharacterCacheService`**

```typescript
// character-cache.service.ts
/**
 * @deprecated
 * Use useCharacterStore diretamente.
 * Este serviço será removido na versão 2.0
 */
export class CharacterCacheService {
  static getCachedCharacter(id: string): Character | null {
    console.warn('[DEPRECATED] Use useCharacterStore.getState().getCachedCharacter()');
    return useCharacterStore.getState().getCachedCharacter(id);
  }
}
```

**Passo 4: Atualizar Services**

```typescript
// character.service.ts
static async getCharacter(id: string): Promise<ServiceResponse<Character>> {
  // ❌ ANTES
  const cachedCharacter = CharacterCacheService.getCachedCharacter(id);

  // ✅ DEPOIS
  const store = useCharacterStore.getState();
  const cachedCharacter = store.getCachedCharacter(id);

  if (cachedCharacter) {
    return { data: cachedCharacter, error: null, success: true };
  }

  // ... buscar do servidor
}
```

#### Checklist

- [ ] Cache integrado ao Zustand store
- [ ] Métodos de cache testados
- [ ] `CharacterCacheService` deprecated
- [ ] Services atualizados
- [ ] Performance validada
- [ ] Remover `CharacterCacheService` após 1 sprint

#### Estimativa

- **Esforço:** 2-3 dias
- **Risco:** Médio
- **ROI:** Alto (simplifica arquitetura)

---

## Fase 2: Refatorações Estruturais (Média Prioridade)

### P4: Quebrar Services Grandes 🔵

**Problema:** 5 arquivos > 1000 linhas

#### Arquivos Alvo

| Arquivo                 | Linhas | Novo Objetivo | Módulos       |
| ----------------------- | ------ | ------------- | ------------- |
| `character.service.ts`  | 1328   | < 400         | 4 módulos     |
| `battle.service.ts`     | 1366   | < 400         | 4 módulos     |
| `consumable.service.ts` | 914    | < 400         | 3 módulos     |
| `spell.service.ts`      | 1062   | < 400         | 3 módulos     |
| `game-battle.tsx`       | 1178   | < 400         | 3 componentes |

#### Exemplo: Quebrar `character.service.ts`

**ANTES:**

```
character.service.ts (1328 linhas)
├── getUserCharacters()
├── getCharacter()
├── createCharacter()
├── deleteCharacter()
├── getCharacterStats()
├── getCharacterForGame()
├── updateCharacterHpMana()
├── applyAutoHeal()
├── updateCharacterFloor()
├── grantSecureXP()
├── grantSecureGold()
├── distributeAttributePoints()
└── ... 15+ outros métodos
```

**DEPOIS:**

```
services/character/
├── character.service.ts        (~300 linhas)
│   └── Métodos principais (CRUD)
├── character-stats.service.ts  (já existe ✅)
├── character-progression.service.ts (já existe ✅)
├── character-healing.service.ts (já existe ✅)
└── character-cache.service.ts  (já existe, deprecar ⚠️)
```

#### Plano de Ação

**Passo 1: Analisar Responsabilidades**

```typescript
// Categorizar métodos por domínio
CRUD Operations:
- getUserCharacters, getCharacter, createCharacter, deleteCharacter

Stats & Combat:
- getCharacterStats, calculateDerivedStats, getCharacterForGame

Progression:
- grantSecureXP, grantSecureGold, updateLevel

Healing & Recovery:
- updateCharacterHpMana, applyAutoHeal, forceFullHealForHub

Attributes:
- distributeAttributePoints, recalculateCharacterStats
```

**Passo 2: Criar Módulos Focados**

```typescript
// services/character/character-crud.service.ts
export class CharacterCrudService {
  static async getCharacter(id: string) {}
  static async getUserCharacters(userId: string) {}
  static async createCharacter(data: CreateDTO) {}
  static async deleteCharacter(id: string) {}
}

// character.service.ts delega para módulos
export class CharacterService {
  // Delegar CRUD
  static getCharacter = CharacterCrudService.getCharacter;
  static getUserCharacters = CharacterCrudService.getUserCharacters;

  // Delegar Stats (já existe)
  static calculateDerivedStats = CharacterStatsService.calculateDerivedStats;

  // Delegar Progression (já existe)
  static grantSecureXP = CharacterProgressionService.grantSecureXP;

  // Delegar Healing (já existe)
  static applyAutoHeal = CharacterHealingService.applyAutoHeal;
}
```

**Passo 3: Atualizar Imports Gradualmente**

```typescript
// ❌ ANTES
import { CharacterService } from '@/services/character.service';
CharacterService.getCharacter(id);

// ✅ DEPOIS (ambos funcionam durante transição)
import { CharacterService } from '@/services/character.service';
// OU
import { CharacterCrudService } from '@/services/character/character-crud.service';
```

#### Checklist

- [ ] Módulos criados e testados
- [ ] Delegação funcionando
- [ ] Imports atualizados
- [ ] Documentação atualizada
- [ ] Nenhum arquivo > 800 linhas

#### Estimativa

- **Esforço:** 5-7 dias (todos os services)
- **Risco:** Baixo (delegação mantém compatibilidade)
- **ROI:** Médio (manutenibilidade)

---

### P5: Reorganizar Lógica de Batalha 🔵

**Problema:** Lógica espalhada por 5+ arquivos

#### Estrutura Atual

```
src/
├── stores/useBattleStore.tsx          (693 linhas)
├── services/battle.service.ts          (1366 linhas)
├── services/battle-initialization.service.ts
├── services/battle-logger.service.ts
└── features/battle/game-battle.tsx     (1178 linhas)
```

#### Estrutura Proposta

```
src/features/battle/
├── components/                  # UI components
│   ├── BattleArena.tsx
│   ├── BattleHeader.tsx
│   └── ...
├── logic/                       # ✅ NOVO
│   ├── battle-actions.ts       # Ações de batalha
│   ├── battle-calculations.ts  # Cálculos de dano
│   ├── battle-turns.ts         # Lógica de turnos
│   ├── battle-rewards.ts       # Sistema de recompensas
│   └── index.ts
├── hooks/                       # ✅ NOVO
│   ├── useBattleInitialization.ts
│   ├── useBattleActions.ts
│   └── usePotionSlots.ts
└── stores/
    └── useBattleStore.tsx      # Apenas estado + orquestração
```

#### Benefícios

✅ **Coesão**: Tudo relacionado a batalha em um lugar  
✅ **Testabilidade**: Lógica pura separada de UI  
✅ **Reutilização**: Funções de cálculo reutilizáveis  
✅ **Manutenção**: Mais fácil encontrar e modificar código

#### Estimativa

- **Esforço:** 3-4 dias
- **Risco:** Médio
- **ROI:** Alto (organização)

---

### P6: Otimizar Hooks Agregadores 🔵

**Problema:** `useGame.ts` retorna 15+ propriedades

#### Análise

```typescript
// useGame.ts - Hook "God Object"
export function useGame() {
  return {
    // GameState (5 props)
    gameState,
    loading,
    error,
    setGameState,
    updateLoading,

    // GameLog (4 props)
    gameMessage,
    gameLog,
    addGameLogMessage,
    setGameMessage,

    // Character (5 props)
    characters,
    selectedCharacter,
    createCharacter,
    selectCharacter,
    reloadCharacters,

    // Event (1 prop)
    interactWithEvent,

    // Legacy (3 props)
    startGame,
    clearGameState,
    returnToMenu,
  };
}
```

**Problema:** Componente que usa apenas `gameMessage` re-renderiza quando `characters` muda.

#### Solução: Hooks Granulares

```typescript
// hooks/useGameState.ts
export function useGameState() {
  const gameState = useGameStateStore(state => state.gameState);
  const loading = useGameStateStore(state => state.loading);
  const error = useGameStateStore(state => state.error);

  return { gameState, loading, error };
}

// hooks/useGameLog.ts (já existe ✅)
export function useGameLog() {
  const gameMessage = useLogStore(state => state.gameMessage);
  const addGameLogMessage = useLogStore(state => state.addGameLogMessage);

  return { gameMessage, gameLog, addGameLogMessage };
}

// hooks/useGameCharacters.ts
export function useGameCharacters() {
  const characters = useCharacterStore(state => state.characters);
  const selectedCharacter = useCharacterStore(state => state.selectedCharacter);

  return { characters, selectedCharacter };
}

// hooks/useGame.ts - Mantido como "convenience wrapper"
export function useGame() {
  const gameState = useGameState();
  const gameLog = useGameLog();
  const characters = useGameCharacters();

  return { ...gameState, ...gameLog, ...characters };
}
```

#### Uso nos Componentes

```typescript
// ✅ BOM: Hook específico (re-render apenas quando gameMessage muda)
function GameLogDisplay() {
  const { gameMessage } = useGameLog();
  return <div>{gameMessage}</div>;
}

// ⚠️ FUNCIONA MAS NÃO IDEAL: Hook agregador
function GameLogDisplay() {
  const { gameMessage } = useGame(); // Re-render desnecessário
  return <div>{gameMessage}</div>;
}
```

#### Checklist

- [ ] Hooks granulares criados
- [ ] Componentes migrados para hooks específicos
- [ ] Performance validada (menos re-renders)
- [ ] Documentação atualizada

#### Estimativa

- **Esforço:** 2-3 dias
- **Risco:** Baixo
- **ROI:** Médio (performance)

---

## Fase 3: Otimizações (Baixa Prioridade)

### P7: Consolidar Validações ⚪

**Problema:** Validações repetidas em 3+ lugares

#### Criar Validators Centralizados

```typescript
// utils/validators/character-validators.ts
export class CharacterValidators {
  static validateName(name: string): ValidationResult {
    if (!name || name.trim().length === 0) {
      return { isValid: false, error: 'Nome não pode ser vazio' };
    }

    if (name.length < 3) {
      return { isValid: false, error: 'Nome deve ter no mínimo 3 caracteres' };
    }

    if (name.length > 20) {
      return { isValid: false, error: 'Nome deve ter no máximo 20 caracteres' };
    }

    return { isValid: true };
  }

  static validateHpMana(hp: number, mana: number, character: Character): ValidationResult {
    if (hp < 0 || hp > character.max_hp) {
      return { isValid: false, error: 'HP inválido' };
    }

    if (mana < 0 || mana > character.max_mana) {
      return { isValid: false, error: 'Mana inválida' };
    }

    return { isValid: true };
  }
}
```

#### Estimativa

- **Esforço:** 1-2 dias
- **Risco:** Baixo
- **ROI:** Baixo (limpeza de código)

---

### P8: Padronizar Conversões ⚪

**Problema:** Conversões `Character ↔ GamePlayer` duplicadas

#### Solução

```typescript
// utils/converters/character-converters.ts
export class CharacterConverters {
  static toGamePlayer(character: Character): GamePlayer {
    return {
      id: character.id,
      user_id: character.user_id,
      name: character.name,
      level: character.level,
      // ... mapeamento completo
    };
  }

  static fromGamePlayer(gamePlayer: GamePlayer): Partial<Character> {
    return {
      id: gamePlayer.id,
      user_id: gamePlayer.user_id,
      name: gamePlayer.name,
      // ... mapeamento reverso
    };
  }
}
```

#### Estimativa

- **Esforço:** 1 dia
- **Risco:** Baixo
- **ROI:** Baixo (consistência)

---

## Métricas de Sucesso

### Antes da Refatoração

| Métrica                        | Valor Atual                          |
| ------------------------------ | ------------------------------------ |
| Services acessando stores      | ~25 ocorrências                      |
| Arquivos > 1000 linhas         | 5 arquivos                           |
| Duplicação de código           | performAction (2x), validações (3x+) |
| Camadas de cache               | 3 não sincronizadas                  |
| Complexidade ciclomática média | ~15                                  |
| Tempo de build                 | ~8s                                  |

### Após Refatoração (Metas)

| Métrica                        | Meta                         |
| ------------------------------ | ---------------------------- |
| Services acessando stores      | **0 ocorrências** ✅         |
| Arquivos > 800 linhas          | **0 arquivos** ✅            |
| Duplicação de código           | **Eliminada** ✅             |
| Camadas de cache               | **1 unificada (Zustand)** ✅ |
| Complexidade ciclomática média | **< 10** ✅                  |
| Tempo de build                 | **< 10s** (aceitável)        |
| Cobertura de testes            | **> 60%** (novo) ✅          |

---

## Checklist de Validação

### Antes de Cada Refatoração

- [ ] Branch criada (`refactor/nome-da-task`)
- [ ] Testes existentes passando
- [ ] Documentação lida e entendida
- [ ] Plan de rollback definido

### Durante a Refatoração

- [ ] Commits frequentes e atômicos
- [ ] Testes adicionados/atualizados
- [ ] Logs de debug removidos
- [ ] Código revisado (self-review)

### Após Cada Refatoração

- [ ] Todos os testes passando
- [ ] Build sem erros
- [ ] Performance não degradou
- [ ] UI funcionando corretamente
- [ ] Documentação atualizada
- [ ] PR criado e aprovado
- [ ] Merge para main

---

## Referências

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Arquitetura atual
- [CODE_STANDARDS.md](./CODE_STANDARDS.md) - Padrões de código
- [DEPENDENCIES_MAP.md](./DEPENDENCIES_MAP.md) - Mapa de dependências

---

**Última atualização:** 2025-01-20  
**Próxima revisão:** Após conclusão da Fase 1
