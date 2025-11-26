# Asset Mapping Documentation

## Overview
Este documento descreve o mapeamento de assets utilizados na aplicação Tower Trials, incluindo consumíveis, equipamentos e componentes visuais.

## Estrutura de Diretórios

### Consumíveis (`public/assets/icons/consumables/`)
- `small_health_potion.png` - Pequena poção de vida
- `medium_health_potion.png` - Média poção de vida
- `large_mana_potion.png` - Grande poção de vida/mana
- `small_mana_potion.png` - Pequena poção de mana
- `medium_mana_potion.png` - Média poção de mana
- `strength_elixir.png` - Elixir de força
- `defense_elixir.png` - Elixir de defesa
- `antidote.png` - Antídoto

### Armas (`public/assets/icons/weapons/`)
- `iron_sword.png` - Espada de ferro
- `steel_sword.png` - Espada de aço
- `wooden_staff.png` - Varinha de madeira
- `oak_staff.png` - Cajado de carvalho
- `bronze_dagger.png` - Adaga de bronze
- `battle_axe.png` - Machado de batalha

### Armaduras (`public/assets/icons/armors/`)
- `leather_armor.png` - Armadura de couro
- `chainmail_armor.png` - Armadura de malha
- `scale_armor.png` - Armadura de escamas
- `apprentice_robe.png` - Túnica de aprendiz
- `occultist_cloak.png` - Manto do ocultista
- `light_vestments.png` - Vestes leves
- `swift_boots.png` - Botas velozes

### Acessórios (`public/assets/icons/accessories/`)
- `strength_ring.png` - Anel de força
- `mana_ring.png` - Anel de mana
- `protection_amulet.png` - Amuleto de proteção
- `arcane_amulet.png` - Amuleto arcano
- `defensive_bracers.png` - Braceletes de defesa

## Como Usar

### Componentes de Imagem

#### ConsumableImage
```tsx
import { ConsumableImage } from '@/components/ui/consumable-image';
import type { Consumable } from '@/models/consumable.model';

<ConsumableImage 
  consumable={consumable}
  size="md"
  className="custom-class"
  showFallback={true}
/>
```

**Props:**
- `consumable` (Consumable) - Objeto consumível
- `size` ('sm' | 'md' | 'lg' | 'xl') - Tamanho da imagem (padrão: 'md')
- `className` (string) - Classes CSS adicionais
- `showFallback` (boolean) - Mostrar emoji fallback se imagem não carregar (padrão: true)

#### EquipmentImage
```tsx
import { EquipmentImage } from '@/components/ui/equipment-image';
import type { Equipment } from '@/models/equipment.model';

<EquipmentImage 
  equipment={equipment}
  size="md"
  className="custom-class"
  showFallback={true}
/>
```

**Props:**
- `equipment` (Equipment) - Objeto equipamento
- `size` ('sm' | 'md' | 'lg' | 'xl') - Tamanho da imagem (padrão: 'md')
- `className` (string) - Classes CSS adicionais
- `showFallback` (boolean) - Mostrar emoji fallback se imagem não carregar (padrão: true)

### AssetManager

#### Métodos Principais

**getConsumableIcon(consumable: Consumable): string**
Retorna o caminho para o ícone do consumível baseado em nome, tipo e valor do efeito.

**getEquipmentIcon(equipment: Equipment): string**
Retorna o caminho para o ícone do equipamento baseado em tipo, subtipo e nível.

**preloadCriticalAssets(): Promise<void>**
Pré-carrega assets críticos para melhor performance na inicialização.

**addConsumableMapping(nameOrKey: string, filename: string): void**
Adiciona um mapeamento personalizado para consumíveis.

## Exemplo de Integração Completa

```tsx
import { ConsumableImage } from '@/components/ui/consumable-image';
import { EquipmentImage } from '@/components/ui/equipment-image';
import type { Consumable } from '@/models/consumable.model';
import type { Equipment } from '@/models/equipment.model';

interface InventoryItemProps {
  item: Consumable | Equipment;
}

export function InventoryItem({ item }: InventoryItemProps) {
  const isConsumable = 'effect_value' in item;

  return (
    <div className="flex items-center gap-3">
      {isConsumable ? (
        <ConsumableImage consumable={item as Consumable} size="md" />
      ) : (
        <EquipmentImage equipment={item as Equipment} size="md" />
      )}
      <div>
        <h3>{item.name}</h3>
        <p className="text-sm text-gray-600">{item.description}</p>
      </div>
    </div>
  );
}
```

## Performance

- **Caching**: AssetManager implementa caching automático para evitar recarregamentos
- **Lazy Loading**: Imagens são carregadas lazy por padrão
- **Preloading**: Assets críticos são pré-carregados durante inicialização
- **Fallback**: Se uma imagem falhar ao carregar, um emoji de fallback é mostrado

## Suporte de Ambientes

- **Produção**: Assets servidos de `/assets`
- **Desenvolvimento**: Vite resolve imports de `src/assets` automaticamente
- **Imports Diretos**: Componentes importam assets diretamente para máxima compatibilidade



