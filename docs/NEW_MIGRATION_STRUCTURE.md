# Estrutura das Novas Migrações - Tower Trials V2

## Visão Geral

Este documento detalha a estrutura das **15 migrações consolidadas** que substituirão as atuais 120 migrações, reduzindo complexidade em **87.5%** e facilitando manutenção futura.

---

## 📋 Lista Completa de Migrações V2

```
00001_create_extensions_and_helpers.sql
00002_create_enums_and_types.sql
00003_create_users_system.sql
00004_create_characters_system.sql
00005_create_monsters_system.sql
00006_create_equipment_system.sql
00007_create_consumables_system.sql
00008_create_potion_slots_system.sql
00009_create_spells_system.sql
00010_create_drops_system.sql
00011_create_crafting_system.sql
00012_create_ranking_system.sql
00013_create_special_events_system.sql
00014_create_dead_characters_system.sql
00015_create_rls_policies.sql
```

---

## 📄 Detalhamento de Cada Migração

### 00001_create_extensions_and_helpers.sql

**Propósito**: Configuração inicial do banco - extensões PostgreSQL e funções auxiliares

**Conteúdo**:

```sql
-- =============================================
-- MIGRATION: Extensions and Helper Functions
-- Created: 2025-01-XX
-- Description: Configura extensões necessárias e funções helper reutilizáveis
-- Dependencies: Nenhuma
-- =============================================

-- Seção 1: Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" (se necessário);

-- Seção 2: Helper Functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Dependências**: Nenhuma (primeira migração)

---

### 00002_create_enums_and_types.sql

**Propósito**: Criação de todos os tipos customizados (ENUMs) usados no jogo

**Conteúdo**:

```sql
-- =============================================
-- MIGRATION: Enums and Custom Types
-- Created: 2025-01-XX
-- Description: Define todos os tipos customizados do sistema
-- Dependencies: 00001
-- =============================================

-- Seção 1: Character & Combat Enums
CREATE TYPE user_role AS ENUM ('PLAYER', 'ADMIN');

-- Seção 2: Monster Enums
CREATE TYPE monster_behavior AS ENUM ('aggressive', 'defensive', 'balanced');
CREATE TYPE resistance_type AS ENUM ('physical', 'magical', 'critical', 'debuff');
CREATE TYPE monster_trait AS ENUM (
    'armored', 'swift', 'magical', 'brutish',
    'resilient', 'berserker', 'ethereal', 'venomous'
);

-- Seção 3: Equipment Enums
CREATE TYPE equipment_type AS ENUM ('weapon', 'armor', 'accessory', 'shield');
CREATE TYPE weapon_subtype AS ENUM ('sword', 'axe', 'blunt', 'staff', 'dagger');
CREATE TYPE equipment_rarity AS ENUM ('common', 'uncommon', 'rare', 'epic', 'legendary');

-- Seção 4: Spell Enums
CREATE TYPE spell_effect_type AS ENUM ('damage', 'heal', 'buff', 'debuff', 'dot', 'hot');

-- Seção 5: Floor Enums
CREATE TYPE floor_type AS ENUM ('common', 'elite', 'event', 'boss');

-- Seção 6: Special Events Enums
CREATE TYPE special_event_type AS ENUM ('bonfire', 'treasure_chest', 'magic_fountain');
```

**Dependências**: 00001

---

### 00003_create_users_system.sql

**Propósito**: Sistema de gerenciamento de usuários e progressão global

**Conteúdo**:

```sql
-- =============================================
-- MIGRATION: Users System
-- Created: 2025-01-XX
-- Description: Gerenciamento de contas de usuários e progressão global
-- Dependencies: 00001, 00002
-- =============================================

-- Seção 1: Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id BIGSERIAL PRIMARY KEY,
    uid UUID NOT NULL UNIQUE,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    avatar_url TEXT,
    role VARCHAR(50) NOT NULL DEFAULT 'PLAYER' CHECK (role IN ('PLAYER', 'ADMIN')),
    highest_floor INTEGER NOT NULL DEFAULT 0,
    total_games INTEGER NOT NULL DEFAULT 0,
    total_victories INTEGER NOT NULL DEFAULT 0,
    total_character_level INTEGER NOT NULL DEFAULT 0,
    max_character_slots INTEGER NOT NULL DEFAULT 3,
    telefone VARCHAR(20),
    documento VARCHAR(20),
    tipo_pessoa VARCHAR(2) CHECK (tipo_pessoa IN ('PF', 'PJ')),
    data_nascimento DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Seção 2: Indexes
CREATE INDEX IF NOT EXISTS idx_users_uid ON public.users(uid);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Seção 3: Functions
CREATE OR REPLACE FUNCTION create_user_profile(...) RETURNS void AS $$ ... $$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION calculate_available_character_slots(...) RETURNS INTEGER AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION calculate_required_total_level_for_slot(...) RETURNS INTEGER AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION update_user_character_progression(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seção 4: Triggers
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Seção 5: RLS (ativo mas sem policies - policies vêm na 00015)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
```

**Dependências**: 00001, 00002  
**Funções**: 4 funções do sistema de usuários

---

### 00004_create_characters_system.sql

**Propósito**: Sistema completo de personagens (criação, stats, progressão, maestrias)

**Conteúdo**:

```sql
-- =============================================
-- MIGRATION: Characters System
-- Created: 2025-01-XX
-- Description: Sistema completo de gerenciamento de personagens
-- Dependencies: 00001, 00002, 00003
-- =============================================

-- Seção 1: Characters Table
CREATE TABLE IF NOT EXISTS characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    xp_next_level INTEGER DEFAULT 100,
    gold INTEGER DEFAULT 0,
    floor INTEGER DEFAULT 1,
    highest_floor INTEGER DEFAULT 1,
    hp INTEGER NOT NULL,
    max_hp INTEGER NOT NULL,
    mana INTEGER NOT NULL,
    max_mana INTEGER NOT NULL,
    atk INTEGER NOT NULL,
    def INTEGER NOT NULL,
    speed INTEGER NOT NULL,
    strength INTEGER NOT NULL DEFAULT 10,
    dexterity INTEGER NOT NULL DEFAULT 10,
    intelligence INTEGER NOT NULL DEFAULT 10,
    wisdom INTEGER NOT NULL DEFAULT 10,
    vitality INTEGER NOT NULL DEFAULT 10,
    luck INTEGER NOT NULL DEFAULT 10,
    attribute_points INTEGER NOT NULL DEFAULT 0,
    sword_mastery INTEGER NOT NULL DEFAULT 1,
    axe_mastery INTEGER NOT NULL DEFAULT 1,
    blunt_mastery INTEGER NOT NULL DEFAULT 1,
    defense_mastery INTEGER NOT NULL DEFAULT 1,
    magic_mastery INTEGER NOT NULL DEFAULT 1,
    sword_mastery_xp INTEGER NOT NULL DEFAULT 0,
    axe_mastery_xp INTEGER NOT NULL DEFAULT 0,
    blunt_mastery_xp INTEGER NOT NULL DEFAULT 0,
    defense_mastery_xp INTEGER NOT NULL DEFAULT 0,
    magic_mastery_xp INTEGER NOT NULL DEFAULT 0,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Seção 2: Indexes
CREATE INDEX IF NOT EXISTS idx_characters_user_id ON characters(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_level ON characters(level DESC);

-- Seção 3: Functions (15 funções)
CREATE OR REPLACE FUNCTION calculate_xp_next_level(...) RETURNS INTEGER AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION calculate_derived_stats(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION recalculate_character_stats(...) RETURNS VOID AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION calculate_skill_xp_requirement(...) RETURNS INTEGER AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION add_skill_xp(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION validate_character_name(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION create_character(...) RETURNS UUID AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION update_character_stats(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION distribute_attribute_points(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION grant_attribute_points_on_levelup(...) RETURNS INTEGER AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION get_character_full_stats(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION check_character_limit(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION get_user_characters(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION get_character(...) RETURNS characters AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION delete_character(...) RETURNS VOID AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION update_character_floor(...) RETURNS VOID AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION calculate_auto_heal(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION update_character_last_activity(...) RETURNS VOID AS $$ ... $$ LANGUAGE plpgsql;

-- Seção 4: Triggers
CREATE TRIGGER update_characters_updated_at
    BEFORE UPDATE ON characters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Seção 5: RLS (ativo mas sem policies - policies vêm na 00015)
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
```

**Dependências**: 00001, 00002, 00003  
**Funções**: 18 funções do sistema de personagens

---

### 00005_create_monsters_system.sql

**Propósito**: Sistema de monstros com escalamento tier-based

**Conteúdo**:

```sql
-- =============================================
-- MIGRATION: Monsters System
-- Created: 2025-01-XX
-- Description: Sistema de monstros com escalamento dinâmico
-- Dependencies: 00001, 00002, 00004
-- =============================================

-- Seção 1: Monsters Table
CREATE TABLE IF NOT EXISTS monsters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    hp INTEGER NOT NULL,
    atk INTEGER NOT NULL,
    def INTEGER NOT NULL,
    mana INTEGER NOT NULL,
    speed INTEGER NOT NULL DEFAULT 10,
    behavior monster_behavior NOT NULL,
    min_floor INTEGER NOT NULL,
    reward_xp INTEGER NOT NULL,
    reward_gold INTEGER NOT NULL,
    strength INTEGER NOT NULL DEFAULT 10,
    dexterity INTEGER NOT NULL DEFAULT 10,
    intelligence INTEGER NOT NULL DEFAULT 10,
    wisdom INTEGER NOT NULL DEFAULT 10,
    vitality INTEGER NOT NULL DEFAULT 10,
    luck INTEGER NOT NULL DEFAULT 5,
    critical_chance DECIMAL DEFAULT 0.05,
    critical_damage DECIMAL DEFAULT 1.5,
    critical_resistance DECIMAL DEFAULT 0,
    physical_resistance DECIMAL DEFAULT 0,
    magical_resistance DECIMAL DEFAULT 0,
    debuff_resistance DECIMAL DEFAULT 0,
    physical_vulnerability DECIMAL DEFAULT 1.0,
    magical_vulnerability DECIMAL DEFAULT 1.0,
    primary_trait monster_trait DEFAULT NULL,
    secondary_trait monster_trait DEFAULT NULL,
    special_abilities TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seção 2: Indexes
CREATE INDEX IF NOT EXISTS idx_monsters_min_floor ON monsters(min_floor);

-- Seção 3: Functions
CREATE OR REPLACE FUNCTION get_monster_for_floor(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql;

-- Seção 4: Triggers
CREATE TRIGGER update_monsters_updated_at
    BEFORE UPDATE ON monsters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Seção 5: RLS (ativo mas sem policies - policies vêm na 00015)
ALTER TABLE monsters ENABLE ROW LEVEL SECURITY;
```

**Dependências**: 00001, 00002, 00004  
**Funções**: 1 função (get_monster_for_floor com tier-based scaling)

---

### 00006_create_equipment_system.sql

**Propósito**: Sistema completo de equipamentos (catálogo + inventário + compra/venda)

**Conteúdo**:

```sql
-- =============================================
-- MIGRATION: Equipment System
-- Created: 2025-01-XX
-- Description: Sistema completo de equipamentos
-- Dependencies: 00001, 00002, 00004
-- =============================================

-- Seção 1: Equipment Table
CREATE TABLE IF NOT EXISTS equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    type equipment_type NOT NULL,
    weapon_subtype weapon_subtype DEFAULT NULL,
    rarity equipment_rarity NOT NULL,
    level_requirement INTEGER NOT NULL CHECK (level_requirement > 0),
    strength_bonus INTEGER DEFAULT 0,
    dexterity_bonus INTEGER DEFAULT 0,
    intelligence_bonus INTEGER DEFAULT 0,
    wisdom_bonus INTEGER DEFAULT 0,
    vitality_bonus INTEGER DEFAULT 0,
    luck_bonus INTEGER DEFAULT 0,
    atk_bonus INTEGER DEFAULT 0,
    def_bonus INTEGER DEFAULT 0,
    mana_bonus INTEGER DEFAULT 0,
    speed_bonus INTEGER DEFAULT 0,
    hp_bonus INTEGER DEFAULT 0,
    critical_chance_bonus DECIMAL DEFAULT 0,
    critical_damage_bonus DECIMAL DEFAULT 0,
    strength_penalty INTEGER DEFAULT 0,
    dexterity_penalty INTEGER DEFAULT 0,
    intelligence_penalty INTEGER DEFAULT 0,
    wisdom_penalty INTEGER DEFAULT 0,
    vitality_penalty INTEGER DEFAULT 0,
    luck_penalty INTEGER DEFAULT 0,
    speed_penalty INTEGER DEFAULT 0,
    price INTEGER NOT NULL CHECK (price > 0),
    is_unlocked BOOLEAN DEFAULT FALSE,
    craftable BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT weapon_subtype_check CHECK (
        (type = 'weapon' AND weapon_subtype IS NOT NULL) OR
        (type != 'weapon' AND weapon_subtype IS NULL)
    )
);

-- Seção 2: Character Equipment (Inventário)
CREATE TABLE IF NOT EXISTS character_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    is_equipped BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(character_id, equipment_id)
);

-- Seção 3: Indexes
CREATE INDEX IF NOT EXISTS idx_equipment_type ON equipment(type);
CREATE INDEX IF NOT EXISTS idx_equipment_rarity ON equipment(rarity);
CREATE INDEX IF NOT EXISTS idx_character_equipment_character_id ON character_equipment(character_id);
CREATE INDEX IF NOT EXISTS idx_character_equipment_equipped ON character_equipment(character_id, is_equipped);

-- Seção 4: Functions
CREATE OR REPLACE FUNCTION buy_equipment(...) RETURNS VOID AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION sell_equipment(...) RETURNS VOID AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION sell_character_equipment_batch(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION toggle_equipment(...) RETURNS VOID AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION calculate_equipment_bonuses(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION unlock_equipment(...) RETURNS VOID AS $$ ... $$ LANGUAGE plpgsql;

-- Seção 5: Triggers
CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON equipment FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_character_equipment_updated_at BEFORE UPDATE ON character_equipment FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seção 6: RLS
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_equipment ENABLE ROW LEVEL SECURITY;
```

**Dependências**: 00001, 00002, 00004  
**Funções**: 6 funções do sistema de equipamentos

---

### 00007_create_consumables_system.sql

**Propósito**: Sistema de consumíveis (poções, elixires, etc)

**Conteúdo**:

```sql
-- =============================================
-- MIGRATION: Consumables System
-- Created: 2025-01-XX
-- Description: Sistema completo de consumíveis
-- Dependencies: 00001, 00002, 00004
-- =============================================

-- Seção 1: Consumables Table
CREATE TABLE IF NOT EXISTS consumables (
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

-- Seção 2: Character Consumables (Inventário)
CREATE TABLE IF NOT EXISTS character_consumables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    consumable_id UUID NOT NULL REFERENCES consumables(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE (character_id, consumable_id)
);

-- Seção 3: Indexes
CREATE INDEX IF NOT EXISTS idx_consumables_type ON consumables(type);
CREATE INDEX IF NOT EXISTS idx_character_consumables_character_id ON character_consumables(character_id);

-- Seção 4: Functions
CREATE OR REPLACE FUNCTION buy_consumable(...) RETURNS VOID AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION use_consumable(...) RETURNS VOID AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION sell_character_consumables_batch(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION add_consumable_to_inventory(...) RETURNS VOID AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION consume_potion(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql;

-- Seção 5: Triggers
CREATE TRIGGER update_consumables_updated_at BEFORE UPDATE ON consumables FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_character_consumables_updated_at BEFORE UPDATE ON character_consumables FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seção 6: RLS
ALTER TABLE consumables ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_consumables ENABLE ROW LEVEL SECURITY;
```

**Dependências**: 00001, 00002, 00004  
**Funções**: 5 funções do sistema de consumíveis

---

### 00008_create_potion_slots_system.sql

**Propósito**: Sistema de slots de poção (atalhos para combate)

**Conteúdo**:

```sql
-- =============================================
-- MIGRATION: Potion Slots System
-- Created: 2025-01-XX
-- Description: Sistema de slots rápidos de poção
-- Dependencies: 00001, 00002, 00004, 00007
-- =============================================

-- Seção 1: Potion Slots Table
CREATE TABLE IF NOT EXISTS potion_slots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    slot_position INTEGER NOT NULL CHECK (slot_position >= 1 AND slot_position <= 3),
    consumable_id UUID REFERENCES consumables(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(character_id, slot_position)
);

-- Seção 2: Indexes
CREATE INDEX IF NOT EXISTS idx_potion_slots_character_id ON potion_slots(character_id);
CREATE INDEX IF NOT EXISTS idx_potion_slots_character_slot ON potion_slots(character_id, slot_position);

-- Seção 3: Functions
CREATE OR REPLACE FUNCTION initialize_character_slots() RETURNS TRIGGER AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION get_character_potion_slots(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION set_potion_slot(...) RETURNS JSON AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION clear_potion_slot(...) RETURNS JSON AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION use_potion_from_slot(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql;

-- Seção 4: Triggers
CREATE TRIGGER update_potion_slots_updated_at BEFORE UPDATE ON potion_slots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_initialize_slots AFTER INSERT ON characters FOR EACH ROW EXECUTE FUNCTION initialize_character_slots();

-- Seção 5: RLS
ALTER TABLE potion_slots ENABLE ROW LEVEL SECURITY;
```

**Dependências**: 00001, 00002, 00004, 00007  
**Funções**: 5 funções do sistema de slots

---

### 00009_create_spells_system.sql

**Propósito**: Sistema de magias e spell slots

**Conteúdo**:

```sql
-- =============================================
-- MIGRATION: Spells System
-- Created: 2025-01-XX
-- Description: Sistema completo de magias
-- Dependencies: 00001, 00002, 00004
-- =============================================

-- Seção 1: Spells Table
CREATE TABLE IF NOT EXISTS spells (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    effect_type spell_effect_type NOT NULL,
    mana_cost INTEGER NOT NULL CHECK (mana_cost > 0),
    cooldown INTEGER NOT NULL CHECK (cooldown >= 0),
    unlocked_at_level INTEGER NOT NULL CHECK (unlocked_at_level > 0),
    effect_value INTEGER NOT NULL,
    duration INTEGER DEFAULT 1 CHECK (duration > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seção 2: Spell Slots Table
CREATE TABLE IF NOT EXISTS spell_slots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    slot_position INTEGER NOT NULL CHECK (slot_position >= 1 AND slot_position <= 3),
    spell_id UUID REFERENCES spells(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(character_id, slot_position)
);

-- Seção 3: Indexes
CREATE INDEX IF NOT EXISTS idx_spells_unlocked_at_level ON spells(unlocked_at_level);
CREATE INDEX IF NOT EXISTS idx_spell_slots_character_id ON spell_slots(character_id);
CREATE INDEX IF NOT EXISTS idx_spell_slots_character_slot ON spell_slots(character_id, slot_position);

-- Seção 4: Functions
CREATE OR REPLACE FUNCTION get_available_spells(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION get_character_spell_slots(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION set_spell_slot(...) RETURNS JSON AS $$ ... $$ LANGUAGE plpgsql;

-- Seção 5: Triggers
CREATE TRIGGER update_spells_updated_at BEFORE UPDATE ON spells FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_spell_slots_updated_at BEFORE UPDATE ON spell_slots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seção 6: RLS
ALTER TABLE spells ENABLE ROW LEVEL SECURITY;
ALTER TABLE spell_slots ENABLE ROW LEVEL SECURITY;
```

**Dependências**: 00001, 00002, 00004  
**Funções**: 3 funções do sistema de spells

---

### 00010_create_drops_system.sql

**Propósito**: Sistema de drops de monstros

**Conteúdo**:

```sql
-- =============================================
-- MIGRATION: Drops System
-- Created: 2025-01-XX
-- Description: Sistema de drops de monstros e inventário
-- Dependencies: 00001, 00002, 00004, 00005
-- =============================================

-- Seção 1: Monster Drops Catalog
CREATE TABLE IF NOT EXISTS monster_drops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    rarity VARCHAR(50) NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
    value INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Seção 2: Monster Possible Drops (Relação)
CREATE TABLE IF NOT EXISTS monster_possible_drops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monster_id UUID NOT NULL REFERENCES monsters(id) ON DELETE CASCADE,
    drop_id UUID NOT NULL REFERENCES monster_drops(id) ON DELETE CASCADE,
    drop_chance DOUBLE PRECISION NOT NULL DEFAULT 0.0 CHECK (drop_chance BETWEEN 0 AND 1),
    min_quantity INTEGER NOT NULL DEFAULT 1,
    max_quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Seção 3: Character Drops (Inventário)
CREATE TABLE IF NOT EXISTS character_drops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    drop_id UUID NOT NULL REFERENCES monster_drops(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE (character_id, drop_id)
);

-- Seção 4: Indexes
CREATE INDEX IF NOT EXISTS idx_monster_drops_rarity ON monster_drops(rarity);
CREATE INDEX IF NOT EXISTS idx_monster_possible_drops_monster_id ON monster_possible_drops(monster_id);
CREATE INDEX IF NOT EXISTS idx_character_drops_character_id ON character_drops(character_id);

-- Seção 5: Functions
CREATE OR REPLACE FUNCTION add_monster_drop(...) RETURNS VOID AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION get_monster_drops(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION sell_character_drops_batch(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql;

-- Seção 6: Triggers
CREATE TRIGGER update_monster_drops_updated_at BEFORE UPDATE ON monster_drops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_monster_possible_drops_updated_at BEFORE UPDATE ON monster_possible_drops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_character_drops_updated_at BEFORE UPDATE ON character_drops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seção 7: RLS
ALTER TABLE monster_drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE monster_possible_drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_drops ENABLE ROW LEVEL SECURITY;
```

**Dependências**: 00001, 00002, 00004, 00005  
**Funções**: 3 funções do sistema de drops

---

### 00011_create_crafting_system.sql

**Propósito**: Sistema de crafting (consumíveis + equipamentos)

**Conteúdo**:

```sql
-- =============================================
-- MIGRATION: Crafting System
-- Created: 2025-01-XX
-- Description: Sistema completo de crafting
-- Dependencies: 00001, 00002, 00004, 00006, 00007, 00010
-- =============================================

-- Seção 1: Crafting Recipes (Consumables)
CREATE TABLE IF NOT EXISTS crafting_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id UUID NOT NULL REFERENCES consumables(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Seção 2: Crafting Ingredients (Consumables)
CREATE TABLE IF NOT EXISTS crafting_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES crafting_recipes(id) ON DELETE CASCADE,
    item_id UUID NOT NULL,
    item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('monster_drop', 'consumable')),
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Seção 3: Equipment Crafting Recipes
CREATE TABLE IF NOT EXISTS equipment_crafting_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Seção 4: Equipment Crafting Ingredients
CREATE TABLE IF NOT EXISTS equipment_crafting_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES equipment_crafting_recipes(id) ON DELETE CASCADE,
    item_id UUID NOT NULL,
    item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('monster_drop', 'consumable', 'equipment')),
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Seção 5: Indexes
CREATE INDEX IF NOT EXISTS idx_crafting_recipes_result_id ON crafting_recipes(result_id);
CREATE INDEX IF NOT EXISTS idx_crafting_ingredients_recipe_id ON crafting_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_equipment_crafting_recipes_result_id ON equipment_crafting_recipes(result_equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_crafting_ingredients_recipe_id ON equipment_crafting_ingredients(recipe_id);

-- Seção 6: Functions
CREATE OR REPLACE FUNCTION validate_crafting_ingredient() RETURNS TRIGGER AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION validate_equipment_crafting_ingredient() RETURNS TRIGGER AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION check_can_craft(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION craft_item(...) RETURNS VOID AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION check_can_craft_equipment(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION craft_equipment(...) RETURNS VOID AS $$ ... $$ LANGUAGE plpgsql;

-- Seção 7: Triggers
CREATE TRIGGER validate_crafting_ingredient_trigger BEFORE INSERT OR UPDATE ON crafting_ingredients FOR EACH ROW EXECUTE FUNCTION validate_crafting_ingredient();
CREATE TRIGGER validate_equipment_crafting_ingredient_trigger BEFORE INSERT OR UPDATE ON equipment_crafting_ingredients FOR EACH ROW EXECUTE FUNCTION validate_equipment_crafting_ingredient();
CREATE TRIGGER update_crafting_recipes_updated_at BEFORE UPDATE ON crafting_recipes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_crafting_ingredients_updated_at BEFORE UPDATE ON crafting_ingredients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_equipment_crafting_recipes_updated_at BEFORE UPDATE ON equipment_crafting_recipes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_equipment_crafting_ingredients_updated_at BEFORE UPDATE ON equipment_crafting_ingredients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seção 8: RLS
ALTER TABLE crafting_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE crafting_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_crafting_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_crafting_ingredients ENABLE ROW LEVEL SECURITY;
```

**Dependências**: 00001, 00002, 00004, 00006, 00007, 00010  
**Funções**: 6 funções do sistema de crafting

---

### 00012_create_ranking_system.sql

**Propósito**: Sistema de ranking global e por andar

**Conteúdo**:

```sql
-- =============================================
-- MIGRATION: Ranking System
-- Created: 2025-01-XX
-- Description: Sistema completo de rankings
-- Dependencies: 00001, 00002, 00003, 00004
-- =============================================

-- Seção 1: Game Rankings Table
CREATE TABLE IF NOT EXISTS game_rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_name VARCHAR(100) NOT NULL,
    highest_floor INTEGER NOT NULL,
    user_id UUID REFERENCES users(uid) ON DELETE SET NULL,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seção 2: Game Progress Table
CREATE TABLE IF NOT EXISTS game_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    player_name VARCHAR(100) NOT NULL,
    current_floor INTEGER DEFAULT 1,
    hp INTEGER NOT NULL,
    max_hp INTEGER NOT NULL,
    attack INTEGER NOT NULL,
    defense INTEGER NOT NULL,
    highest_floor INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seção 3: Indexes
CREATE INDEX IF NOT EXISTS idx_game_rankings_highest_floor ON game_rankings(highest_floor DESC);
CREATE INDEX IF NOT EXISTS idx_game_rankings_user_id ON game_rankings(user_id);
CREATE INDEX IF NOT EXISTS idx_game_progress_user_id ON game_progress(user_id);

-- Seção 4: Functions
CREATE OR REPLACE FUNCTION save_ranking_entry(...) RETURNS UUID AS $$ ... $$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION get_global_ranking(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION get_floor_ranking(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION get_player_ranking_position(...) RETURNS INTEGER AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION delete_user_ranking_entries(...) RETURNS INTEGER AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION count_ranking_entries(...) RETURNS INTEGER AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION get_top_floors_summary() RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION get_player_rank_history(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql;

-- Seção 5: Triggers
CREATE TRIGGER update_game_progress_updated_at BEFORE UPDATE ON game_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seção 6: RLS
ALTER TABLE game_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_progress ENABLE ROW LEVEL SECURITY;
```

**Dependências**: 00001, 00002, 00003, 00004  
**Funções**: 8 funções do sistema de ranking

---

### 00013_create_special_events_system.sql

**Propósito**: Sistema de eventos especiais e andares

**Conteúdo**:

```sql
-- =============================================
-- MIGRATION: Special Events System
-- Created: 2025-01-XX
-- Description: Sistema de eventos especiais e andares
-- Dependencies: 00001, 00002, 00004, 00005
-- =============================================

-- Seção 1: Floors Table
CREATE TABLE IF NOT EXISTS floors (
    floor_number INTEGER PRIMARY KEY,
    type floor_type NOT NULL DEFAULT 'common',
    monster_pool UUID[] NOT NULL,
    is_checkpoint BOOLEAN DEFAULT FALSE,
    min_level INTEGER NOT NULL DEFAULT 1,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_floor_number CHECK (floor_number > 0)
);

-- Seção 2: Special Events Table
CREATE TABLE IF NOT EXISTS special_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type special_event_type NOT NULL,
    description TEXT NOT NULL,
    hp_restore_percent INTEGER DEFAULT 0,
    mana_restore_percent INTEGER DEFAULT 0,
    gold_reward_min INTEGER DEFAULT 0,
    gold_reward_max INTEGER DEFAULT 0,
    chance_weight INTEGER DEFAULT 1,
    min_floor INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seção 3: Indexes
CREATE INDEX IF NOT EXISTS idx_floors_floor_number ON floors(floor_number);
CREATE INDEX IF NOT EXISTS idx_special_events_min_floor ON special_events(min_floor);

-- Seção 4: Functions
CREATE OR REPLACE FUNCTION generate_monster_pool(...) RETURNS UUID[] AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION get_floor_data(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION get_unlocked_checkpoints(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION get_special_event_for_floor(...) RETURNS special_events AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION process_special_event(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seção 5: Triggers
CREATE TRIGGER update_floors_updated_at BEFORE UPDATE ON floors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seção 6: RLS
ALTER TABLE floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_events ENABLE ROW LEVEL SECURITY;
```

**Dependências**: 00001, 00002, 00004, 00005  
**Funções**: 5 funções do sistema de eventos e andares

---

### 00014_create_dead_characters_system.sql

**Propósito**: Sistema de cemitério (permadeath)

**Conteúdo**:

```sql
-- =============================================
-- MIGRATION: Dead Characters System (Cemetery)
-- Created: 2025-01-XX
-- Description: Sistema de permadeath e cemitério
-- Dependencies: 00001, 00002, 00003, 00004
-- =============================================

-- Seção 1: Dead Characters Table
CREATE TABLE IF NOT EXISTS dead_characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    original_character_id UUID NOT NULL,
    name VARCHAR(50) NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    xp BIGINT NOT NULL DEFAULT 0,
    gold BIGINT NOT NULL DEFAULT 0,
    strength INTEGER NOT NULL DEFAULT 10,
    dexterity INTEGER NOT NULL DEFAULT 10,
    intelligence INTEGER NOT NULL DEFAULT 10,
    wisdom INTEGER NOT NULL DEFAULT 10,
    vitality INTEGER NOT NULL DEFAULT 10,
    luck INTEGER NOT NULL DEFAULT 10,
    max_hp INTEGER NOT NULL DEFAULT 100,
    max_mana INTEGER NOT NULL DEFAULT 50,
    atk INTEGER NOT NULL DEFAULT 15,
    def INTEGER NOT NULL DEFAULT 10,
    speed INTEGER NOT NULL DEFAULT 12,
    floor_reached INTEGER NOT NULL DEFAULT 1,
    highest_floor INTEGER NOT NULL DEFAULT 1,
    total_monsters_killed INTEGER NOT NULL DEFAULT 0,
    total_damage_dealt BIGINT NOT NULL DEFAULT 0,
    total_damage_taken BIGINT NOT NULL DEFAULT 0,
    total_spells_cast INTEGER NOT NULL DEFAULT 0,
    total_potions_used INTEGER NOT NULL DEFAULT 0,
    death_cause VARCHAR(255) NOT NULL DEFAULT 'Unknown',
    killed_by_monster VARCHAR(100),
    character_created_at TIMESTAMPTZ NOT NULL,
    died_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    survival_time_minutes INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (died_at - character_created_at)) / 60
    ) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seção 2: Indexes
CREATE INDEX IF NOT EXISTS idx_dead_characters_user_id ON dead_characters(user_id);
CREATE INDEX IF NOT EXISTS idx_dead_characters_died_at ON dead_characters(died_at DESC);
CREATE INDEX IF NOT EXISTS idx_dead_characters_level ON dead_characters(level DESC);
CREATE INDEX IF NOT EXISTS idx_dead_characters_floor_reached ON dead_characters(floor_reached DESC);

-- Seção 3: Functions
CREATE OR REPLACE FUNCTION kill_character(...) RETURNS UUID AS $$ ... $$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION get_user_cemetery(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION count_user_cemetery(...) RETURNS INTEGER AS $$ ... $$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION get_cemetery_stats(...) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seção 4: Triggers
CREATE TRIGGER update_dead_characters_updated_at BEFORE UPDATE ON dead_characters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seção 5: RLS
ALTER TABLE dead_characters ENABLE ROW LEVEL SECURITY;
```

**Dependências**: 00001, 00002, 00003, 00004  
**Funções**: 4 funções do sistema de cemitério

---

### 00015_create_rls_policies.sql

**Propósito**: Consolidação de todas as políticas RLS

**Conteúdo**:

```sql
-- =============================================
-- MIGRATION: RLS Policies
-- Created: 2025-01-XX
-- Description: Políticas de Row Level Security para todas as tabelas
-- Dependencies: 00001-00014
-- =============================================

-- ======================================
-- USERS TABLE
-- ======================================
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
DROP POLICY IF EXISTS "users_update_policy" ON public.users;
DROP POLICY IF EXISTS "users_delete_policy" ON public.users;

CREATE POLICY "users_select_policy" ON public.users
    FOR SELECT USING (true);

CREATE POLICY "users_insert_policy" ON public.users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "users_update_policy" ON public.users
    FOR UPDATE USING (
        uid = (SELECT auth.uid()) OR
        auth.role() = 'service_role'
    ) WITH CHECK (
        uid = (SELECT auth.uid()) OR
        auth.role() = 'service_role'
    );

CREATE POLICY "users_delete_policy" ON public.users
    FOR DELETE USING (
        uid = (SELECT auth.uid()) OR
        auth.role() = 'service_role'
    );

-- ======================================
-- CHARACTERS TABLE
-- ======================================
DROP POLICY IF EXISTS "characters_select_policy" ON characters;
DROP POLICY IF EXISTS "characters_insert_policy" ON characters;
DROP POLICY IF EXISTS "characters_update_policy" ON characters;
DROP POLICY IF EXISTS "characters_delete_policy" ON characters;

CREATE POLICY "characters_select_policy" ON characters
    FOR SELECT USING (
        user_id = auth.uid() OR
        auth.role() = 'service_role'
    );

CREATE POLICY "characters_insert_policy" ON characters
    FOR INSERT WITH CHECK (
        user_id = auth.uid() OR
        auth.role() = 'service_role'
    );

CREATE POLICY "characters_update_policy" ON characters
    FOR UPDATE USING (
        user_id = auth.uid() OR
        auth.role() = 'service_role'
    ) WITH CHECK (
        user_id = auth.uid() OR
        auth.role() = 'service_role'
    );

CREATE POLICY "characters_delete_policy" ON characters
    FOR DELETE USING (
        user_id = auth.uid() OR
        auth.role() = 'service_role'
    );

-- ======================================
-- MONSTERS TABLE (Leitura pública)
-- ======================================
DROP POLICY IF EXISTS "monsters_public_read" ON monsters;
CREATE POLICY "monsters_public_read" ON monsters
    FOR SELECT USING (true);

-- ======================================
-- EQUIPMENT TABLES
-- ======================================
-- Equipment catalog: Leitura pública
DROP POLICY IF EXISTS "equipment_public_read" ON equipment;
CREATE POLICY "equipment_public_read" ON equipment
    FOR SELECT USING (true);

-- Character equipment: Apenas o dono
DROP POLICY IF EXISTS "character_equipment_policy" ON character_equipment;
CREATE POLICY "character_equipment_policy" ON character_equipment
    FOR ALL TO authenticated
    USING (character_id IN (
        SELECT id FROM characters WHERE user_id = auth.uid()
    ))
    WITH CHECK (character_id IN (
        SELECT id FROM characters WHERE user_id = auth.uid()
    ));

-- ======================================
-- CONSUMABLES TABLES
-- ======================================
-- Consumables catalog: Leitura pública
DROP POLICY IF EXISTS "consumables_public_read" ON consumables;
CREATE POLICY "consumables_public_read" ON consumables
    FOR SELECT USING (true);

-- Character consumables: Apenas o dono
DROP POLICY IF EXISTS "character_consumables_policy" ON character_consumables;
CREATE POLICY "character_consumables_policy" ON character_consumables
    FOR ALL TO authenticated
    USING (character_id IN (
        SELECT id FROM characters WHERE user_id = auth.uid()
    ))
    WITH CHECK (character_id IN (
        SELECT id FROM characters WHERE user_id = auth.uid()
    ));

-- ======================================
-- POTION SLOTS
-- ======================================
DROP POLICY IF EXISTS "potion_slots_policy" ON potion_slots;
CREATE POLICY "potion_slots_policy" ON potion_slots
    FOR ALL TO authenticated
    USING (character_id IN (
        SELECT id FROM characters WHERE user_id = auth.uid()
    ))
    WITH CHECK (character_id IN (
        SELECT id FROM characters WHERE user_id = auth.uid()
    ));

-- ======================================
-- SPELLS TABLES
-- ======================================
-- Spells catalog: Leitura pública
DROP POLICY IF EXISTS "spells_public_read" ON spells;
CREATE POLICY "spells_public_read" ON spells
    FOR SELECT USING (true);

-- Spell slots: Apenas o dono
DROP POLICY IF EXISTS "spell_slots_policy" ON spell_slots;
CREATE POLICY "spell_slots_policy" ON spell_slots
    FOR ALL TO authenticated
    USING (character_id IN (
        SELECT id FROM characters WHERE user_id = auth.uid()
    ))
    WITH CHECK (character_id IN (
        SELECT id FROM characters WHERE user_id = auth.uid()
    ));

-- ======================================
-- DROPS TABLES
-- ======================================
-- Drops catalog: Leitura pública
DROP POLICY IF EXISTS "monster_drops_public_read" ON monster_drops;
CREATE POLICY "monster_drops_public_read" ON monster_drops
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "monster_possible_drops_public_read" ON monster_possible_drops;
CREATE POLICY "monster_possible_drops_public_read" ON monster_possible_drops
    FOR SELECT USING (true);

-- Character drops: Apenas o dono
DROP POLICY IF EXISTS "character_drops_policy" ON character_drops;
CREATE POLICY "character_drops_policy" ON character_drops
    FOR ALL TO authenticated
    USING (character_id IN (
        SELECT id FROM characters WHERE user_id = auth.uid()
    ))
    WITH CHECK (character_id IN (
        SELECT id FROM characters WHERE user_id = auth.uid()
    ));

-- ======================================
-- CRAFTING TABLES (Leitura pública)
-- ======================================
DROP POLICY IF EXISTS "crafting_recipes_public_read" ON crafting_recipes;
CREATE POLICY "crafting_recipes_public_read" ON crafting_recipes
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "crafting_ingredients_public_read" ON crafting_ingredients;
CREATE POLICY "crafting_ingredients_public_read" ON crafting_ingredients
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "equipment_crafting_recipes_public_read" ON equipment_crafting_recipes;
CREATE POLICY "equipment_crafting_recipes_public_read" ON equipment_crafting_recipes
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "equipment_crafting_ingredients_public_read" ON equipment_crafting_ingredients;
CREATE POLICY "equipment_crafting_ingredients_public_read" ON equipment_crafting_ingredients
    FOR SELECT USING (true);

-- ======================================
-- RANKING TABLES
-- ======================================
DROP POLICY IF EXISTS "game_rankings_select_policy" ON game_rankings;
DROP POLICY IF EXISTS "game_rankings_insert_policy" ON game_rankings;
DROP POLICY IF EXISTS "game_rankings_update_policy" ON game_rankings;
DROP POLICY IF EXISTS "game_rankings_delete_policy" ON game_rankings;

CREATE POLICY "game_rankings_select_policy" ON game_rankings
    FOR SELECT USING (true);

CREATE POLICY "game_rankings_insert_policy" ON game_rankings
    FOR INSERT TO authenticated
    WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "game_rankings_update_policy" ON game_rankings
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "game_rankings_delete_policy" ON game_rankings
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- Game Progress: Apenas próprio usuário
DROP POLICY IF EXISTS "game_progress_policy" ON game_progress;
CREATE POLICY "game_progress_policy" ON game_progress
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ======================================
-- FLOORS AND SPECIAL EVENTS (Leitura pública)
-- ======================================
DROP POLICY IF EXISTS "floors_public_read" ON floors;
CREATE POLICY "floors_public_read" ON floors
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "special_events_public_read" ON special_events;
CREATE POLICY "special_events_public_read" ON special_events
    FOR SELECT USING (true);

-- ======================================
-- DEAD CHARACTERS
-- ======================================
DROP POLICY IF EXISTS "dead_characters_select_policy" ON dead_characters;
DROP POLICY IF EXISTS "dead_characters_insert_policy" ON dead_characters;

CREATE POLICY "dead_characters_select_policy" ON dead_characters
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "dead_characters_insert_policy" ON dead_characters
    FOR INSERT WITH CHECK (true);
```

**Dependências**: Todas as migrações anteriores (00001-00014)

---

## 📊 Resumo Geral

### Estatísticas

```
Total de Migrações: 15
Total de Funções: ~70
Total de Tabelas: 24
Total de ENUMs: 8
Total de Triggers: 24
Total de Policies: 30+
```

### Redução Alcançada

```
Antes: 120 migrações
Depois: 15 migrações
Redução: 87.5%
```

---

## ✅ Próximos Passos

1. ⏳ **Revisar e aprovar** esta estrutura
2. ⏳ **Criar seed_v2.sql** otimizado
3. ⏳ **Implementar migrações** (00001-00015)
4. ⏳ **Validar integridade** (schema + funções)
5. ⏳ **Testar em ambiente local**
6. ⏳ **Deploy em novo projeto Supabase**

---

**Última Atualização**: 20 de Outubro de 2025  
**Status**: Estrutura definida - Aguardando aprovação
