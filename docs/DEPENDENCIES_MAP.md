# Mapa de Dependências - Tower Trials

> **Versão:** 1.0  
> **Data:** 2025-01-20  
> **Status:** Documentação Oficial do Fluxo de Dados

## Índice

1. [Visão Geral](#visão-geral)
2. [Grafo de Dependências](#grafo-de-dependências)
3. [Fluxos de Dados Principais](#fluxos-de-dados-principais)
4. [Stores e suas Responsabilidades](#stores-e-suas-responsabilidades)
5. [Services e Integrações](#services-e-integrações)
6. [Features e Isolamento](#features-e-isolamento)
7. [Dependências Circulares](#dependências-circulares)
8. [Otimizações de Cache](#otimizações-de-cache)

---

## Visão Geral

Este documento mapeia como os dados fluem pela aplicação Tower Trials, identificando:

- ✅ Fontes de dados (Supabase, Stores, Cache)
- ✅ Transformações (Services)
- ✅ Consumidores (Components, Hooks)
- ⚠️ Dependências circulares (problemas conhecidos)
- ⚠️ Gargalos de performance

---

## Grafo de Dependências

### Camadas da Aplicação

```
┌─────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Features │  │Components│  │  Routes  │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       └─────────────┼─────────────┘                     │
│                     │ use hooks                          │
└─────────────────────┼─────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│                    STATE LAYER                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Hooks   │  │  Stores  │  │  Cache   │              │
│  │ (custom) │  │ (Zustand)│  │ (memory) │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       └─────────────┼─────────────┘                     │
│                     │ call services                      │
└─────────────────────┼─────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│                   BUSINESS LOGIC LAYER                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Services (25 services)                          │  │
│  │  - CharacterService                              │  │
│  │  - BattleService                                 │  │
│  │  - GameService                                   │  │
│  │  - ... 22 outros                                 │  │
│  └────┬─────────────────────────────────────────────┘  │
│       │ make API calls                                  │
└───────┼─────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────┐
│                    DATA ACCESS LAYER                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Supabase Client                                 │  │
│  │  - PostgreSQL                                    │  │
│  │  - RPC Functions                                 │  │
│  │  - Auth                                          │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Fluxos de Dados Principais

### 1. Fluxo de Autenticação

```
Login Page
   ↓
AuthService.signIn()
   ↓
Supabase Auth
   ↓
AuthContext (user state)
   ↓
Protected Routes
   ↓
Load User Data
```

**Arquivos envolvidos:**

- `src/resources/auth/auth-service.ts`
- `src/resources/auth/auth-provider.tsx`
- `src/resources/auth/auth-hook.ts`
- `src/routes/_authenticated.tsx`

### 2. Fluxo de Carregamento de Personagem

```
Character Select (UI)
   ↓
useCharacterStore.selectCharacter(id)
   ↓
CharacterService.getCharacter(id)
   ├─→ Check Cache (CharacterCacheService)
   │   └─→ Return if valid
   └─→ Supabase RPC (get_character_full_stats)
       └─→ Update Cache
           └─→ Update Store (useCharacterStore)
               └─→ Update UI
```

**Arquivos envolvidos:**

- `src/features/character/CharacterSelect.tsx`
- `src/stores/useCharacterStore.tsx`
- `src/services/character.service.ts`
- `src/services/character-cache.service.ts`
- Supabase: `get_character_full_stats` (RPC function)

### 3. Fluxo de Batalha (Ataque)

```
BattleArena (Button Click)
   ↓
useBattleActions().performAction('attack')
   ↓
useBattleStore.performAction('attack')
   ├─→ Validations (debounce, isProcessing, gameMode)
   ├─→ Update state (isProcessing = true)
   ├─→ BattleService.processPlayerAction()
   │   ├─→ Calculate damage
   │   ├─→ Apply effects
   │   ├─→ Update enemy HP
   │   └─→ Return new state
   ├─→ Update gameState (useGameStateStore)
   ├─→ Add logs (useLogStore)
   ├─→ Check if enemy defeated
   │   └─→ GameService.processEnemyDefeat()
   │       └─→ RewardService.processRewards()
   │           └─→ Update character XP/Gold
   └─→ Process enemy turn (if alive)
       └─→ BattleService.processEnemyAction()
           └─→ Update player HP
               └─→ Check if player died
                   └─→ Game Over
```

**Arquivos envolvidos:**

- `src/features/battle/BattleArena.tsx`
- `src/stores/useBattleStore.tsx` (693 linhas)
- `src/stores/useGameStateStore.tsx`
- `src/stores/useLogStore.tsx`
- `src/services/battle.service.ts` (1366 linhas)
- `src/services/game.service.ts`
- `src/services/reward.service.ts`

### 4. Fluxo de Progressão de Andar

```
Hub (Click "Explorar")
   ↓
GameStateService.advanceToNextFloor()
   ├─→ FloorService.getFloorData(newFloorNumber)
   │   └─→ Supabase RPC (get_floor_data)
   ├─→ Check floor type
   │   ├─→ 'event' → Generate special event
   │   └─→ 'common'/'elite'/'boss' → Generate enemy
   │       └─→ MonsterService.getEnemyForFloor()
   │           └─→ Supabase RPC (get_enemy_for_floor)
   └─→ Update gameState (mode = 'battle')
       └─→ BattleInitializationService.initializeBattle()
           └─→ Load character spells, consumables
               └─→ Navigate to /game/battle
```

**Arquivos envolvidos:**

- `src/features/hub/ActionMenuGrid.tsx`
- `src/services/game-state.service.ts`
- `src/services/floor.service.ts`
- `src/services/monster.service.ts`
- `src/services/battle-initialization.service.ts`
- Supabase: `get_floor_data`, `get_enemy_for_floor` (RPC functions)

---

## Stores e suas Responsabilidades

### Mapa de Stores

```
useGameStateStore (218 linhas)
├── gameState: GameState
│   ├── mode: GameMode
│   ├── player: GamePlayer
│   ├── currentEnemy: Enemy | null
│   ├── currentFloor: Floor | null
│   └── currentSpecialEvent: SpecialEvent | null
├── loading: GameLoadingState
└── error: string | null
│
└─→ USADO POR: Todos os componentes de jogo
    └─→ ATUALIZADO POR: Services (via stores)

useBattleStore (693 linhas)
├── isProcessingAction: boolean
├── currentTurnType: 'player' | 'enemy' | null
├── battlePhase: BattlePhase
├── turnCount: number
└── performAction: (action) => Promise<void>
│
└─→ USADO POR: Componentes de batalha
    └─→ CHAMA: BattleService, GameService

useCharacterStore (512 linhas)
├── characters: Character[]
├── selectedCharacter: Character | null
├── cacheTimestamps: Record<string, number>
└── pendingRequests: Map<string, Promise>
│
└─→ USADO POR: CharacterSelect, Hub, Battle
    └─→ CHAMA: CharacterService
    └─→ PERSISTE: localStorage

useLogStore (684 linhas)
├── gameLogs: ExtendedGameLogEntry[]
├── debugLogs: ExtendedGameLogEntry[]
├── filteredLogs: ExtendedGameLogEntry[]
└── logStats: LogStats
│
└─→ USADO POR: GameLog, BattleArena
    └─→ PERSISTE: localStorage (últimos 100 logs)

useGameStore (371 linhas)
├── isProcessingAction: boolean
├── lastActionTimestamp: number
├── availableCharacters: Character[]
└── sessionId: string | null
│
└─→ USADO POR: Poucos componentes (legado?)
    └─→ DUPLICA: performAction (⚠️ PROBLEMA)

useCharacterListStore (deprecated?)
└─→ SUBSTITUÍDO POR: useCharacterStore

useCharacterSelectionStore (deprecated?)
└─→ SUBSTITUÍDO POR: useCharacterStore

useEventStore
├── currentEvent: SpecialEvent | null
└── eventHistory: SpecialEvent[]
│
└─→ USADO POR: EventPanel

useMonsterStore
├── monsters: Map<string, Enemy>
└── cache: timestamps
│
└─→ USADO POR: MonsterService
```

### Dependências entre Stores

```
┌──────────────────┐
│useGameStateStore │ ← Estado central
└────────┬─────────┘
         │ read by
    ┌────┼────┐
    │    │    │
    ↓    ↓    ↓
┌────────┐ ┌──────────┐ ┌──────────┐
│Battle  │ │Character │ │  Log     │
│Store   │ │Store     │ │ Store    │
└────────┘ └──────────┘ └──────────┘
```

**⚠️ PROBLEMA IDENTIFICADO:**

- Stores acessam outros stores via `.getState()`
- Cria acoplamento
- Dificulta testes

**✅ SOLUÇÃO PROPOSTA:**

- Stores comunicam via eventos (Zustand subscribeWithSelector)
- Ou via hooks de orquestração

---

## Services e Integrações

### Mapa de Services (25 services)

#### Character Domain

```
CharacterService (1328 linhas) ⚠️ GRANDE
├── getUserCharacters()
├── getCharacter()
├── createCharacter()
├── deleteCharacter()
└── getCharacterForGame()
    │
    └─→ CHAMA:
        ├── CharacterCacheService (cache)
        ├── CharacterStatsService (cálculos)
        ├── CharacterProgressionService (XP/Level)
        ├── CharacterHealingService (HP/Mana)
        ├── EquipmentService (bônus)
        └── SpellService (magias)
```

#### Battle Domain

```
BattleService (1366 linhas) ⚠️ GRANDE
├── processPlayerAction()
├── processEnemyAction()
├── calculateDamage()
└── calculateInitiative()
    │
    └─→ CHAMA:
        ├── SkillXpService (skill progression)
        ├── SpellService (spell effects)
        ├── EquipmentService (equipment bonuses)
        ├── ConsumableService (potions)
        └── MonsterService (enemy data)

BattleInitializationService
└── initializeBattle()
    └─→ Carrega dados completos para batalha

BattleLoggerService
└── logBattleEvent()
    └─→ Adiciona logs formatados
```

#### Game Domain

```
GameService
├── generateEnemy()
├── loadPlayerForGame()
├── processEnemyDefeat()
└── advanceToNextFloor()
    │
    └─→ CHAMA:
        ├── MonsterService
        ├── FloorService
        ├── RewardService
        └── GameStateService

GameStateService
├── loadPlayerForGame()
├── advanceToNextFloor()
└── resetGameState()

FloorService
├── getFloorData()
└── processSpecialEventInteraction()
```

#### Support Services

```
CacheService
├── clearAllGameCaches()
└── getCachedData()

SkillXpService
├── applySkillXp()
├── calculateSkillXpRequired()
└── getSkillDisplayName()

RewardService
├── processEnemyDefeat()
├── grantXp()
└── grantGold()

RankingService
├── getGlobalRanking()
├── saveScore()
└── countRankingEntries()
```

### Dependências entre Services

```
                    GameService
                         ↓
        ┌────────────────┼────────────────┐
        ↓                ↓                ↓
  MonsterService   FloorService    RewardService
        │                                  │
        │                                  ↓
        └──────────────→ CharacterService ←┘
                              │
              ┌───────────────┼───────────────┐
              ↓               ↓               ↓
     CharacterStats  CharacterHealing  Equipment
        Service          Service         Service
```

**⚠️ PROBLEMAS IDENTIFICADOS:**

1. **Services acessando Stores:**

   - 25+ ocorrências de `.getState()`
   - Viola separação de camadas

2. **Services muito grandes:**

   - `CharacterService`: 1328 linhas
   - `BattleService`: 1366 linhas
   - Devem ser quebrados em módulos

3. **Duplicação de lógica:**
   - Auto-heal em múltiplos services
   - Validações repetidas

---

## Features e Isolamento

### Princípio: Features Isoladas

Cada feature deve ser auto-contida e comunicar via stores/services.

```
features/
├── battle/          ✅ BEM ISOLADA
│   ├── components/
│   ├── hooks/
│   └── (sem imports de outras features)
│
├── character/       ✅ BEM ISOLADA
│   ├── components/
│   └── (usa apenas stores/services)
│
├── equipment/       ✅ BEM ISOLADA
├── consumable/      ✅ BEM ISOLADA
├── hub/             ✅ BEM ISOLADA
└── inventory/       ✅ BEM ISOLADA
```

### Comunicação entre Features

```
Feature A          Feature B
   ↓                  ↓
   └─→ Store ←───────┘
         ↓
      Service
         ↓
      Supabase
```

**✅ BOM:** Features não se importam diretamente  
**❌ RUIM:** `import { Something } from '@/features/other-feature'`

---

## Dependências Circulares

### Problemas Conhecidos (RESOLVIDOS)

#### 1. CharacterProvider Loop (RESOLVIDO)

**Problema Original:**

```typescript
// ❌ DEPENDÊNCIA CIRCULAR
const initializeSpecialEvent = useCallback(
  async (character, eventKey) => {
    await initializeBattle(character, ...); // Chama initializeBattle
  },
  [initializeBattle] // ❌ Dependência de initializeBattle
);

const contextValue = useMemo(
  () => ({ initializeBattle, initializeSpecialEvent }),
  [initializeBattle, initializeSpecialEvent] // ❌ CIRCULAR!
);
```

**Solução Implementada:**

```typescript
// ✅ SEM DEPENDÊNCIA CIRCULAR
const initializeSpecialEvent = useCallback(
  async (character, eventKey) => {
    // Fallback direto via serviço
    const result = await BattleInitializationService.initializeBattle(character);
  },
  [selectedCharacter?.id, setGameState] // ✅ Apenas primitivos
);

const contextValue = useMemo(
  () => ({
    /* functions */
  }),
  [
    characters.length, // ✅ Apenas primitivos
    selectedCharacter?.id, // ✅ Apenas primitivos
    // REMOVIDO: funções
  ]
);
```

**Documentação:** `docs/SOLUTION_BATTLE_LOOP_FIX.md`

#### 2. Services ↔ Stores (PENDENTE)

**Problema Atual:**

```
BattleService
   ├─→ import { useBattleStore } from '@/stores/useBattleStore'
   └─→ useBattleStore.getState().player

useBattleStore
   ├─→ import { BattleService } from '@/services/battle.service'
   └─→ BattleService.processPlayerAction()
```

**Solução Planejada:**

- Services NÃO devem importar stores
- Dados passados via parâmetros
- Hooks fazem a ponte

**Status:** Ver `REFACTORING_GUIDE.md` - Fase 2.1

---

## Otimizações de Cache

### Sistema de Cache em 3 Camadas (ATUAL)

```
┌─────────────────────────────────────┐
│  Layer 1: CharacterCacheService     │
│  - Em memória (Map)                 │
│  - Timestamps de expiração          │
│  - Pending requests                 │
└───────────┬─────────────────────────┘
            │ (sem sincronização)
            ↓
┌─────────────────────────────────────┐
│  Layer 2: useCharacterStore         │
│  - Zustand state                    │
│  - Persist localStorage             │
└───────────┬─────────────────────────┘
            │ (sincronização manual)
            ↓
┌─────────────────────────────────────┐
│  Layer 3: Supabase Cache            │
│  - HTTP cache                       │
│  - RPC results                      │
└─────────────────────────────────────┘
```

**⚠️ PROBLEMAS:**

- Dados desatualizados entre camadas
- Complexidade de invalidação
- Risco de inconsistência

### Sistema Proposto (FUTURO)

```
┌─────────────────────────────────────┐
│  useCharacterStore (Zustand)        │
│  ┌─────────────────────────────────┐│
│  │ State:                          ││
│  │ - characters: Character[]       ││
│  │ - cacheTimestamps: Record       ││
│  │ - pendingRequests: Map          ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │ Actions:                        ││
│  │ - getCachedCharacter()          ││
│  │ - invalidateCache()             ││
│  └─────────────────────────────────┘│
└───────────┬─────────────────────────┘
            │ FONTE ÚNICA DE VERDADE
            ↓
┌─────────────────────────────────────┐
│  Supabase (source of truth remota)  │
└─────────────────────────────────────┘
```

**✅ BENEFÍCIOS:**

- Cache unificado
- Invalidação simples
- Menos bugs

**Status:** Ver `REFACTORING_GUIDE.md` - Fase 2.3

---

## Fluxo de Dados por Feature

### Battle Feature

```
BattleArena.tsx
   ↓ use
useBattleActions()
   ↓ select
useBattleStore
   ├─→ State: isProcessing, currentTurn, battlePhase
   └─→ Actions: performAction, resetBattle
       ↓ call
   BattleService
       ├─→ calculateDamage()
       ├─→ processPlayerAction()
       └─→ processEnemyAction()
           ↓ update
       useGameStateStore
           ├─→ player.hp
           ├─→ enemy.hp
           └─→ battleRewards
               ↓ persist
           Supabase
               └─→ update characters table
```

### Character Feature

```
CharacterSelect.tsx
   ↓ use
useCharacterManagement()
   ↓ combine
┌─────────────┬──────────────┐
│             │              │
↓             ↓              ↓
useCharacter  useCharacter   useAuth
WithAuth      Selection
   ↓             ↓
useCharacterStore
   ├─→ State: characters, selectedCharacter
   └─→ Actions: loadCharacters, selectCharacter
       ↓ call
   CharacterService
       ├─→ getCharacter()
       ├─→ getUserCharacters()
       └─→ createCharacter()
           ↓ RPC
       Supabase
           ├─→ get_character_full_stats
           ├─→ get_user_characters
           └─→ create_character
```

### Equipment Feature

```
EquipmentPanel.tsx
   ↓ use
useEquipment()
   ↓
EquipmentService
   ├─→ getCharacterEquipment()
   ├─→ equipItem()
   ├─→ unequipItem()
   └─→ getEquipmentBonuses()
       ↓ RPC
   Supabase
       ├─→ get_character_equipment
       ├─→ equip_item
       └─→ calculate_equipment_bonuses
```

---

## Métricas de Dependências

### Análise Atual

| Categoria                          | Quantidade | Status                  |
| ---------------------------------- | ---------- | ----------------------- |
| Total Services                     | 25         | ⚠️ Alguns muito grandes |
| Services > 1000 linhas             | 5          | ⚠️ Devem ser quebrados  |
| Stores Zustand                     | 9          | ✅ Bem organizados      |
| Stores com persist                 | 2          | ✅ Estratégico          |
| Custom Hooks                       | 12         | ✅ Bom número           |
| Features isoladas                  | 7          | ✅ Bem isoladas         |
| Dependências circulares conhecidas | 1          | ⚠️ Services ↔ Stores   |
| Camadas de cache                   | 3          | ⚠️ Devem ser unificadas |

### Metas Pós-Refatoração

| Categoria                 | Meta        |
| ------------------------- | ----------- |
| Services > 800 linhas     | 0           |
| Dependências circulares   | 0           |
| Camadas de cache          | 1 (Zustand) |
| Coverage de testes        | > 60%       |
| Acesso stores em services | 0           |

---

## Referências

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Visão geral da arquitetura
- [REFACTORING_GUIDE.md](./REFACTORING_GUIDE.md) - Plano de melhorias
- [CODE_STANDARDS.md](./CODE_STANDARDS.md) - Padrões de código
- [SOLUTION_BATTLE_LOOP_FIX.md](./SOLUTION_BATTLE_LOOP_FIX.md) - Correção de loop

---

**Última atualização:** 2025-01-20  
**Próxima revisão:** Após refatorações da Fase 1
