-- Criar enum para tipos de efeito de magia
CREATE TYPE spell_effect_type AS ENUM (
    'damage',        -- Dano direto
    'heal',         -- Cura
    'buff',         -- Aumenta atributos
    'debuff',       -- Diminui atributos do inimigo
    'dot',          -- Dano ao longo do tempo
    'hot'          -- Cura ao longo do tempo
);

-- Criar tabela de magias
CREATE TABLE IF NOT EXISTS spells (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    effect_type spell_effect_type NOT NULL,
    mana_cost INTEGER NOT NULL CHECK (mana_cost > 0),
    cooldown INTEGER NOT NULL CHECK (cooldown >= 0),
    unlocked_at_level INTEGER NOT NULL CHECK (unlocked_at_level > 0),
    effect_value INTEGER NOT NULL, -- Valor do efeito (dano, cura, etc)
    duration INTEGER DEFAULT 1 CHECK (duration > 0), -- Duração em turnos para efeitos ao longo do tempo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger para atualizar o updated_at
CREATE TRIGGER update_spells_updated_at
    BEFORE UPDATE ON spells
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Função para obter magias disponíveis para um nível
CREATE OR REPLACE FUNCTION get_available_spells(p_level INTEGER)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    description TEXT,
    effect_type spell_effect_type,
    mana_cost INTEGER,
    cooldown INTEGER,
    effect_value INTEGER,
    duration INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.description,
        s.effect_type,
        s.mana_cost,
        s.cooldown,
        s.effect_value,
        s.duration
    FROM spells s
    WHERE s.unlocked_at_level <= p_level
    ORDER BY s.unlocked_at_level ASC;
END;
$$ LANGUAGE plpgsql; 