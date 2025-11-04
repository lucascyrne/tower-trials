# Correção: Classificação de Tipos de Equipamento

## Problema Identificado
"Vestes Leves" e outras peças de peitoral estavam aparecendo no slot de "capacetes" quando deveriam aparecer no slot de "peitoral".

## Raiz da Causa
Os tipos de equipamento foram mal classificados no `seed.sql`:

| Tipo | Significado | Slot Esperado | Exemplos Corretos |
|------|-------------|---------------|------------------|
| `'armor'` | **Escudos** - proteção na mão secundária | `armor` ou `off_hand` | Escudos, proteções portáteis |
| `'chest'` | **Peitoral** - peça corporal de armadura | `chest` | Armaduras, mantos, vestes, peças de corpo |
| `'helmet'` | **Capacete** | `helmet` | Capacetes, coroas |
| `'legs'` | **Perneiras** | `legs` | Perneiras, calças de batalha |
| `'boots'` | **Botas** | `boots` | Botas, sapatos |

## Itens Corrigidos
Todas as peças de **peitoral corporal** foram reclassificadas de `'armor'` para `'chest'`:

### Common (Nível 1)
- ✅ Armadura de Couro
- ✅ Túnica de Aprendiz
- ✅ **Vestes Leves** ← Principal problema

### Uncommon (Nível 5)
- ✅ Armadura de Malha
- ✅ Manto do Ocultista
- ✅ Armadura de Escamas

### Rare (Nível 10)
- ✅ Armadura de Placas
- ✅ Manto Elemental
- ✅ Armadura Dracônica

### Epic (Nível 15)
- ✅ Armadura de Mithril
- ✅ Vestes do Arquimago
- ✅ Pele de Behemoth

### Legendary (Nível 20)
- ✅ Armadura Divina
- ✅ Manto Celestial
- ✅ Pele de Leviatã

## Como Funciona
No `equipment.service.ts`, a função `getCharacterEquipmentComplete()` mapeia tipos para slots:

```typescript
switch (equipmentType) {
  case 'armor':
    // Escudos podem ir em armor ou off_hand
    slotKey = !equippedSlots.armor ? 'armor' : 'off_hand';
    break;
  case 'chest':
    // Peças de peitoral vão SEMPRE em chest
    slotKey = 'chest';
    break;
  // ... outros tipos
}
```

## Resultado
Agora "Vestes Leves" e todas as peças corporais aparecem corretamente no slot de **"peitoral"** 🎯
