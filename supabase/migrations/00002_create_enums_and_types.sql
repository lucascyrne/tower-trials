-- =============================================
-- MIGRATION: ENUMs and Custom Types
-- Version: 2.0
-- Description: Define todos os tipos customizados e ENUMs do sistema
-- Dependencies: 00001
-- =============================================

-- === MONSTROS ===

CREATE TYPE monster_behavior AS ENUM ('aggressive', 'defensive', 'balanced');

CREATE TYPE resistance_type AS ENUM (
    'physical',
    'magical',
    'critical',
    'debuff'
);

CREATE TYPE monster_trait AS ENUM (
    'armored',
    'swift',
    'magical',
    'brutish',
    'resilient',
    'berserker',
    'ethereal',
    'venomous'
);

-- === EQUIPAMENTOS ===

CREATE TYPE equipment_type AS ENUM (
    'weapon',
    'armor',
    'accessory'
);

CREATE TYPE weapon_subtype AS ENUM (
    'sword',
    'axe',
    'blunt',
    'staff',
    'dagger'
);

CREATE TYPE equipment_rarity AS ENUM (
    'common',
    'uncommon',
    'rare',
    'epic',
    'legendary'
);

-- === SPELLS ===

CREATE TYPE spell_effect_type AS ENUM (
    'damage',
    'heal',
    'buff',
    'debuff',
    'dot',
    'hot'
);

-- === ANDARES/FLOORS ===

CREATE TYPE floor_type AS ENUM ('common', 'elite', 'event', 'boss');

-- === EVENTOS ESPECIAIS ===

CREATE TYPE special_event_type AS ENUM ('bonfire', 'treasure_chest', 'magic_fountain');

