-- Criar enum para comportamentos dos monstros
CREATE TYPE monster_behavior AS ENUM ('aggressive', 'defensive', 'balanced');

-- Criar enum para tipos de resistência
CREATE TYPE resistance_type AS ENUM (
    'physical',  -- Resistência física
    'magical',   -- Resistência mágica 
    'critical',  -- Resistência a críticos
    'debuff'     -- Resistência a debuffs
);

-- Criar enum para pontos fortes/fracos
CREATE TYPE monster_trait AS ENUM (
    'armored',      -- Resistente a ataques físicos, fraco contra magia
    'swift',        -- Rápido e evasivo, fraco contra ataques lentos mas fortes
    'magical',      -- Forte em magia, fraco contra ataques físicos
    'brutish',      -- Alto dano físico, baixa defesa mágica
    'resilient',    -- Alta resistência geral, baixo dano
    'berserker',    -- Dano aumenta conforme perde HP
    'ethereal',     -- Resistente a críticos, vulnerável a magia
    'venomous'      -- Aplica efeitos de DoT
);

-- Criar tabela de monstros
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
    
    -- Atributos primários do monstro (para cálculos mais complexos)
    strength INTEGER NOT NULL DEFAULT 10,
    dexterity INTEGER NOT NULL DEFAULT 10,
    intelligence INTEGER NOT NULL DEFAULT 10,
    wisdom INTEGER NOT NULL DEFAULT 10,
    vitality INTEGER NOT NULL DEFAULT 10,
    luck INTEGER NOT NULL DEFAULT 5,
    
    -- Propriedades especiais de combate
    critical_chance DECIMAL DEFAULT 0.05, -- 5% base
    critical_damage DECIMAL DEFAULT 1.5,  -- 150% base
    critical_resistance DECIMAL DEFAULT 0, -- Resistência a críticos
    
    -- Resistências específicas (0.0 = 0%, 1.0 = 100%)
    physical_resistance DECIMAL DEFAULT 0,
    magical_resistance DECIMAL DEFAULT 0,
    debuff_resistance DECIMAL DEFAULT 0,
    
    -- Vulnerabilidades específicas (multiplicador de dano)
    physical_vulnerability DECIMAL DEFAULT 1.0,
    magical_vulnerability DECIMAL DEFAULT 1.0,
    
    -- Características especiais
    primary_trait monster_trait DEFAULT NULL,
    secondary_trait monster_trait DEFAULT NULL,
    
    -- Habilidades especiais (para implementações futuras)
    special_abilities TEXT[] DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger para atualizar o updated_at
CREATE TRIGGER update_monsters_updated_at
    BEFORE UPDATE ON monsters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_monsters_min_floor ON monsters(min_floor);

-- Função para obter monstro por andar com stats ajustados e complexidade
CREATE OR REPLACE FUNCTION get_monster_for_floor(p_floor INTEGER)
RETURNS TABLE (
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
) AS $$
DECLARE
    floor_range INTEGER := 5;
    scaling_factor DECIMAL := 0.15; -- Reduzido para manter balanceamento
BEGIN
    RETURN QUERY
    SELECT m.id, m.name,
           -- Escalar stats derivados baseado no andar
           (m.hp + (p_floor - m.min_floor) * GREATEST(8, FLOOR(m.hp * scaling_factor)))::INTEGER as hp,
           (m.atk + (p_floor - m.min_floor) * GREATEST(2, FLOOR(m.atk * scaling_factor)))::INTEGER as atk,
           (m.def + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.def * scaling_factor)))::INTEGER as def,
           m.mana,
           (m.speed + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.speed * scaling_factor * 0.5)))::INTEGER as speed,
           m.behavior,
           m.min_floor,
           -- Escalar recompensas baseado no andar
           (m.reward_xp + (p_floor - m.min_floor) * GREATEST(3, FLOOR(m.reward_xp * scaling_factor)))::INTEGER as reward_xp,
           (m.reward_gold + (p_floor - m.min_floor) * GREATEST(4, FLOOR(m.reward_gold * scaling_factor)))::INTEGER as reward_gold,
           
           -- Atributos primários escalados
           (m.strength + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.strength * scaling_factor * 0.3)))::INTEGER as strength,
           (m.dexterity + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.dexterity * scaling_factor * 0.3)))::INTEGER as dexterity,
           (m.intelligence + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.intelligence * scaling_factor * 0.3)))::INTEGER as intelligence,
           (m.wisdom + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.wisdom * scaling_factor * 0.3)))::INTEGER as wisdom,
           (m.vitality + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.vitality * scaling_factor * 0.3)))::INTEGER as vitality,
           (m.luck + (p_floor - m.min_floor) * GREATEST(0, FLOOR(m.luck * scaling_factor * 0.2)))::INTEGER as luck,
           
           -- Propriedades de combate com escalamento moderado
           LEAST(0.35, m.critical_chance + (p_floor - m.min_floor) * 0.005) as critical_chance, -- Cap em 35%
           LEAST(2.5, m.critical_damage + (p_floor - m.min_floor) * 0.02) as critical_damage,   -- Cap em 250%
           LEAST(0.8, m.critical_resistance + (p_floor - m.min_floor) * 0.01) as critical_resistance, -- Cap em 80%
           
           -- Resistências com cap
           LEAST(0.75, m.physical_resistance + (p_floor - m.min_floor) * 0.008) as physical_resistance,
           LEAST(0.75, m.magical_resistance + (p_floor - m.min_floor) * 0.008) as magical_resistance,
           LEAST(0.90, m.debuff_resistance + (p_floor - m.min_floor) * 0.01) as debuff_resistance,
           
           -- Vulnerabilidades não mudam com andar (características fixas)
           m.physical_vulnerability,
           m.magical_vulnerability,
           m.primary_trait,
           m.secondary_trait,
           m.special_abilities
    FROM monsters m
    WHERE m.min_floor <= p_floor 
    AND m.min_floor >= GREATEST(1, p_floor - floor_range)
    ORDER BY RANDOM()
    LIMIT 1;

    -- Se nenhum monstro foi encontrado no range ideal, pegar o mais próximo
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT m.id, m.name,
               (m.hp + (p_floor - m.min_floor) * GREATEST(8, FLOOR(m.hp * scaling_factor)))::INTEGER as hp,
               (m.atk + (p_floor - m.min_floor) * GREATEST(2, FLOOR(m.atk * scaling_factor)))::INTEGER as atk,
               (m.def + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.def * scaling_factor)))::INTEGER as def,
               m.mana,
               (m.speed + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.speed * scaling_factor * 0.5)))::INTEGER as speed,
               m.behavior,
               m.min_floor,
               (m.reward_xp + (p_floor - m.min_floor) * GREATEST(3, FLOOR(m.reward_xp * scaling_factor)))::INTEGER as reward_xp,
               (m.reward_gold + (p_floor - m.min_floor) * GREATEST(4, FLOOR(m.reward_gold * scaling_factor)))::INTEGER as reward_gold,
               (m.strength + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.strength * scaling_factor * 0.3)))::INTEGER as strength,
               (m.dexterity + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.dexterity * scaling_factor * 0.3)))::INTEGER as dexterity,
               (m.intelligence + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.intelligence * scaling_factor * 0.3)))::INTEGER as intelligence,
               (m.wisdom + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.wisdom * scaling_factor * 0.3)))::INTEGER as wisdom,
               (m.vitality + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.vitality * scaling_factor * 0.3)))::INTEGER as vitality,
               (m.luck + (p_floor - m.min_floor) * GREATEST(0, FLOOR(m.luck * scaling_factor * 0.2)))::INTEGER as luck,
               LEAST(0.35, m.critical_chance + (p_floor - m.min_floor) * 0.005) as critical_chance,
               LEAST(2.5, m.critical_damage + (p_floor - m.min_floor) * 0.02) as critical_damage,
               LEAST(0.8, m.critical_resistance + (p_floor - m.min_floor) * 0.01) as critical_resistance,
               LEAST(0.75, m.physical_resistance + (p_floor - m.min_floor) * 0.008) as physical_resistance,
               LEAST(0.75, m.magical_resistance + (p_floor - m.min_floor) * 0.008) as magical_resistance,
               LEAST(0.90, m.debuff_resistance + (p_floor - m.min_floor) * 0.01) as debuff_resistance,
               m.physical_vulnerability,
               m.magical_vulnerability,
               m.primary_trait,
               m.secondary_trait,
               m.special_abilities
        FROM monsters m
        ORDER BY ABS(m.min_floor - p_floor) ASC
        LIMIT 1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Habilitar RLS
ALTER TABLE monsters ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read monsters" ON monsters
    FOR SELECT 
    USING (true);

CREATE POLICY "Service role full access monsters" ON monsters
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Permissões serão gerenciadas automaticamente pelo Supabase 