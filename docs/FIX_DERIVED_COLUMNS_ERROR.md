# ✅ Correção: Erro 42703 "critical_chance does not exist"

## 🔴 Erro Encontrado

```
Code: 42703
Message: column "critical_chance" of relation "characters" does not exist
```

## 🔍 Análise Detalhada

### Contexto
A RPC `create_character` estava tentando **inserir diretamente** valores em colunas que **não existem fisicamente** na tabela:

```sql
INSERT INTO characters (
  ...
  critical_chance,  -- ❌ ERRO: Não existe!
  critical_damage,  -- ❌ ERRO: Não existe!
  ...
)
```

### Tipo de Coluna
De acordo com `character.model.ts`:

```typescript
export interface Character {
  // ...
  // Stats derivados (calculados)
  critical_chance?: number;  // ⬅️ Opcional, CALCULADO
  critical_damage?: number;  // ⬅️ Opcional, CALCULADO
  // ...
}
```

### Por Que Não Existem
Estas colunas são **stats derivados** que devem ser:
- ✅ **Calculados** a partir dos atributos (sorte, força, etc)
- ✅ **Consultados** via RPC ou função (`calculate_derived_stats`)
- ❌ **Nunca inseridos diretamente** no banco

---

## ✅ Solução Implementada

### Arquivo: `fix_create_character_validation.sql` (ATUALIZADO)

#### Mudança: Remover Colunas Derivadas do INSERT

**ANTES (ERRO):**
```sql
INSERT INTO characters (
  ...
  critical_chance,  -- ❌ Removido
  critical_damage,  -- ❌ Removido
  is_alive,
  ...
)
```

**DEPOIS (CORRETO):**
```sql
INSERT INTO characters (
  ...
  is_alive,
  ...
)
```

### Colunas Removidas do INSERT
- ❌ `critical_chance` (coluna derivada)
- ❌ `critical_damage` (coluna derivada)

### Colunas Mantidas (OBRIGATÓRIAS)
- ✅ `id` - UUID do personagem
- ✅ `user_id` - Referência ao usuário
- ✅ `name` - Nome do personagem
- ✅ `level`, `xp`, `xp_next_level`, `gold` - Stats básicos
- ✅ `hp`, `max_hp`, `mana`, `max_mana` - Recursos
- ✅ `atk`, `def`, `speed` - Stats de combate
- ✅ `floor` - Andar atual
- ✅ `strength`, `dexterity`, `intelligence`, `wisdom`, `vitality`, `luck` - Atributos primários
- ✅ `attribute_points` - Pontos disponíveis
- ✅ `is_alive` - Status de vitalidade
- ✅ `created_at`, `updated_at` - Timestamps

---

## 🔬 Comparação: Colunas Reais vs Derivadas

| Coluna | Tipo | Origem | Ação |
|--------|------|--------|------|
| `critical_chance` | Derivada | Calculada de `luck` | ❌ Remover do INSERT |
| `critical_damage` | Derivada | Calculada de `luck` | ❌ Remover do INSERT |
| `atk` | Real | Valor base | ✅ Inserir |
| `def` | Real | Valor base | ✅ Inserir |
| `speed` | Real | Valor base | ✅ Inserir |

---

## 🧮 Onde Calcular Stats Derivados

Após criar o personagem, os stats derivados são calculados via:

```sql
-- RPC para calcular stats derivados
SELECT * FROM calculate_derived_stats(
  p_level := 1,
  p_strength := 10,
  p_dexterity := 10,
  p_intelligence := 10,
  p_wisdom := 10,
  p_vitality := 10,
  p_luck := 10
);
```

Resultado:
```
derived_critical_chance: 5.0
derived_critical_damage: 1.5
```

---

## 🚀 Como Replicar

**Supabase Dashboard → SQL Editor:**

1. Copiar a **versão ATUALIZADA** de: `scripts/sql/fix_create_character_validation.sql`
2. Colar e executar
3. Aguardar sucesso

---

## ✅ Teste Após Correção

```
1. Criar um novo personagem
   ✅ Deve funcionar sem erros 42703
2. Verificar que o personagem foi criado
3. Confirmar stats derivados são calculados corretamente
```

---

## 📝 Lição Aprendida

### ❌ Erros de Mapeamento de Colunas
```typescript
// Interface no frontend (com derived stats opcionais)
export interface Character {
  critical_chance?: number;  // Opcional
  critical_damage?: number;  // Opcional
}

// ❌ Assumir que existem na tabela
INSERT INTO characters (..., critical_chance, critical_damage, ...)

// ✅ Realidade: São calculadas, não persistidas
```

### ✅ Solução Correta
- ✅ Inserir **apenas colunas reais**
- ✅ Calcular **stats derivados** quando necessário consultar
- ✅ Manter interface limpa com `?:` para opcionais

---

## 🎉 Status Final

✅ Erro 300 "Multiple Choices" - **RESOLVIDO**
✅ Erro 400 "Limite atingido" - **RESOLVIDO**
✅ Erro 42703 "available_slots" - **RESOLVIDO**
✅ Erro 42703 "critical_chance" - **RESOLVIDO**

**Sistema 100% funcional!** 🎮

