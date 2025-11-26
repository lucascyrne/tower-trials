# 🚀 Guia Rápido de Assets

## TL;DR - O que mudou?

✅ **Novos componentes criados:**
- `ConsumableImage` - Exibe ícones de consumíveis
- `EquipmentImage` - Exibe ícones de equipamentos

✅ **Arquivos atualizados:**
- `src/utils/asset-utils.ts` - Mapeamento expandido
- `src/components/ui/consumable-image.tsx` - Mais consumíveis suportados

---

## 💡 Uso Rápido

### Exibir Consumível
```tsx
import { ConsumableImage } from '@/components/ui/consumable-image';

<ConsumableImage consumable={potion} size="md" />
```

### Exibir Equipamento
```tsx
import { EquipmentImage } from '@/components/ui/equipment-image';

<EquipmentImage equipment={sword} size="md" />
```

---

## 📂 Assets Disponíveis

### Consumíveis
| Nome | Arquivo |
|------|---------|
| Poção de Vida Pequena | `small_health_potion.png` |
| Poção de Vida Média | `medium_health_potion.png` |
| Poção de Vida Grande | `large_mana_potion.png` |
| Poção de Mana Pequena | `small_mana_potion.png` |
| Poção de Mana Média | `medium_mana_potion.png` |
| Poção de Mana Grande | `large_mana_potion.png` |
| Elixir de Força | `strength_elixir.png` |
| Elixir de Defesa | `defense_elixir.png` |
| Antídoto | `antidote.png` |

### Equipamentos
| Tipo | Exemplos |
|------|----------|
| Espadas | `iron_sword.png`, `steel_sword.png` |
| Cajados | `wooden_staff.png`, `oak_staff.png` |
| Adagas | `bronze_dagger.png` |
| Machados | `battle_axe.png` |
| Armaduras | `leather_armor.png`, `chainmail_armor.png`, `scale_armor.png` |
| Roupas | `apprentice_robe.png`, `occultist_cloak.png`, `light_vestments.png` |
| Botas | `swift_boots.png` |
| Anéis | `strength_ring.png`, `mana_ring.png` |
| Amuletos | `protection_amulet.png`, `arcane_amulet.png` |

---

## 🎯 Tamanhos Disponíveis

```
size="sm"  →  16px × 16px   (para listas, menus)
size="md"  →  24px × 24px   (padrão, inventário)
size="lg"  →  32px × 32px   (destaque, detalhe)
size="xl"  →  48px × 48px   (preview grande)
```

---

## 🔄 Compatibilidade Automática

✨ Ambos componentes:
- Detectam tipo automaticamente pelo nome
- Suportam nomes em português e inglês
- Têm fallback a emoji se imagem falhar
- Implementam lazy loading automático
- Mostram loading skeleton durante carregamento

---

## 📍 Localização de Assets

```
Desenvolvimento:  public/assets/icons/
Produção:         /assets/icons/
```

Componentes importam direto de `src/assets/icons/` para máxima compatibilidade.

---

## ⚙️ Usar AssetManager Diretamente

```tsx
import { AssetManager } from '@/utils/asset-utils';

// Obter caminho
const icon = AssetManager.getConsumableIcon(item);
const armor = AssetManager.getEquipmentIcon(item);

// Pré-carregar
await AssetManager.preloadCriticalAssets();

// Custom mapping
AssetManager.addConsumableMapping('meu-item', 'arquivo.png');
```

---

## 🆘 Não Encontrou Seu Item?

1. **Verificar nome** - Pode estar com nome ligeiramente diferente
2. **Custom Mapping** - Use `addConsumableMapping()` para adicionar
3. **Fallback** - Emoji será mostrado se houver erro
4. **Novo Asset** - Adicione arquivo em `public/assets/` e atualize mapeamento

---

## 📋 Checklist de Implementação

- [ ] Importou componente correto (`ConsumableImage` vs `EquipmentImage`)
- [ ] Passou objeto correto (`Consumable` vs `Equipment`)
- [ ] Escolheu tamanho apropriado (`sm`, `md`, `lg`, `xl`)
- [ ] Asset existe em `public/assets/icons/`
- [ ] Arquivo não tem espaços (use underscore: `small_potion.png`)

---

## 🎨 Exemplo Completo

```tsx
import { ConsumableImage } from '@/components/ui/consumable-image';
import { EquipmentImage } from '@/components/ui/equipment-image';

export function Item({ item }) {
  const isConsumable = 'effect_value' in item;

  return (
    <div className="flex items-center gap-3">
      {isConsumable ? (
        <ConsumableImage consumable={item} size="lg" />
      ) : (
        <EquipmentImage equipment={item} size="lg" />
      )}
      <div>
        <h3>{item.name}</h3>
        <p>{item.description}</p>
      </div>
    </div>
  );
}
```

---

## 📞 Suporte

Para questões mais detalhadas, veja:
- `src/components/ui/README.md` - Documentação completa
- `src/utils/asset-mapping.md` - Mapeamento detalhado
- `ASSET_UPDATES.md` - Histórico de mudanças

---

**Última atualização:** 25 de Novembro, 2025 ✨



