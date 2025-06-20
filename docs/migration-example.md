# Exemplo de Migração: Providers para Stores Zustand

## Antes (usando Providers)

```tsx
// Componente usando os antigos providers
import { useCharacterListContext } from '../contexts/character-list-hook';
import { useCharacterSelectionContext } from '../contexts/character-selection-hook';

function CharacterSelectComponent() {
  // Hooks dos contextos antigos
  const { characters, isLoading, createCharacter, reloadCharacters } = useCharacterListContext();
  const { selectedCharacterId, selectCharacter, clearSelection } = useCharacterSelectionContext();

  const handleCreateCharacter = async (name: string) => {
    await createCharacter(name);
  };

  const handleSelectCharacter = (id: string, name: string) => {
    selectCharacter(id, name);
  };

  return (
    <div>
      {isLoading && <p>Carregando...</p>}
      {characters.map(character => (
        <div
          key={character.id}
          onClick={() => handleSelectCharacter(character.id, character.name)}
          className={selectedCharacterId === character.id ? 'selected' : ''}
        >
          {character.name}
        </div>
      ))}
    </div>
  );
}
```

## Depois (usando Stores Zustand)

### Opção 1: Hook Combinado (Recomendado)

```tsx
import { useCharacterManagement } from '../hooks/useCharacterHooks';

function CharacterSelectComponent() {
  // Um único hook com toda a funcionalidade integrada
  const {
    characters,
    isLoading,
    selectedCharacterId,
    createCharacter,
    selectCharacter,
    clearSelection,
    user,
  } = useCharacterManagement();

  const handleCreateCharacter = async (name: string) => {
    await createCharacter(name); // Já integrado com autenticação
  };

  const handleSelectCharacter = (id: string, name: string) => {
    selectCharacter(id, name);
  };

  return (
    <div>
      {isLoading && <p>Carregando...</p>}
      {characters.map(character => (
        <div
          key={character.id}
          onClick={() => handleSelectCharacter(character.id, character.name)}
          className={selectedCharacterId === character.id ? 'selected' : ''}
        >
          {character.name}
        </div>
      ))}
    </div>
  );
}
```

### Opção 2: Stores Separados

```tsx
import { useCharacterListWithAuth } from '../hooks/useCharacterHooks';
import { useCharacterSelectionWithCache } from '../hooks/useCharacterHooks';

function CharacterSelectComponent() {
  // Hooks especializados
  const { characters, isLoading, createCharacter } = useCharacterListWithAuth();
  const { selectedCharacterId, selectCharacter, selectedCharacter } =
    useCharacterSelectionWithCache();

  return (
    <div>
      {isLoading && <p>Carregando...</p>}
      {characters.map(character => (
        <div
          key={character.id}
          onClick={() => selectCharacter(character.id, character.name)}
          className={selectedCharacterId === character.id ? 'selected' : ''}
        >
          {character.name}
        </div>
      ))}

      {/* Dados completos do personagem selecionado disponíveis */}
      {selectedCharacter && (
        <div>
          <h3>Personagem Selecionado</h3>
          <p>Nome: {selectedCharacter.name}</p>
          <p>Nível: {selectedCharacter.level}</p>
          <p>
            HP: {selectedCharacter.hp}/{selectedCharacter.max_hp}
          </p>
        </div>
      )}
    </div>
  );
}
```

### Opção 3: Acesso Direto aos Stores

```tsx
import { useCharacterStore } from '../stores/useCharacterStore';
import { useAuth } from '../resources/auth/auth-hook';
import { useGameLog } from '../stores/useLogStore';
import { useEffect } from 'react';

function CharacterSelectComponent() {
  const { user } = useAuth();
  const { addGameLogMessage, setGameMessage } = useGameLog();

  // Acesso direto ao store principal
  const {
    characters,
    isLoading,
    selectedCharacterId,
    loadCharacters,
    createCharacter,
    selectCharacter,
  } = useCharacterStore();

  // Carregar personagens manualmente
  useEffect(() => {
    if (user?.id) {
      loadCharacters(user.id, addGameLogMessage, setGameMessage);
    }
  }, [user?.id, loadCharacters, addGameLogMessage, setGameMessage]);

  const handleCreateCharacter = async (name: string) => {
    if (user?.id) {
      await createCharacter(name, user.id, addGameLogMessage);
    }
  };

  return (
    <div>
      {isLoading && <p>Carregando...</p>}
      {characters.map(character => (
        <div
          key={character.id}
          onClick={() => selectCharacter(character.id, character.name)}
          className={selectedCharacterId === character.id ? 'selected' : ''}
        >
          {character.name}
        </div>
      ))}
    </div>
  );
}
```

## Principais Benefícios da Migração

1. **Sem Providers Aninhados**: Elimina a necessidade de wrapping components
2. **Persistência Automática**: Seleção de personagem persiste no localStorage
3. **Cache Inteligente**: Dados do personagem selecionado ficam em cache
4. **Integração Simplificada**: Hooks combinados reduzem boilerplate
5. **Melhor Performance**: Zustand otimiza re-renders automaticamente
6. **DevTools**: Integração nativa com Redux DevTools para debug

## Limpeza Necessária

Após a migração, você pode remover:

- `src/contexts/character-list.context.ts`
- `src/contexts/character-selection.context.ts`
- `src/stores/character-list.provider.tsx` (antigo)
- `src/stores/character-selection.provider.tsx` (antigo)
- `src/stores/character.provider.tsx` (antigo)
- Hooks contextualizados como `useCharacterListContext`
