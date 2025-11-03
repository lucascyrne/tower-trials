# Schema Final do Banco de Dados - Tower Trials

## Visão Geral

Este documento mapeia a estrutura completa e final do banco de dados após análise de todas as 120 migrações. Consolidação realizada em: **20 de Outubro de 2025**.

---

## 📋 Índice de Tabelas

### Tabelas Core

1. [users](#users) - Gerenciamento de usuários
2. [characters](#characters) - Personagens ativos
3. [dead_characters](#dead_characters) - Cemitério (permadeath)

### Sistema de Combate

4. [monsters](#monsters) - Monstros do jogo
5. [floors](#floors) - Andares da torre
6. [special_events](#special_events) - Eventos especiais

### Sistema de Equipamentos

7. [equipment](#equipment) - Catálogo de equipamentos
8. [character_equipment](#character_equipment) - Inventário de equipamentos

### Sistema de Consumíveis

9. [consumables](#consumables) - Catálogo de consumíveis
10. [character_consumables](#character_consumables) - Inventário de consumíveis
11. [potion_slots](#potion_slots) - Slots de poção do personagem

### Sistema de Magias

12. [spells](#spells) - Catálogo de magias
13. [spell_slots](#spell_slots) - Slots de spell do personagem

### Sistema de Drops e Crafting

14. [monster_drops](#monster_drops) - Catálogo de drops
15. [monster_possible_drops](#monster_possible_drops) - Relação monstro-drops
16. [character_drops](#character_drops) - Inventário de drops
17. [crafting_recipes](#crafting_recipes) - Receitas de consumíveis
18. [crafting_ingredients](#crafting_ingredients) - Ingredientes para receitas
19. [equipment_crafting_recipes](#equipment_crafting_recipes) - Receitas de equipamentos
20. [equipment_crafting_ingredients](#equipment_crafting_ingredients) - Ingredientes para equipamentos

### Sistema de Ranking

21. [game_rankings](#game_rankings) - Rankings globais
22. [game_progress](#game_progress) - Progresso de jogo (se houver)

### Sistema de Slots (Antigo - Deprecated)

23. [character_potion_slots](#character_potion_slots) - **DEPRECATED** - Use `potion_slots`
24. [character_spell_slots](#character_spell_slots) - **DEPRECATED** - Use `spell_slots`

---

## 📊 Enums e Tipos Customizados

### monster_behavior

```sql
CREATE TYPE monster_behavior AS ENUM (
    'aggressive',  -- Monstro agressivo (foca em ataque)
    'defensive',   -- Monstro defensivo (foca em defesa)
    'balanced'     -- Monstro balanceado
);
```

### resistance_type

```sql
CREATE TYPE resistance_type AS ENUM (
    'physical',  -- Resistência física
    'magical',   -- Resistência mágica
    'critical',  -- Resistência a críticos
    'debuff'     -- Resistência a debuffs
);
```

### monster_trait

```sql
CREATE TYPE monster_trait AS ENUM (
    'armored',      -- Resistente a ataques físicos, fraco contra magia
    'swift',        -- Rápido e evasivo
    'magical',      -- Forte em magia
    'brutish',      -- Alto dano físico, baixa defesa mágica
    'resilient',    -- Alta resistência geral
    'berserker',    -- Dano aumenta conforme perde HP
    'ethereal',     -- Resistente a críticos
    'venomous'      -- Aplica efeitos de DoT
);
```

### equipment_type

```sql
CREATE TYPE equipment_type AS ENUM (
    'weapon',    -- Armas
    'armor',     -- Armaduras
    'accessory', -- Acessórios
    'shield'     -- Escudos (adicionado posteriormente)
);
```

### weapon_subtype

```sql
CREATE TYPE weapon_subtype AS ENUM (
    'sword',     -- Espadas
    'axe',       -- Machados
    'blunt',     -- Armas de concussão (maças, martelos)
    'staff',     -- Cajados mágicos
    'dagger'     -- Adagas
);
```

### equipment_rarity

```sql
CREATE TYPE equipment_rarity AS ENUM (
    'common',    -- Comum
    'uncommon',  -- Incomum
    'rare',      -- Raro
    'epic',      -- Épico
    'legendary'  -- Lendário
);
```

### spell_effect_type

```sql
CREATE TYPE spell_effect_type AS ENUM (
    'damage',  -- Dano direto
    'heal',    -- Cura
    'buff',    -- Aumenta atributos
    'debuff',  -- Diminui atributos do inimigo
    'dot',     -- Dano ao longo do tempo
    'hot'      -- Cura ao longo do tempo
);
```

### floor_type

```sql
CREATE TYPE floor_type AS ENUM (
    'common',  -- Andar comum
    'elite',   -- Andar de elite
    'event',   -- Andar de evento especial
    'boss'     -- Andar de chefe
);
```

---

## 🗂️ Detalhamento das Tabelas

## users

Gerencia contas de usuários e progressão global.

### Estrutura

```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    uid UUID NOT NULL UNIQUE,              -- UUID do Supabase Auth
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    avatar_url TEXT,
    role VARCHAR(50) NOT NULL DEFAULT 'PLAYER' CHECK (role IN ('PLAYER', 'ADMIN')),

    -- Progressão global
    highest_floor INTEGER NOT NULL DEFAULT 0,
    total_games INTEGER NOT NULL DEFAULT 0,
    total_victories INTEGER NOT NULL DEFAULT 0,
    total_character_level INTEGER NOT NULL DEFAULT 0,
    max_character_slots INTEGER NOT NULL DEFAULT 3,

    -- Dados pessoais (opcionais)
    telefone VARCHAR(20),
    documento VARCHAR(20),
    tipo_pessoa VARCHAR(2) CHECK (tipo_pessoa IN ('PF', 'PJ')),
    data_nascimento DATE,

    -- Metadados
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

### Índices

- `idx_users_uid` ON users(uid)
- `idx_users_username` ON users(username)
- `idx_users_email` ON users(email)

### Relacionamentos

- **1:N** com `characters` (via uid → user_id)
- **1:N** com `dead_characters` (via uid → user_id)
- **1:N** com `game_rankings` (via uid → user_id)

---

## characters

Personagens ativos no jogo (permadeath - quando morrem, vão para `dead_characters`).

### Estrutura

```sql
CREATE TABLE characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,

    -- Progressão básica
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    xp_next_level INTEGER DEFAULT 100,
    gold INTEGER DEFAULT 0,
    floor INTEGER DEFAULT 1,
    highest_floor INTEGER DEFAULT 1,  -- Adicionado posteriormente

    -- Stats derivados (calculados a partir de atributos)
    hp INTEGER NOT NULL,
    max_hp INTEGER NOT NULL,
    mana INTEGER NOT NULL,
    max_mana INTEGER NOT NULL,
    atk INTEGER NOT NULL,
    def INTEGER NOT NULL,
    speed INTEGER NOT NULL,

    -- Atributos primários (base do personagem)
    strength INTEGER NOT NULL DEFAULT 10,       -- Força: aumenta ataque físico
    dexterity INTEGER NOT NULL DEFAULT 10,      -- Destreza: aumenta velocidade
    intelligence INTEGER NOT NULL DEFAULT 10,   -- Inteligência: aumenta mana e dano mágico
    wisdom INTEGER NOT NULL DEFAULT 10,         -- Sabedoria: regeneração de mana
    vitality INTEGER NOT NULL DEFAULT 10,       -- Vitalidade: HP máximo
    luck INTEGER NOT NULL DEFAULT 10,           -- Sorte: drop rate e chance crítica
    attribute_points INTEGER NOT NULL DEFAULT 0,-- Pontos disponíveis para distribuir

    -- Sistema de maestrias (habilidades que evoluem com uso)
    sword_mastery INTEGER NOT NULL DEFAULT 1,
    axe_mastery INTEGER NOT NULL DEFAULT 1,
    blunt_mastery INTEGER NOT NULL DEFAULT 1,
    defense_mastery INTEGER NOT NULL DEFAULT 1,
    magic_mastery INTEGER NOT NULL DEFAULT 1,

    -- XP das maestrias
    sword_mastery_xp INTEGER NOT NULL DEFAULT 0,
    axe_mastery_xp INTEGER NOT NULL DEFAULT 0,
    blunt_mastery_xp INTEGER NOT NULL DEFAULT 0,
    defense_mastery_xp INTEGER NOT NULL DEFAULT 0,
    magic_mastery_xp INTEGER NOT NULL DEFAULT 0,

    -- Sistema de auto-heal (cura offline)
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Metadados
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id, name)
);
```

### Índices

- `idx_characters_user_id` ON characters(user_id)
- `idx_characters_level` ON characters(level DESC)

### Relacionamentos

- **N:1** com `users` (via user_id)
- **1:N** com `character_equipment`
- **1:N** com `character_consumables`
- **1:N** com `character_drops`
- **1:N** com `potion_slots`
- **1:N** com `spell_slots`

---

## dead_characters

Cemitério - armazena personagens mortos para visualização histórica (permadeath).

### Estrutura

```sql
CREATE TABLE dead_characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    original_character_id UUID NOT NULL, -- ID original quando vivo

    -- Snapshot do personagem na morte
    name VARCHAR(50) NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    xp BIGINT NOT NULL DEFAULT 0,
    gold BIGINT NOT NULL DEFAULT 0,

    -- Atributos na morte
    strength INTEGER NOT NULL DEFAULT 10,
    dexterity INTEGER NOT NULL DEFAULT 10,
    intelligence INTEGER NOT NULL DEFAULT 10,
    wisdom INTEGER NOT NULL DEFAULT 10,
    vitality INTEGER NOT NULL DEFAULT 10,
    luck INTEGER NOT NULL DEFAULT 10,

    -- Stats derivados na morte
    max_hp INTEGER NOT NULL DEFAULT 100,
    max_mana INTEGER NOT NULL DEFAULT 50,
    atk INTEGER NOT NULL DEFAULT 15,
    def INTEGER NOT NULL DEFAULT 10,
    speed INTEGER NOT NULL DEFAULT 12,

    -- Dados da jornada
    floor_reached INTEGER NOT NULL DEFAULT 1,
    highest_floor INTEGER NOT NULL DEFAULT 1,
    total_monsters_killed INTEGER NOT NULL DEFAULT 0,
    total_damage_dealt BIGINT NOT NULL DEFAULT 0,
    total_damage_taken BIGINT NOT NULL DEFAULT 0,
    total_spells_cast INTEGER NOT NULL DEFAULT 0,
    total_potions_used INTEGER NOT NULL DEFAULT 0,

    -- Causa da morte
    death_cause VARCHAR(255) NOT NULL DEFAULT 'Unknown',
    killed_by_monster VARCHAR(100),

    -- Tempo de vida
    character_created_at TIMESTAMPTZ NOT NULL,
    died_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    survival_time_minutes INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (died_at - character_created_at)) / 60
    ) STORED,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Índices

- `idx_dead_characters_user_id` ON dead_characters(user_id)
- `idx_dead_characters_died_at` ON dead_characters(died_at DESC)
- `idx_dead_characters_level` ON dead_characters(level DESC)
- `idx_dead_characters_floor_reached` ON dead_characters(floor_reached DESC)

---

## monsters

Catálogo de monstros do jogo com stats escaláveis por andar.

### Estrutura

```sql
CREATE TABLE monsters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,

    -- Stats base (escalam com andar via função)
    hp INTEGER NOT NULL,
    atk INTEGER NOT NULL,
    def INTEGER NOT NULL,
    mana INTEGER NOT NULL,
    speed INTEGER NOT NULL DEFAULT 10,
    behavior monster_behavior NOT NULL,
    min_floor INTEGER NOT NULL,         -- Andar mínimo onde aparece

    -- Recompensas base (escalam com andar)
    reward_xp INTEGER NOT NULL,
    reward_gold INTEGER NOT NULL,

    -- Atributos primários do monstro
    strength INTEGER NOT NULL DEFAULT 10,
    dexterity INTEGER NOT NULL DEFAULT 10,
    intelligence INTEGER NOT NULL DEFAULT 10,
    wisdom INTEGER NOT NULL DEFAULT 10,
    vitality INTEGER NOT NULL DEFAULT 10,
    luck INTEGER NOT NULL DEFAULT 5,

    -- Propriedades de combate
    critical_chance DECIMAL DEFAULT 0.05,      -- 5% base
    critical_damage DECIMAL DEFAULT 1.5,       -- 150% base
    critical_resistance DECIMAL DEFAULT 0,     -- Resistência a críticos

    -- Resistências (0.0 = 0%, 1.0 = 100%)
    physical_resistance DECIMAL DEFAULT 0,
    magical_resistance DECIMAL DEFAULT 0,
    debuff_resistance DECIMAL DEFAULT 0,

    -- Vulnerabilidades (multiplicador de dano)
    physical_vulnerability DECIMAL DEFAULT 1.0,
    magical_vulnerability DECIMAL DEFAULT 1.0,

    -- Características especiais
    primary_trait monster_trait DEFAULT NULL,
    secondary_trait monster_trait DEFAULT NULL,

    -- Habilidades especiais (array)
    special_abilities TEXT[] DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Índices

- `idx_monsters_min_floor` ON monsters(min_floor)

---

## equipment

Catálogo de equipamentos disponíveis no jogo.

### Estrutura

```sql
CREATE TABLE equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    type equipment_type NOT NULL,
    weapon_subtype weapon_subtype DEFAULT NULL, -- Apenas para type='weapon'
    rarity equipment_rarity NOT NULL,
    level_requirement INTEGER NOT NULL CHECK (level_requirement > 0),

    -- Bônus de atributos primários
    strength_bonus INTEGER DEFAULT 0,
    dexterity_bonus INTEGER DEFAULT 0,
    intelligence_bonus INTEGER DEFAULT 0,
    wisdom_bonus INTEGER DEFAULT 0,
    vitality_bonus INTEGER DEFAULT 0,
    luck_bonus INTEGER DEFAULT 0,

    -- Bônus de stats derivados (compatibilidade e itens especiais)
    atk_bonus INTEGER DEFAULT 0,
    def_bonus INTEGER DEFAULT 0,
    mana_bonus INTEGER DEFAULT 0,
    speed_bonus INTEGER DEFAULT 0,
    hp_bonus INTEGER DEFAULT 0,

    -- Propriedades especiais
    critical_chance_bonus DECIMAL DEFAULT 0,
    critical_damage_bonus DECIMAL DEFAULT 0,

    -- Trade-offs (penalidades para balanceamento)
    strength_penalty INTEGER DEFAULT 0,
    dexterity_penalty INTEGER DEFAULT 0,
    intelligence_penalty INTEGER DEFAULT 0,
    wisdom_penalty INTEGER DEFAULT 0,
    vitality_penalty INTEGER DEFAULT 0,
    luck_penalty INTEGER DEFAULT 0,
    speed_penalty INTEGER DEFAULT 0,

    price INTEGER NOT NULL CHECK (price > 0),
    is_unlocked BOOLEAN DEFAULT FALSE,  -- Controla desbloqueio na loja
    craftable BOOLEAN DEFAULT FALSE,    -- Pode ser craftado

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT weapon_subtype_check CHECK (
        (type = 'weapon' AND weapon_subtype IS NOT NULL) OR
        (type != 'weapon' AND weapon_subtype IS NULL)
    )
);
```

---

## character_equipment

Inventário de equipamentos de cada personagem.

### Estrutura

```sql
CREATE TABLE character_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    is_equipped BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(character_id, equipment_id)
);
```

---

## consumables

Catálogo de consumíveis (poções, elixires, etc).

### Estrutura

```sql
CREATE TABLE consumables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('potion', 'elixir', 'antidote', 'buff')),
    effect_value INTEGER NOT NULL,
    price INTEGER NOT NULL,
    level_requirement INTEGER NOT NULL DEFAULT 1,
    craftable BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

---

## character_consumables

Inventário de consumíveis de cada personagem.

### Estrutura

```sql
CREATE TABLE character_consumables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    consumable_id UUID NOT NULL REFERENCES consumables(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE (character_id, consumable_id)
);
```

---

## potion_slots

Slots de poção do personagem (atalhos para combate).

### Estrutura

```sql
CREATE TABLE potion_slots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    slot_position INTEGER NOT NULL CHECK (slot_position >= 1 AND slot_position <= 3),
    consumable_id UUID REFERENCES consumables(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(character_id, slot_position)
);
```

### Índices

- `idx_potion_slots_character_id` ON potion_slots(character_id)
- `idx_potion_slots_character_slot` ON potion_slots(character_id, slot_position)

---

## spells

Catálogo de magias disponíveis no jogo.

### Estrutura

```sql
CREATE TABLE spells (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    effect_type spell_effect_type NOT NULL,
    mana_cost INTEGER NOT NULL CHECK (mana_cost > 0),
    cooldown INTEGER NOT NULL CHECK (cooldown >= 0),
    unlocked_at_level INTEGER NOT NULL CHECK (unlocked_at_level > 0),
    effect_value INTEGER NOT NULL,
    duration INTEGER DEFAULT 1 CHECK (duration > 0), -- Para DoT/HoT/Buffs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## spell_slots

Slots de spell do personagem (atalhos para combate).

### Estrutura

```sql
CREATE TABLE spell_slots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    slot_position INTEGER NOT NULL CHECK (slot_position >= 1 AND slot_position <= 3),
    spell_id UUID REFERENCES spells(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(character_id, slot_position)
);
```

### Índices

- `idx_spell_slots_character_id` ON spell_slots(character_id)
- `idx_spell_slots_character_slot` ON spell_slots(character_id, slot_position)

---

## monster_drops

Catálogo de drops que monstros podem soltar.

### Estrutura

```sql
CREATE TABLE monster_drops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    rarity VARCHAR(50) NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
    value INTEGER NOT NULL DEFAULT 0, -- valor de venda
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

---

## monster_possible_drops

Relacionamento entre monstros e seus possíveis drops.

### Estrutura

```sql
CREATE TABLE monster_possible_drops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monster_id UUID NOT NULL REFERENCES monsters(id) ON DELETE CASCADE,
    drop_id UUID NOT NULL REFERENCES monster_drops(id) ON DELETE CASCADE,
    drop_chance DOUBLE PRECISION NOT NULL DEFAULT 0.0 CHECK (drop_chance BETWEEN 0 AND 1),
    min_quantity INTEGER NOT NULL DEFAULT 1,
    max_quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

---

## character_drops

Inventário de drops de cada personagem.

### Estrutura

```sql
CREATE TABLE character_drops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    drop_id UUID NOT NULL REFERENCES monster_drops(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE (character_id, drop_id)
);
```

---

## crafting_recipes

Receitas para criar consumíveis.

### Estrutura

```sql
CREATE TABLE crafting_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id UUID NOT NULL REFERENCES consumables(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

---

## crafting_ingredients

Ingredientes necessários para cada receita de consumível.

### Estrutura

```sql
CREATE TABLE crafting_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES crafting_recipes(id) ON DELETE CASCADE,
    item_id UUID NOT NULL,
    item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('monster_drop', 'consumable')),
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

---

## equipment_crafting_recipes

Receitas para criar equipamentos.

### Estrutura

```sql
CREATE TABLE equipment_crafting_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

---

## equipment_crafting_ingredients

Ingredientes necessários para cada receita de equipamento.

### Estrutura

```sql
CREATE TABLE equipment_crafting_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES equipment_crafting_recipes(id) ON DELETE CASCADE,
    item_id UUID NOT NULL,
    item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('monster_drop', 'consumable', 'equipment')),
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

---

## floors

Sistema de andares da torre (pode ser dinâmico ou pré-definido).

### Estrutura

```sql
CREATE TABLE floors (
    floor_number INTEGER PRIMARY KEY,
    type floor_type NOT NULL DEFAULT 'common',
    monster_pool UUID[] NOT NULL,         -- Array de IDs de monstros possíveis
    is_checkpoint BOOLEAN DEFAULT FALSE,  -- Andares que salvam progresso
    min_level INTEGER NOT NULL DEFAULT 1, -- Nível mínimo recomendado
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_floor_number CHECK (floor_number > 0)
);
```

---

## special_events

Eventos especiais que podem ocorrer em andares de tipo 'event'.

### Estrutura

```sql
CREATE TABLE special_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,  -- 'bonfire', 'treasure_chest', 'magic_fountain', etc
    description TEXT NOT NULL,

    -- Efeitos do evento
    hp_restore_percent INTEGER DEFAULT 0,
    mana_restore_percent INTEGER DEFAULT 0,
    gold_reward_min INTEGER DEFAULT 0,
    gold_reward_max INTEGER DEFAULT 0,

    -- Sistema de chance
    chance_weight INTEGER DEFAULT 10,  -- Peso para sorteio (maior = mais comum)
    min_floor INTEGER DEFAULT 1,       -- Andar mínimo onde pode aparecer

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## game_rankings

Sistema de ranking global.

### Estrutura

```sql
CREATE TABLE game_rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_name VARCHAR(100) NOT NULL,
    highest_floor INTEGER NOT NULL,
    user_id UUID REFERENCES users(uid) ON DELETE SET NULL,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Índices

- `idx_game_rankings_highest_floor` ON game_rankings(highest_floor DESC)
- `idx_game_rankings_user_id` ON game_rankings(user_id)

---

## 🔗 Diagrama de Relacionamentos (Simplificado)

```
users (1) ──────────┬──────── (N) characters
                    │
                    └──────── (N) dead_characters
                    │
                    └──────── (N) game_rankings

characters (1) ─────┬──────── (N) character_equipment ───── (N) equipment
                    │
                    ├──────── (N) character_consumables ─── (N) consumables
                    │
                    ├──────── (N) character_drops ────────  (N) monster_drops
                    │
                    ├──────── (N) potion_slots
                    │
                    └──────── (N) spell_slots

monsters (1) ───────────────── (N) monster_possible_drops ─ (N) monster_drops

crafting_recipes (1) ────────── (N) crafting_ingredients
equipment_crafting_recipes (1) ─ (N) equipment_crafting_ingredients
```

---

## 📌 Tabelas Deprecated

### character_potion_slots (DEPRECATED)

- **Substituto**: Use `potion_slots`
- **Motivo**: Renomeada para padronização

### character_spell_slots (DEPRECATED)

- **Substituto**: Use `spell_slots`
- **Motivo**: Renomeada para padronização

---

## 📝 Notas Importantes

1. **Permadeath System**: Personagens mortos são movidos de `characters` para `dead_characters`
2. **Auto-Heal**: Campo `last_activity` em `characters` usado para calcular cura offline (2h para 100%)
3. **Slots System**: Cada personagem tem 3 slots de poção e 3 slots de spell
4. **Dynamic Scaling**: Monstros escalam stats baseado no andar via função `get_monster_for_floor()`
5. **Character Slots**: Usuários começam com 3 slots, desbloqueiam mais com progressão
6. **RLS**: Row Level Security habilitado em todas as tabelas sensíveis
7. **Cascading Deletes**: Deleção de personagem limpa automaticamente todos os dados relacionados

---

## 🔄 Próximos Passos

- [ ] Criar `DB_RELATIONSHIPS.md` com diagrama ER completo em Mermaid
- [ ] Catalogar funções RPC em `DB_FUNCTIONS_CATALOG.md`
- [ ] Extrair constantes de balanceamento em `GAME_BALANCE_CONSTANTS.md`
