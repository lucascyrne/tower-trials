# ✨ Solução: Sistema de Eventos Especiais

## 🎯 **Problema Identificado**

O sistema não carregava eventos especiais quando `gameState.mode` mudava para `"special_event"`. O `SpecialEventService` existia mas nunca era chamado, mantendo `gameState.currentSpecialEvent` como `null`.

## 🔧 **Solução Implementada**

### **1. Função `initializeSpecialEvent` no CharacterProvider**

```typescript
const initializeSpecialEvent = useCallback(
  async (character: Character, eventKey: string) => {
    // Verificar se o andar é elegível (não múltiplos de 5 ou 10)
    const floor = character.floor;
    if (floor % 5 === 0 || floor % 10 === 0) {
      throw new Error('Andar não elegível para eventos especiais');
    }

    // Carregar evento especial
    const eventResponse = await SpecialEventService.getSpecialEventForFloor(floor);

    // Atualizar gameState com evento carregado
    setGameState({
      mode: 'special_event',
      currentSpecialEvent: eventResponse.data,
      // ... outros campos
    });
  },
  [selectedCharacter, setGameState, addGameLogMessage, updateLoading, initializeBattle]
);
```

### **2. Lógica de Raridade no SpecialEventService**

```typescript
static async getSpecialEventForFloor(floor: number): Promise<ServiceResponse<SpecialEvent>> {
  // Verificar elegibilidade do andar
  if (!this.isFloorEligibleForEvent(floor)) {
    return { data: null, error: 'Andar não elegível', success: false };
  }

  // Chance muito baixa (3%)
  const eventChance = Math.random();
  if (eventChance > 0.03) {
    return { data: null, error: 'Evento não gerado por chance', success: false };
  }

  // Buscar evento do banco de dados
  const { data, error } = await supabase.rpc('get_special_event_for_floor', { p_floor: floor });
  // ...
}
```

### **3. Controle de Elegibilidade**

```typescript
static isFloorEligibleForEvent(floor: number): boolean {
  // Eventos especiais não aparecem em:
  // - Andares múltiplos de 5 (mini-boss)
  // - Andares múltiplos de 10 (boss)
  // - Andar 1 (início do jogo)
  return floor > 1 && floor % 5 !== 0 && floor % 10 !== 0;
}
```

## 📋 **Mudanças Aplicadas**

### **CharacterProvider.tsx**

- ✅ Adicionada função `initializeSpecialEvent`
- ✅ Controle de refs para evitar múltiplas inicializações
- ✅ Fallback para batalha normal se evento falhar
- ✅ Função adicionada ao contexto

### **character-context.ts**

- ✅ Interface atualizada com `initializeSpecialEvent`

### **event.service.ts**

- ✅ Lógica de raridade implementada (3% chance)
- ✅ Verificação de elegibilidade de andar
- ✅ Método `isFloorEligibleForEvent` adicionado

## 🎮 **Como Usar**

### **Em um componente:**

```typescript
const { initializeSpecialEvent } = useCharacter();

// Chamar quando quiser tentar inicializar evento especial
await initializeSpecialEvent(character, `event_${character.id}_${character.floor}`);
```

### **Fluxo automático:**

```typescript
// O sistema verifica automaticamente:
// 1. Se o andar é elegível (não múltiplos de 5/10)
// 2. Se a chance de 3% é atingida
// 3. Se há eventos disponíveis no banco
// 4. Se falhar, inicia batalha normal como fallback
```

## 🏗️ **Características da Solução**

### **✅ Vantagens**

- **Raridade controlada**: Apenas 3% de chance + elegibilidade de andar
- **Não bloqueia progressão**: Fallback automático para batalha normal
- **Evita loops**: Controle com refs similar ao `initializeBattle`
- **Integração limpa**: Usa mesma estrutura do sistema de batalhas
- **Logs detalhados**: Facilita debugging

### **🎯 Regras de Negócio**

- Eventos especiais só em andares: 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19...
- Chance de 3% por andar elegível
- Nunca em andares de boss (múltiplos de 5 e 10)
- Nunca no andar 1 (início do jogo)

## 🔄 **Resultado Final**

Agora quando o modo muda para `"special_event"`:

1. `initializeSpecialEvent` é chamada automaticamente
2. `SpecialEventService.getSpecialEventForFloor` é executado
3. Evento é carregado e inserido no `gameState.currentSpecialEvent`
4. Interface pode exibir o evento corretamente
5. Se falhar, inicia batalha normal sem quebrar o fluxo
