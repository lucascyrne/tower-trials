-- Migração para corrigir cálculo de bônus de equipamentos
-- Criada em: 2024-12-22
-- Problema: calculate_equipment_bonuses_enhanced_v2 não inclui helmet, chest, legs, boots

-- ✅ CORREÇÃO: Atualizar função para incluir TODOS os slots de equipamento
CREATE OR REPLACE FUNCTION calculate_equipment_bonuses_enhanced_v2(p_character_id UUID)
RETURNS TABLE (
    total_atk_bonus INTEGER,
    total_def_bonus INTEGER,
    total_mana_bonus INTEGER,
    total_speed_bonus INTEGER,
    total_hp_bonus INTEGER,
    total_critical_chance_bonus NUMERIC,
    total_critical_damage_bonus NUMERIC,
    total_double_attack_chance_bonus NUMERIC,
    total_magic_damage_bonus NUMERIC,
    accessories_count INTEGER,
    has_set_bonus BOOLEAN
) AS $$
DECLARE
    v_main_hand_atk INTEGER := 0;
    v_main_hand_def INTEGER := 0;
    v_off_hand_atk INTEGER := 0;
    v_off_hand_def INTEGER := 0;
    v_armor_pieces_atk INTEGER := 0;
    v_armor_pieces_def INTEGER := 0;
    v_accessories_atk INTEGER := 0;
    v_accessories_def INTEGER := 0;
    v_other_stats_total RECORD;
    v_armor_pieces_count INTEGER := 0;
BEGIN
    -- Inicializar valores
    total_atk_bonus := 0;
    total_def_bonus := 0;
    total_mana_bonus := 0;
    total_speed_bonus := 0;
    total_hp_bonus := 0;
    total_critical_chance_bonus := 0;
    total_critical_damage_bonus := 0;
    total_double_attack_chance_bonus := 0;
    total_magic_damage_bonus := 0;
    accessories_count := 0;
    has_set_bonus := false;

    -- ✅ CORREÇÃO: Calcular bônus da mão principal
    SELECT 
        COALESCE(SUM(e.atk_bonus), 0),
        COALESCE(SUM(e.def_bonus), 0)
    INTO v_main_hand_atk, v_main_hand_def
    FROM character_equipment ce
    JOIN equipment e ON ce.equipment_id = e.id
    WHERE ce.character_id = p_character_id 
    AND ce.is_equipped = true 
    AND ce.slot_type = 'main_hand';

    -- ✅ CORREÇÃO: Calcular bônus da mão secundária com nerf para armas
    SELECT 
        COALESCE(SUM(
            CASE 
                WHEN e.type = 'weapon' THEN FLOOR(e.atk_bonus * 0.8)
                ELSE e.atk_bonus 
            END
        ), 0),
        COALESCE(SUM(
            CASE 
                WHEN e.type = 'weapon' THEN FLOOR(e.def_bonus * 0.8)
                ELSE e.def_bonus 
            END
        ), 0)
    INTO v_off_hand_atk, v_off_hand_def
    FROM character_equipment ce
    JOIN equipment e ON ce.equipment_id = e.id
    WHERE ce.character_id = p_character_id 
    AND ce.is_equipped = true 
    AND ce.slot_type = 'off_hand';

    -- ✅ CORREÇÃO CRÍTICA: Incluir TODOS os slots de armadura (armor, helmet, chest, legs, boots)
    SELECT 
        COALESCE(SUM(e.atk_bonus), 0),
        COALESCE(SUM(e.def_bonus), 0),
        COUNT(*)
    INTO v_armor_pieces_atk, v_armor_pieces_def, v_armor_pieces_count
    FROM character_equipment ce
    JOIN equipment e ON ce.equipment_id = e.id
    WHERE ce.character_id = p_character_id 
    AND ce.is_equipped = true 
    AND ce.slot_type IN ('armor', 'helmet', 'chest', 'legs', 'boots');

    -- ✅ CORREÇÃO: Calcular bônus dos acessórios
    SELECT 
        COALESCE(SUM(e.atk_bonus), 0),
        COALESCE(SUM(e.def_bonus), 0),
        COUNT(*)
    INTO v_accessories_atk, v_accessories_def, accessories_count
    FROM character_equipment ce
    JOIN equipment e ON ce.equipment_id = e.id
    WHERE ce.character_id = p_character_id 
    AND ce.is_equipped = true 
    AND ce.slot_type IN ('ring_1', 'ring_2', 'necklace', 'amulet');

    -- ✅ CORREÇÃO: Calcular outros stats (mana, speed, hp, críticos) de TODOS os equipamentos
    SELECT 
        COALESCE(SUM(e.mana_bonus), 0) as mana,
        COALESCE(SUM(e.speed_bonus), 0) as speed,
        COALESCE(SUM(e.hp_bonus), 0) as hp,
        COALESCE(SUM(e.critical_chance_bonus), 0) as crit_chance,
        COALESCE(SUM(e.critical_damage_bonus), 0) as crit_damage,
        COALESCE(SUM(e.double_attack_chance_bonus), 0) as double_attack,
        COALESCE(SUM(e.magic_damage_bonus), 0) as magic_damage
    INTO v_other_stats_total
    FROM character_equipment ce
    JOIN equipment e ON ce.equipment_id = e.id
    WHERE ce.character_id = p_character_id 
    AND ce.is_equipped = true;

    -- ✅ CORREÇÃO: Somar todos os bônus de ATK e DEF
    total_atk_bonus := v_main_hand_atk + v_off_hand_atk + v_armor_pieces_atk + v_accessories_atk;
    total_def_bonus := v_main_hand_def + v_off_hand_def + v_armor_pieces_def + v_accessories_def;

    -- Aplicar outros stats
    total_mana_bonus := v_other_stats_total.mana;
    total_speed_bonus := v_other_stats_total.speed;
    total_hp_bonus := v_other_stats_total.hp;
    total_critical_chance_bonus := v_other_stats_total.crit_chance;
    total_critical_damage_bonus := v_other_stats_total.crit_damage;
    total_double_attack_chance_bonus := v_other_stats_total.double_attack;
    total_magic_damage_bonus := v_other_stats_total.magic_damage;

    -- ✅ NOVO: Bônus de conjunto para armadura completa (4+ peças)
    IF v_armor_pieces_count >= 4 THEN
        total_def_bonus := FLOOR(total_def_bonus * 1.2); -- +20% defesa
        total_hp_bonus := FLOOR(total_hp_bonus * 1.15); -- +15% HP
        has_set_bonus := true;
    ELSIF v_armor_pieces_count >= 3 THEN
        total_def_bonus := FLOOR(total_def_bonus * 1.1); -- +10% defesa
        has_set_bonus := true;
    ELSIF v_armor_pieces_count >= 2 THEN
        total_hp_bonus := FLOOR(total_hp_bonus * 1.05); -- +5% HP
        has_set_bonus := true;
    END IF;

    -- ✅ MELHORADO: Bônus de conjunto para acessórios
    IF accessories_count >= 4 THEN
        total_atk_bonus := FLOOR(total_atk_bonus * 1.1); -- +10% ataque
        total_critical_chance_bonus := total_critical_chance_bonus * 1.15; -- +15% chance crítica
        has_set_bonus := true;
    ELSIF accessories_count >= 3 THEN
        total_critical_chance_bonus := total_critical_chance_bonus * 1.1; -- +10% chance crítica
        total_speed_bonus := FLOOR(total_speed_bonus * 1.05); -- +5% velocidade
        has_set_bonus := true;
    ELSIF accessories_count >= 2 THEN
        total_critical_damage_bonus := total_critical_damage_bonus * 1.05; -- +5% dano crítico
        has_set_bonus := true;
    END IF;

    -- Log para debug
    RAISE NOTICE 'Bônus calculados para %: ATK=% (main:%, off:%, armor:%, acc:%), DEF=% (main:%, off:%, armor:%, acc:%), peças_armadura:%, acessórios:%', 
        p_character_id, total_atk_bonus, v_main_hand_atk, v_off_hand_atk, v_armor_pieces_atk, v_accessories_atk,
        total_def_bonus, v_main_hand_def, v_off_hand_def, v_armor_pieces_def, v_accessories_def,
        v_armor_pieces_count, accessories_count;

    RETURN QUERY SELECT 
        total_atk_bonus,
        total_def_bonus,
        total_mana_bonus,
        total_speed_bonus,
        total_hp_bonus,
        total_critical_chance_bonus,
        total_critical_damage_bonus,
        total_double_attack_chance_bonus,
        total_magic_damage_bonus,
        accessories_count,
        has_set_bonus;
END;
$$ LANGUAGE plpgsql;

-- ✅ CORREÇÃO: Comentário explicativo
COMMENT ON FUNCTION calculate_equipment_bonuses_enhanced_v2(UUID) IS 
'Função corrigida para calcular bônus de equipamentos incluindo TODOS os slots: main_hand, off_hand, armor, helmet, chest, legs, boots, ring_1, ring_2, necklace, amulet com bônus de conjunto para armadura e acessórios'; 