# ⚔️ Sistema de Armas Two-Handed (Duas Mãos)

## 📋 Problema Identificado
O "Machado de Batalha" e outras armas pesadas estavam sendo equipadas na mão secundária (off_hand) ao invés de ocuparem ambas as mãos, causando equipamento incorreto de armas que deveriam ser two-handed.

## ✅ Solução Implementada

### 1. **Banco de Dados** (`00032_add_two_handed_flag_to_equipment.sql`)
- Adicionada coluna `is_two_handed BOOLEAN DEFAULT FALSE` à tabela `equipment`
- Criado índice para busca rápida de armas two-handed
- Migration pronta para aplicação ao banco

### 2. **Modelo TypeScript** (`src/models/equipment.model.ts`)
- Adicionado campo `is_two_handed?: boolean` ao interface `Equipment`
- Novas funções helper:
  - `isTwoHandedWeapon(equipment)` - verifica se uma arma é two-handed
  - `hasTwoHandedWeapon(slots)` - verifica se há two-handed equipada

### 3. **Lógica de Equipamento** (`src/services/equipment.service.ts`)
- Atualizado `determineEquipmentSlot()`:
  - Armas two-handed SEMPRE vão para `main_hand`
  - Nunca tentam ir para `off_hand`
  - Substituem ambos os slots automaticamente
- Atualizado `canEquipItem()`:
  - Validação especial para armas two-handed
  - Mensagens claras sobre substituição de slots

### 4. **Interface de Seleção** (`src/routes/.../equipment/select.tsx`)
- Atualizado `isEquipmentCompatibleWithSlot()`:
  - Armas two-handed bloqueadas em `off_hand`
  - Validação ocorre antes do resto da lógica
- Adicionadas badges visuais:
  - Badge "⚔️ Two-Handed" em listagem
  - Aviso em laranja na seção de detalhes
  - Descrição clara das limitações

### 5. **Data** (`supabase/seed.sql`)
- Todos os 135+ equipamentos agora incluem coluna `is_two_handed`
- Armas two-handed marcadas como `TRUE`:
  - **Uncommon**: Machado de Batalha
  - **Rare**: Machado de Guerra, Martelo de Guerra
  - **Epic**: Martelo de Titã, Bastão de Necromante, Machado Devastador
  - **Legendary**: Mjolnir, Cajado de Merlin, Machado dos Berserkers, Maça Divina, Cajado das Tempestades

## 🎮 Comportamento

### Antes (BUGADO)
```
Equipar: Machado de Batalha (two-handed)
Resultado: 
  - main_hand: vazio
  - off_hand: Machado de Batalha ❌
```

### Depois (CORRETO)
```
Equipar: Machado de Batalha (two-handed)
Resultado:
  - main_hand: Machado de Batalha ✅
  - off_hand: BLOQUEADO (ocupado pelo two-handed)
```

## 📊 Armas Two-Handed por Rarity

| Rarity | Arma | Tipo | Ataque |
|--------|------|------|--------|
| Uncommon | Machado de Batalha | axe | +15 |
| Rare | Machado de Guerra | axe | +28 |
| Rare | Martelo de Guerra | blunt | +30 |
| Epic | Martelo de Titã | blunt | +50 |
| Epic | Bastão de Necromante | staff | +30 |
| Epic | Machado Devastador | axe | +45 |
| Legendary | Mjolnir | blunt | +100 |
| Legendary | Cajado de Merlin | staff | +50 |
| Legendary | Machado dos Berserkers | axe | +85 |
| Legendary | Maça Divina | blunt | +90 |
| Legendary | Cajado das Tempestades | staff | +28 |

## 🛠️ Como Aplicar

### 1. Aplicar Migration
```bash
# Supabase CLI
supabase migration up 00032_add_two_handed_flag_to_equipment

# Ou manualmente no SQL Editor
-- Copiar e executar: supabase/migrations/00032_add_two_handed_flag_to_equipment.sql
```

### 2. Resetar Seed (opcional, recomendado)
```bash
# Executar o novo seed com is_two_handed
psql your_connection_string -f supabase/seed.sql
```

### 3. Deployar Código
- TypeScript mudanças: modelo e serviços
- React mudanças: interface de seleção
- Sem breaking changes - totalmente backward compatible

## ✨ Benefícios

✅ **Realismo**: Armas pesadas ocupam ambas as mãos como deveria ser
✅ **Clareza**: UI mostra claramente quais armas são two-handed
✅ **Controle**: Limite automático sobre equipamento incompatível
✅ **Balance**: Evita exploit de carregar armas massivas na off-hand
✅ **Extensível**: Fácil adicionar/remover armas two-handed ajustando flag

## 🔄 Alterações de Código

### Arquivos Modificados:
1. ✅ `src/models/equipment.model.ts` - Modelo
2. ✅ `src/services/equipment.service.ts` - Lógica
3. ✅ `src/routes/.../equipment/select.tsx` - UI
4. ✅ `supabase/migrations/00032_...sql` - DB
5. ✅ `supabase/seed.sql` - Data

### Linhas de Código:
- **Adicionadas**: ~50
- **Modificadas**: ~135 (insert statements)
- **Removidas**: 0 (backward compatible)

## 📝 Notas de Release

### Para QA:
1. Testar equipamento do "Machado de Batalha" em qualquer personagem
2. Verificar que ocupa ambas as mãos
3. Verificar que não pode equipar escudo simultaneamente
4. Verificar badge "Two-Handed" apareça na UI

### Para Players:
- Armas pesadas (machados, martelos lendários) agora ocupam corretamente ambas as mãos
- Não é mais possível equipar dois itens quando uma arma two-handed está ativa
- Visualização clara de quais armas são two-handed antes de equipar
