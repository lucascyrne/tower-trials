-- ================================
-- Migração para adicionar magia inicial aos novos personagens
-- Data: 2024-12-20
-- ================================

-- Função para dar magia inicial a um personagem
CREATE OR REPLACE FUNCTION grant_starter_spell(
    p_character_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_fireball_spell_id UUID;
BEGIN
    -- Buscar ID da magia "Bola de Fogo"
    SELECT id INTO v_fireball_spell_id 
    FROM spells 
    WHERE name = 'Bola de Fogo' 
    LIMIT 1;
    
    -- Verificar se a magia existe
    IF v_fireball_spell_id IS NULL THEN
        RAISE EXCEPTION 'Magia "Bola de Fogo" não encontrada no banco de dados';
    END IF;
    
    -- Equipar a magia "Bola de Fogo" no slot 1
    INSERT INTO character_spell_slots (character_id, slot_position, spell_id)
    VALUES (p_character_id, 1, v_fireball_spell_id)
    ON CONFLICT (character_id, slot_position) 
    DO UPDATE SET spell_id = v_fireball_spell_id;
    
END;
$$ LANGUAGE plpgsql;

-- Atualizar a função create_character para incluir magia inicial
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
        magic_attack
    )
    VALUES (
        p_user_id,
        v_formatted_name,
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
        v_base_stats.magic_attack
    )
    RETURNING id INTO v_character_id;
    
    -- Dar poções iniciais ao personagem
    PERFORM grant_starter_potions(v_character_id);
    
    -- NOVO: Dar magia inicial ao personagem
    PERFORM grant_starter_spell(v_character_id);
    
    RETURN v_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 