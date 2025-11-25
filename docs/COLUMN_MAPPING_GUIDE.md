# 📋 Guia: Mapeamento Correto de Colunas

## Problema: Colunas Derivadas vs Colunas Reais

Quando trabalhar com `Character`, entender a diferença é **CRÍTICO**:

---

## ✅ Colunas REAIS (Persistidas na Tabela)

Estas colunas existem fisicamente no banco e podem ser inseridas/atualizadas:

```typescript
// Identidade e Propriedade
id: string;                    // ✅ Inserir
user_id: string;               // ✅ Inserir
name: string;                  // ✅ Inserir
is_alive?: boolean;            // ✅ Inserir

// Stats Básicos
level: number;                 // ✅ Inserir
xp: number;                    // ✅ Inserir
xp_next_level: number;         // ✅ Inserir
gold: number;                  // ✅ Inserir

// Recursos
hp: number;                    // ✅ Inserir
max_hp: number;                // ✅ Inserir
mana: number;                  // ✅ Inserir
max_mana: number;              // ✅ Inserir

// Stats Base de Combate
atk: number;                   // ✅ Inserir
def: number;                   // ✅ Inserir
speed: number;                 // ✅ Inserir
floor: number;                 // ✅ Inserir

// Atributos Primários
strength: number;              // ✅ Inserir
dexterity: number;             // ✅ Inserir
intelligence: number;          // ✅ Inserir
wisdom: number;                // ✅ Inserir
vitality: number;              // ✅ Inserir
luck: number;                  // ✅ Inserir
attribute_points: number;      // ✅ Inserir

// Habilidades (Masteries)
sword_mastery: number;         // ✅ Inserir
axe_mastery: number;           // ✅ Inserir
blunt_mastery: number;         // ✅ Inserir
defense_mastery: number;       // ✅ Inserir
magic_mastery: number;         // ✅ Inserir

sword_mastery_xp: number;      // ✅ Inserir
axe_mastery_xp: number;        // ✅ Inserir
blunt_mastery_xp: number;      // ✅ Inserir
defense_mastery_xp: number;    // ✅ Inserir
magic_mastery_xp: number;      // ✅ Inserir

// Timestamps
created_at: string;            // ✅ Inserir
updated_at: string;            // ✅ Inserir
last_activity?: string;        // ✅ Inserir (opcional)
```

---

## ❌ Colunas DERIVADAS (Calculadas, Não Persistidas)

Estas **NÃO existem** fisicamente. São **calculadas** quando necessário:

```typescript
// Stats Derivados - NUNCA inserir diretamente!
critical_chance?: number;     // ❌ CALCULADA de: luck * 0.5
critical_damage?: number;     // ❌ CALCULADA de: 1.5 + (luck / 100)

// Possível adicionar no futuro:
// magic_attack?: number;     // ❌ CALCULADA de: intelligence
// magic_damage_bonus?: number; // ❌ CALCULADA de: wisdom
```

### Onde São Calculadas
```sql
-- Função RPC
SELECT * FROM calculate_derived_stats(
  p_level,
  p_strength, p_dexterity, p_intelligence,
  p_wisdom, p_vitality, p_luck
);

-- Resultado
derived_critical_chance: DECIMAL
derived_critical_damage: DECIMAL
```

---

## ❌ Erros Comuns

### ERRO 1: Tentar Inserir Stats Derivados
```sql
-- ❌ ERRADO - Vai gerar erro 42703
INSERT INTO characters (
  ...
  critical_chance,    -- Não existe!
  critical_damage,    -- Não existe!
  ...
)
```

### ERRO 2: Esquecer Colunas Obrigatórias
```sql
-- ❌ ERRADO - Vai falhar por NOT NULL
INSERT INTO characters (name)
VALUES ('Personagem');
-- Faltam: user_id, level, hp, max_hp, etc
```

### ERRO 3: Usar Nome Errado de Coluna
```sql
-- ❌ ERRADO
SELECT max_character_slots FROM check_character_limit()
-- Correto seria:
SELECT available_slots FROM check_character_limit()
```

---

## ✅ Padrão Correto para CREATE

```sql
CREATE FUNCTION create_character(p_user_id uuid, p_name text)
RETURNS uuid AS $$
BEGIN
  -- Inserir APENAS colunas reais
  INSERT INTO characters (
    id, user_id, name, level, xp, xp_next_level, gold,
    hp, max_hp, mana, max_mana, atk, def, speed, floor,
    strength, dexterity, intelligence, wisdom, vitality, luck,
    attribute_points, is_alive, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), p_user_id, p_name, 1, 0, 100, 0,
    50, 50, 20, 20, 5, 5, 5, 1,
    10, 10, 10, 10, 10, 10, 0, TRUE, NOW(), NOW()
  ) RETURNING id INTO v_character_id;
  
  -- ✅ Stats derivados são consultados depois, nunca inseridos
  -- SELECT * FROM calculate_derived_stats(1, 10, 10, 10, 10, 10, 10)
  
  RETURN v_character_id;
END;
$$ LANGUAGE plpgsql;
```

---

## 📋 Checklist para Migrations

Ao criar migrations com INSERT em `characters`:

- [ ] Incluir: `id`, `user_id`, `name`
- [ ] Incluir: Todos os stats base (`level`, `xp`, `gold`, etc)
- [ ] Incluir: Todos os atributos (`strength`, `dexterity`, etc)
- [ ] Incluir: Todas as masteries (`sword_mastery`, etc)
- [ ] Incluir: `is_alive`, `created_at`, `updated_at`
- [ ] ❌ NÃO incluir: `critical_chance`, `critical_damage`
- [ ] ❌ NÃO incluir: Nenhuma coluna derivada
- [ ] Verificar: Que todos os tipos de dados combinam

---

## 🔍 Query para Validar Colunas

```sql
-- Ver estrutura real da tabela
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'characters'
ORDER BY ordinal_position;
```

---

## 🧪 Teste de Conformidade

Depois de criar um personagem, validar:

```sql
-- ✅ Personagem criado
SELECT id, name, is_alive FROM characters WHERE name = 'Novo Personagem';

-- ✅ Stats base existem
SELECT level, hp, atk, def, speed FROM characters WHERE id = 'xxx';

-- ✅ Atributos existem
SELECT strength, dexterity, intelligence FROM characters WHERE id = 'xxx';

-- ❌ Stats derivados NÃO devem estar na tabela (devem ser NULL ou inexistentes)
-- Usar calculate_derived_stats() quando necessário consultá-los
```

---

## 📝 Resumo

| Ação | Colunas Reais | Colunas Derivadas |
|------|---------------|-------------------|
| **INSERT** | ✅ Sim | ❌ Não |
| **UPDATE** | ✅ Sim | ❌ Não |
| **SELECT** | ✅ Sim | ✅ Via RPC |
| **PERSISTIR** | ✅ No BD | ❌ Calcular on-demand |

---

## 🎯 Conclusão

**Regra de Ouro:** Se uma coluna tem `?:` na interface TypeScript (opcional derivada), provavelmente **NÃO deve ser inserida** no SQL. Calcule quando necessário!

