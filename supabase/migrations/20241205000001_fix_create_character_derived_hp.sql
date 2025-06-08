-- ================================
-- Migração para corrigir função create_character
-- Data: 2024-12-05
-- ================================

-- Atualizar a função create_character para usar a versão atual de calculate_derived_stats
CREATE OR REPLACE FUNCTION create_character(
    p_user_id UUID,
    p_name VARCHAR
)
RETURNS UUID AS $$
DECLARE
    v_character_id UUID;
    v_base_stats RECORD;
    v_character_count INTEGER;
    v_available_slots INTEGER;
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
    
    -- Contar personagens atuais
    SELECT COUNT(*)
    INTO v_character_count
    FROM characters
    WHERE user_id = p_user_id;
    
    -- Calcular slots disponíveis baseado no nível total
    v_available_slots := calculate_available_character_slots(p_user_id);
    
    -- Verificar se pode criar mais personagens
    IF v_character_count >= v_available_slots THEN
        DECLARE
            next_slot_level INTEGER;
        BEGIN
            next_slot_level := calculate_required_total_level_for_slot(v_available_slots + 1);
            RAISE EXCEPTION 'Limite de personagens atingido. Para criar o %º personagem, você precisa de % níveis totais entre todos os seus personagens.', 
                v_available_slots + 1, next_slot_level;
        END;
    END IF;

    -- Calcular stats iniciais usando a função mais recente
    SELECT 
        hp,
        max_hp,
        mana,
        max_mana,
        atk,
        def,
        speed,
        magic_attack
    INTO v_base_stats 
    FROM calculate_derived_stats(
        1, -- level
        10, -- strength
        10, -- dexterity  
        10, -- intelligence
        10, -- wisdom
        10, -- vitality
        10, -- luck
        1,  -- sword_mastery 
        1,  -- axe_mastery
        1,  -- blunt_mastery
        1,  -- defense_mastery
        1   -- magic_mastery
    );
    
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
        floor,
        strength,
        dexterity,
        intelligence,
        wisdom,
        vitality,
        luck,
        attribute_points,
        magic_attack -- Adicionar a nova coluna magic_attack
    )
    VALUES (
        p_user_id,
        v_formatted_name, -- Usar nome formatado
        1, -- level inicial
        0, -- xp inicial
        calculate_xp_next_level(1), -- xp necessário para level 2
        0, -- gold inicial
        v_base_stats.hp,
        v_base_stats.max_hp,
        v_base_stats.mana,
        v_base_stats.max_mana,
        v_base_stats.atk,
        v_base_stats.def,
        v_base_stats.speed,
        1,  -- andar inicial
        10, -- strength inicial
        10, -- dexterity inicial
        10, -- intelligence inicial
        10, -- wisdom inicial
        10, -- vitality inicial
        10, -- luck inicial
        5,  -- pontos de atributo iniciais para personalizar build
        v_base_stats.magic_attack   -- magic_attack calculado
    )
    RETURNING id INTO v_character_id;
    
    RETURN v_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualizar função update_character_stats para usar a nova versão
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
    new_xp_next_level INTEGER,
    slots_unlocked BOOLEAN,
    new_available_slots INTEGER
) AS $$
DECLARE
    v_current_level INTEGER;
    v_current_xp INTEGER;
    v_xp_next_level INTEGER;
    v_leveled_up BOOLEAN := FALSE;
    v_base_stats RECORD;
    v_new_xp INTEGER;
    v_user_id UUID;
    v_progression_result RECORD;
BEGIN
    -- Obter dados atuais do personagem
    SELECT level, xp, xp_next_level, user_id
    INTO v_current_level, v_current_xp, v_xp_next_level, v_user_id
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
    END IF;
    
    -- Se XP foi fornecido, verificar level up
    IF p_xp IS NOT NULL THEN
        -- Atualizar XP primeiro sem salvar
        v_new_xp := v_current_xp + p_xp;
        
        -- Verificar level up antes de salvar
        WHILE v_new_xp >= v_xp_next_level LOOP
            v_current_level := v_current_level + 1;
            v_leveled_up := TRUE;
            
            -- Atualizar variáveis para próxima iteração
            v_xp_next_level := calculate_xp_next_level(v_current_level);
        END LOOP;
        
        -- Calcular stats derivados para o nível atual
        SELECT 
            hp,
            max_hp,
            mana,
            max_mana,
            atk,
            def,
            speed,
            magic_attack
        INTO v_base_stats 
        FROM calculate_derived_stats(
            v_current_level,
            (SELECT strength FROM characters WHERE id = p_character_id),
            (SELECT dexterity FROM characters WHERE id = p_character_id),
            (SELECT intelligence FROM characters WHERE id = p_character_id),
            (SELECT wisdom FROM characters WHERE id = p_character_id),
            (SELECT vitality FROM characters WHERE id = p_character_id),
            (SELECT luck FROM characters WHERE id = p_character_id),
            (SELECT sword_mastery FROM characters WHERE id = p_character_id),
            (SELECT axe_mastery FROM characters WHERE id = p_character_id),
            (SELECT blunt_mastery FROM characters WHERE id = p_character_id),
            (SELECT defense_mastery FROM characters WHERE id = p_character_id),
            (SELECT magic_mastery FROM characters WHERE id = p_character_id)
        );
        
        -- Agora aplicar todas as mudanças de uma vez
        IF v_leveled_up THEN
            -- Se subiu de nível, atualizar todos os stats
            UPDATE characters
            SET
                level = v_current_level,
                xp = v_new_xp,
                xp_next_level = v_xp_next_level,
                max_hp = v_base_stats.max_hp,
                max_mana = v_base_stats.max_mana,
                atk = v_base_stats.atk,
                def = v_base_stats.def,
                speed = v_base_stats.speed,
                magic_attack = v_base_stats.magic_attack,
                hp = v_base_stats.max_hp, -- Recupera HP totalmente ao subir de nível
                mana = v_base_stats.max_mana -- Recupera Mana totalmente ao subir de nível
            WHERE id = p_character_id;
            
            -- Conceder pontos de atributo por subir de nível
            PERFORM grant_attribute_points_on_levelup(p_character_id, v_current_level);
            
            -- Atualizar progressão do usuário quando um personagem sobe de nível
            SELECT * INTO v_progression_result 
            FROM update_user_character_progression(v_user_id);
        ELSE
            -- Só atualizar XP
            UPDATE characters
            SET
                xp = v_new_xp
            WHERE id = p_character_id;
        END IF;
    END IF;
    
    -- Retornar resultado
    RETURN QUERY 
    SELECT 
        v_leveled_up,
        v_current_level,
        COALESCE(v_new_xp, v_current_xp) AS new_xp,
        v_xp_next_level,
        CASE WHEN v_progression_result IS NOT NULL THEN v_progression_result.slots_unlocked ELSE FALSE END AS slots_unlocked,
        CASE WHEN v_progression_result IS NOT NULL THEN v_progression_result.available_slots ELSE 3 END AS new_available_slots;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualizar função distribute_attribute_points para usar nova versão
CREATE OR REPLACE FUNCTION distribute_attribute_points(
    p_character_id UUID,
    p_strength INTEGER DEFAULT 0,
    p_dexterity INTEGER DEFAULT 0,
    p_intelligence INTEGER DEFAULT 0,
    p_wisdom INTEGER DEFAULT 0,
    p_vitality INTEGER DEFAULT 0,
    p_luck INTEGER DEFAULT 0
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    new_stats RECORD
) AS $$
DECLARE
    v_character RECORD;
    v_total_points INTEGER;
    v_stats RECORD;
BEGIN
    -- Buscar personagem atual
    SELECT * INTO v_character
    FROM characters
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Personagem não encontrado'::TEXT, NULL::RECORD;
        RETURN;
    END IF;
    
    -- Calcular total de pontos tentando distribuir
    v_total_points := p_strength + p_dexterity + p_intelligence + p_wisdom + p_vitality + p_luck;
    
    -- Verificar se há pontos suficientes
    IF v_total_points > v_character.attribute_points THEN
        RETURN QUERY SELECT FALSE, 'Pontos de atributo insuficientes'::TEXT, NULL::RECORD;
        RETURN;
    END IF;
    
    -- Verificar valores negativos
    IF p_strength < 0 OR p_dexterity < 0 OR p_intelligence < 0 OR 
       p_wisdom < 0 OR p_vitality < 0 OR p_luck < 0 THEN
        RETURN QUERY SELECT FALSE, 'Valores de atributos não podem ser negativos'::TEXT, NULL::RECORD;
        RETURN;
    END IF;
    
    -- Atualizar atributos
    UPDATE characters
    SET
        strength = strength + p_strength,
        dexterity = dexterity + p_dexterity,
        intelligence = intelligence + p_intelligence,
        wisdom = wisdom + p_wisdom,
        vitality = vitality + p_vitality,
        luck = luck + p_luck,
        attribute_points = attribute_points - v_total_points
    WHERE id = p_character_id;
    
    -- Recalcular stats do personagem
    PERFORM recalculate_character_stats(p_character_id);
    
    -- Buscar novos stats para retorno
    SELECT * INTO v_stats FROM get_character_full_stats(p_character_id);
    
    RETURN QUERY SELECT TRUE, 'Atributos distribuídos com sucesso'::TEXT, v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário da migração
COMMENT ON FUNCTION create_character(UUID, VARCHAR) IS 'Função corrigida para criar personagens usando a versão atual de calculate_derived_stats'; 