# Arquitetura - Tower Trials

> **Versão:** 1.0  
> **Última atualização:** 2025-01-20  
> **Status:** Documentação oficial da arquitetura atual

## Índice

1. [Visão Geral](#visão-geral)
2. [Stack Tecnológico](#stack-tecnológico)
3. [Estrutura de Pastas](#estrutura-de-pastas)
4. [Padrões de Arquitetura](#padrões-de-arquitetura)
5. [Fluxo de Dados](#fluxo-de-dados)
6. [Gerenciamento de Estado](#gerenciamento-de-estado)
7. [Camadas da Aplicação](#camadas-da-aplicação)
8. [Convenções e Boas Práticas](#convenções-e-boas-práticas)
9. [Problemas Conhecidos](#problemas-conhecidos)

---

## Visão Geral

**Tower Trials** é um RPG roguelike baseado em turnos desenvolvido como Progressive Web App (PWA). A arquitetura segue princípios de **Component-Driven Development** com foco em:

- ✅ **Type Safety** (TypeScript estrito)
- ✅ **Estado Previsível** (Zustand + Immer)
- ✅ **Separação de Responsabilidades** (Features isoladas)
- ✅ **Performance** (Lazy loading, cache em camadas)
- ✅ **PWA** (Offline-first, Service Worker)

### Características Principais

- **Frontend SPA**: React 19 + Vite
- **Roteamento**: TanStack Router v1 (type-safe)
- **Estado Global**: Zustand (9 stores especializados)
- **Backend**: Supabase (PostgreSQL + RPC functions)
- **Estilização**: Tailwind CSS v4 + shadcn/ui
- **Build**: Vite 6 com code splitting otimizado

---

## Stack Tecnológico

### Core

| Tecnologia      | Versão   | Uso                  |
| --------------- | -------- | -------------------- |
| React           | 19.1.0   | UI Framework         |
| TypeScript      | 5.8.3    | Type Safety          |
| Vite            | 6.3.5    | Build Tool           |
| TanStack Router | 1.120.18 | Roteamento Type-Safe |
| Zustand         | 5.0.5    | Estado Global        |
| Immer           | 10.1.1   | Imutabilidade        |
| Supabase        | 2.50.0   | Backend & Auth       |

### UI & Estilização

- **Tailwind CSS** 4.1.8 - Utility-first CSS
- **Radix UI** - Componentes acessíveis
- **shadcn/ui** - Sistema de design
- **Framer Motion** 12.6.3 - Animações
- **Lucide React** - Ícones

### Ferramentas de Desenvolvimento

- **ESLint** 9.25.0 - Linting
- **Prettier** 3.5.3 - Formatação
- **TypeScript ESLint** 8.30.1 - Type linting

---

## Estrutura de Pastas

```
src/
├── assets/              # Recursos estáticos (imagens, ícones)
├── components/          # Componentes reutilizáveis
│   ├── core/           # Componentes fundamentais (Header, Footer)
│   ├── hocs/           # Higher-Order Components (auth guards)
│   ├── providers/      # Context Providers
│   ├── ui/             # 43 componentes UI base (shadcn/ui)
│   └── shop/           # Componentes específicos de loja
├── features/            # Features isoladas por domínio
│   ├── battle/         # Sistema de batalha (13 arquivos)
│   ├── character/      # Gestão de personagens (8 arquivos)
│   ├── consumable/     # Sistema de consumíveis (4 arquivos)
│   ├── equipment/      # Sistema de equipamentos (5 arquivos)
│   ├── hub/            # Hub do jogo (4 arquivos)
│   ├── inventory/      # Inventário (3 arquivos)
│   └── monster/        # Visualização de monstros (1 arquivo)
├── hooks/               # 12 custom hooks
├── lib/                 # Integrações externas (Supabase)
├── models/              # 8 modelos TypeScript
├── routes/              # Definição de rotas (TanStack Router)
├── services/            # 25 services - lógica de negócio
├── stores/              # 9 Zustand stores
├── utils/               # Utilitários puros
├── config/              # Configurações
└── main.tsx             # Entry point
```

### Organização por Domínio (Features)

Cada feature é **auto-contida** e possui:

```
features/battle/
├── BattleArena.tsx          # UI principal
├── BattleHeader.tsx         # Componente de apresentação
├── CombinedBattleInterface.tsx
├── GameLog.tsx
├── SpecialEventPanel.tsx
└── ...
```

**Princípio**: Features não devem importar de outras features diretamente. Comunicação via stores/services.

---

## Padrões de Arquitetura

### 1. **Component-Driven Development**

Hierarquia de componentes clara:

```
Pages (routes/)
  ↓
Features (features/)
  ↓
Components (components/)
  ↓
UI Base (components/ui/)
```

### 2. **Service Layer Pattern**

Services encapsulam:

- ✅ Lógica de negócio
- ✅ Comunicação com API (Supabase)
- ✅ Transformação de dados
- ✅ Validações complexas

**Exemplo:**

```typescript
// character.service.ts
export class CharacterService {
  static async getCharacter(id: string): Promise<ServiceResponse<Character>> {
    // Lógica isolada e testável
  }
}
```

### 3. **Store Pattern (Zustand)**

Estado global dividido em **stores especializados**:

```typescript
// useBattleStore.tsx
export const useBattleStore = create<BattleStore>()(
  subscribeWithSelector((set, get) => ({
    // Estado + Ações
  }))
);
```

### 4. **Custom Hooks Pattern**

Hooks encapsulam lógica reutilizável:

```typescript
// useCharacter.ts
export function useCharacter(characterId: string) {
  // Lógica de acesso a dados
  // Efeitos colaterais
  // Retorna interface simplificada
}
```

---

## Fluxo de Dados

### Arquitetura de 3 Camadas

```
┌─────────────────────────────────────────┐
│  UI LAYER (Components/Features)         │
│  - Apresentação                          │
│  - User interactions                     │
└─────────────┬───────────────────────────┘
              │ Dispatch actions / Read state
              ↓
┌─────────────────────────────────────────┐
│  STATE LAYER (Zustand Stores)           │
│  - Estado global                         │
│  - Seletores otimizados                 │
│  - Middleware (persist, devtools)       │
└─────────────┬───────────────────────────┘
              │ Call services
              ↓
┌─────────────────────────────────────────┐
│  SERVICE LAYER (Services)               │
│  - Lógica de negócio                    │
│  - API calls (Supabase)                 │
│  - Transformações de dados              │
└─────────────────────────────────────────┘
```

### Fluxo de Exemplo: Atacar Inimigo

```
1. User clica em "Atacar"
   ↓
2. BattleArena.tsx → useBattleActions().performAction('attack')
   ↓
3. useBattleStore → chama BattleService.processPlayerAction()
   ↓
4. BattleService → calcula dano, atualiza HP
   ↓
5. BattleService → retorna novo estado
   ↓
6. useBattleStore → atualiza estado via set()
   ↓
7. Componentes re-renderizam (somente os afetados)
```

---

## Gerenciamento de Estado

### Stores Zustand (9 stores)

| Store                        | Responsabilidade                     | Persist | Linhas |
| ---------------------------- | ------------------------------------ | ------- | ------ |
| `useBattleStore`             | Controle de turnos, ações de batalha | ❌      | 693    |
| `useGameStore`               | Estado geral do jogo, sessão         | ❌      | 371    |
| `useGameStateStore`          | Player, enemy, floor atual           | ❌      | 218    |
| `useCharacterStore`          | Lista de personagens, seleção        | ✅      | 512    |
| `useLogStore`                | Sistema de logs do jogo              | ✅      | 684    |
| `useCharacterListStore`      | (Deprecated?)                        | -       | -      |
| `useCharacterSelectionStore` | (Deprecated?)                        | -       | -      |
| `useEventStore`              | Eventos especiais                    | ❌      | -      |
| `useMonsterStore`            | Cache de monstros                    | ❌      | -      |

### Middleware Utilizado

#### subscribeWithSelector

```typescript
// Permite seletores otimizados
const hp = useBattleStore(state => state.player.hp);
// Re-render APENAS quando hp muda
```

#### persist

```typescript
// Salva estado no localStorage
persist(
  (set, get) => ({
    /* store */
  }),
  {
    name: 'character-storage',
    partialize: state => ({
      /* escolhe o que persiste */
    }),
  }
);
```

#### immer (produce)

```typescript
// Mutação "segura" do estado
set(
  produce(draft => {
    draft.player.hp = 100; // Parece mutação, mas cria cópia imutável
  })
);
```

---

## Camadas da Aplicação

### 1. Presentation Layer (UI)

**Localização:** `src/components/`, `src/features/`

**Responsabilidades:**

- Renderizar UI
- Capturar eventos do usuário
- Consumir hooks/stores
- **NÃO** conter lógica de negócio

**Exemplo:**

```typescript
export function BattleArena() {
  const { performAction } = useBattleActions();

  return (
    <button onClick={() => performAction('attack')}>
      Atacar
    </button>
  );
}
```

### 2. State Management Layer

**Localização:** `src/stores/`, `src/hooks/`

**Responsabilidades:**

- Gerenciar estado global
- Fornecer seletores otimizados
- Orquestrar chamadas a services
- Cache em memória

**Exemplo:**

```typescript
// useBattleStore.tsx
performAction: async action => {
  set(
    produce(draft => {
      draft.isProcessing = true;
    })
  );
  const result = await BattleService.processAction(action);
  set(
    produce(draft => {
      Object.assign(draft, result);
    })
  );
};
```

### 3. Business Logic Layer

**Localização:** `src/services/`

**Responsabilidades:**

- Validações de negócio
- Cálculos complexos
- Transformação de dados
- Integração com backend

**Exemplo:**

```typescript
// battle.service.ts
export class BattleService {
  static calculateDamage(attacker: Character, defender: Enemy): number {
    const baseDamage = attacker.atk - defender.def;
    const critChance = attacker.critical_chance;
    // ... lógica complexa
    return finalDamage;
  }
}
```

### 4. Data Access Layer

**Localização:** `src/lib/supabase.ts`, funções RPC

**Responsabilidades:**

- Conexão com Supabase
- Queries otimizadas
- Autenticação
- Real-time subscriptions (futuro)

---

## Convenções e Boas Práticas

### Nomenclatura

#### Arquivos

- **Componentes:** PascalCase → `BattleArena.tsx`
- **Hooks:** camelCase → `useCharacter.ts`
- **Services:** kebab-case → `character.service.ts`
- **Stores:** camelCase → `useBattleStore.tsx`
- **Utils:** kebab-case → `number-utils.ts`

#### Código

- **Interfaces/Types:** PascalCase → `Character`, `GameState`
- **Funções:** camelCase → `calculateDamage()`
- **Constantes:** UPPER_SNAKE_CASE → `MAX_HP`, `BASE_DAMAGE`
- **Componentes:** PascalCase → `BattleArena`

### Estrutura de Services

```typescript
// ✅ BOM: Service como classe estática
export class CharacterService {
  // Cache privado
  private static cache = new Map();

  // Métodos públicos
  static async getCharacter(id: string) {}
  static async createCharacter(data: CreateDTO) {}

  // Métodos privados
  private static validateData(data: unknown) {}
}
```

### Estrutura de Stores

```typescript
// ✅ BOM: Separar state, actions e types
interface BattleState {
  isProcessing: boolean;
  currentTurn: string;
}

interface BattleActions {
  performAction: (action: ActionType) => Promise<void>;
  resetBattle: () => void;
}

type BattleStore = BattleState & BattleActions;

export const useBattleStore = create<BattleStore>()(
  subscribeWithSelector((set, get) => ({
    // Estado inicial
    isProcessing: false,
    currentTurn: 'player',

    // Ações
    performAction: async action => {},
    resetBattle: () => {},
  }))
);

// Seletores customizados
export const useBattleState = () =>
  useBattleStore(state => ({
    isProcessing: state.isProcessing,
    currentTurn: state.currentTurn,
  }));
```

### Estrutura de Hooks

```typescript
// ✅ BOM: Hook com propósito único e bem definido
export function useCharacter(characterId: string) {
  const character = useCharacterStore(state => state.characters.find(c => c.id === characterId));

  const { updateCharacter } = useCharacterStore();

  // Efeitos colaterais (se necessário)
  useEffect(() => {
    // Carregar dados se não existir
  }, [characterId]);

  // Interface simplificada
  return {
    character,
    updateCharacter,
    isLoading: !character,
  };
}
```

### Error Handling

```typescript
// ✅ BOM: Retornar ServiceResponse tipado
interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

// Services sempre retornam este padrão
static async getCharacter(id: string): Promise<ServiceResponse<Character>> {
  try {
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return { data, error: null, success: true };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false
    };
  }
}
```

---

## Problemas Conhecidos

### 🚨 Críticos

#### 1. Services Acessando Stores Diretamente

**Problema:** ~25 services chamam `useXXXStore.getState()`

```typescript
// ❌ ANTI-PATTERN
export class CharacterService {
  static async doSomething() {
    const store = useCharacterStore.getState(); // ❌ Acoplamento
    const gameState = useGameStateStore.getState(); // ❌ Viola separação
  }
}
```

**Solução planejada:** Ver `REFACTORING_GUIDE.md` - Fase 2.1

#### 2. Dependências Circulares Residuais

**Problema:** Services importam stores, stores importam services

**Status:** Parcialmente mitigado (ver `docs/SOLUTION_BATTLE_LOOP_FIX.md`)

**Solução planejada:** Camada de abstração entre stores e services

### ⚠️ Médios

#### 3. Duplicação de `performAction`

**Localização:**

- `useBattleStore.tsx` linha 90
- `useGameStore.tsx` linha 154

**Impacto:** Risco de inconsistência

**Solução planejada:** Consolidar em `useBattleStore` (ver REFACTORING_GUIDE.md)

#### 4. Sistema de Cache em 3 Camadas

**Problema:**

- `CharacterCacheService` (em memória)
- `useCharacterStore` (Zustand + localStorage)
- Pending requests cache

**Solução planejada:** Unificar em Zustand (Fase 2.3)

#### 5. Arquivos Muito Grandes

**Arquivos > 1000 linhas:**

- `character.service.ts`: 1328 linhas
- `battle.service.ts`: 1366 linhas
- `consumable.service.ts`: 914 linhas
- `spell.service.ts`: 1062 linhas
- `game-battle.tsx`: 1178 linhas

**Solução planejada:** Quebrar em módulos (Fase 3.1)

### ℹ️ Baixos

#### 6. Hooks Agregadores Grandes

**Problema:** `useGame.ts` retorna 15+ propriedades

**Impacto:** Re-renders desnecessários

**Solução:** Criar hooks granulares

---

## Decisões de Design

### Por que Zustand e não Redux?

✅ **Vantagens:**

- Menos boilerplate
- Performance superior (subscribeWithSelector)
- TypeScript nativo
- Menor bundle size
- API mais simples

### Por que TanStack Router?

✅ **Vantagens:**

- Type-safe routing
- File-based routing automático
- Melhor performance que React Router
- Built-in code splitting

### Por que Supabase?

✅ **Vantagens:**

- PostgreSQL (relacional robusto)
- RPC functions (lógica no servidor)
- Auth integrado
- Real-time ready
- Open source

### Por que Feature-based Structure?

✅ **Vantagens:**

- Escalabilidade
- Isolamento de domínios
- Facilita trabalho em equipe
- Code splitting natural

---

## Próximos Passos

1. ✅ Documentar arquitetura atual (este arquivo)
2. 📋 Criar guia de refatoração (REFACTORING_GUIDE.md)
3. 📋 Documentar padrões de código (CODE_STANDARDS.md)
4. 📋 Mapear dependências (DEPENDENCIES_MAP.md)
5. 🔧 Implementar melhorias críticas (ver plano aprovado)

---

## Referências

- [React Best Practices](https://react.dev)
- [Zustand Documentation](https://zustand.docs.pmnd.rs)
- [TanStack Router](https://tanstack.com/router)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- Documentos internos:
  - `docs/SOLUTION_BATTLE_LOOP_FIX.md`
  - `docs/react-spa-patterns.md`
  - `docs/AUDITORIA_CICLOS_ESTADO.md`

---

**Mantido por:** Equipe Tower Trials  
**Contato:** Consultar CHANGELOG para histórico de mudanças
