-- Criar tabela de personagens
CREATE TABLE IF NOT EXISTS characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    xp_next_level INTEGER DEFAULT 100,
    gold INTEGER DEFAULT 0,
    hp INTEGER NOT NULL,
    max_hp INTEGER NOT NULL,
    mana INTEGER NOT NULL,
    max_mana INTEGER NOT NULL,
    atk INTEGER NOT NULL,
    def INTEGER NOT NULL,
    speed INTEGER NOT NULL,
    floor INTEGER DEFAULT 1,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_characters_user_id ON characters(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_level ON characters(level DESC);

-- Trigger para atualizar o updated_at
CREATE TRIGGER update_characters_updated_at
    BEFORE UPDATE ON characters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Função para calcular XP necessário para o próximo nível
CREATE OR REPLACE FUNCTION calculate_xp_next_level(current_level INTEGER)
RETURNS INTEGER AS $$
BEGIN
    -- Base XP * (1.5 ^ (level - 1))
    RETURN FLOOR(100 * POW(1.5, current_level - 1));
END;
$$ LANGUAGE plpgsql;

-- Função para calcular stats base por nível
CREATE OR REPLACE FUNCTION calculate_base_stats(p_level INTEGER)
RETURNS TABLE (
    base_hp INTEGER,
    base_mana INTEGER,
    base_atk INTEGER,
    base_def INTEGER,
    base_speed INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        100 + (10 * (p_level - 1)) as base_hp,
        50 + (5 * (p_level - 1)) as base_mana,
        20 + (2 * (p_level - 1)) as base_atk,
        10 + (1 * (p_level - 1)) as base_def,
        10 + (1 * (p_level - 1)) as base_speed;
END;
$$ LANGUAGE plpgsql;

-- Função para criar um novo personagem
CREATE OR REPLACE FUNCTION create_character(
    p_user_id UUID,
    p_name VARCHAR
)
RETURNS UUID AS $$
DECLARE
    v_character_id UUID;
    v_base_stats RECORD;
    v_character_count INTEGER;
BEGIN
    -- Verificar limite de personagens
    SELECT COUNT(*)
    INTO v_character_count
    FROM characters
    WHERE user_id = p_user_id;
    
    IF v_character_count >= 3 THEN
        RAISE EXCEPTION 'Limite máximo de personagens atingido';
    END IF;

    -- Calcular stats iniciais
    SELECT * INTO v_base_stats FROM calculate_base_stats(1);
    
    -- Inserir novo personagem
    INSERT INTO characters (
        user_id,
        name,
        level,
        xp,
        xp_next_level,
        gold,
        hp,
        max_hp,
        mana,
        max_mana,
        atk,
        def,
        speed,
        floor
    )
    VALUES (
        p_user_id,
        p_name,
        1, -- level inicial
        0, -- xp inicial
        calculate_xp_next_level(1), -- xp necessário para level 2
        0, -- gold inicial
        v_base_stats.base_hp,
        v_base_stats.base_hp,
        v_base_stats.base_mana,
        v_base_stats.base_mana,
        v_base_stats.base_atk,
        v_base_stats.base_def,
        v_base_stats.base_speed,
        1  -- andar inicial
    )
    RETURNING id INTO v_character_id;
    
    RETURN v_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para atualizar stats do personagem
CREATE OR REPLACE FUNCTION update_character_stats(
    p_character_id UUID,
    p_xp INTEGER DEFAULT NULL,
    p_gold INTEGER DEFAULT NULL,
    p_hp INTEGER DEFAULT NULL,
    p_mana INTEGER DEFAULT NULL,
    p_floor INTEGER DEFAULT NULL
)
RETURNS TABLE (
    leveled_up BOOLEAN,
    new_level INTEGER,
    new_xp INTEGER,
    new_xp_next_level INTEGER
) AS $$
DECLARE
    v_current_level INTEGER;
    v_current_xp INTEGER;
    v_xp_next_level INTEGER;
    v_leveled_up BOOLEAN := FALSE;
    v_base_stats RECORD;
    v_new_xp INTEGER;
BEGIN
    -- Obter dados atuais do personagem
    SELECT level, xp, xp_next_level 
    INTO v_current_level, v_current_xp, v_xp_next_level
    FROM characters 
    WHERE id = p_character_id;
    
    -- Atualizar HP e Mana se fornecidos
    IF p_hp IS NOT NULL OR p_mana IS NOT NULL THEN
        UPDATE characters
        SET
            hp = COALESCE(p_hp, hp),
            mana = COALESCE(p_mana, mana)
        WHERE id = p_character_id;
    END IF;
    
    -- Atualizar gold se fornecido
    IF p_gold IS NOT NULL THEN
        UPDATE characters
        SET gold = gold + p_gold
        WHERE id = p_character_id;
    END IF;
    
    -- Atualizar andar se fornecido
    IF p_floor IS NOT NULL THEN
        UPDATE characters
        SET floor = p_floor
        WHERE id = p_character_id;
        
        -- Atualizar também o progresso do jogo
        UPDATE game_progress
        SET current_floor = p_floor
        WHERE user_id = (SELECT user_id FROM characters WHERE id = p_character_id);
    END IF;
    
    -- Se XP foi fornecido, verificar level up
    IF p_xp IS NOT NULL THEN
        -- Atualizar XP primeiro sem salvar
        v_new_xp := v_current_xp + p_xp;
        
        -- Verificar level up antes de salvar
        WHILE v_new_xp >= v_xp_next_level LOOP
            v_current_level := v_current_level + 1;
            v_leveled_up := TRUE;
            
            -- Calcular novos stats base para o novo nível
            SELECT * INTO v_base_stats FROM calculate_base_stats(v_current_level);
            
            -- Atualizar variáveis para próxima iteração
            v_xp_next_level := calculate_xp_next_level(v_current_level);
        END LOOP;
        
        -- Inicializar v_base_stats com valores do nível atual se não subiu de nível
        IF NOT v_leveled_up THEN
            SELECT * INTO v_base_stats FROM calculate_base_stats(v_current_level);
        END IF;
        
        -- Agora aplicar todas as mudanças de uma vez
        IF v_leveled_up THEN
            -- Se subiu de nível, atualizar todos os stats
            UPDATE characters
            SET
                level = v_current_level,
                xp = v_new_xp,
                xp_next_level = v_xp_next_level,
                max_hp = v_base_stats.base_hp,
                max_mana = v_base_stats.base_mana,
                atk = v_base_stats.base_atk,
                def = v_base_stats.base_def,
                speed = v_base_stats.base_speed,
                hp = v_base_stats.base_hp, -- Recupera HP totalmente ao subir de nível
                mana = v_base_stats.base_mana -- Recupera Mana totalmente ao subir de nível
            WHERE id = p_character_id;
        ELSE
            -- Se não subiu de nível, atualizar apenas XP
            UPDATE characters
            SET
                xp = v_new_xp
            WHERE id = p_character_id;
        END IF;
    END IF;
    
    RETURN QUERY
    SELECT 
        v_leveled_up,
        v_current_level,
        COALESCE(v_new_xp, v_current_xp) AS new_xp,
        v_xp_next_level;
END;
$$ LANGUAGE plpgsql;

-- Função para buscar personagens do usuário
CREATE OR REPLACE FUNCTION get_user_characters(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    name VARCHAR(100),
    level INTEGER,
    xp INTEGER,
    xp_next_level INTEGER,
    gold INTEGER,
    hp INTEGER,
    max_hp INTEGER,
    mana INTEGER,
    max_mana INTEGER,
    atk INTEGER,
    def INTEGER,
    speed INTEGER,
    floor INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT c.*
    FROM characters c
    WHERE c.user_id = p_user_id
    ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar limite de personagens
CREATE OR REPLACE FUNCTION check_character_limit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    character_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO character_count
    FROM characters
    WHERE user_id = p_user_id;
    
    RETURN character_count < 3;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para buscar um personagem específico
CREATE OR REPLACE FUNCTION get_character(p_character_id UUID)
RETURNS characters AS $$
DECLARE
    v_character characters;
BEGIN
    SELECT c.* INTO v_character
    FROM characters c
    WHERE c.id = p_character_id
    AND c.user_id = auth.uid(); -- Garante que apenas o dono do personagem pode vê-lo
    
    IF v_character IS NULL THEN
        RAISE EXCEPTION 'Personagem não encontrado ou sem permissão';
    END IF;
    
    RETURN v_character;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para deletar um personagem e todos os seus dados relacionados
CREATE OR REPLACE FUNCTION delete_character(p_character_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Verificar se o usuário tem permissão para deletar este personagem
    IF NOT EXISTS (
        SELECT 1 FROM characters c
        WHERE c.id = p_character_id
        AND c.user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Personagem não encontrado ou sem permissão para deletar';
    END IF;

    -- Deletar todos os dados relacionados
    -- As constraints ON DELETE CASCADE cuidarão de limpar as tabelas relacionadas
    DELETE FROM characters WHERE id = p_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para atualizar o andar atual do personagem
CREATE OR REPLACE FUNCTION update_character_floor(
    p_character_id UUID,
    p_floor INTEGER
)
RETURNS VOID AS $$
BEGIN
    -- Validar se o andar é válido
    IF p_floor < 1 THEN
        RAISE EXCEPTION 'Andar deve ser pelo menos 1';
    END IF;
    
    -- Atualizar o andar do personagem
    UPDATE characters
    SET 
        floor = p_floor,
        updated_at = NOW()
    WHERE id = p_character_id;
    
    -- Verificar se o personagem foi encontrado
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    -- Atualizar também o progresso do jogo se existir
    UPDATE game_progress
    SET 
        current_floor = p_floor,
        updated_at = NOW()
    WHERE user_id = (SELECT user_id FROM characters WHERE id = p_character_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Habilitar RLS
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes
DROP POLICY IF EXISTS "Usuários podem ver seus próprios personagens" ON characters;
DROP POLICY IF EXISTS "Usuários podem criar seus próprios personagens" ON characters;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios personagens" ON characters;
DROP POLICY IF EXISTS "Usuários podem deletar seus próprios personagens" ON characters;

-- Criar novas políticas
CREATE POLICY "Usuários podem ver seus próprios personagens" ON characters
    FOR SELECT
    TO authenticated
    USING (user_id IN (SELECT uid FROM users WHERE uid = auth.uid()::text::uuid));

CREATE POLICY "Usuários podem criar seus próprios personagens" ON characters
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id IN (SELECT uid FROM users WHERE uid = auth.uid()::text::uuid)
        AND (
            SELECT COUNT(*) FROM characters 
            WHERE user_id IN (SELECT uid FROM users WHERE uid = auth.uid()::text::uuid)
        ) < 3
    );

CREATE POLICY "Usuários podem atualizar seus próprios personagens" ON characters
    FOR UPDATE
    TO authenticated
    USING (user_id IN (SELECT uid FROM users WHERE uid = auth.uid()::text::uuid))
    WITH CHECK (user_id IN (SELECT uid FROM users WHERE uid = auth.uid()::text::uuid));

CREATE POLICY "Usuários podem deletar seus próprios personagens" ON characters
    FOR DELETE
    TO authenticated
    USING (user_id IN (SELECT uid FROM users WHERE uid = auth.uid()::text::uuid));

-- Garantir que as funções possam ser executadas por usuários autenticados
GRANT EXECUTE ON FUNCTION create_character TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_characters TO authenticated;
GRANT EXECUTE ON FUNCTION get_character TO authenticated;
GRANT EXECUTE ON FUNCTION delete_character TO authenticated;
GRANT EXECUTE ON FUNCTION update_character_floor TO authenticated;

-- =====================================================
-- SISTEMA DE CURA AUTOMÁTICA
-- =====================================================

-- Função para calcular cura automática baseada em tempo
CREATE OR REPLACE FUNCTION calculate_auto_heal(
    p_character_id UUID,
    p_current_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
    healed BOOLEAN,
    old_hp INTEGER,
    new_hp INTEGER,
    heal_amount INTEGER
) AS $$
DECLARE
    v_character RECORD;
    v_time_diff_seconds INTEGER;
    v_heal_amount INTEGER;
    v_new_hp INTEGER;
    v_adjusted_current_hp INTEGER;
    v_heal_rate_per_second NUMERIC;
BEGIN
    -- Buscar dados do personagem
    SELECT c.hp, c.max_hp, c.last_activity
    INTO v_character
    FROM characters c
    WHERE c.id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    -- Se HP já está no máximo ou não há last_activity, não curar
    IF v_character.hp >= v_character.max_hp OR v_character.last_activity IS NULL THEN
        RETURN QUERY
        SELECT FALSE, v_character.hp, v_character.hp, 0;
        RETURN;
    END IF;
    
    -- Calcular diferença de tempo em segundos
    v_time_diff_seconds := EXTRACT(EPOCH FROM (p_current_time - v_character.last_activity))::INTEGER;
    
    -- Se passou menos de 1 segundo, não curar
    IF v_time_diff_seconds < 1 THEN
        RETURN QUERY
        SELECT FALSE, v_character.hp, v_character.hp, 0;
        RETURN;
    END IF;
    
    -- Configurações de cura: 6 horas para cura completa (0.1% a 100%)
    -- Taxa de cura: 99.9% / 21600s ≈ 0.00462% por segundo
    v_heal_rate_per_second := 99.9 / 21600.0;
    
    -- Se HP está abaixo de 0.1%, ajustar para 0.1% antes de calcular cura
    v_adjusted_current_hp := GREATEST(v_character.hp, CEIL(v_character.max_hp * 0.001));
    
    -- Calcular quantidade de cura baseada no tempo
    v_heal_amount := FLOOR((v_heal_rate_per_second * v_time_diff_seconds / 100.0) * v_character.max_hp);
    
    -- Aplicar cura sem ultrapassar HP máximo
    v_new_hp := LEAST(v_character.max_hp, v_adjusted_current_hp + v_heal_amount);
    
    -- Verificar se houve cura efetiva
    IF v_new_hp > v_character.hp THEN
        -- Atualizar HP no banco de dados
        UPDATE characters
        SET 
            hp = v_new_hp,
            last_activity = p_current_time
        WHERE id = p_character_id;
        
        RETURN QUERY
        SELECT TRUE, v_character.hp, v_new_hp, (v_new_hp - v_character.hp);
    ELSE
        RETURN QUERY
        SELECT FALSE, v_character.hp, v_character.hp, 0;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para atualizar última atividade
CREATE OR REPLACE FUNCTION update_character_last_activity(
    p_character_id UUID,
    p_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS VOID AS $$
BEGIN
    UPDATE characters
    SET last_activity = p_timestamp
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permitir execução das funções de cura automática por usuários autenticados
GRANT EXECUTE ON FUNCTION calculate_auto_heal TO authenticated;
GRANT EXECUTE ON FUNCTION update_character_last_activity TO authenticated;

-- Adicionar comentário explicativo ao campo last_activity
COMMENT ON COLUMN characters.last_activity IS 'Timestamp da última atividade do personagem, usado para cura automática baseada em tempo (6h para cura completa)'; 