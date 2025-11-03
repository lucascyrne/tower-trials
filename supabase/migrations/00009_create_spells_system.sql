-- =============================================
-- MIGRATION: Sistema de Spells
-- Version: 2.0
-- Description: Sistema de magias, slots e funções de gerenciamento
-- Dependencies: 00002 (ENUMs), 00004 (characters)
-- =============================================

-- === TABELAS ===

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

CREATE TABLE IF NOT EXISTS spell_slots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    slot_position INTEGER NOT NULL CHECK (slot_position >= 1 AND slot_position <= 3),
    spell_id UUID REFERENCES spells(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(character_id, slot_position)
);

-- === ÍNDICES ===

CREATE INDEX IF NOT EXISTS idx_spell_slots_character_id ON spell_slots(character_id);

-- === TRIGGERS ===

CREATE TRIGGER update_spells_updated_at
    BEFORE UPDATE ON spells
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_spell_slots_updated_at
    BEFORE UPDATE ON spell_slots
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- === FUNÇÕES ===

-- Buscar magias disponíveis para um nível
CREATE OR REPLACE FUNCTION get_available_spells(p_level INTEGER)
RETURNS TABLE (
    id UUID, name VARCHAR, description TEXT, effect_type spell_effect_type,
    mana_cost INTEGER, cooldown INTEGER, effect_value INTEGER, duration INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT s.id, s.name, s.description, s.effect_type, s.mana_cost, s.cooldown, s.effect_value, s.duration
    FROM spells s WHERE s.unlocked_at_level <= p_level ORDER BY s.unlocked_at_level;
END;
$$ LANGUAGE plpgsql;

-- Buscar slots de spell do personagem
CREATE OR REPLACE FUNCTION get_character_spell_slots(p_character_id UUID)
RETURNS TABLE (
    slot_position INTEGER, spell_id UUID, spell_name TEXT, spell_description TEXT,
    effect_type spell_effect_type, mana_cost INTEGER, cooldown INTEGER, effect_value INTEGER
) AS $$
BEGIN
    INSERT INTO spell_slots (character_id, slot_position, spell_id)
    SELECT p_character_id, generate_series(1, 3), NULL
    WHERE NOT EXISTS (SELECT 1 FROM spell_slots WHERE character_id = p_character_id)
    ON CONFLICT (character_id, slot_position) DO NOTHING;

    RETURN QUERY
    SELECT ss.slot_position, ss.spell_id, s.name, s.description, s.effect_type, s.mana_cost, s.cooldown, s.effect_value
    FROM spell_slots ss
    LEFT JOIN spells s ON ss.spell_id = s.id
    WHERE ss.character_id = p_character_id
    ORDER BY ss.slot_position;
END;
$$ LANGUAGE plpgsql;

-- Definir spell em slot
CREATE OR REPLACE FUNCTION set_spell_slot(p_character_id UUID, p_slot_position INTEGER, p_spell_id UUID)
RETURNS VOID AS $$
BEGIN
    IF p_slot_position < 1 OR p_slot_position > 3 THEN RAISE EXCEPTION 'Posição de slot inválida'; END IF;
    
    INSERT INTO spell_slots (character_id, slot_position, spell_id)
    VALUES (p_character_id, p_slot_position, p_spell_id)
    ON CONFLICT (character_id, slot_position) 
    DO UPDATE SET spell_id = p_spell_id, updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Habilitar RLS (políticas na migração 00015)
ALTER TABLE spells ENABLE ROW LEVEL SECURITY;
ALTER TABLE spell_slots ENABLE ROW LEVEL SECURITY;

