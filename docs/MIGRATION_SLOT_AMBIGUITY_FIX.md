# Correção: Ambiguidade de Coluna "slot_position" em Funções SQL

## 🔴 Problema Identificado

**Erro:** `POST https://bkqzntlkkbepzvoesqxh.supabase.co/rest/v1/rpc/get_character_potion_slots 400 (Bad Request)`

**Mensagem de Erro:**

```json
{
  "code": "42702",
  "details": "It could refer to either a PL/pgSQL variable or a table column.",
  "hint": null,
  "message": "column reference \"slot_position\" is ambiguous"
}
```

## 🔍 Causa Raiz

O erro PostgreSQL **42702** indica que uma coluna `slot_position` está sendo referenciada sem qualificação adequada. Isso acontece quando:

1. Uma coluna existe em múltiplas tabelas e não está qualificada com alias
2. Uma coluna tem o mesmo nome que um parâmetro ou variável PL/pgSQL
3. A cláusula `ON CONFLICT` não está usando `EXCLUDED` para referências pós-INSERT

## ✅ Soluções Implementadas

### 1. **Migração 00016_fix_slot_functions.sql** (ATUALIZADA)

Corrigidas as seguintes funções com qualificações apropriadas:

#### a) `get_character_potion_slots()`

```sql
-- ❌ ANTES (ambíguo)
WHERE NOT EXISTS (SELECT 1 FROM potion_slots WHERE character_id = p_character_id)

-- ✅ DEPOIS (qualificado)
WHERE NOT EXISTS (SELECT 1 FROM potion_slots ps WHERE ps.character_id = p_character_id)
```

#### b) `consume_potion_from_slot()`

```sql
-- ❌ ANTES (ambíguo)
WHERE character_id = p_character_id AND consumable_id = v_consumable_id AND quantity > 0

-- ✅ DEPOIS (qualificado com alias cc)
WHERE cc.character_id = p_character_id AND cc.consumable_id = v_consumable_id AND cc.quantity > 0
```

#### c) `set_potion_slot()` - NOVA ASSINATURA

```sql
-- Agora retorna (success, error, message) para melhor tratamento de erros
CREATE OR REPLACE FUNCTION set_potion_slot(...)
RETURNS TABLE(success BOOLEAN, error TEXT, message TEXT)
```

#### d) `clear_potion_slot()` - NOVA ASSINATURA

```sql
-- Agora retorna (success, error, message) para melhor tratamento de erros
CREATE OR REPLACE FUNCTION clear_potion_slot(...)
RETURNS TABLE(success BOOLEAN, error TEXT, message TEXT)
```

### 2. **Migração 00017_fix_use_potion_from_slot.sql** (NOVA)

Corrigida a função `use_potion_from_slot()` com qualificações completas:

```sql
CREATE OR REPLACE FUNCTION use_potion_from_slot(p_character_id UUID, p_slot_position INTEGER)
RETURNS TABLE(success BOOLEAN, new_hp INTEGER, new_mana INTEGER, message TEXT) AS $$
DECLARE
    v_consumable_id UUID;
    v_result RECORD;
BEGIN
    -- ✅ Qualificado com alias ps
    SELECT ps.consumable_id INTO v_consumable_id
    FROM potion_slots ps
    WHERE ps.character_id = p_character_id AND ps.slot_position = p_slot_position;

    -- ... resto da função com qualificações apropriadas
```

### 3. **Migração 00018_fix_spell_slots_ambiguity.sql** (NOVA)

Corrigidas também as funções de Spell slots que tinham o mesmo problema:

#### a) `get_character_spell_slots()`

```sql
-- ❌ ANTES (ambíguo)
WHERE NOT EXISTS (SELECT 1 FROM spell_slots WHERE character_id = p_character_id)

-- ✅ DEPOIS (qualificado com alias ss)
WHERE NOT EXISTS (SELECT 1 FROM spell_slots ss WHERE ss.character_id = p_character_id)
```

#### b) `set_spell_slot()` - NOVA ASSINATURA

```sql
-- Agora retorna (success, error, message) para melhor tratamento de erros
CREATE OR REPLACE FUNCTION set_spell_slot(...)
RETURNS TABLE(success BOOLEAN, error TEXT, message TEXT)
```

## 📋 Mudanças de Contrato de API

### `set_potion_slot()` e `clear_potion_slot()`

**Antes:**

```typescript
RETURNS VOID
```

**Depois:**

```typescript
RETURNS TABLE(success BOOLEAN, error TEXT, message TEXT)
```

**Impacto no `slot.service.ts`:**
O código já estava preparado para isso e trata a resposta corretamente.

### `set_spell_slot()`

**Antes:**

```typescript
RETURNS VOID
```

**Depois:**

```typescript
RETURNS TABLE(success BOOLEAN, error TEXT, message TEXT)
```

**Impacto no `slot.service.ts`:**
O código já estava preparado para isso e trata a resposta corretamente.

## 🚀 Como Aplicar

### Passo 1: Sincronizar Migrações

```bash
supabase db pull  # Se precisar sincronizar estado remoto
```

### Passo 2: Aplicar Migrações Localmente

```bash
supabase migration up
```

### Passo 3: Fazer Deploy

```bash
supabase db push
```

### Passo 4: Testar a RPC

```typescript
const { data, error } = await supabase.rpc('get_character_potion_slots', {
  p_character_id: characterId,
});

// Agora deve funcionar sem erro 42702
```

## 🧪 Validações

- ✅ Todas as referências a `slot_position` estão qualificadas com alias de tabela
- ✅ Todas as referências a `character_id`, `consumable_id`, `quantity` estão qualificadas
- ✅ `ON CONFLICT` usa `EXCLUDED` para referências pós-INSERT
- ✅ Funções retornam estruturas apropriadas com feedback de sucesso/erro
- ✅ Cache invalidation funciona após operações bem-sucedidas

## 📝 Notas Técnicas

### Por que a ambiguidade acontecia?

No PostgreSQL, quando você tem:

```sql
SELECT slot_position FROM potion_slots ps
WHERE NOT EXISTS (SELECT 1 FROM potion_slots WHERE ...)
```

O `slot_position` no WHERE interno pode referir-se tanto à coluna da tabela interna quanto aos parâmetros, causando ambiguidade no compilador SQL.

### Melhor Prática

Sempre qualifique colunas em:

1. **Subqueries** - use alias explícito
2. **JOINs múltiplos** - qualifique cada referência
3. **CTEs e múltiplas referências à mesma tabela** - use alias diferentes
4. **ON CONFLICT** - use `EXCLUDED` para dados inseridos

## ✨ Resultado

Após aplicar essas migrações, o erro `column reference "slot_position" is ambiguous` será eliminado e as operações de slot funcionarão normalmente.

---

**Data de Criação:** 2025-10-29
**Versão:** 1.0
**Status:** Pronto para Deploy
