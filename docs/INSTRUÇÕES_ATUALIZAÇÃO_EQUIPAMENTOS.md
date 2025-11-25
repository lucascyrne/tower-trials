# 📋 Instruções: Atualização de Equipamentos

## 🎯 Objetivo
Expandir o sistema de equipamentos com novos tipos (capacetes, perneiras, escudos, anéis, colares) e atualizar os equipamentos existentes para usar categorias mais específicas.

---

## ⚠️ PRÉ-REQUISITOS

Você precisa do **Supabase CLI** instalado. Se não tiver:
```bash
npm install -g supabase
```

---

## 📝 O QUE SERÁ FEITO

### 1. **Expandir o ENUM de Tipos de Equipamento**
Adicionar novos tipos ao banco de dados:
- `helmet` - Capacetes/Elmos
- `chest` - Peitorais/Torso
- `legs` - Perneiras/Calças
- `boots` - Botas/Sapatos
- `shield` - Escudos
- `ring` - Anéis
- `necklace` - Colares e Amuletos

### 2. **Atualizar Equipamentos Existentes**
- Botas: `accessory` → `boots`
- Anéis: `accessory` → `ring`
- Amuletos: `accessory` → `necklace`
- Armaduras genéricas: `armor` → `chest`

### 3. **Adicionar Novos Equipamentos**
- 12 capacetes (common → legendary)
- 12 perneiras (common → legendary)
- 12 escudos (common → legendary)
- 10 botas adicionais (common → legendary)

**Total: 46 novos equipamentos!**

---

## 🚀 PASSO A PASSO DE EXECUÇÃO

### **OPÇÃO 1: Via Supabase Dashboard (Recomendado para Primeira Vez)**

#### Passo 1: Aplicar a Migration 00033
1. Abra o [Supabase Dashboard](https://app.supabase.com)
2. Vá para: **SQL Editor** → **New Query**
3. Copie o conteúdo do arquivo: `supabase/migrations/00033_expand_equipment_types.sql`
4. Cole no editor SQL
5. Clique em **Run**
6. ✅ Você deve ver a mensagem de sucesso

#### Passo 2: Aplicar a Migration 00034
1. Abra um novo **SQL Query**
2. Copie o conteúdo do arquivo: `supabase/migrations/00034_add_unique_constraint_equipment_name.sql`
3. Cole no editor SQL
4. Clique em **Run**
5. ✅ Você deve ver a mensagem de sucesso

#### Passo 3: Executar o Script de Atualização
1. Abra um novo **SQL Query**
2. Copie o conteúdo do arquivo: `supabase/update_equipment.sql`
3. Cole no editor SQL
4. Clique em **Run**
5. ✅ Você deve ver as mensagens:
   - `✓ Equipamentos atualizados com sucesso!`
   - `✓ Total de capacetes: 12`
   - `✓ Total de perneiras: 12`
   - `✓ Total de escudos: 12`
   - `✓ Total de botas: 10`

---

### **OPÇÃO 2: Via Supabase CLI (Para Produção)**

#### Passo 1: Resetar o Banco (⚠️ REMOVE TODOS OS DADOS!)
```bash
cd C:\Projects\workspace\tower-trials
supabase db push
```

#### Passo 2: Reseed de Dados
```bash
supabase db pull
npm run seed  # Se existir script de seed configurado
```

---

### **OPÇÃO 3: Verificação Manual Pós-Execução**

Para confirmar que tudo funcionou, execute estas queries no SQL Editor:

```sql
-- Ver tipos de equipamento disponíveis
SELECT DISTINCT type FROM equipment ORDER BY type;

-- Contar novos capacetes
SELECT COUNT(*) as capacetes FROM equipment WHERE type = 'helmet';

-- Contar novos escudos
SELECT COUNT(*) as escudos FROM equipment WHERE type = 'shield';

-- Contar perneiras
SELECT COUNT(*) as perneiras FROM equipment WHERE type = 'legs';

-- Listar todos os capacetes
SELECT name, rarity, level_requirement FROM equipment WHERE type = 'helmet' ORDER BY level_requirement;

-- Listar todos os escudos
SELECT name, rarity, level_requirement FROM equipment WHERE type = 'shield' ORDER BY level_requirement;

-- Listar todas as perneiras
SELECT name, rarity, level_requirement FROM equipment WHERE type = 'legs' ORDER BY level_requirement;
```

---

## 🔄 ORDEM CORRETA DE EXECUÇÃO

```
1️⃣  Aplicar Migration 00033 (expande enum)
       ↓
2️⃣  Aplicar Migration 00034 (adiciona constraint UNIQUE)
       ↓
3️⃣  Executar update_equipment.sql (atualiza e insere)
       ↓
4️⃣  Verificar com queries SQL
       ↓
5️⃣  Restart do servidor frontend (ng serve)
```

---

## ⚠️ TROUBLESHOOTING

### Erro: `ERROR: 22P02: invalid input value for enum equipment_type`
**Solução:** Você esqueceu de aplicar a Migration 00033 primeiro. Execute-a antes do update_equipment.sql.

### Erro: `ERROR: 42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification`
**Solução:** Você esqueceu de aplicar a Migration 00034 primeiro. A migration 00034 adiciona a constraint UNIQUE necessária para o ON CONFLICT funcionar. Execute-a na ordem correta:
1. Migration 00033 (tipos de equipamento)
2. Migration 00034 (constraint UNIQUE)
3. update_equipment.sql (insere dados)

### Erro: `ERROR: duplicate key value violates unique constraint`
**Solução:** Alguns equipamentos já existem. O script usa `ON CONFLICT (name) DO NOTHING` para evitar, então não é problema. Basta reexecutar.

### Os novos equipamentos não aparecem no jogo?
**Solução:** 
1. Verifique se `is_unlocked = true` para equipamentos comuns
2. Faça refresh da página (Ctrl+Shift+R)
3. Limpe cache: `npm run build && npm run dev`

---

## 📊 RESUMO DE EQUIPAMENTOS POR TIPO

| Tipo | Quantidade | Raridade | Nível |
|------|-----------|----------|-------|
| **Capacetes** | 12 | common → legendary | 1-20 |
| **Perneiras** | 12 | common → legendary | 1-20 |
| **Escudos** | 12 | common → legendary | 1-20 |
| **Botas** | 10 | common → legendary | 1-20 |
| **TOTAL** | **46** | - | - |

---

## 📁 ARQUIVOS MODIFICADOS/CRIADOS

- ✨ `supabase/migrations/00033_expand_equipment_types.sql` (NOVO)
- ✏️ `supabase/update_equipment.sql` (NOVO)
- ✏️ `supabase/seed.sql` (ATUALIZADO - novos equipamentos adicionados)
- ℹ️ Este arquivo de instruções

---

## 🎮 PRÓXIMOS PASSOS (Opcional)

Depois que os equipamentos estiverem adicionados, você pode:

1. **Atualizar a UI** para mostrar slots de equipment específicos:
   - `helmet_slot`
   - `chest_slot`
   - `legs_slot`
   - `boots_slot`
   - `shield_slot`
   - `ring_1_slot`, `ring_2_slot`
   - `necklace_slot`

2. **Adicionar restrições** de tipo de equipamento nos slots

3. **Criar sistema de vestiário** (transmog)

---

## ✅ CHECKLIST FINAL

- [ ] Migration 00033 aplicada com sucesso
- [ ] Migration 00034 aplicada com sucesso
- [ ] Script update_equipment.sql executado
- [ ] Queries de verificação retornam os valores esperados
- [ ] Frontend reiniciado
- [ ] Novos equipamentos visíveis no jogo
- [ ] Sem erros de enum type inválido
- [ ] Sem erros de constraint UNIQUE

---

**Última Atualização:** Novembro de 2025  
**Versão:** 1.0  
**Status:** Pronto para uso ✅
