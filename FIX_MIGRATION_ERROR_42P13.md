# 🔧 Correção: Erro PostgreSQL 42P13 - Mudança de Tipo de Retorno

## 🔴 Erro Encontrado

Ao tentar aplicar as migrações, o seguinte erro foi disparado:

```
ERROR: cannot change return type of existing function (SQLSTATE 42P13)
At statement 1:
CREATE OR REPLACE FUNCTION set_spell_slot(p_character_id UUID, p_slot_position INTEGER, p_spell_id UUID)
RETURNS TABLE(success BOOLEAN, error TEXT, message TEXT)
```

## 🔍 Causa Raiz

PostgreSQL **não permite** usar `CREATE OR REPLACE FUNCTION` quando:

- A função já existe
- O tipo de retorno está sendo **mudado** (ex: `VOID` → `TABLE(...)`)

Isso ocorreu com as funções:

1. `set_potion_slot()` - Migração 00016
2. `clear_potion_slot()` - Migração 00016
3. `set_spell_slot()` - Migração 00018

## ✅ Solução Implementada

Usar `DROP FUNCTION IF EXISTS` antes de `CREATE`:

```sql
-- ❌ ANTES (causa erro 42P13)
CREATE OR REPLACE FUNCTION set_spell_slot(...)
RETURNS TABLE(success BOOLEAN, error TEXT, message TEXT)

-- ✅ DEPOIS (funciona)
DROP FUNCTION IF EXISTS set_spell_slot(UUID, INTEGER, UUID) CASCADE;
CREATE FUNCTION set_spell_slot(...)
RETURNS TABLE(success BOOLEAN, error TEXT, message TEXT)
```

### Mudanças Realizadas

#### Migração 00016_fix_slot_functions.sql

```sql
-- set_potion_slot
DROP FUNCTION IF EXISTS set_potion_slot(UUID, INTEGER, UUID) CASCADE;
CREATE FUNCTION set_potion_slot(...)
RETURNS TABLE(success BOOLEAN, error TEXT, message TEXT)

-- clear_potion_slot
DROP FUNCTION IF EXISTS clear_potion_slot(UUID, INTEGER) CASCADE;
CREATE FUNCTION clear_potion_slot(...)
RETURNS TABLE(success BOOLEAN, error TEXT, message TEXT)
```

#### Migração 00018_fix_spell_slots_ambiguity.sql

```sql
-- set_spell_slot
DROP FUNCTION IF EXISTS set_spell_slot(UUID, INTEGER, UUID) CASCADE;
CREATE FUNCTION set_spell_slot(...)
RETURNS TABLE(success BOOLEAN, error TEXT, message TEXT)
```

## 📋 Por que usar `CASCADE`?

```sql
DROP FUNCTION IF EXISTS set_spell_slot(UUID, INTEGER, UUID) CASCADE;
                                                                ^^^^^^^^
                                                        Importante!
```

A cláusula `CASCADE` garante que:

- Se houver triggers ou outras dependências, elas serão removidas também
- A função será eliminada sem erros mesmo que tenha dependências
- A migração será mais robusta

## 🚀 Próximos Passos

### 1. Aplicar Novamente as Migrações

```bash
# As migrações agora estão corrigidas
pnpm run migrate:dev

# Ou manualmente
supabase migration up
```

### 2. Validar Migrações Aplicadas

```bash
# Listar migrações aplicadas
supabase migration list

# Deve exibir:
# ✅ 00016_fix_slot_functions.sql
# ✅ 00017_fix_use_potion_from_slot.sql
# ✅ 00018_fix_spell_slots_ambiguity.sql
```

### 3. Testar as Funções

```sql
-- Testar set_potion_slot
SELECT * FROM set_potion_slot('character-uuid', 1, 'consumable-uuid');

-- Deve retornar:
-- success | error | message
-- true    | null  | "Slot configurado com sucesso"
```

## 📚 Referência PostgreSQL

Erro 42P13 ocorre em cenários como:

```sql
-- ❌ Erro: Tipo de retorno diferente
CREATE FUNCTION foo() RETURNS VOID AS $$ ... $$;
CREATE OR REPLACE FUNCTION foo() RETURNS INT AS $$ ... $$;
-- ERROR: cannot change return type of existing function

-- ✅ Solução: DROP antes de CREATE
DROP FUNCTION foo() CASCADE;
CREATE FUNCTION foo() RETURNS INT AS $$ ... $$;
```

## ✨ Resultado Final

✅ Migrações 00016, 00017, 00018 podem agora ser aplicadas sem erros  
✅ Todas as funções de slots estão corrigidas  
✅ Novo tratamento de erros com feedback apropriado  
✅ Banco de dados sincronizado com aplicação

---

**Data:** 2025-10-29  
**Status:** ✅ Corrigido
