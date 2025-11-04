# ⚡ Quick Start: Atualização de Equipamentos

## 🚀 Ordem de Execução (Copie e Cole)

### Passo 1: Migration 00033
**Arquivo:** `supabase/migrations/00033_expand_equipment_types.sql`

Copie TODO o conteúdo → Supabase Dashboard → SQL Editor → New Query → RUN

### Passo 2: Migration 00034 ⭐ CRÍTICO
**Arquivo:** `supabase/migrations/00034_add_unique_constraint_equipment_name.sql`

Copie TODO o conteúdo → Supabase Dashboard → SQL Editor → New Query → RUN

**⚠️ SE PULAR ESTE PASSO, RECEBERÁ ERRO!**

### Passo 3: Update Script
**Arquivo:** `supabase/update_equipment.sql`

Copie TODO o conteúdo → Supabase Dashboard → SQL Editor → New Query → RUN

### Passo 4: Verificar
Cole no SQL Editor:
```sql
SELECT DISTINCT type FROM equipment ORDER BY type;
```

**Resultado esperado:** 10 tipos diferentes

---

## 🎯 Resumo em 1 Minuto

| # | Ação | Arquivo | Status |
|---|------|---------|--------|
| 1️⃣ | Execute Migration | `00033_expand_equipment_types.sql` | ✅ |
| 2️⃣ | Execute Migration | `00034_add_unique_constraint_equipment_name.sql` | ✅ |
| 3️⃣ | Execute Script | `update_equipment.sql` | ✅ |
| 4️⃣ | Reinicie Frontend | - | ✅ |

---

## ❌ Erros Comuns

### Erro 1: `invalid input value for enum equipment_type`
→ Pulou Migration 00033
→ **Solução:** Execute 00033 primeiro

### Erro 2: `there is no unique or exclusion constraint` ⭐
→ Pulou Migration 00034
→ **Solução:** Execute 00034 ANTES de update_equipment.sql

### Erro 3: `duplicate key value`
→ Equipamentos duplicados já existem
→ **Solução:** Normal! Script evita duplicação. Reexecute.

---

## ✅ Pronto!

Após completar os 4 passos:
- 🎮 46 novos equipamentos adicionados
- 📊 10 tipos de equipamento (antes eram 3)
- ⚔️ 12 capacetes, 12 perneiras, 12 escudos, 10 botas

---

**Tempo total:** ~5 minutos  
**Dificuldade:** Muito Fácil ✨
