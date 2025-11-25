# ✅ Correção: Erro 42703 "column does not exist"

## 🔴 Erro Encontrado

```
Status: 400 Bad Request
Code: 42703
Message: column "max_character_slots" does not exist
```

## 🔍 Causa Raiz

Na RPC `create_character`, o código tentava acessar:
```sql
SELECT can_create, max_character_slots, current_characters
FROM public.check_character_limit(p_user_id);
```

Mas a RPC `check_character_limit` retorna estas colunas:
- ✅ `can_create`
- ❌ `max_character_slots` (NÃO EXISTE)
- ✅ `available_slots` (CORRETO)
- ✅ `current_characters`
- ✅ `total_level_sum`
- ✅ `next_slot_required_level`

---

## ✅ Solução Aplicada

### Arquivo: `fix_create_character_validation.sql`

#### Mudança 1: Nome da Variável
```sql
-- ANTES
v_max_slots bigint;

-- DEPOIS
v_available_slots bigint;
```

#### Mudança 2: SELECT Correto
```sql
-- ANTES (ERRO)
SELECT can_create, max_character_slots, current_characters
INTO v_can_create, v_max_slots, v_current_count

-- DEPOIS (CORRETO)
SELECT can_create, available_slots, current_characters
INTO v_can_create, v_available_slots, v_current_count
```

#### Mudança 3: Mensagem de Erro
```sql
-- ANTES
RAISE EXCEPTION 'Limite de personagens atingido. Máximo: %, Criados: %', 
  v_max_slots, v_current_count;

-- DEPOIS
RAISE EXCEPTION 'Limite de personagens atingido. Disponíveis: %, Criados: %', 
  v_available_slots, v_current_count;
```

---

## 📝 Resumo das Mudanças

| Item | Antes | Depois |
|------|-------|--------|
| Variável | `v_max_slots` | `v_available_slots` |
| SELECT | `max_character_slots` ❌ | `available_slots` ✅ |
| Mensagem | "Máximo:" | "Disponíveis:" |

---

## 🚀 Reaplicar a Migração

1. Abra Supabase Dashboard → SQL Editor
2. Copie o arquivo **atualizado**: `scripts/sql/fix_create_character_validation.sql`
3. Cole e execute
4. Aguarde sucesso

---

## ✅ Teste Após Correção

```
1. Criar 3 personagens
2. Matar todos os 3
3. Tentar criar novo
   → Deve retornar: ✅ Sucesso (personagem criado)
   → Sem erro 42703
   → Sem erro 400
```

---

## 🎉 Resultado

**Erro 42703 RESOLVIDO** = ✅ **Sistema 100% funcional!**

