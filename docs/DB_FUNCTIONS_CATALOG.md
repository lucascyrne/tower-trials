# Catálogo de Funções RPC - Tower Trials

## Visão Geral

Este documento cataloga todas as funções PostgreSQL (RPC) ativas no banco de dados Tower Trials após consolidação das 120 migrações. Total de **~70 funções únicas** após remoção de duplicatas.

---

## 📋 Índice por Domínio

1. [Sistema de Usuários](#sistema-de-usuários) - 4 funções
2. [Sistema de Personagens](#sistema-de-personagens) - 15 funções
3. [Sistema de Combate](#sistema-de-combate) - 2 funções
4. [Sistema de Equipamentos](#sistema-de-equipamentos) - 6 funções
5. [Sistema de Consumíveis](#sistema-de-consumíveis) - 5 funções
6. [Sistema de Slots](#sistema-de-slots) - 8 funções
7. [Sistema de Drops e Crafting](#sistema-de-drops-e-crafting) - 9 funções
8. [Sistema de Ranking](#sistema-de-ranking) - 8 funções
9. [Sistema de Eventos](#sistema-de-eventos) - 3 funções
10. [Sistema de Cemitério](#sistema-de-cemitério) - 4 funções
11. [Sistema de Andares](#sistema-de-andares) - 3 funções
12. [Funções Auxiliares](#funções-auxiliares) - 3 funções

---

## Sistema de Usuários

### `create_user_profile()`

```sql
CREATE OR REPLACE FUNCTION create_user_profile(
    p_uid UUID,
    p_username VARCHAR,
    p_email VARCHAR
) RETURNS void
```

**Propósito**: Cria perfil de usuário durante signup no Supabase Auth  
**SECURITY DEFINER**: ✅ (bypassa RLS para criação inicial)  
**Uso**: Chamado automaticamente após signup  
**Retorno**: void

---

### `calculate_available_character_slots()`

```sql
CREATE OR REPLACE FUNCTION calculate_available_character_slots(
    p_user_id UUID
) RETURNS INTEGER
```

**Propósito**: Calcula quantos slots de personagem o usuário tem baseado em `total_character_level`  
**Lógica**:

- Slots 1-3: Gratuitos
- Slot 4+: Requer 15 níveis totais por slot adicional  
  **Exemplo**: 45 níveis totais = 6 slots (3 base + 3 desbloqueados)  
  **Retorno**: INTEGER (número de slots)

---

### `calculate_required_total_level_for_slot()`

```sql
CREATE OR REPLACE FUNCTION calculate_required_total_level_for_slot(
    slot_number INTEGER
) RETURNS INTEGER
```

**Propósito**: Calcula nível total necessário para desbloquear um slot específico  
**Fórmula**: `(slot_number - 3) * 15`  
**Exemplo**: Slot 5 = `(5 - 3) * 15 = 30 níveis totais`  
**Retorno**: INTEGER

---

### `update_user_character_progression()`

```sql
CREATE OR REPLACE FUNCTION update_user_character_progression(
    p_user_id UUID
) RETURNS TABLE(
    total_level INTEGER,
    available_slots INTEGER,
    slots_unlocked BOOLEAN
)
```

**Propósito**: Atualiza `users.total_character_level` e `max_character_slots`  
**Quando**: Chamado após level up ou morte de personagem  
**SECURITY DEFINER**: ✅  
**Retorno**:

- `total_level`: Soma de níveis de todos os personagens
- `available_slots`: Slots disponíveis calculados
- `slots_unlocked`: TRUE se desbloqueou novos slots

---

## Sistema de Personagens

### `create_character()`

```sql
CREATE OR REPLACE FUNCTION create_character(
    p_user_id UUID,
    p_name VARCHAR
) RETURNS UUID
```

**Propósito**: Cria novo personagem  
**Validações**:

- Nome válido (via `validate_character_name`)
- Usuário não excedeu limite de slots
- Nome único para o usuário  
  **Efeitos Colaterais**:
- Cria 3 `potion_slots` vazios
- Cria 3 `spell_slots` vazios
- Atualiza `users.total_character_level`  
  **Retorno**: UUID do personagem criado

---

### `delete_character()`

```sql
CREATE OR REPLACE FUNCTION delete_character(
    p_character_id UUID
) RETURNS VOID
```

**Propósito**: Deleta personagem e todos os dados relacionados  
**Cascade**: Deleta automaticamente via FK:

- `character_equipment`
- `character_consumables`
- `character_drops`
- `potion_slots`
- `spell_slots`  
  **Pós-processamento**: Atualiza `users.total_character_level`  
  **Retorno**: void

---

### `get_character()`

```sql
CREATE OR REPLACE FUNCTION get_character(
    p_character_id UUID
) RETURNS characters
```

**Propósito**: Busca dados completos de um personagem  
**Retorno**: Row completo de `characters`  
**Erro**: Exception se personagem não encontrado

---

### `get_user_characters()`

```sql
CREATE OR REPLACE FUNCTION get_user_characters(
    p_user_id UUID
) RETURNS TABLE (
    id UUID,
    user_id UUID,
    name VARCHAR(100),
    level INTEGER,
    xp INTEGER,
    xp_next_level INTEGER,
    gold INTEGER,
    hp INTEGER,
    max_hp INTEGER,
    mana INTEGER,
    max_mana INTEGER,
    atk INTEGER,
    def INTEGER,
    speed INTEGER,
    floor INTEGER,
    last_activity TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
)
```

**Propósito**: Lista todos os personagens de um usuário  
**Ordem**: `created_at DESC`  
**Retorno**: TABLE com dados básicos dos personagens

---

### `validate_character_name()`

```sql
CREATE OR REPLACE FUNCTION validate_character_name(
    p_name VARCHAR
) RETURNS TABLE (
    is_valid BOOLEAN,
    error_message TEXT
)
```

**Propósito**: Valida nome de personagem  
**Regras**:

- 3-20 caracteres
- Começa com letra
- Alfanumérico + espaços, hífen, apóstrofe
- Não pode ser apenas números
- Máx 2 números consecutivos
- Máx 3 caracteres iguais seguidos
- Sem palavras proibidas (lista extensa)  
  **Retorno**: `is_valid` + `error_message` (se inválido)

---

### `calculate_derived_stats()`

```sql
CREATE OR REPLACE FUNCTION calculate_derived_stats(
    p_level INTEGER,
    p_strength INTEGER DEFAULT 10,
    p_dexterity INTEGER DEFAULT 10,
    p_intelligence INTEGER DEFAULT 10,
    p_wisdom INTEGER DEFAULT 10,
    p_vitality INTEGER DEFAULT 10,
    p_luck INTEGER DEFAULT 10
) RETURNS TABLE (
    derived_hp INTEGER,
    derived_max_hp INTEGER,
    derived_mana INTEGER,
    derived_max_mana INTEGER,
    derived_atk INTEGER,
    derived_def INTEGER,
    derived_speed INTEGER,
    derived_critical_chance DECIMAL,
    derived_critical_damage DECIMAL
)
```

**Propósito**: Calcula stats derivados baseado em atributos primários  
**Fórmulas**:

- `HP = base + (Vitality * 8)`
- `Mana = base + (Intelligence * 5)`
- `ATK = base + (Strength * 2)`
- `DEF = base + (Vitality + Wisdom)`
- `Speed = base + FLOOR(Dexterity * 1.5)`
- `Crit Chance = Luck * 0.5%`
- `Crit Damage = 1.5 + (Luck / 100)`  
  **Retorno**: TABLE com stats calculados

---

### `recalculate_character_stats()`

```sql
CREATE OR REPLACE FUNCTION recalculate_character_stats(
    p_character_id UUID
) RETURNS VOID
```

**Propósito**: Recalcula e atualiza stats derivados do personagem  
**Quando**: Após distribuir pontos de atributo, equipar itens, level up  
**Lógica**: Mantém proporção de HP/Mana atual  
**Retorno**: void

---

### `update_character_stats()`

```sql
CREATE OR REPLACE FUNCTION update_character_stats(
    p_character_id UUID,
    p_xp INTEGER DEFAULT NULL,
    p_gold INTEGER DEFAULT NULL,
    p_hp INTEGER DEFAULT NULL,
    p_mana INTEGER DEFAULT NULL,
    p_floor INTEGER DEFAULT NULL
) RETURNS TABLE (
    leveled_up BOOLEAN,
    new_level INTEGER,
    new_xp INTEGER,
    new_xp_next_level INTEGER,
    slots_unlocked BOOLEAN,
    new_available_slots INTEGER
)
```

**Propósito**: Atualiza stats do personagem (usado após combate)  
**Lógica**:

- Se XP >= XP necessário → Level up (loop para múltiplos níveis)
- Level up → Recupera HP/Mana completo
- Level up → Concede pontos de atributo  
  **Retorno**: Informações sobre progressão

---

### `distribute_attribute_points()`

```sql
CREATE OR REPLACE FUNCTION distribute_attribute_points(
    p_character_id UUID,
    p_strength INTEGER DEFAULT 0,
    p_dexterity INTEGER DEFAULT 0,
    p_intelligence INTEGER DEFAULT 0,
    p_wisdom INTEGER DEFAULT 0,
    p_vitality INTEGER DEFAULT 0,
    p_luck INTEGER DEFAULT 0
) RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    new_stats RECORD
)
```

**Propósito**: Distribui pontos de atributo disponíveis  
**Validações**:

- Tem pontos suficientes
- Limite máximo de 50 por atributo  
  **Efeitos**: Chama `recalculate_character_stats()` após aplicar  
  **Retorno**: Success status + novos stats completos

---

### `grant_attribute_points_on_levelup()`

```sql
CREATE OR REPLACE FUNCTION grant_attribute_points_on_levelup(
    p_character_id UUID,
    p_new_level INTEGER
) RETURNS INTEGER
```

**Propósito**: Concede pontos de atributo ao subir de nível  
**Fórmula**:

- Base: 2 pontos por nível
- Bônus: +1 a cada 5 níveis (nos níveis 5, 10, 15, 20, etc)  
  **Exemplo**: Level 5 = 3 pontos (2 base + 1 bônus)  
  **Retorno**: INTEGER (pontos concedidos)

---

### `calculate_xp_next_level()`

```sql
CREATE OR REPLACE FUNCTION calculate_xp_next_level(
    current_level INTEGER
) RETURNS INTEGER
```

**Propósito**: Calcula XP necessário para próximo nível  
**Fórmula**: `FLOOR(100 * POW(1.5, current_level - 1))`  
**Exemplo**: Level 1→2 = 100 XP, Level 2→3 = 150 XP, Level 10→11 = 3838 XP  
**Retorno**: INTEGER

---

### `add_skill_xp()`

```sql
CREATE OR REPLACE FUNCTION add_skill_xp(
    p_character_id UUID,
    p_skill_type VARCHAR, -- 'sword', 'axe', 'blunt', 'defense', 'magic'
    p_xp_amount INTEGER
) RETURNS TABLE (
    skill_leveled_up BOOLEAN,
    new_skill_level INTEGER,
    new_skill_xp INTEGER
)
```

**Propósito**: Adiciona XP a uma maestria específica  
**Skills**: sword_mastery, axe_mastery, blunt_mastery, defense_mastery, magic_mastery  
**Limite**: Level 100 máximo  
**Fórmula XP**: `FLOOR(50 * POW(1.4, current_level - 1))`  
**Retorno**: Informações sobre progressão da skill

---

### `calculate_skill_xp_requirement()`

```sql
CREATE OR REPLACE FUNCTION calculate_skill_xp_requirement(
    current_level INTEGER
) RETURNS INTEGER
```

**Propósito**: Calcula XP necessário para próximo nível de skill  
**Fórmula**: `FLOOR(50 * POW(1.4, current_level - 1))`  
**Retorno**: INTEGER

---

### `calculate_auto_heal()`

```sql
CREATE OR REPLACE FUNCTION calculate_auto_heal(
    p_character_id UUID,
    p_current_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) RETURNS TABLE(
    new_hp INTEGER,
    new_mana INTEGER,
    healed BOOLEAN
)
```

**Propósito**: Calcula cura automática baseada em tempo offline  
**Sistema**:

- Cura de 0.1% → 100% em **2 horas (7200 segundos)**
- Taxa: ~0.01387% por segundo
- Cura HP e Mana simultaneamente  
  **Retorno**: Novos valores de HP/Mana

---

### `update_character_last_activity()`

```sql
CREATE OR REPLACE FUNCTION update_character_last_activity(
    p_character_id UUID,
    p_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) RETURNS VOID
```

**Propósito**: Atualiza timestamp de última atividade (para auto-heal)  
**Quando**: Após qualquer ação do personagem  
**Retorno**: void

---

### `get_character_full_stats()`

```sql
CREATE OR REPLACE FUNCTION get_character_full_stats(
    p_character_id UUID
) RETURNS TABLE (
    character_id UUID,
    name VARCHAR,
    level INTEGER,
    xp INTEGER,
    xp_next_level INTEGER,
    gold INTEGER,
    hp INTEGER,
    max_hp INTEGER,
    mana INTEGER,
    max_mana INTEGER,
    atk INTEGER,
    def INTEGER,
    speed INTEGER,
    strength INTEGER,
    dexterity INTEGER,
    intelligence INTEGER,
    wisdom INTEGER,
    vitality INTEGER,
    luck INTEGER,
    attribute_points INTEGER,
    critical_chance DECIMAL,
    critical_damage DECIMAL,
    sword_mastery INTEGER,
    axe_mastery INTEGER,
    blunt_mastery INTEGER,
    defense_mastery INTEGER,
    magic_mastery INTEGER,
    sword_mastery_xp INTEGER,
    axe_mastery_xp INTEGER,
    blunt_mastery_xp INTEGER,
    defense_mastery_xp INTEGER,
    magic_mastery_xp INTEGER
)
```

**Propósito**: Retorna todos os stats do personagem (incluindo calculados)  
**Retorno**: TABLE com dados completos

---

## Sistema de Combate

### `get_monster_for_floor()`

```sql
CREATE OR REPLACE FUNCTION get_monster_for_floor(
    p_floor INTEGER
) RETURNS TABLE (
    id UUID,
    name VARCHAR,
    hp INTEGER,
    atk INTEGER,
    def INTEGER,
    mana INTEGER,
    speed INTEGER,
    behavior monster_behavior,
    min_floor INTEGER,
    reward_xp INTEGER,
    reward_gold INTEGER,
    strength INTEGER,
    dexterity INTEGER,
    intelligence INTEGER,
    wisdom INTEGER,
    vitality INTEGER,
    luck INTEGER,
    critical_chance DECIMAL,
    critical_damage DECIMAL,
    critical_resistance DECIMAL,
    physical_resistance DECIMAL,
    magical_resistance DECIMAL,
    debuff_resistance DECIMAL,
    physical_vulnerability DECIMAL,
    magical_vulnerability DECIMAL,
    primary_trait monster_trait,
    secondary_trait monster_trait,
    special_abilities TEXT[]
)
```

**Propósito**: Seleciona monstro aleatório para um andar com stats escalados  
**Lógica**:

- Busca monstros com `min_floor <= p_floor` e `min_floor >= (p_floor - 5)`
- Escalamento de stats: `base + (p_floor - min_floor) * scaling_factor`
- Scaling factor: 0.15 (15% por andar)
- Caps: Crit chance 35%, Crit damage 250%, Resistências 75-90%  
  **Retorno**: Monstro completo com stats escalados

---

## Sistema de Equipamentos

### `buy_equipment()`

```sql
CREATE OR REPLACE FUNCTION buy_equipment(
    p_character_id UUID,
    p_equipment_id UUID,
    p_price INTEGER
) RETURNS VOID
```

**Propósito**: Compra equipamento da loja  
**Validações**:

- Equipamento está desbloqueado (`is_unlocked = TRUE`)
- Personagem tem nível suficiente
- Personagem tem gold suficiente  
  **Efeitos**: Deduz gold + Adiciona a `character_equipment`  
  **Retorno**: void

---

### `sell_equipment()`

```sql
CREATE OR REPLACE FUNCTION sell_equipment(
    p_character_id UUID,
    p_equipment_id UUID
) RETURNS VOID
```

**Propósito**: Vende um equipamento individual  
**Preço de venda** (baseado em raridade):

- common: 30%
- uncommon: 35%
- rare: 40%
- epic: 45%
- legendary: 50%  
  **Efeitos**: Adiciona gold + Remove de `character_equipment` + Recalcula stats  
  **Retorno**: void

---

### `sell_character_equipment_batch()`

```sql
CREATE OR REPLACE FUNCTION sell_character_equipment_batch(
    p_character_id UUID,
    p_equipment_sales JSONB -- [{equipment_id: UUID, quantity: INTEGER}]
) RETURNS TABLE (
    total_gold_earned INTEGER,
    items_sold INTEGER,
    new_character_gold INTEGER
)
```

**Propósito**: Vende múltiplos equipamentos em lote  
**Sistema**: FIFO (First In, First Out) - vende os mais antigos primeiro  
**Validação**: Apenas equipamentos **não equipados** podem ser vendidos  
**Retorno**: Total de gold ganho + quantidade vendida + novo gold do personagem

---

### `toggle_equipment()`

```sql
CREATE OR REPLACE FUNCTION toggle_equipment(
    p_character_id UUID,
    p_equipment_id UUID,
    p_equip BOOLEAN
) RETURNS VOID
```

**Propósito**: Equipa ou desequipa um item  
**Validações**:

- Nível do personagem >= `level_requirement`
- Maestria suficiente para armas raras+ (level 10+)  
  **Lógica**: Desequipa item do mesmo tipo antes de equipar novo  
  **Efeitos**: Chama `recalculate_character_stats()` após mudança  
  **Retorno**: void

---

### `calculate_equipment_bonuses()`

```sql
CREATE OR REPLACE FUNCTION calculate_equipment_bonuses(
    p_character_id UUID
) RETURNS TABLE (
    total_strength_bonus INTEGER,
    total_dexterity_bonus INTEGER,
    total_intelligence_bonus INTEGER,
    total_wisdom_bonus INTEGER,
    total_vitality_bonus INTEGER,
    total_luck_bonus INTEGER,
    total_atk_bonus INTEGER,
    total_def_bonus INTEGER,
    total_mana_bonus INTEGER,
    total_speed_bonus INTEGER,
    total_hp_bonus INTEGER,
    total_critical_chance_bonus DECIMAL,
    total_critical_damage_bonus DECIMAL,
    total_strength_penalty INTEGER,
    total_dexterity_penalty INTEGER,
    total_intelligence_penalty INTEGER,
    total_wisdom_penalty INTEGER,
    total_vitality_penalty INTEGER,
    total_luck_penalty INTEGER,
    total_speed_penalty INTEGER
)
```

**Propósito**: Calcula bônus totais de todos os equipamentos equipados  
**Lógica**: Soma bônus - penalidades de todos os itens `is_equipped = TRUE`  
**Retorno**: TABLE com totais

---

### `unlock_equipment()`

```sql
CREATE OR REPLACE FUNCTION unlock_equipment(
    p_equipment_id UUID
) RETURNS VOID
```

**Propósito**: Desbloqueia equipamento na loja (via pergaminho)  
**Efeitos**: `is_unlocked = TRUE`  
**Retorno**: void

---

## Sistema de Consumíveis

### `buy_consumable()`

```sql
CREATE OR REPLACE FUNCTION buy_consumable(
    p_character_id UUID,
    p_consumable_id UUID,
    p_quantity INTEGER DEFAULT 1
) RETURNS VOID
```

**Propósito**: Compra consumíveis da loja  
**Validações**: Gold suficiente  
**Efeitos**: Deduz gold + Adiciona/atualiza `character_consumables.quantity`  
**Retorno**: void

---

### `use_consumable()`

```sql
CREATE OR REPLACE FUNCTION use_consumable(
    p_character_id UUID,
    p_consumable_id UUID
) RETURNS VOID
```

**Propósito**: Usa um consumível (decrementa quantidade)  
**Validações**: Personagem possui o item  
**Efeitos**: `quantity -= 1` em `character_consumables`  
**Retorno**: void

---

### `sell_character_consumables_batch()`

```sql
CREATE OR REPLACE FUNCTION sell_character_consumables_batch(
    p_character_id UUID,
    p_consumable_sales JSONB -- [{consumable_id: UUID, quantity: INTEGER}]
) RETURNS TABLE (
    total_gold_earned INTEGER,
    items_sold INTEGER,
    new_character_gold INTEGER
)
```

**Propósito**: Vende múltiplos consumíveis em lote  
**Preço de venda**: 30% do preço original (fixo)  
**Retorno**: Total de gold ganho + quantidade vendida + novo gold

---

### `add_consumable_to_inventory()`

```sql
CREATE OR REPLACE FUNCTION add_consumable_to_inventory(
    p_character_id UUID,
    p_consumable_id UUID,
    p_quantity INTEGER
) RETURNS VOID
```

**Propósito**: Adiciona consumível ao inventário (usado por crafting)  
**Lógica**: UPSERT - atualiza quantity se já existir  
**Retorno**: void

---

### `consume_potion()`

```sql
CREATE OR REPLACE FUNCTION consume_potion(
    p_character_id UUID,
    p_consumable_id UUID
) RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    new_hp INTEGER,
    new_mana INTEGER
)
```

**Propósito**: Consome poção e aplica efeito  
**Lógica**:

- Detecta tipo por descrição (HP/Mana)
- Aplica efeito ao personagem
- Decrementa quantidade
- Remove do inventário se quantity = 0  
  **Retorno**: Status + novos valores de HP/Mana

---

## Sistema de Slots

### `initialize_character_slots()`

```sql
CREATE OR REPLACE FUNCTION initialize_character_slots()
RETURNS TRIGGER
```

**Propósito**: Trigger que cria slots vazios quando personagem é criado  
**Efeitos**:

- Cria 3 `potion_slots` (position 1, 2, 3)
- Cria 3 `spell_slots` (position 1, 2, 3)  
  **Trigger**: `AFTER INSERT ON characters`

---

### `get_character_potion_slots()`

```sql
CREATE FUNCTION get_character_potion_slots(
    p_character_id UUID
) RETURNS TABLE (
    slot_position INTEGER,
    consumable_id UUID,
    consumable_name TEXT,
    consumable_description TEXT,
    effect_value INTEGER,
    consumable_type TEXT,
    available_quantity INTEGER,
    consumable_price INTEGER
)
```

**Propósito**: Busca slots de poção com dados dos consumíveis equipados  
**Lógica**: LEFT JOIN com `consumables` e `character_consumables`  
**Retorno**: TABLE com 3 rows (slots 1, 2, 3)

---

### `set_potion_slot()`

```sql
CREATE FUNCTION set_potion_slot(
    p_character_id UUID,
    p_slot_position INTEGER,
    p_consumable_id UUID
) RETURNS JSON
```

**Propósito**: Configura consumível em um slot específico  
**Validações**:

- Slot 1-3
- Consumível existe
- Personagem possui o consumível (quantity > 0)
- Consumível não está em outro slot  
  **Retorno**: JSON `{success: true/false, message/error: TEXT}`

---

### `clear_potion_slot()`

```sql
CREATE FUNCTION clear_potion_slot(
    p_character_id UUID,
    p_slot_position INTEGER
) RETURNS JSON
```

**Propósito**: Limpa um slot de poção (set NULL)  
**Retorno**: JSON `{success: true, message: TEXT}`

---

### `use_potion_from_slot()`

```sql
CREATE OR REPLACE FUNCTION use_potion_from_slot(
    p_character_id UUID,
    p_slot_position INTEGER
) RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    new_hp INTEGER,
    new_mana INTEGER
)
```

**Propósito**: Usa poção diretamente de um slot  
**Lógica**:

- Busca consumível do slot
- Aplica efeito
- Decrementa quantidade
- Limpa slot se quantity = 0  
  **Retorno**: Status + novos valores

---

### `get_character_spell_slots()`

```sql
CREATE FUNCTION get_character_spell_slots(
    p_character_id UUID
) RETURNS TABLE (
    slot_position INTEGER,
    spell_id UUID,
    spell_name TEXT,
    spell_description TEXT,
    mana_cost INTEGER,
    damage INTEGER,
    spell_type TEXT
)
```

**Propósito**: Busca slots de spell com dados das spells equipadas  
**Retorno**: TABLE com 3 rows (slots 1, 2, 3)

---

### `set_spell_slot()`

```sql
CREATE FUNCTION set_spell_slot(
    p_character_id UUID,
    p_slot_position INTEGER,
    p_spell_id UUID
) RETURNS JSON
```

**Propósito**: Configura spell em um slot específico  
**Validações**:

- Slot 1-3
- Spell existe  
  **Retorno**: JSON `{success: true/false, message/error: TEXT}`

---

## Sistema de Drops e Crafting

### `add_monster_drop()`

```sql
CREATE OR REPLACE FUNCTION add_monster_drop(
    p_character_id UUID,
    p_drop_id UUID,
    p_quantity INTEGER
) RETURNS VOID
```

**Propósito**: Adiciona drop ao inventário do personagem  
**Lógica**: UPSERT com tratamento de race condition  
**Retorno**: void

---

### `get_monster_drops()`

```sql
CREATE OR REPLACE FUNCTION get_monster_drops(
    p_monster_id UUID
) RETURNS TABLE (
    drop_id UUID,
    drop_name VARCHAR,
    drop_chance DOUBLE PRECISION,
    min_quantity INTEGER,
    max_quantity INTEGER,
    rarity VARCHAR
)
```

**Propósito**: Lista drops possíveis de um monstro  
**Retorno**: TABLE com configurações de drop

---

### `sell_character_drops_batch()`

```sql
CREATE OR REPLACE FUNCTION sell_character_drops_batch(
    p_character_id UUID,
    p_drop_sales JSONB -- [{drop_id: UUID, quantity: INTEGER}]
) RETURNS TABLE (
    total_gold_earned INTEGER,
    items_sold INTEGER,
    new_character_gold INTEGER
)
```

**Propósito**: Vende múltiplos drops em lote  
**Preço de venda**: Valor definido em `monster_drops.value`  
**Retorno**: Total de gold ganho + quantidade vendida + novo gold

---

### `check_can_craft()`

```sql
CREATE OR REPLACE FUNCTION check_can_craft(
    p_character_id UUID,
    p_recipe_id UUID
) RETURNS TABLE (
    can_craft BOOLEAN,
    missing_ingredients TEXT[]
)
```

**Propósito**: Verifica se personagem tem ingredientes para craftar consumível  
**Retorno**: `can_craft` + array de ingredientes faltantes (se houver)

---

### `craft_item()`

```sql
CREATE OR REPLACE FUNCTION craft_item(
    p_character_id UUID,
    p_recipe_id UUID
) RETURNS VOID
```

**Propósito**: Crafta consumível  
**Lógica**:

1. Verifica ingredientes
2. Consome ingredientes (decrementa quantities)
3. Adiciona resultado ao inventário  
   **Retorno**: void

---

### `check_can_craft_equipment()`

```sql
CREATE OR REPLACE FUNCTION check_can_craft_equipment(
    p_character_id UUID,
    p_recipe_id UUID
) RETURNS TABLE (
    can_craft BOOLEAN,
    missing_ingredients TEXT[]
)
```

**Propósito**: Verifica se personagem tem ingredientes para craftar equipamento  
**Nota**: Suporta equipamentos como ingredientes (apenas não equipados)  
**Retorno**: `can_craft` + array de ingredientes faltantes

---

### `craft_equipment()`

```sql
CREATE OR REPLACE FUNCTION craft_equipment(
    p_character_id UUID,
    p_recipe_id UUID
) RETURNS VOID
```

**Propósito**: Crafta equipamento  
**Lógica**:

1. Verifica ingredientes
2. Consome ingredientes (DELETA registros de equipamentos usados)
3. Adiciona resultado ao inventário  
   **Retorno**: void

---

### `validate_crafting_ingredient()`

```sql
CREATE OR REPLACE FUNCTION validate_crafting_ingredient()
RETURNS TRIGGER
```

**Propósito**: Trigger que valida referência polimórfica em `crafting_ingredients`  
**Lógica**: Verifica se `item_id` existe na tabela correspondente a `item_type`  
**Trigger**: `BEFORE INSERT OR UPDATE ON crafting_ingredients`

---

### `validate_equipment_crafting_ingredient()`

```sql
CREATE OR REPLACE FUNCTION validate_equipment_crafting_ingredient()
RETURNS TRIGGER
```

**Propósito**: Trigger que valida referência polimórfica em `equipment_crafting_ingredients`  
**Trigger**: `BEFORE INSERT OR UPDATE ON equipment_crafting_ingredients`

---

## Sistema de Ranking

### `save_ranking_entry()`

```sql
CREATE OR REPLACE FUNCTION save_ranking_entry(
    p_user_id UUID,
    p_player_name VARCHAR,
    p_floor INTEGER,
    p_character_level INTEGER,
    p_character_gold INTEGER,
    p_character_alive BOOLEAN
) RETURNS UUID
```

**Propósito**: Salva entrada no ranking (upsert)  
**Lógica**: Atualiza se já existe entrada para o usuário  
**SECURITY DEFINER**: ✅  
**Retorno**: UUID da entrada de ranking

---

### `get_global_ranking()`

```sql
CREATE OR REPLACE FUNCTION get_global_ranking(
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
    rank INTEGER,
    player_name VARCHAR,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMPTZ
)
```

**Propósito**: Busca ranking global ordenado por andar  
**Ordem**: `highest_floor DESC, character_level DESC`  
**Retorno**: TABLE com paginação

---

### `get_floor_ranking()`

```sql
CREATE OR REPLACE FUNCTION get_floor_ranking(
    p_floor INTEGER,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
    rank INTEGER,
    player_name VARCHAR,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    created_at TIMESTAMPTZ
)
```

**Propósito**: Busca ranking de um andar específico  
**Filtro**: `highest_floor = p_floor`  
**Ordem**: `character_level DESC, character_gold DESC`  
**Retorno**: TABLE com paginação

---

### `get_player_ranking_position()`

```sql
CREATE OR REPLACE FUNCTION get_player_ranking_position(
    p_user_id UUID,
    p_mode VARCHAR DEFAULT 'floor' -- 'floor' | 'global'
) RETURNS INTEGER
```

**Propósito**: Busca posição do jogador no ranking  
**Modos**:

- `'floor'`: Ranking do andar atual do personagem
- `'global'`: Ranking global  
  **Retorno**: INTEGER (posição no ranking, 0 se não encontrado)

---

### `delete_user_ranking_entries()`

```sql
CREATE OR REPLACE FUNCTION delete_user_ranking_entries(
    p_user_id UUID
) RETURNS INTEGER
```

**Propósito**: Deleta todas as entradas de ranking de um usuário  
**Quando**: Usado quando personagem morre (permadeath)  
**Retorno**: INTEGER (quantidade deletada)

---

### `count_ranking_entries()`

```sql
CREATE OR REPLACE FUNCTION count_ranking_entries(
    p_floor INTEGER DEFAULT NULL
) RETURNS INTEGER
```

**Propósito**: Conta total de entradas no ranking  
**Parâmetros**:

- `p_floor = NULL`: Conta global
- `p_floor = N`: Conta do andar específico  
  **Retorno**: INTEGER

---

### `get_top_floors_summary()`

```sql
CREATE OR REPLACE FUNCTION get_top_floors_summary()
RETURNS TABLE (
    floor_number INTEGER,
    players_reached INTEGER,
    highest_level INTEGER,
    total_gold BIGINT
)
```

**Propósito**: Resumo de estatísticas por andar  
**Ordem**: `floor_number DESC`  
**Limite**: Top 20 andares  
**Retorno**: TABLE com estatísticas agregadas

---

### `get_player_rank_history()`

```sql
CREATE OR REPLACE FUNCTION get_player_rank_history(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
    floor_reached INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    achieved_at TIMESTAMPTZ
)
```

**Propósito**: Histórico de conquistas do jogador  
**Ordem**: `created_at DESC`  
**Retorno**: TABLE com histórico

---

## Sistema de Eventos

### `get_special_event_for_floor()`

```sql
CREATE OR REPLACE FUNCTION get_special_event_for_floor(
    p_floor INTEGER
) RETURNS special_events
```

**Propósito**: Sorteia evento especial aleatório para um andar  
**Lógica**: Weighted random baseado em `chance_weight`  
**Fallback**: Retorna fogueira básica se nenhum evento encontrado  
**Retorno**: Row completo de `special_events`

---

### `process_special_event()`

```sql
CREATE OR REPLACE FUNCTION process_special_event(
    p_character_id UUID,
    p_event_id UUID
) RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    hp_restored INTEGER,
    mana_restored INTEGER,
    gold_gained INTEGER
)
```

**Propósito**: Processa efeitos de um evento especial  
**Lógica**:

- Calcula restauração de HP/Mana (porcentagem)
- Sorteia gold entre min e max
- Atualiza personagem
- Gera mensagem descritiva  
  **SECURITY DEFINER**: ✅  
  **Retorno**: Detalhes dos efeitos aplicados

---

## Sistema de Cemitério

### `kill_character()`

```sql
CREATE OR REPLACE FUNCTION kill_character(
    p_character_id UUID,
    p_death_cause VARCHAR DEFAULT 'Battle defeat',
    p_killed_by_monster VARCHAR DEFAULT NULL
) RETURNS UUID
```

**Propósito**: Move personagem para cemitério (permadeath)  
**Lógica**:

1. Copia snapshot completo para `dead_characters`
2. Deleta de `characters` (cascade deleta relacionados)
3. Atualiza `users.total_character_level`  
   **SECURITY DEFINER**: ✅  
   **Retorno**: UUID do registro em `dead_characters`

---

### `get_user_cemetery()`

```sql
CREATE OR REPLACE FUNCTION get_user_cemetery(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
    id UUID,
    original_character_id UUID,
    name VARCHAR,
    level INTEGER,
    xp BIGINT,
    gold BIGINT,
    strength INTEGER,
    dexterity INTEGER,
    intelligence INTEGER,
    wisdom INTEGER,
    vitality INTEGER,
    luck INTEGER,
    max_hp INTEGER,
    max_mana INTEGER,
    atk INTEGER,
    def INTEGER,
    speed INTEGER,
    floor_reached INTEGER,
    highest_floor INTEGER,
    total_monsters_killed INTEGER,
    total_damage_dealt BIGINT,
    total_damage_taken BIGINT,
    total_spells_cast INTEGER,
    total_potions_used INTEGER,
    death_cause VARCHAR,
    killed_by_monster VARCHAR,
    character_created_at TIMESTAMPTZ,
    died_at TIMESTAMPTZ,
    survival_time_minutes INTEGER
)
```

**Propósito**: Lista personagens mortos de um usuário  
**Ordem**: `died_at DESC`  
**SECURITY DEFINER**: ✅  
**Retorno**: TABLE com paginação

---

### `count_user_cemetery()`

```sql
CREATE OR REPLACE FUNCTION count_user_cemetery(
    p_user_id UUID
) RETURNS INTEGER
```

**Propósito**: Conta personagens mortos de um usuário  
**SECURITY DEFINER**: ✅  
**Retorno**: INTEGER

---

### `get_cemetery_stats()`

```sql
CREATE OR REPLACE FUNCTION get_cemetery_stats(
    p_user_id UUID
) RETURNS TABLE (
    total_deaths INTEGER,
    highest_level_reached INTEGER,
    highest_floor_reached INTEGER,
    total_survival_time_hours NUMERIC,
    most_common_death_cause VARCHAR,
    deadliest_monster VARCHAR
)
```

**Propósito**: Estatísticas consolidadas do cemitério  
**SECURITY DEFINER**: ✅  
**Retorno**: Agregações do cemitério do usuário

---

## Sistema de Andares

### `get_floor_data()`

```sql
CREATE OR REPLACE FUNCTION get_floor_data(
    p_floor_number INTEGER
) RETURNS TABLE (
    floor_number INTEGER,
    type floor_type,
    is_checkpoint BOOLEAN,
    min_level INTEGER,
    description TEXT
)
```

**Propósito**: Busca ou gera dados de um andar  
**Lógica Dinâmica**:

- Boss: A cada 10 andares (10, 20, 30...)
- Elite: A cada 5 andares (5, 15, 25...)
- Event: A cada 7 andares (7, 14, 21...)
- Common: Demais  
  **Checkpoint**: A cada 10 andares  
  **Retorno**: Dados do andar

---

### `get_unlocked_checkpoints()`

```sql
CREATE OR REPLACE FUNCTION get_unlocked_checkpoints(
    p_highest_floor INTEGER
) RETURNS TABLE (
    floor_number INTEGER,
    description TEXT
)
```

**Propósito**: Lista checkpoints desbloqueados pelo jogador  
**Lógica**: Andar 1 + múltiplos de 10 até `p_highest_floor`  
**Retorno**: TABLE de checkpoints disponíveis

---

### `generate_monster_pool()`

```sql
CREATE OR REPLACE FUNCTION generate_monster_pool(
    p_floor_number INTEGER
) RETURNS UUID[]
```

**Propósito**: Gera array de monstros possíveis para um andar  
**Lógica**: Seleciona top 3 monstros com `min_floor <= p_floor`  
**Retorno**: UUID[] (array de IDs)

---

## Funções Auxiliares

### `update_updated_at_column()`

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
```

**Propósito**: Trigger genérico que atualiza `updated_at = NOW()`  
**Uso**: Aplicado em TODAS as tabelas mutáveis  
**Trigger**: `BEFORE UPDATE`

---

### `calculate_sell_prices()`

```sql
CREATE OR REPLACE FUNCTION calculate_sell_prices(
    p_character_id UUID,
    p_item_type TEXT, -- 'equipment', 'consumable', 'drop'
    p_item_ids UUID[]
) RETURNS TABLE (
    item_id UUID,
    sell_price INTEGER
)
```

**Propósito**: Calcula preços de venda para múltiplos itens  
**Uso**: Útil para UI mostrar valores antes de vender  
**Retorno**: TABLE com ID e preço de cada item

---

## 📌 Notas Importantes

### SECURITY DEFINER

Funções marcadas com `SECURITY DEFINER` executam com privilégios do criador (bypassing RLS). Usadas quando:

- Operações precisam acessar dados de outros usuários (rankings)
- Operações precisam modificar dados do sistema (cemitério)
- Operações precisam bypass temporário de RLS para funcionalidade

### Convenções de Nomenclatura

- `get_*`: Funções de leitura (SELECT)
- `create_*`: Funções de criação (INSERT)
- `update_*`: Funções de atualização (UPDATE)
- `delete_*`: Funções de deleção (DELETE)
- `calculate_*`: Funções de cálculo (pure functions)
- `*_batch`: Funções que operam em múltiplos registros
- `check_*`: Funções de validação (retornam status)

### Tipos de Retorno

- `VOID`: Não retorna valor
- `TABLE`: Retorna conjunto de registros
- `RECORD`: Retorna um registro
- `INTEGER/DECIMAL/TEXT`: Retorna valor escalar
- `JSON`: Retorna objeto JSON (usado em APIs)

---

## ✅ Próximos Passos

- [ ] Extrair constantes de balanceamento em `GAME_BALANCE_CONSTANTS.md`
- [ ] Criar diagramas de fluxo para operações críticas
- [ ] Documentar triggers e suas interações
