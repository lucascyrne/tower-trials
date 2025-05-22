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

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_monsters_min_floor ON monsters(min_floor);

-- Função para obter monstro por andar com stats ajustados
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
DECLARE
    floor_range INTEGER := 5;
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
           m.reward_xp + (p_floor - m.min_floor) * 4 as reward_xp,
           m.reward_gold + (p_floor - m.min_floor) * 5 as reward_gold
    FROM monsters m
    WHERE m.min_floor <= p_floor 
    AND m.min_floor >= GREATEST(1, p_floor - floor_range)
    ORDER BY RANDOM()
    LIMIT 1;

    -- Se nenhum monstro foi encontrado no range ideal, pegar o mais próximo
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT m.id, m.name,
               m.hp + (p_floor - m.min_floor) * 10 as hp,
               m.atk + (p_floor - m.min_floor) * 2 as atk,
               m.def + (p_floor - m.min_floor) * 1 as def,
               m.mana,
               m.speed + (p_floor - m.min_floor) * 1 as speed,
               m.behavior,
               m.min_floor,
               m.reward_xp + (p_floor - m.min_floor) * 4 as reward_xp,
               m.reward_gold + (p_floor - m.min_floor) * 5 as reward_gold
        FROM monsters m
        ORDER BY ABS(m.min_floor - p_floor) ASC
        LIMIT 1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Habilitar RLS
ALTER TABLE monsters ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Leitura pública de monstros" ON monsters
    FOR SELECT 
    USING (true);

CREATE POLICY "Service role tem acesso total" ON monsters
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Garantir que as funções possam ser executadas por usuários autenticados
GRANT EXECUTE ON FUNCTION get_monster_for_floor TO authenticated;
GRANT EXECUTE ON FUNCTION get_monster_for_floor TO anon;

-- Garantir que a tabela monsters possa ser lida por todos
GRANT SELECT ON monsters TO authenticated;
GRANT SELECT ON monsters TO anon;

-- Garantir que o service_role tenha acesso total
GRANT ALL ON monsters TO service_role; 