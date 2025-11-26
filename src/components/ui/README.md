# Componentes UI - Documentação Completa

## 🎨 Componentes de Assets

### ConsumableImage
Componente para exibir ícones de consumíveis com suporte a fallback automático.

**Características:**
- Importa diretamente assets para máxima compatibilidade
- Detecta automaticamente tipo de consumível por nome
- Suporta múltiplos tamanhos
- Fallback a emoji se imagem falhar
- Loading animation durante carregamento

**Exemplo de Uso:**

```tsx
import { ConsumableImage } from '@/components/ui/consumable-image';
import type { Consumable } from '@/models/consumable.model';

// Simples
<ConsumableImage consumable={item} />

// Com customização
<ConsumableImage 
  consumable={item}
  size="lg"
  className="rounded-lg shadow-md"
  showFallback={true}
/>
```

**Props:**
| Prop | Tipo | Padrão | Descrição |
|------|------|--------|-----------|
| `consumable` | `Consumable` | Obrigatório | Objeto do consumível |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | Tamanho da imagem |
| `className` | `string` | `''` | Classes CSS adicionais |
| `showFallback` | `boolean` | `true` | Mostrar fallback se falhar |

**Tamanhos:**
- `sm`: 16px × 16px (h-4 w-4)
- `md`: 24px × 24px (h-6 w-6)
- `lg`: 32px × 32px (h-8 w-8)
- `xl`: 48px × 48px (h-12 w-12)

---

### EquipmentImage
Componente para exibir ícones de equipamentos com suporte a todos os tipos.

**Características:**
- Cobertura completa para armas, armaduras e acessórios
- Detecção automática por nome do equipamento
- Emoji fallback contextual (⚔️ armas, 🛡️ armaduras)
- Mapeamento em português

**Exemplo de Uso:**

```tsx
import { EquipmentImage } from '@/components/ui/equipment-image';
import type { Equipment } from '@/models/equipment.model';

// Simples
<EquipmentImage equipment={sword} />

// Com customização
<EquipmentImage 
  equipment={armor}
  size="xl"
  className="border rounded"
/>
```

**Props:**
| Prop | Tipo | Padrão | Descrição |
|------|------|--------|-----------|
| `equipment` | `Equipment` | Obrigatório | Objeto do equipamento |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | Tamanho da imagem |
| `className` | `string` | `''` | Classes CSS adicionais |
| `showFallback` | `boolean` | `true` | Mostrar fallback se falhar |

**Tipos Suportados:**
- Armas: Espadas, Cajados, Adagas, Machados, Maças
- Armaduras: Peito, Roupas especiais
- Acessórios: Anéis, Amuletos, Braceletes
- Botas e capacetes

---

## 📊 Mapeamento de Assets

### Consumíveis Suportados

```
🔴 Poções de Vida
├── Pequena (≤20 HP)       → small_health_potion.png
├── Média (21-60 HP)       → medium_health_potion.png
└── Grande (>60 HP)        → large_mana_potion.png

🔵 Poções de Mana
├── Pequena (≤10 MP)       → small_mana_potion.png
├── Média (11-30 MP)       → medium_mana_potion.png
└── Grande (>30 MP)        → large_mana_potion.png

⚗️ Especiais
├── Elixir de Força        → strength_elixir.png
├── Elixir de Defesa       → defense_elixir.png
└── Antídoto               → antidote.png
```

### Equipamentos Suportados

```
⚔️ Armas
├── Espadas                → iron_sword.png / steel_sword.png
├── Cajados/Varinhas       → wooden_staff.png / oak_staff.png
├── Adagas                 → bronze_dagger.png
└── Machados               → battle_axe.png

🛡️ Armaduras
├── Armaduras (couro)      → leather_armor.png
├── Armaduras (metal)      → chainmail_armor.png / scale_armor.png
├── Roupas/Mantos          → apprentice_robe.png / occultist_cloak.png
└── Botas                  → swift_boots.png

💍 Acessórios
├── Anéis                  → strength_ring.png / mana_ring.png
├── Amuletos               → protection_amulet.png / arcane_amulet.png
└── Braceletes             → defensive_bracers.png
```

---

## 🔄 Integração com AssetManager

### Métodos Úteis

```tsx
import { AssetManager } from '@/utils/asset-utils';

// Obter ícone de consumível
const path = AssetManager.getConsumableIcon(consumable);

// Obter ícone de equipamento
const path = AssetManager.getEquipmentIcon(equipment);

// Pré-carregar assets críticos
await AssetManager.preloadCriticalAssets();

// Adicionar mapeamento customizado
AssetManager.addConsumableMapping('meu-consumível', 'meu-asset.png');

// Limpar cache
AssetManager.clearCache();
```

---

## 🎯 Exemplo Completo: Inventário

```tsx
import { ConsumableImage } from '@/components/ui/consumable-image';
import { EquipmentImage } from '@/components/ui/equipment-image';
import type { Consumable } from '@/models/consumable.model';
import type { Equipment } from '@/models/equipment.model';

interface InventorySlotProps {
  item: Consumable | Equipment;
  quantity?: number;
}

export function InventorySlot({ item, quantity }: InventorySlotProps) {
  const isConsumable = 'effect_value' in item;

  return (
    <div className="flex flex-col items-center gap-2 p-3 bg-slate-900 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors">
      {/* Ícone */}
      {isConsumable ? (
        <ConsumableImage 
          consumable={item as Consumable} 
          size="lg"
          className="rounded"
        />
      ) : (
        <EquipmentImage 
          equipment={item as Equipment}
          size="lg"
          className="rounded"
        />
      )}

      {/* Nome */}
      <h3 className="text-sm font-semibold text-center truncate w-full">
        {item.name}
      </h3>

      {/* Quantidade (apenas para consumíveis) */}
      {isConsumable && quantity && (
        <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-200">
          ×{quantity}
        </span>
      )}

      {/* Descrição */}
      <p className="text-xs text-slate-400 text-center line-clamp-2">
        {item.description}
      </p>
    </div>
  );
}
```

---

## ⚡ Performance

### Otimizações Implementadas

1. **Caching Automático**
   - Resultados armazenados por ID
   - Reutilização de paths já resolvidos

2. **Lazy Loading**
   - Imagens carregam sob demanda
   - Reduz payload inicial

3. **Preloading**
   - Assets críticos carregam na inicialização
   - Melhora UX durante navegação

4. **Fallback Gracioso**
   - Emoji alternativo mantém UI consistente
   - Sem quebra visual se imagem falhar

---

## 🔧 Troubleshooting

### Imagem não aparece
1. Verifique se arquivo existe em `public/assets/`
2. Confirme nome do arquivo está correto
3. Verifique console para erros de carregamento
4. Emoji fallback deve aparecer automaticamente

### Mapeamento inválido
1. Use `addConsumableMapping()` para adicionar custom maps
2. Nomes são case-insensitive (automaticamente normalizados)
3. Atualize `CONSUMABLE_ASSET_MAP` ou `EQUIPMENT_ASSET_MAP` conforme necessário

### Performance lenta
1. Verifique se `preloadCriticalAssets()` foi chamado
2. Considere usar tamanho 'sm' para listas grandes
3. Valide compressão de imagens em `public/assets/`

---

## 📚 Referências

- [Asset Mapping Guide](../asset-mapping.md)
- [Asset Manager API](../asset-utils.ts)
- [Modelos de Dados](../../models/consumable.model.ts)
- [Modelos de Dados](../../models/equipment.model.ts)



