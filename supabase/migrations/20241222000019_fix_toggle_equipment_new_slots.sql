-- Migração para corrigir toggle_equipment para suportar novos tipos de equipamento
-- Criada em: 2024-12-22
-- Problema: toggle_equipment não reconhece helmet, chest, legs, boots

-- ✅ CORREÇÃO: Atualizar função toggle_equipment para suportar todos os novos slots
CREATE OR REPLACE FUNCTION toggle_equipment(
    p_character_id UUID,
    p_equipment_id UUID,
    p_equip BOOLEAN,
    p_slot_type VARCHAR(20) DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_equipment_type equipment_type;
    v_weapon_subtype weapon_subtype;
    v_character_level INTEGER;
    v_required_level INTEGER;
    v_sword_mastery INTEGER;
    v_axe_mastery INTEGER;
    v_blunt_mastery INTEGER;
    v_magic_mastery INTEGER;
    v_min_mastery INTEGER := 10;
    v_final_slot_type VARCHAR(20);
BEGIN
    -- Obter dados do equipamento
    SELECT type, weapon_subtype, level_requirement 
    INTO v_equipment_type, v_weapon_subtype, v_required_level
    FROM equipment
    WHERE id = p_equipment_id;
    
    -- Obter dados do personagem
    SELECT level, sword_mastery, axe_mastery, blunt_mastery, magic_mastery
    INTO v_character_level, v_sword_mastery, v_axe_mastery, v_blunt_mastery, v_magic_mastery
    FROM characters
    WHERE id = p_character_id;
    
    -- Verificar nível do personagem
    IF v_character_level < v_required_level THEN
        RAISE EXCEPTION 'Nível insuficiente para usar este equipamento (necessário: %)', v_required_level;
    END IF;
    
    -- ✅ CORREÇÃO: Determinar slot final com suporte aos novos tipos
    IF v_equipment_type = 'weapon' THEN
        IF p_slot_type IS NULL THEN
            v_final_slot_type := 'main_hand'; -- Default para mão principal
        ELSE
            v_final_slot_type := p_slot_type;
        END IF;
    ELSIF v_equipment_type = 'armor' THEN
        -- Escudos sempre vão para slot armor ou off_hand se especificado
        IF p_slot_type IS NULL OR p_slot_type = '' THEN
            v_final_slot_type := 'armor';
        ELSE
            v_final_slot_type := p_slot_type;
        END IF;
    ELSIF v_equipment_type = 'helmet' THEN
        v_final_slot_type := 'helmet';
    ELSIF v_equipment_type = 'chest' THEN
        v_final_slot_type := 'chest';
    ELSIF v_equipment_type = 'legs' THEN
        v_final_slot_type := 'legs';
    ELSIF v_equipment_type = 'boots' THEN
        v_final_slot_type := 'boots';
    ELSIF v_equipment_type = 'ring' THEN
        -- Se slot específico fornecido, usar; senão tentar ring_1 primeiro
        IF p_slot_type IS NOT NULL AND p_slot_type IN ('ring_1', 'ring_2') THEN
            v_final_slot_type := p_slot_type;
        ELSE
            -- Verificar qual slot está disponível
            IF NOT EXISTS (
                SELECT 1 FROM character_equipment 
                WHERE character_id = p_character_id 
                AND slot_type = 'ring_1' 
                AND is_equipped = true
            ) THEN
                v_final_slot_type := 'ring_1';
            ELSE
                v_final_slot_type := 'ring_2';
            END IF;
        END IF;
    ELSIF v_equipment_type = 'necklace' THEN
        v_final_slot_type := 'necklace';
    ELSIF v_equipment_type = 'amulet' THEN
        v_final_slot_type := 'amulet';
    ELSE
        -- Fallback para tipos não reconhecidos (manter compatibilidade)
        IF p_slot_type IS NOT NULL THEN
            v_final_slot_type := p_slot_type;
        ELSE
            RAISE EXCEPTION 'Tipo de equipamento não reconhecido: %', v_equipment_type;
        END IF;
    END IF;
    
    -- Verificar maestria necessária para armas avançadas
    IF p_equip AND v_equipment_type = 'weapon' AND v_required_level >= 10 THEN
        CASE v_weapon_subtype
            WHEN 'sword' THEN
                IF v_sword_mastery < v_min_mastery THEN
                    RAISE EXCEPTION 'Maestria com espadas insuficiente (necessário: %)', v_min_mastery;
                END IF;
            WHEN 'dagger' THEN
                IF v_sword_mastery < v_min_mastery THEN
                    RAISE EXCEPTION 'Maestria com espadas insuficiente para usar adagas (necessário: %)', v_min_mastery;
                END IF;
            WHEN 'axe' THEN
                IF v_axe_mastery < v_min_mastery THEN
                    RAISE EXCEPTION 'Maestria com machados insuficiente (necessário: %)', v_min_mastery;
                END IF;
            WHEN 'blunt' THEN
                IF v_blunt_mastery < v_min_mastery THEN
                    RAISE EXCEPTION 'Maestria com armas de concussão insuficiente (necessário: %)', v_min_mastery;
                END IF;
            WHEN 'staff' THEN
                IF v_magic_mastery < v_min_mastery THEN
                    RAISE EXCEPTION 'Maestria em magia insuficiente (necessário: %)', v_min_mastery;
                END IF;
        END CASE;
    END IF;
    
    -- Se for para equipar, desequipar item do mesmo slot primeiro
    IF p_equip THEN
        UPDATE character_equipment
        SET is_equipped = false
        WHERE character_id = p_character_id
        AND slot_type = v_final_slot_type
        AND is_equipped = true;
    END IF;
    
    -- Equipar/desequipar o item selecionado
    UPDATE character_equipment
    SET is_equipped = p_equip,
        slot_type = CASE WHEN p_equip THEN v_final_slot_type ELSE slot_type END
    WHERE character_id = p_character_id
    AND equipment_id = p_equipment_id;
    
    -- Verificar se a operação foi bem-sucedida
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Equipamento não encontrado no inventário do personagem';
    END IF;
    
    -- Recalcular stats do personagem após mudança de equipamento
    PERFORM recalculate_character_stats(p_character_id);
    
    -- Log da operação para debug
    RAISE NOTICE 'toggle_equipment: personagem=%, equipamento=%, acao=%, slot=%, tipo=%', 
        p_character_id, p_equipment_id, 
        CASE WHEN p_equip THEN 'EQUIPAR' ELSE 'DESEQUIPAR' END,
        v_final_slot_type, v_equipment_type;
END;
$$ LANGUAGE plpgsql;

-- ✅ CORREÇÃO: Comentário explicativo
COMMENT ON FUNCTION toggle_equipment(UUID, UUID, BOOLEAN, VARCHAR) IS 
'Função corrigida para equipar/desequipar equipamentos com suporte completo aos novos slots: helmet, chest, legs, boots, ring_1, ring_2, necklace, amulet'; 