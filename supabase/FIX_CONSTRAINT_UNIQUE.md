# 🔧 Fix: Constraint UNIQUE para ON CONFLICT

## 🚨 O Erro Recebido

```
ERROR:  42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification
```

---

## 🔍 Análise do Problema

### O Que Aconteceu?

O script `update_equipment.sql` usava:
```sql
INSERT INTO equipment (...) VALUES (...)
ON CONFLICT (name) DO NOTHING;
```

Mas a tabela `equipment` não tinha uma constraint UNIQUE na coluna `name`.

### Por Que Funciona Assim?

Em PostgreSQL, `ON CONFLICT` só funciona com:
- ✅ Constraint UNIQUE
- ✅ Constraint PRIMARY KEY
- ✅ Constraint EXCLUSION

Sem uma dessas, PostgreSQL não sabe como detectar conflitos!

### Anatomia do Erro

```
ERROR:  42P10
         └─ Código do erro (erro de conflato de constraint)

"there is no unique or exclusion constraint matching the ON CONFLICT specification"
 └─ Mensagem: "não há constraint UNIQUE ou EXCLUSION que corresponda"
```

---

## ✅ A Solução: Migration 00034

### O Que Faz?

Adiciona constraint UNIQUE na coluna `name`:

```sql
-- Adicionar constraint UNIQUE
ALTER TABLE equipment ADD CONSTRAINT unique_equipment_name UNIQUE (name);

-- Criar índice para performance
CREATE INDEX idx_equipment_name ON equipment(name);
```

### Como Funciona?

**Antes:**
```
equipment table
├─ id (PK - sem ON CONFLICT)
├─ name (sem constraint UNIQUE)
├─ description
├─ type
└─ ... outros campos
```

**Depois:**
```
equipment table
├─ id (PK)
├─ name (✅ UNIQUE - permite ON CONFLICT!)
├─ description
├─ type
└─ ... outros campos
```

---

## 🎯 Sequência Correta

```
1️⃣  Migration 00033
    ALTER TYPE equipment_type ADD VALUE 'helmet';
    ALTER TYPE equipment_type ADD VALUE 'chest';
    ... (expande ENUM)
    
2️⃣  Migration 00034 ← NECESSÁRIA!
    ALTER TABLE equipment ADD CONSTRAINT unique_equipment_name UNIQUE (name);
    CREATE INDEX idx_equipment_name ON equipment(name);
    
3️⃣  update_equipment.sql
    INSERT INTO equipment (...) VALUES (...)
    ON CONFLICT (name) DO NOTHING;  ← Agora funciona!
```

### Por Que Essa Ordem?

1. **00033** expande o ENUM (permite novos tipos)
2. **00034** adiciona constraint UNIQUE (permite ON CONFLICT)
3. **update_equipment.sql** usa ambos para inserir dados

Se pular a step 2, recebe o erro!

---

## 📊 Antes vs Depois

### Antes (Erro)
```sql
-- update_equipment.sql tenta:
INSERT INTO equipment (name, ...) VALUES ('Capacete de Couro', ...)
ON CONFLICT (name) DO NOTHING;

-- PostgreSQL responde:
-- ERROR: 42P10 - não tem constraint UNIQUE em 'name'!
-- ❌ Falha
```

### Depois (Sucesso)
```sql
-- Migration 00034 adicionou constraint:
ALTER TABLE equipment ADD CONSTRAINT unique_equipment_name UNIQUE (name);

-- update_equipment.sql agora funciona:
INSERT INTO equipment (name, ...) VALUES ('Capacete de Couro', ...)
ON CONFLICT (name) DO NOTHING;

-- PostgreSQL responde:
-- ✅ Sucesso! Se 'Capacete de Couro' já existe, ignora. Caso contrário, insere.
```

---

## 🔐 Por Que UNIQUE é Seguro?

### Garantias Fornecidas

- ✅ Sem duplicação de nomes de equipamentos
- ✅ Buscas por nome são rápidas (índice automático)
- ✅ ON CONFLICT agora funciona perfeitamente
- ✅ Dados seguros (constraint a nível de banco)

### Dados Existentes?

Se houver equipamentos com nomes duplicados:

```
Migration 00034 vai FALHAR se:
- Já existem 2+ equipamentos com o mesmo name
```

Solução (se necessário):
```sql
-- Deletar duplicatas antes de adicionar constraint
DELETE FROM equipment WHERE id NOT IN (
  SELECT MIN(id) FROM equipment GROUP BY name
);

-- Depois rodar a migration
```

---

## 📝 Summary

| Aspecto | Detalhes |
|---------|----------|
| **Erro** | `42P10: there is no unique or exclusion constraint` |
| **Causa** | Coluna `name` sem constraint UNIQUE |
| **Solução** | Migration 00034 (adiciona UNIQUE) |
| **Arquivo** | `supabase/migrations/00034_add_unique_constraint_equipment_name.sql` |
| **Impacto** | Permite ON CONFLICT em INSERTs |
| **Performance** | Melhora buscas por nome (índice automático) |
| **Segurança** | Garante nomes únicos de equipamentos |

---

## 🚀 Próximos Passos

1. ✅ Aplicar Migration 00033 (tipos)
2. ✅ Aplicar Migration 00034 (constraint) ← CRÍTICO!
3. ✅ Executar update_equipment.sql
4. ✅ Verificar com queries SQL

Se pular o passo 2, vai receber o erro novamente!

---

**Status:** ✅ Corrigido e Documentado  
**Versão:** 1.0  
**Data:** Novembro 2025
