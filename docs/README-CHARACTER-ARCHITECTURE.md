# Arquitetura de Contextos de Personagem - Refatoração

Esta documentação descreve a nova arquitetura modular dos contextos de personagem, substituindo o monolítico `CharacterProvider`.

## 🏗️ Visão Geral

O `CharacterProvider` original foi refatorado em múltiplos contextos especializados, cada um com responsabilidade única e clara. Isso elimina dependências circulares, melhora performance e facilita manutenção.

## 📦 Novos Contextos

### 1. CharacterSelectionContext

**Responsabilidade**: Gerenciar apenas o ID e nome do personagem selecionado

- `selectedCharacterId: string | null`
- `selectedCharacterName: string | null`
- `selectCharacter(id, name): void`
- `clearSelection(): void`

### 2. CharacterListContext

**Responsabilidade**: Gerenciar lista de personagens do usuário

- `characters: Character[]`
- `hasLoadedCharacters: boolean`
- `isLoading: boolean`
- `createCharacter(name): Promise<void>`
- `reloadCharacters(): void`

### 3. GameStateContext (existente)

**Responsabilidade**: Estado do jogo (modo, floor, inimigo ativo)

- Mantido conforme `useGameState()` hook existente

## 🔧 Hooks Especializados

### Hooks de Operações

- `useCharacterHubOperations()` - Carregamento no hub + cura automática
- `useCharacterBattleOperations()` - Inicialização de batalhas
- `useCharacterEventOperations()` - Eventos especiais
- `useCharacterBasicOperations()` - Seleção e atualização de stats

### Hooks de Acesso

- `useCharacterSelection()` - Acesso ao contexto de seleção
- `useCharacterList()` - Acesso ao contexto de lista

### Hook Consolidado

- `useCharacterOperations()` - Combina todas as operações em um hook conveniente

## 🎯 Benefícios Alcançados

### 1. Responsabilidade Única

Cada contexto tem responsabilidade clara e limitada:

- **Seleção**: Apenas ID/nome do personagem selecionado
- **Lista**: Apenas operações de lista de personagens
- **Operações**: Hooks especializados para cada tipo de operação

### 2. Eliminação de Dependências Circulares

- Contextos não dependem uns dos outros diretamente
- Estado é capturado na execução ao invés de dependências
- Hooks especializados combinam contextos conforme necessário

### 3. Caching Inteligente

- `CharacterListProvider` implementa cache com invalidação controlada
- Evita requisições desnecessárias
- Controla execuções múltiplas com refs

### 4. Performance Melhorada

- Contextos menores = menos re-renders
- `useMemo` e `useCallback` com dependências mínimas
- Validação de mudanças antes de atualizar estado

### 5. Facilidade de Manutenção

- Cada arquivo tem responsabilidade específica
- Fácil localizar e modificar funcionalidades
- Menos risco de efeitos colaterais

## 📁 Estrutura de Arquivos

```
src/resources/game/
├── character-selection.context.ts      # Contexto de seleção
├── character-selection.provider.tsx    # Provider de seleção
├── character-list.context.ts           # Contexto de lista
├── character-list.provider.tsx         # Provider de lista
├── character-operations.hooks.ts       # Hooks de operações especializadas
├── character-hooks.ts                  # Hooks de acesso e operações consolidadas
└── character.provider.tsx              # Provider orquestrador
```

## 🔄 Migração

### Para Novos Componentes

```tsx
// Use hooks especializados
import { useCharacterList, useCharacterSelection } from './character-hooks';
import { useCharacterHubOperations } from './character-operations.hooks';

function MyComponent() {
  const { characters } = useCharacterList();
  const { selectedCharacterId } = useCharacterSelection();
  const { loadCharacterForHub } = useCharacterHubOperations();

  // ...
}
```

### Para Componentes Existentes (Migração Simples)

```tsx
// Use o novo hook consolidado
import { useCharacterOperations } from './character-hooks';

function ExistingComponent() {
  const { characters, selectedCharacter, loadCharacterForHub } = useCharacterOperations();
  // Interface quase idêntica à anterior
}
```

## ⚠️ Considerações Importantes

1. **Migração Simples**: Use `useCharacterOperations()` para substituir `useCharacter()`
2. **Performance**: Novos hooks são mais eficientes
3. **Funcionalidades**: Todas as funcionalidades originais mantidas
4. **Compatibilidade**: Interface quase idêntica facilita migração

## 🚀 Próximos Passos

1. **Migrar componentes**: Substituir `useCharacter()` por `useCharacterOperations()`
2. **Otimizações**: Implementar mais otimizações de cache conforme necessário
3. **Testes**: Adicionar testes específicos para cada contexto
4. **Limpeza**: Remover quaisquer importações de arquivos antigos

---

Esta refatoração **eliminou código deprecated** e consolidou em uma interface limpa e eficiente. A migração é simples: substituir `useCharacter()` por `useCharacterOperations()`.
