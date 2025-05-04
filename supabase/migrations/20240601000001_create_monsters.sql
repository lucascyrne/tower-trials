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
    speed INTEGER NOT NULL DEFAULT 10,
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
INSERT INTO monsters (name, hp, atk, def, mana, speed, behavior, min_floor, reward_xp, reward_gold) VALUES
-- Monstros Iniciais (Andares 1-5)
('Slime Verde', 50, 10, 5, 0, 8, 'balanced', 1, 20, 10),
('Slime Azul', 55, 12, 4, 0, 9, 'aggressive', 1, 22, 12),
('Rato Gigante', 45, 15, 3, 0, 15, 'aggressive', 1, 25, 15),
('Goblin', 60, 12, 8, 20, 12, 'balanced', 2, 30, 20),
('Kobold', 55, 18, 5, 30, 14, 'aggressive', 3, 35, 25),
('Esqueleto', 70, 14, 10, 0, 10, 'defensive', 4, 40, 30),
('Lobo Selvagem', 65, 20, 6, 0, 16, 'aggressive', 4, 42, 28),
('Aranha Venenosa', 60, 16, 7, 15, 17, 'balanced', 5, 45, 32),

-- Monstros Intermediários (Andares 6-10)
('Orc', 100, 25, 15, 0, 11, 'aggressive', 6, 60, 40),
('Zumbi', 120, 20, 20, 0, 8, 'defensive', 7, 70, 45),
('Harpia', 90, 30, 10, 40, 18, 'aggressive', 8, 80, 50),
('Golem de Pedra', 150, 15, 30, 0, 7, 'defensive', 9, 90, 55),
('Mago Corrompido', 80, 40, 5, 100, 13, 'balanced', 10, 100, 60),
('Lobo Alpha', 110, 35, 12, 0, 18, 'aggressive', 6, 65, 42),
('Basilisco', 130, 20, 25, 30, 12, 'defensive', 7, 75, 47),
('Morcego Vampírico', 85, 30, 8, 20, 19, 'aggressive', 8, 78, 48),
('Armadura Animada', 140, 25, 35, 0, 8, 'defensive', 9, 88, 53),
('Druida Corrompido', 90, 35, 15, 120, 14, 'balanced', 10, 95, 58),

-- Monstros Avançados (Andares 11-15)
('Ogro', 200, 40, 25, 0, 9, 'aggressive', 11, 150, 70),
('Quimera', 180, 45, 20, 60, 16, 'balanced', 12, 170, 75),
('Hidra', 250, 35, 30, 80, 12, 'defensive', 13, 190, 80),
('Dragão Jovem', 300, 50, 40, 120, 20, 'aggressive', 14, 220, 90),
('Lich', 220, 60, 20, 200, 15, 'balanced', 15, 250, 100),
('Troll da Montanha', 230, 50, 30, 0, 9, 'aggressive', 11, 160, 72),
('Elemental de Fogo', 190, 55, 15, 150, 17, 'balanced', 12, 180, 78),
('Elemental de Gelo', 200, 45, 25, 160, 15, 'balanced', 13, 195, 82),
('Golem de Cristal', 280, 35, 50, 0, 8, 'defensive', 14, 210, 88),
('Necromante', 200, 70, 15, 250, 14, 'balanced', 15, 260, 105),

-- Monstros End-Game (Andares 16-20)
('Dragão Adulto', 400, 70, 50, 150, 22, 'aggressive', 16, 300, 120),
('Titã de Pedra', 500, 50, 70, 0, 8, 'defensive', 17, 330, 130),
('Demônio Alado', 350, 80, 40, 200, 25, 'aggressive', 18, 360, 140),
('Golem Ancestral', 600, 60, 90, 0, 7, 'defensive', 19, 390, 150),
('Dragão Ancião', 700, 100, 80, 300, 26, 'balanced', 20, 500, 200),
('Imp', 320, 75, 35, 150, 28, 'aggressive', 16, 280, 115),
('Golem de Lava', 450, 60, 60, 100, 10, 'defensive', 17, 320, 125),
('Cavaleiro da Morte', 380, 85, 45, 180, 18, 'aggressive', 18, 350, 135),
('Wyrm Glacial', 550, 70, 65, 200, 20, 'balanced', 19, 380, 145),
('Dragão Elemental', 750, 110, 70, 350, 30, 'balanced', 20, 550, 250);

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
    speed INTEGER,
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
           m.speed + (p_floor - m.min_floor) * 1 as speed,
           m.behavior,
           m.min_floor,
           -- Escalar recompensas baseado no andar
           -- Reduzindo a escala de recompensas para tornar mais difícil acumular gold
           -- e aumentar o tempo para obter equipamentos melhores
           m.reward_xp + (p_floor - m.min_floor) * 4 as reward_xp,
           m.reward_gold + (p_floor - m.min_floor) * 5 as reward_gold
    FROM monsters m
    WHERE m.min_floor <= p_floor
    ORDER BY RANDOM()
    LIMIT 1;
END;
$$ LANGUAGE plpgsql; 