-- =============================================
-- MIGRATION: Sistema de Monstros
-- Version: 2.0
-- Description: Tabela de monstros com traits, resistências e função de scaling dinâmico
-- Dependencies: 00002 (ENUMs)
-- =============================================

-- === TABELAS ===

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

-- === ÍNDICES ===

CREATE INDEX IF NOT EXISTS idx_monsters_min_floor ON monsters(min_floor);

-- === TRIGGERS ===

CREATE TRIGGER update_monsters_updated_at
    BEFORE UPDATE ON monsters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- === FUNÇÕES ===

-- Buscar monstro para andar com stats escalados dinamicamente
CREATE OR REPLACE FUNCTION get_monster_for_floor(p_floor INTEGER)
RETURNS TABLE (
    id UUID, name VARCHAR, hp INTEGER, atk INTEGER, def INTEGER, mana INTEGER, speed INTEGER,
    behavior monster_behavior, min_floor INTEGER, reward_xp INTEGER, reward_gold INTEGER,
    strength INTEGER, dexterity INTEGER, intelligence INTEGER, wisdom INTEGER, vitality INTEGER, luck INTEGER,
    critical_chance DECIMAL, critical_damage DECIMAL, critical_resistance DECIMAL,
    physical_resistance DECIMAL, magical_resistance DECIMAL, debuff_resistance DECIMAL,
    physical_vulnerability DECIMAL, magical_vulnerability DECIMAL,
    primary_trait monster_trait, secondary_trait monster_trait, special_abilities TEXT[]
) AS $$
DECLARE
    scaling_factor DECIMAL := 0.15;
BEGIN
    RETURN QUERY
    SELECT m.id, m.name,
           (m.hp + (p_floor - m.min_floor) * GREATEST(8, FLOOR(m.hp * scaling_factor)))::INTEGER,
           (m.atk + (p_floor - m.min_floor) * GREATEST(2, FLOOR(m.atk * scaling_factor)))::INTEGER,
           (m.def + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.def * scaling_factor)))::INTEGER,
           m.mana,
           (m.speed + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.speed * scaling_factor * 0.5)))::INTEGER,
           m.behavior, m.min_floor,
           (m.reward_xp + (p_floor - m.min_floor) * GREATEST(10, FLOOR(m.reward_xp * 0.2)))::INTEGER,
           (m.reward_gold + (p_floor - m.min_floor) * GREATEST(5, FLOOR(m.reward_gold * 0.2)))::INTEGER,
           m.strength, m.dexterity, m.intelligence, m.wisdom, m.vitality, m.luck,
           m.critical_chance, m.critical_damage, m.critical_resistance,
           m.physical_resistance, m.magical_resistance, m.debuff_resistance,
           m.physical_vulnerability, m.magical_vulnerability,
           m.primary_trait, m.secondary_trait, m.special_abilities
    FROM monsters m
    WHERE m.min_floor <= p_floor
    ORDER BY m.min_floor DESC, m.name  -- ✅ CRÍTICO: Seleciona monstro apropriado para o andar, não aleatório!
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Habilitar RLS (políticas na migração 00015)
ALTER TABLE monsters ENABLE ROW LEVEL SECURITY;

