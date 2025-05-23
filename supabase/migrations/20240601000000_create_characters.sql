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

-- Função para validar nome de personagem no banco
CREATE OR REPLACE FUNCTION validate_character_name(p_name VARCHAR)
RETURNS TABLE (
    is_valid BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    clean_name VARCHAR;
    name_length INTEGER;
    letter_count INTEGER;
    number_count INTEGER;
    
    -- Lista completa de palavras ofensivas e reservadas
    forbidden_words TEXT[] := ARRAY[
        -- Português - palavras de baixo calão
        'porra', 'merda', 'caralho', 'puta', 'putaria', 'viado', 'bicha', 'cu', 'buceta',
        'piroca', 'pinto', 'rola', 'foda', 'foder', 'fodido', 'cuzao', 'cuzão', 'babaca',
        'otario', 'otário', 'idiota', 'imbecil', 'retardado', 'mongoloide', 'burro',
        'desgraça', 'desgraçado', 'filho da puta', 'fdp', 'vagabundo', 'safado',
        'cachorro', 'cadela', 'prostituta', 'vagabunda', 'piranha', 'galinha',
        
        -- Inglês - palavras de baixo calão
        'fuck', 'shit', 'bitch', 'damn', 'hell', 'ass', 'asshole', 'bastard',
        'crap', 'piss', 'dick', 'cock', 'pussy', 'cunt', 'whore', 'slut',
        'fag', 'faggot', 'nigger', 'retard', 'moron', 'idiot', 'stupid',
        'gay', 'lesbian', 'homo', 'nazi', 'hitler', 'rape', 'kill', 'murder',
        
        -- Espanhol - palavras de baixo calão
        'mierda', 'joder', 'puta', 'puto', 'cabron', 'cabrón', 'pendejo',
        'estupido', 'estúpido', 'culo', 'coño', 'verga', 'chingar', 'pinche',
        'mamada', 'putada', 'hijo de puta', 'hdp', 'marica', 'maricon', 'maricón',
        
        -- Palavras relacionadas a drogas
        'droga', 'cocaina', 'heroina', 'crack', 'cocaine',
        'heroin', 'drug', 'dealer', 'traficante',
        
        -- Termos inadequados gerais
        'sexo', 'sex', 'porn', 'porno', 'nude', 'naked', 'xxx', 'fetish',
        
        -- Palavras reservadas do sistema
        'admin', 'administrator', 'moderador', 'moderator', 'mod', 'gm', 'gamemaster',
        'suporte', 'support', 'help', 'ajuda', 'oficial', 'official', 'staff',
        'dev', 'developer', 'sistema', 'system', 'bot', 'null', 'undefined',
        'test', 'teste', 'demo', 'sample', 'example', 'exemplo', 'guest', 'visitante',
        'player', 'jogador', 'user', 'usuario', 'usuário', 'npc', 'monster', 'monstro'
    ];
    
    word TEXT;
BEGIN
    -- Verificar se nome foi fornecido
    IF p_name IS NULL OR p_name = '' THEN
        RETURN QUERY SELECT FALSE, 'Nome é obrigatório';
        RETURN;
    END IF;
    
    -- Limpar espaços desnecessários
    clean_name := TRIM(p_name);
    name_length := LENGTH(clean_name);
    
    -- Verificar comprimento
    IF name_length < 3 THEN
        RETURN QUERY SELECT FALSE, 'Nome deve ter pelo menos 3 caracteres';
        RETURN;
    END IF;
    
    IF name_length > 20 THEN
        RETURN QUERY SELECT FALSE, 'Nome deve ter no máximo 20 caracteres';
        RETURN;
    END IF;
    
    -- Verificar se começa com letra
    IF NOT (SUBSTRING(clean_name FROM 1 FOR 1) ~ '[a-zA-ZÀ-ÿ]') THEN
        RETURN QUERY SELECT FALSE, 'Nome deve começar com uma letra';
        RETURN;
    END IF;
    
    -- Verificar caracteres válidos (letras, números, espaços, hífen, apostrofe)
    IF NOT (clean_name ~ '^[a-zA-ZÀ-ÿ0-9\s''\-]+$') THEN
        RETURN QUERY SELECT FALSE, 'Nome contém caracteres especiais não permitidos';
        RETURN;
    END IF;
    
    -- Verificar se é apenas números
    IF clean_name ~ '^[0-9]+$' THEN
        RETURN QUERY SELECT FALSE, 'Nome não pode ser apenas números';
        RETURN;
    END IF;
    
    -- Verificar números consecutivos (mais de 2)
    IF clean_name ~ '[0-9]{3,}' THEN
        RETURN QUERY SELECT FALSE, 'Nome não pode ter mais de 2 números consecutivos';
        RETURN;
    END IF;
    
    -- Verificar caracteres repetidos (mais de 3 iguais)
    IF clean_name ~ '(.)\1{3,}' THEN
        RETURN QUERY SELECT FALSE, 'Nome não pode ter mais de 3 caracteres iguais seguidos';
        RETURN;
    END IF;
    
    -- Verificar espaços múltiplos
    IF clean_name ~ '\s{2,}' THEN
        RETURN QUERY SELECT FALSE, 'Nome não pode ter espaços múltiplos';
        RETURN;
    END IF;
    
    -- Contar letras e números
    letter_count := LENGTH(clean_name) - LENGTH(REGEXP_REPLACE(clean_name, '[a-zA-ZÀ-ÿ]', '', 'g'));
    number_count := LENGTH(clean_name) - LENGTH(REGEXP_REPLACE(clean_name, '[0-9]', '', 'g'));
    
    -- Verificar se tem pelo menos uma letra
    IF letter_count = 0 THEN
        RETURN QUERY SELECT FALSE, 'Nome deve conter pelo menos uma letra';
        RETURN;
    END IF;
    
    -- Verificar proporção de números
    IF number_count > letter_count THEN
        RETURN QUERY SELECT FALSE, 'Nome não pode ter mais números que letras';
        RETURN;
    END IF;
    
    -- Verificar palavras proibidas (completas e substrings)
    FOREACH word IN ARRAY forbidden_words LOOP
        IF LOWER(clean_name) LIKE '%' || word || '%' THEN
            RETURN QUERY SELECT FALSE, 'Nome contém termos inadequados ou reservados';
            RETURN;
        END IF;
    END LOOP;
    
    -- Nome válido
    RETURN QUERY SELECT TRUE, NULL::TEXT;
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
    v_validation RECORD;
    v_formatted_name VARCHAR;
BEGIN
    -- Validar nome do personagem
    SELECT * INTO v_validation FROM validate_character_name(p_name);
    
    IF NOT v_validation.is_valid THEN
        RAISE EXCEPTION '%', v_validation.error_message;
    END IF;
    
    -- Formatar nome (capitalizar primeira letra de cada palavra)
    v_formatted_name := INITCAP(TRIM(p_name));
    
    -- Verificar se já existe personagem com mesmo nome para o usuário
    IF EXISTS (
        SELECT 1 FROM characters 
        WHERE user_id = p_user_id 
        AND UPPER(name) = UPPER(v_formatted_name)
    ) THEN
        RAISE EXCEPTION 'Você já possui um personagem com este nome';
    END IF;
    
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
        v_formatted_name, -- Usar nome formatado
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
    last_activity TIMESTAMP WITH TIME ZONE,
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
GRANT EXECUTE ON FUNCTION validate_character_name TO authenticated;

-- =====================================================
-- SISTEMA DE CURA AUTOMÁTICA
-- =====================================================

-- Função para calcular cura automática baseada em tempo offline
-- Cura total em 2 horas (de 0.1% a 100% da vida e mana)
CREATE OR REPLACE FUNCTION calculate_auto_heal(
    p_character_id UUID,
    p_current_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE(new_hp INTEGER, new_mana INTEGER, healed BOOLEAN) AS $$
DECLARE
    char_record RECORD;
    time_diff_seconds INTEGER;
    heal_duration_seconds INTEGER := 7200; -- 2 horas = 7200 segundos
    min_percent DECIMAL := 0.1;
    max_percent DECIMAL := 100.0;
    
    -- Variáveis para HP
    adjusted_current_hp INTEGER;
    adjusted_current_hp_percent DECIMAL;
    heal_rate_per_second DECIMAL;
    hp_heal_percentage DECIMAL;
    hp_heal_amount INTEGER;
    calculated_new_hp INTEGER;
    
    -- Variáveis para Mana
    adjusted_current_mana INTEGER;
    adjusted_current_mana_percent DECIMAL;
    mana_heal_percentage DECIMAL;
    mana_heal_amount INTEGER;
    calculated_new_mana INTEGER;
BEGIN
    -- Buscar dados do personagem
    SELECT hp, max_hp, mana, max_mana, last_activity
    INTO char_record
    FROM characters
    WHERE id = p_character_id;
    
    -- Se não encontrou o personagem ou não tem last_activity
    IF NOT FOUND OR char_record.last_activity IS NULL THEN
        RETURN QUERY SELECT char_record.hp, char_record.mana, FALSE;
        RETURN;
    END IF;
    
    -- Se HP e Mana já estão no máximo, não curar
    IF char_record.hp >= char_record.max_hp AND char_record.mana >= char_record.max_mana THEN
        RETURN QUERY SELECT char_record.hp, char_record.mana, FALSE;
        RETURN;
    END IF;
    
    -- Calcular diferença de tempo em segundos
    time_diff_seconds := EXTRACT(EPOCH FROM (p_current_time - char_record.last_activity))::INTEGER;
    
    -- Se passou menos de 1 segundo, não curar
    IF time_diff_seconds < 1 THEN
        RETURN QUERY SELECT char_record.hp, char_record.mana, FALSE;
        RETURN;
    END IF;
    
    -- Calcular nova HP se necessário
    calculated_new_hp := char_record.hp;
    IF char_record.hp < char_record.max_hp THEN
        -- Ajustar HP atual se estiver abaixo de 0.1%
        adjusted_current_hp := GREATEST(char_record.hp, CEIL(char_record.max_hp * (min_percent / 100.0)));
        adjusted_current_hp_percent := (adjusted_current_hp::DECIMAL / char_record.max_hp::DECIMAL) * 100.0;
        
        -- Taxa de cura HP: (100% - 0.1%) / 2 horas = 99.9% / 7200s ≈ 0.01387% por segundo
        heal_rate_per_second := (max_percent - min_percent) / heal_duration_seconds;
        
        -- Calcular percentual de cura baseado no tempo
        hp_heal_percentage := LEAST(
            heal_rate_per_second * time_diff_seconds,
            max_percent - adjusted_current_hp_percent
        );
        
        -- Calcular quantidade de HP a ser curada
        hp_heal_amount := FLOOR((hp_heal_percentage / 100.0) * char_record.max_hp);
        calculated_new_hp := LEAST(char_record.max_hp, adjusted_current_hp + hp_heal_amount);
    END IF;
    
    -- Calcular nova Mana se necessário
    calculated_new_mana := char_record.mana;
    IF char_record.mana < char_record.max_mana THEN
        -- Ajustar Mana atual se estiver abaixo de 0.1%
        adjusted_current_mana := GREATEST(char_record.mana, CEIL(char_record.max_mana * (min_percent / 100.0)));
        adjusted_current_mana_percent := (adjusted_current_mana::DECIMAL / char_record.max_mana::DECIMAL) * 100.0;
        
        -- Taxa de cura Mana: (100% - 0.1%) / 2 horas = 99.9% / 7200s ≈ 0.01387% por segundo
        heal_rate_per_second := (max_percent - min_percent) / heal_duration_seconds;
        
        -- Calcular percentual de cura baseado no tempo
        mana_heal_percentage := LEAST(
            heal_rate_per_second * time_diff_seconds,
            max_percent - adjusted_current_mana_percent
        );
        
        -- Calcular quantidade de Mana a ser curada
        mana_heal_amount := FLOOR((mana_heal_percentage / 100.0) * char_record.max_mana);
        calculated_new_mana := LEAST(char_record.max_mana, adjusted_current_mana + mana_heal_amount);
    END IF;
    
    -- Retornar resultados
    RETURN QUERY SELECT 
        calculated_new_hp, 
        calculated_new_mana,
        (calculated_new_hp > char_record.hp OR calculated_new_mana > char_record.mana);
END;
$$ LANGUAGE plpgsql;

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