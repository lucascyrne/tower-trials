-- Criar enum para comportamentos dos monstros
CREATE TYPE monster_behavior AS ENUM ('aggressive', 'defensive', 'balanced');

-- Criar tabela de monstros
CREATE TABLE IF NOT EXISTS monsters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    hp INTEGER NOT NULL,
    atk INTEGER NOT NULL,
    def INTEGER NOT NULL,
    mana INTEGER NOT NULL,
    behavior monster_behavior NOT NULL,
    min_floor INTEGER NOT NULL,
    reward_xp INTEGER NOT NULL,
    reward_gold INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger para atualizar o updated_at
CREATE TRIGGER update_monsters_updated_at
    BEFORE UPDATE ON monsters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Inserir monstros iniciais
INSERT INTO monsters (name, hp, atk, def, mana, behavior, min_floor, reward_xp, reward_gold) VALUES
-- Monstros Iniciais (Andares 1-5)
('Slime', 50, 10, 5, 0, 'balanced', 1, 20, 10),
('Rato Gigante', 45, 15, 3, 0, 'aggressive', 1, 25, 15),
('Goblin', 60, 12, 8, 20, 'balanced', 2, 30, 20),
('Kobold', 55, 18, 5, 30, 'aggressive', 3, 35, 25),
('Esqueleto', 70, 14, 10, 0, 'defensive', 4, 40, 30),

-- Monstros Intermediários (Andares 6-10)
('Orc', 100, 25, 15, 0, 'aggressive', 6, 60, 50),
('Zumbi', 120, 20, 20, 0, 'defensive', 7, 70, 60),
('Harpia', 90, 30, 10, 40, 'aggressive', 8, 80, 70),
('Golem de Pedra', 150, 15, 30, 0, 'defensive', 9, 90, 80),
('Mago Corrompido', 80, 40, 5, 100, 'balanced', 10, 100, 100),

-- Monstros Avançados (Andares 11-15)
('Ogro', 200, 40, 25, 0, 'aggressive', 11, 150, 120),
('Quimera', 180, 45, 20, 60, 'balanced', 12, 170, 140),
('Hidra', 250, 35, 30, 80, 'defensive', 13, 190, 160),
('Dragão Jovem', 300, 50, 40, 120, 'aggressive', 14, 220, 200),
('Lich', 220, 60, 20, 200, 'balanced', 15, 250, 250);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_monsters_min_floor ON monsters(min_floor);

-- Função para obter monstro por andar
CREATE OR REPLACE FUNCTION get_monster_for_floor(p_floor INTEGER)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    hp INTEGER,
    atk INTEGER,
    def INTEGER,
    mana INTEGER,
    behavior monster_behavior,
    min_floor INTEGER,
    reward_xp INTEGER,
    reward_gold INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT m.id, m.name, 
           -- Escalar stats baseado no andar
           m.hp + (p_floor - m.min_floor) * 10 as hp,
           m.atk + (p_floor - m.min_floor) * 2 as atk,
           m.def + (p_floor - m.min_floor) * 1 as def,
           m.mana,
           m.behavior,
           m.min_floor,
           -- Escalar recompensas baseado no andar
           m.reward_xp + (p_floor - m.min_floor) * 5 as reward_xp,
           m.reward_gold + (p_floor - m.min_floor) * 10 as reward_gold
    FROM monsters m
    WHERE m.min_floor <= p_floor
    ORDER BY m.min_floor DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql; 