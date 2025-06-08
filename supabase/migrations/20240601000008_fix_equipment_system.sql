-- Migração para corrigir sistema de equipamentos e implementar dual-wielding

-- Adicionar campos para especificar slot de equipamento
ALTER TABLE character_equipment ADD COLUMN IF NOT EXISTS slot_type VARCHAR(20) DEFAULT NULL;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_character_equipment_slot ON character_equipment(character_id, slot_type, is_equipped);

-- Atualizar dados existentes para preencher slot_type baseado no tipo de equipamento
UPDATE character_equipment ce
SET slot_type = CASE 
    WHEN e.type = 'weapon' THEN 'main_hand'
    WHEN e.type = 'armor' THEN 'armor'  
    WHEN e.type = 'accessory' THEN 'accessory'
    ELSE NULL
END
FROM equipment e 
WHERE ce.equipment_id = e.id AND ce.slot_type IS NULL;

-- Função corrigida para equipar/desequipar item com validação de maestria e dual-wielding
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
    
    -- Determinar slot final
    IF v_equipment_type = 'weapon' THEN
        IF p_slot_type IS NULL THEN
            v_final_slot_type := 'main_hand'; -- Default para mão principal
        ELSE
            v_final_slot_type := p_slot_type;
        END IF;
    ELSIF v_equipment_type = 'armor' THEN
        v_final_slot_type := 'armor';
    ELSIF v_equipment_type = 'accessory' THEN
        v_final_slot_type := 'accessory';
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
    
    -- Recalcular stats do personagem após mudança de equipamento
    PERFORM recalculate_character_stats(p_character_id);
END;
$$ LANGUAGE plpgsql;

-- Função para obter equipamentos equipados por slot
CREATE OR REPLACE FUNCTION get_equipped_slots(p_character_id UUID)
RETURNS TABLE (
    slot_type VARCHAR(20),
    equipment_id UUID,
    equipment_name VARCHAR(50),
    equipment_type equipment_type,
    weapon_subtype weapon_subtype,
    atk_bonus INTEGER,
    def_bonus INTEGER,
    mana_bonus INTEGER,
    speed_bonus INTEGER,
    hp_bonus INTEGER,
    rarity equipment_rarity
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ce.slot_type,
        e.id,
        e.name,
        e.type,
        e.weapon_subtype,
        e.atk_bonus,
        e.def_bonus,
        e.mana_bonus,
        e.speed_bonus,
        e.hp_bonus,
        e.rarity
    FROM character_equipment ce
    JOIN equipment e ON ce.equipment_id = e.id
    WHERE ce.character_id = p_character_id
    AND ce.is_equipped = true
    ORDER BY ce.slot_type;
END;
$$ LANGUAGE plpgsql;

-- Função para verificar se o personagem pode equipar um item
CREATE OR REPLACE FUNCTION can_equip_item(
    p_character_id UUID,
    p_equipment_id UUID
) RETURNS TABLE (
    can_equip BOOLEAN,
    reason TEXT
) AS $$
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
        RETURN QUERY SELECT false, 'Nível insuficiente (necessário: ' || v_required_level || ')';
        RETURN;
    END IF;
    
    -- Verificar maestria para armas avançadas
    IF v_equipment_type = 'weapon' AND v_required_level >= 10 THEN
        CASE v_weapon_subtype
            WHEN 'sword' THEN
                IF v_sword_mastery < v_min_mastery THEN
                    RETURN QUERY SELECT false, 'Maestria com espadas insuficiente (necessário: ' || v_min_mastery || ')';
                    RETURN;
                END IF;
            WHEN 'dagger' THEN
                IF v_sword_mastery < v_min_mastery THEN
                    RETURN QUERY SELECT false, 'Maestria com espadas insuficiente (necessário: ' || v_min_mastery || ')';
                    RETURN;
                END IF;
            WHEN 'axe' THEN
                IF v_axe_mastery < v_min_mastery THEN
                    RETURN QUERY SELECT false, 'Maestria com machados insuficiente (necessário: ' || v_min_mastery || ')';
                    RETURN;
                END IF;
            WHEN 'blunt' THEN
                IF v_blunt_mastery < v_min_mastery THEN
                    RETURN QUERY SELECT false, 'Maestria com armas de concussão insuficiente (necessário: ' || v_min_mastery || ')';
                    RETURN;
                END IF;
            WHEN 'staff' THEN
                IF v_magic_mastery < v_min_mastery THEN
                    RETURN QUERY SELECT false, 'Maestria em magia insuficiente (necessário: ' || v_min_mastery || ')';
                    RETURN;
                END IF;
        END CASE;
    END IF;
    
    -- Se chegou até aqui, pode equipar
    RETURN QUERY SELECT true, 'Pode equipar';
END;
$$ LANGUAGE plpgsql; 