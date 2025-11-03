# Padrões de Código - Tower Trials

> **Versão:** 1.0  
> **Data:** 2025-01-20  
> **Status:** Padrões Oficiais Estabelecidos

## Índice

1. [Filosofia de Código](#filosofia-de-código)
2. [Nomenclatura](#nomenclatura)
3. [Estrutura de Arquivos](#estrutura-de-arquivos)
4. [TypeScript](#typescript)
5. [React e Componentes](#react-e-componentes)
6. [Zustand Stores](#zustand-stores)
7. [Services](#services)
8. [Hooks Customizados](#hooks-customizados)
9. [Tratamento de Erros](#tratamento-de-erros)
10. [Performance](#performance)
11. [Comentários e Documentação](#comentários-e-documentação)
12. [Git e Commits](#git-e-commits)

---

## Filosofia de Código

### Princípios Fundamentais

1. **Código Limpo** - Código que explica a si mesmo
2. **KISS** - Keep It Simple, Stupid
3. **DRY** - Don't Repeat Yourself
4. **YAGNI** - You Aren't Gonna Need It
5. **Single Responsibility** - Uma responsabilidade por módulo/função

### Prioridades

```
1. Funciona corretamente
2. É fácil de entender
3. É fácil de modificar
4. É performático
5. É elegante
```

---

## Nomenclatura

### Arquivos e Pastas

#### Componentes

```typescript
// ✅ BOM: PascalCase
BattleArena.tsx;
CharacterSelect.tsx;
EquipmentPanel.tsx;

// ❌ RUIM
battleArena.tsx;
character - select.tsx;
equipment_panel.tsx;
```

#### Services

```typescript
// ✅ BOM: kebab-case.service.ts
character.service.ts;
battle - initialization.service.ts;
skill - xp.service.ts;

// ❌ RUIM
CharacterService.ts;
battleInitialization.service.ts;
SkillXP.service.ts;
```

#### Hooks

```typescript
// ✅ BOM: camelCase, prefixo 'use'
useCharacter.ts;
useBattleActions.ts;
useGameLogging.ts;

// ❌ RUIM
Character.ts;
battle - actions.ts;
UseGameLogging.ts;
```

#### Stores

```typescript
// ✅ BOM: camelCase, prefixo 'use', sufixo 'Store'
useBattleStore.tsx;
useCharacterStore.tsx;

// ❌ RUIM
BattleStore.tsx;
character - store.tsx;
storeCharacter.tsx;
```

#### Utils

```typescript
// ✅ BOM: kebab-case
number - utils.ts;
character - utils.ts;
logging - utils.ts;

// ❌ RUIM
NumberUtils.ts;
characterUtils.ts;
utils_logging.ts;
```

#### Models

```typescript
// ✅ BOM: kebab-case.model.ts
character.model.ts;
game.model.ts;
equipment.model.ts;

// ❌ RUIM
Character.ts;
GameModel.ts;
equipment.ts;
```

### Código

#### Variáveis e Funções

```typescript
// ✅ BOM: camelCase, descritivo
const characterId = '123';
const isProcessing = false;
function calculateDamage(attacker: Character, defender: Enemy) {}

// ❌ RUIM
const CharacterId = '123';
const is_processing = false;
function calc_dmg(a, d) {}
```

#### Constantes

```typescript
// ✅ BOM: UPPER_SNAKE_CASE
const MAX_HP = 100;
const BASE_DAMAGE = 10;
const DEFAULT_SPEED = 10;

// ❌ RUIM
const maxHp = 100;
const baseDamage = 10;
```

#### Classes e Interfaces

```typescript
// ✅ BOM: PascalCase
interface Character {}
interface ServiceResponse<T> {}
class CharacterService {}
type GamePlayer = {};

// ❌ RUIM
interface character {}
interface serviceResponse<T> {}
class characterService {}
type game_player = {};
```

#### Enums

```typescript
// ✅ BOM: PascalCase para enum, UPPER_SNAKE_CASE para valores
enum GameMode {
  MENU = 'menu',
  BATTLE = 'battle',
  GAMEOVER = 'gameover',
}

// ❌ RUIM
enum gameMode {
  menu = 'menu',
  battle = 'battle',
}
```

#### Booleans

```typescript
// ✅ BOM: Prefixos is, has, should, can
const isLoading = true;
const hasError = false;
const shouldUpdate = true;
const canDelete = false;

// ❌ RUIM
const loading = true;
const error = false;
const update = true;
```

---

## Estrutura de Arquivos

### Organização de Imports

```typescript
// 1. React e libs externas
import { useState, useEffect } from 'react';
import { create } from 'zustand';
import { produce } from 'immer';

// 2. Absolute imports (@/)
import { Character } from '@/models/character.model';
import { CharacterService } from '@/services/character.service';
import { useCharacterStore } from '@/stores/useCharacterStore';

// 3. Relative imports
import { calculateStats } from './utils';
import { CharacterCard } from './CharacterCard';

// 4. Tipos apenas (type imports)
import type { GameState } from '@/models/game.model';
import type { FC } from 'react';
```

### Ordem de Elementos em Arquivo

```typescript
// 1. Imports
import ...

// 2. Types e Interfaces
interface Props {}
type State = {};

// 3. Constantes
const MAX_HP = 100;

// 4. Componente/Classe/Store principal
export function Component() {}
// ou
export class Service {}
// ou
export const useStore = create<Store>()...

// 5. Exports secundários (seletores, helpers)
export const useSpecificSelector = () => {};
```

---

## TypeScript

### Type Safety

#### ✅ SEMPRE usar tipos explícitos

```typescript
// ✅ BOM
function calculateDamage(attack: number, defense: number): number {
  return Math.max(0, attack - defense);
}

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

// ❌ RUIM (any, implicit any)
function calculateDamage(attack, defense) {
  return attack - defense;
}

function doSomething(data: any) {} // Evitar any
```

#### ✅ Usar Utility Types

```typescript
// ✅ BOM
type PartialCharacter = Partial<Character>;
type ReadonlyCharacter = Readonly<Character>;
type CharacterKeys = keyof Character;
type CharacterId = Pick<Character, 'id'>;
type CharacterWithoutId = Omit<Character, 'id'>;

// Para estados
type LoadingState = Record<string, boolean>;
```

#### ✅ Type Guards

```typescript
// ✅ BOM
function isCharacter(obj: unknown): obj is Character {
  return typeof obj === 'object' && obj !== null && 'id' in obj && 'name' in obj && 'level' in obj;
}

// Uso
if (isCharacter(data)) {
  // TypeScript sabe que data é Character aqui
  console.log(data.name);
}
```

#### ✅ Evitar Type Assertions (casting)

```typescript
// ⚠️ EVITAR (quando possível)
const character = data as Character;

// ✅ PREFERIR (validação + type guard)
if (!isCharacter(data)) {
  throw new Error('Invalid character data');
}
// data é Character daqui em diante
```

### Generics

```typescript
// ✅ BOM: Nomes descritivos para generics
interface ServiceResponse<TData> {
  data: TData | null;
  error: string | null;
}

// Se múltiplos generics, usar nomes claros
interface Mapper<TInput, TOutput> {
  map: (input: TInput) => TOutput;
}

// ❌ RUIM
interface ServiceResponse<T> {} // OK para casos simples
interface Mapper<A, B, C, D> {} // Confuso
```

---

## React e Componentes

### Estrutura de Componente

```typescript
// ✅ BOM: Estrutura padronizada
import { useState, useEffect } from 'react';
import type { FC } from 'react';

// 1. Props interface
interface BattleArenaProps {
  characterId: string;
  onVictory?: () => void;
  className?: string;
}

// 2. Componente
export const BattleArena: FC<BattleArenaProps> = ({
  characterId,
  onVictory,
  className
}) => {
  // 3. Hooks (na ordem)
  // - useState
  const [isAttacking, setIsAttacking] = useState(false);

  // - useStore/useContext
  const { performAction } = useBattleActions();

  // - useEffect
  useEffect(() => {
    // Efeitos
  }, []);

  // 4. Handlers
  const handleAttack = () => {
    setIsAttacking(true);
    performAction('attack');
  };

  // 5. Render
  return (
    <div className={className}>
      <button onClick={handleAttack}>Atacar</button>
    </div>
  );
};
```

### Props

```typescript
// ✅ BOM: Desestruturar props
export const Component: FC<Props> = ({ id, name, onSave }) => {
  // Usar diretamente: id, name, onSave
};

// ❌ RUIM
export const Component: FC<Props> = props => {
  // Acessar via props.id, props.name
};

// ✅ BOM: Props opcionais com ?
interface Props {
  id: string; // Obrigatório
  name?: string; // Opcional
  onSave?: () => void; // Opcional
  className?: string; // Opcional
}

// ✅ BOM: Default values na desestruturação
export const Component: FC<Props> = ({ id, name = 'Sem nome', className = '' }) => {};
```

### Hooks Rules

```typescript
// ✅ BOM: Sempre no top level
function Component() {
  const [state, setState] = useState(0);
  const value = useStore(state => state.value);

  // ...
}

// ❌ RUIM: Hooks condicionais
function Component() {
  if (condition) {
    const [state, setState] = useState(0); // ❌ NUNCA
  }
}

// ❌ RUIM: Hooks em loops
function Component() {
  for (let i = 0; i < 10; i++) {
    useEffect(() => {}); // ❌ NUNCA
  }
}
```

### Event Handlers

```typescript
// ✅ BOM: Prefixo 'handle'
const handleClick = () => {};
const handleSubmit = (e: FormEvent) => {};
const handleChange = (value: string) => {};

// ❌ RUIM
const onClick = () => {};
const submit = () => {};
const change = () => {};
```

### Conditional Rendering

```typescript
// ✅ BOM: Condicional inline para casos simples
{isLoading && <Spinner />}
{error && <ErrorMessage error={error} />}

// ✅ BOM: Ternário para casos binários
{isLoggedIn ? <Dashboard /> : <Login />}

// ✅ BOM: Early return para lógica complexa
if (isLoading) return <Spinner />;
if (error) return <ErrorMessage error={error} />;
if (!data) return <EmptyState />;

return <MainContent data={data} />;

// ❌ RUIM: Ternários aninhados
{condition1 ? (
  condition2 ? <A /> : <B />
) : (
  condition3 ? <C /> : <D />
)}
```

---

## Zustand Stores

### Estrutura Padrão

```typescript
// ✅ BOM: Estrutura completa e tipada
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { produce } from 'immer';

// 1. State interface
interface BattleState {
  isProcessing: boolean;
  currentTurn: 'player' | 'enemy' | null;
  turnCount: number;
}

// 2. Actions interface
interface BattleActions {
  performAction: (action: ActionType) => Promise<void>;
  resetBattle: () => void;
  incrementTurnCount: () => void;
}

// 3. Store type
type BattleStore = BattleState & BattleActions;

// 4. Store criação
export const useBattleStore = create<BattleStore>()(
  subscribeWithSelector((set, get) => ({
    // Estado inicial
    isProcessing: false,
    currentTurn: null,
    turnCount: 0,

    // Ações
    performAction: async action => {
      set(
        produce(draft => {
          draft.isProcessing = true;
        })
      );

      // Lógica...

      set(
        produce(draft => {
          draft.isProcessing = false;
        })
      );
    },

    resetBattle: () => {
      set(
        produce(draft => {
          draft.currentTurn = null;
          draft.turnCount = 0;
          draft.isProcessing = false;
        })
      );
    },

    incrementTurnCount: () => {
      set(
        produce(draft => {
          draft.turnCount += 1;
        })
      );
    },
  }))
);

// 5. Seletores customizados
export const useBattleState = () =>
  useBattleStore(state => ({
    isProcessing: state.isProcessing,
    currentTurn: state.currentTurn,
  }));

export const useBattleActions = () =>
  useBattleStore(state => ({
    performAction: state.performAction,
    resetBattle: state.resetBattle,
  }));
```

### Regras para Stores

#### ✅ Usar Immer para atualizações

```typescript
// ✅ BOM
set(
  produce(draft => {
    draft.player.hp = 100;
    draft.player.mana = 50;
  })
);

// ❌ RUIM (spread manual, propenso a erros)
set(state => ({
  ...state,
  player: {
    ...state.player,
    hp: 100,
    mana: 50,
  },
}));
```

#### ✅ Seletores granulares

```typescript
// ✅ BOM: Seletor específico
const hp = useBattleStore(state => state.player.hp);
// Re-render APENAS quando hp muda

// ❌ RUIM: Selecionar objeto inteiro
const player = useBattleStore(state => state.player);
// Re-render quando QUALQUER propriedade de player muda
```

#### ✅ Ações assíncronas no store

```typescript
// ✅ BOM: Ação assíncrona gerencia loading
performAction: async action => {
  set(
    produce(draft => {
      draft.isLoading = true;
    })
  );

  try {
    const result = await SomeService.doSomething(action);
    set(
      produce(draft => {
        draft.data = result;
        draft.error = null;
      })
    );
  } catch (error) {
    set(
      produce(draft => {
        draft.error = error.message;
      })
    );
  } finally {
    set(
      produce(draft => {
        draft.isLoading = false;
      })
    );
  }
};
```

---

## Services

### Estrutura Padrão

```typescript
// ✅ BOM: Service como classe estática
import type { Character } from '@/models/character.model';
import { supabase } from '@/lib/supabase';

// Interface de resposta padronizada
interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export class CharacterService {
  // Cache privado (se necessário)
  private static cache = new Map<string, Character>();

  /**
   * Buscar personagem por ID
   * @param id - ID do personagem
   * @returns ServiceResponse com Character ou erro
   */
  static async getCharacter(id: string): Promise<ServiceResponse<Character>> {
    try {
      // Verificar cache
      const cached = this.cache.get(id);
      if (cached) {
        return { data: cached, error: null, success: true };
      }

      // Buscar do servidor
      const { data, error } = await supabase.from('characters').select('*').eq('id', id).single();

      if (error) throw error;

      // Atualizar cache
      this.cache.set(id, data);

      return { data, error: null, success: true };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      };
    }
  }

  /**
   * Limpar cache
   * @private
   */
  private static clearCache(): void {
    this.cache.clear();
  }
}
```

### Regras para Services

#### ✅ SEMPRE retornar ServiceResponse

```typescript
// ✅ BOM
interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

static async doSomething(): Promise<ServiceResponse<Result>> {
  try {
    // ...
    return { data: result, error: null, success: true };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Error',
      success: false
    };
  }
}

// ❌ RUIM (throw direto)
static async doSomething(): Promise<Result> {
  const result = await api.call();
  return result; // Sem tratamento de erro
}
```

#### ✅ Services NÃO devem acessar stores diretamente

```typescript
// ❌ RUIM
export class CharacterService {
  static async updateCharacter(id: string, data: Partial<Character>) {
    const store = useCharacterStore.getState(); // ❌ Acoplamento
    const current = store.selectedCharacter;

    // ...
  }
}

// ✅ BOM
export class CharacterService {
  static async updateCharacter(
    id: string,
    data: Partial<Character>,
    currentCharacter: Character | null // ✅ Parâmetro
  ) {
    // ...
  }
}
```

#### ✅ Métodos privados para lógica interna

```typescript
export class CharacterService {
  // Público
  static async getCharacter(id: string) {
    const cached = this.getFromCache(id);
    if (cached) return cached;

    const data = await this.fetchFromServer(id);
    this.saveToCache(id, data);
    return data;
  }

  // Privados
  private static getFromCache(id: string) {}
  private static fetchFromServer(id: string) {}
  private static saveToCache(id: string, data: Character) {}
}
```

---

## Hooks Customizados

### Estrutura Padrão

```typescript
// ✅ BOM: Hook bem estruturado
import { useState, useEffect, useCallback } from 'react';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { CharacterService } from '@/services/character.service';

/**
 * Hook para gerenciar operações de personagem
 * @param characterId - ID do personagem
 * @returns Objeto com character e operações
 */
export function useCharacter(characterId: string) {
  // 1. Acessar stores
  const character = useCharacterStore(state => state.characters.find(c => c.id === characterId));
  const updateCharacterInStore = useCharacterStore(state => state.updateCharacter);

  // 2. Estado local (se necessário)
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 3. Callbacks
  const updateCharacter = useCallback(
    async (data: Partial<Character>) => {
      setIsLoading(true);
      setError(null);

      const result = await CharacterService.updateCharacter(characterId, data, character);

      if (result.success) {
        updateCharacterInStore(result.data);
      } else {
        setError(result.error);
      }

      setIsLoading(false);
    },
    [characterId, character, updateCharacterInStore]
  );

  // 4. Effects
  useEffect(() => {
    // Carregar dados se não existir
    if (!character) {
      // ...
    }
  }, [characterId, character]);

  // 5. Retornar interface simplificada
  return {
    character,
    isLoading,
    error,
    updateCharacter,
  };
}
```

### Regras para Hooks

#### ✅ Prefixo 'use'

```typescript
// ✅ BOM
function useCharacter() {}
function useBattleActions() {}
function useGameState() {}

// ❌ RUIM
function getCharacter() {} // Não é hook
function characterHook() {} // Prefixo errado
```

#### ✅ Retornar objeto (não array) para múltiplos valores

```typescript
// ✅ BOM: Objeto (nomes claros)
const { character, isLoading, error, updateCharacter } = useCharacter(id);

// ⚠️ OK para 2 valores relacionados (como useState)
const [count, setCount] = useState(0);

// ❌ RUIM: Array com 3+ valores
const [character, isLoading, error, updateCharacter] = useCharacter(id);
// Difícil lembrar a ordem
```

#### ✅ useCallback para funções retornadas

```typescript
// ✅ BOM
export function useCharacter(id: string) {
  const updateCharacter = useCallback(
    async data => {
      // ...
    },
    [id]
  ); // Dependências estáveis

  return { updateCharacter };
}

// ❌ RUIM (função recriada a cada render)
export function useCharacter(id: string) {
  const updateCharacter = async data => {
    // Sem useCallback
    // ...
  };

  return { updateCharacter };
}
```

---

## Tratamento de Erros

### Error Boundaries (Componentes)

```typescript
// ✅ BOM: Tratar erros gracefully
try {
  await performAction();
} catch (error) {
  console.error('Erro ao executar ação:', error);
  toast.error('Erro', {
    description: error instanceof Error ? error.message : 'Erro desconhecido',
  });
}

// ❌ RUIM: Deixar erros sem tratamento
await performAction(); // Se falhar, quebra a aplicação
```

### Validação de Dados

```typescript
// ✅ BOM: Validar antes de usar
function processCharacter(data: unknown): Character {
  if (!isCharacter(data)) {
    throw new Error('Dados de personagem inválidos');
  }

  return data;
}

// ❌ RUIM: Assumir que dados são válidos
function processCharacter(data: any): Character {
  return data as Character; // Perigoso
}
```

---

## Performance

### Otimizações de Re-render

```typescript
// ✅ BOM: Seletor específico
const hp = useCharacterStore(state => state.character.hp);
// Re-render apenas quando hp muda

// ✅ BOM: Múltiplos seletores específicos
const hp = useCharacterStore(state => state.character.hp);
const mana = useCharacterStore(state => state.character.mana);

// ❌ RUIM: Selecionar objeto inteiro
const character = useCharacterStore(state => state.character);
// Re-render quando qualquer propriedade de character muda
```

### Memo e useMemo

```typescript
// ✅ BOM: useMemo para cálculos pesados
const expensiveCalculation = useMemo(() => {
  return calculateComplexStats(character);
}, [character]); // Só recalcula quando character muda

// ✅ BOM: React.memo para componentes
export const CharacterCard = React.memo(({ character }: Props) => {
  return <div>{character.name}</div>;
});

// ❌ RUIM: Calcular toda hora
function Component() {
  const stats = calculateComplexStats(character); // Recalcula todo render
}
```

### Lazy Loading

```typescript
// ✅ BOM: Lazy load de rotas
const GameBattle = lazy(() => import('./features/battle/game-battle'));

// ✅ BOM: Dynamic imports para código pesado
const loadHeavyModule = async () => {
  const { HeavyModule } = await import('./heavy-module');
  return HeavyModule;
};
```

---

## Comentários e Documentação

### JSDoc para Funções Públicas

```typescript
/**
 * Calcula o dano final de um ataque
 * @param attacker - Personagem atacante
 * @param defender - Inimigo defensor
 * @param isCritical - Se o ataque é crítico
 * @returns Dano final após todos os cálculos
 * @example
 * const damage = calculateDamage(player, enemy, false);
 */
export function calculateDamage(attacker: Character, defender: Enemy, isCritical: boolean): number {
  // ...
}
```

### Comentários Inline

```typescript
// ✅ BOM: Explicar "porquê", não "o quê"
// Usar Math.max para evitar dano negativo
const finalDamage = Math.max(0, baseDamage - defense);

// ❌ RUIM: Óbvio
// Calcula dano final
const finalDamage = Math.max(0, baseDamage - defense);

// ✅ BOM: Marcar TODOs e FIXMEs
// TODO: Implementar sistema de críticos duplos
// FIXME: Bug quando defesa é maior que ataque
// WARNING: Esta lógica será refatorada (ver issue #123)
```

### Código Auto-Explicativo

```typescript
// ✅ BOM: Nomes claros, sem necessidade de comentários
function isCharacterDead(character: Character): boolean {
  return character.hp <= 0;
}

if (isCharacterDead(player)) {
  handleGameOver();
}

// ❌ RUIM: Necessita comentário para entender
// Verifica se jogador morreu
if (p.hp <= 0) {
  // Game over
  handleGO();
}
```

---

## Git e Commits

### Mensagens de Commit

#### Formato

```
<tipo>(<escopo>): <descrição curta>

<descrição detalhada opcional>

<footer opcional>
```

#### Tipos

- `feat`: Nova funcionalidade
- `fix`: Correção de bug
- `refactor`: Refatoração (sem mudar funcionalidade)
- `docs`: Apenas documentação
- `style`: Formatação, sem mudança de lógica
- `test`: Adicionar/modificar testes
- `chore`: Tarefas de build, dependências

#### Exemplos

```bash
# ✅ BOM
feat(battle): adicionar sistema de críticos duplos
fix(character): corrigir cálculo de HP com equipamentos
refactor(stores): remover acesso direto a stores dos services
docs(architecture): atualizar fluxo de dados

# ❌ RUIM
update stuff
fix bug
changes
wip
```

### Commits Atômicos

```bash
# ✅ BOM: Um commit por mudança lógica
git commit -m "feat(battle): adicionar cálculo de dano crítico"
git commit -m "test(battle): adicionar testes de dano crítico"

# ❌ RUIM: Múltiplas mudanças não relacionadas
git commit -m "add critical damage, fix bug, update docs"
```

### Branches

```bash
# ✅ BOM: Nomes descritivos
feature/battle-critical-system
fix/character-hp-calculation
refactor/remove-store-access-from-services

# ❌ RUIM
my-branch
fix
updates
branch1
```

---

## Ferramentas

### ESLint

Configuração em `eslint.config.js` (seguir configuração do projeto)

### Prettier

```bash
# Formatar código
npm run format

# Verificar formatação
npm run format:check
```

### TypeScript

```bash
# Verificar tipos
npm run type-check
# ou
tsc --noEmit
```

---

## Checklist de Code Review

### Antes de Criar PR

- [ ] Código formatado (Prettier)
- [ ] Sem erros de linting (ESLint)
- [ ] Sem erros de tipos (TypeScript)
- [ ] Testes passando
- [ ] Código documentado (quando necessário)
- [ ] Sem console.logs de debug
- [ ] Commits organizados e atômicos
- [ ] Branch atualizada com main

### Durante Review

- [ ] Código segue os padrões estabelecidos
- [ ] Nomenclatura consistente
- [ ] Sem duplicação desnecessária
- [ ] Performance adequada
- [ ] Tratamento de erros apropriado
- [ ] TypeScript usado corretamente
- [ ] Componentes/funções têm responsabilidade única

---

**Última atualização:** 2025-01-20  
**Mantido por:** Equipe Tower Trials
