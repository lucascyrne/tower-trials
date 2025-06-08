-- ================================
-- Migração para corrigir o sistema de bônus de equipamentos
-- Data: 2024-12-03
-- ================================

-- Função para calcular stats finais incluindo bônus de equipamentos
CREATE OR REPLACE FUNCTION calculate_final_character_stats(p_character_id UUID)
RETURNS TABLE (
    base_hp INTEGER,
    base_max_hp INTEGER,
    base_mana INTEGER,
    base_max_mana INTEGER,
    base_atk INTEGER,
    base_def INTEGER,
    base_speed INTEGER,
    equipment_hp_bonus INTEGER,
    equipment_mana_bonus INTEGER,
    equipment_atk_bonus INTEGER,
    equipment_def_bonus INTEGER,
    equipment_speed_bonus INTEGER,
    final_hp INTEGER,
    final_max_hp INTEGER,
    final_mana INTEGER,
    final_max_mana INTEGER,
    final_atk INTEGER,
    final_def INTEGER,
    final_speed INTEGER
) AS $$
DECLARE
    v_character RECORD;
    v_base_stats RECORD;
    v_eq_hp_bonus INTEGER := 0;
    v_eq_mana_bonus INTEGER := 0;
    v_eq_atk_bonus INTEGER := 0;
    v_eq_def_bonus INTEGER := 0;
    v_eq_speed_bonus INTEGER := 0;
BEGIN
    -- Buscar dados atuais do personagem
    SELECT * INTO v_character
    FROM characters
    WHERE id = p_character_id;
    
    -- Calcular stats base (só atributos primários + nível)
    SELECT 
        derived_hp,
        derived_max_hp,
        derived_mana,
        derived_max_mana,
        derived_atk,
        derived_def,
        derived_speed
    INTO v_base_stats 
    FROM calculate_derived_stats(
        v_character.level,
        v_character.strength,
        v_character.dexterity,
        v_character.intelligence,
        v_character.wisdom,
        v_character.vitality,
        v_character.luck
    );
    
    -- Buscar bônus de equipamentos
    SELECT 
        COALESCE(total_hp_bonus, 0),
        COALESCE(total_mana_bonus, 0),
        COALESCE(total_atk_bonus, 0),
        COALESCE(total_def_bonus, 0),
        COALESCE(total_speed_bonus, 0)
    INTO 
        v_eq_hp_bonus,
        v_eq_mana_bonus,
        v_eq_atk_bonus,
        v_eq_def_bonus,
        v_eq_speed_bonus
    FROM calculate_equipment_bonuses(p_character_id);
    
    -- Retornar todos os valores
    RETURN QUERY
    SELECT
        v_base_stats.derived_hp::INTEGER,
        v_base_stats.derived_max_hp::INTEGER,
        v_base_stats.derived_mana::INTEGER,
        v_base_stats.derived_max_mana::INTEGER,
        v_base_stats.derived_atk::INTEGER,
        v_base_stats.derived_def::INTEGER,
        v_base_stats.derived_speed::INTEGER,
        v_eq_hp_bonus::INTEGER,
        v_eq_mana_bonus::INTEGER,
        v_eq_atk_bonus::INTEGER,
        v_eq_def_bonus::INTEGER,
        v_eq_speed_bonus::INTEGER,
        (v_base_stats.derived_hp + v_eq_hp_bonus)::INTEGER,
        (v_base_stats.derived_max_hp + v_eq_hp_bonus)::INTEGER,
        (v_base_stats.derived_mana + v_eq_mana_bonus)::INTEGER,
        (v_base_stats.derived_max_mana + v_eq_mana_bonus)::INTEGER,
        (v_base_stats.derived_atk + v_eq_atk_bonus)::INTEGER,
        (v_base_stats.derived_def + v_eq_def_bonus)::INTEGER,
        (v_base_stats.derived_speed + v_eq_speed_bonus)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Atualizar função de recalcular stats para incluir equipamentos
CREATE OR REPLACE FUNCTION recalculate_character_stats(p_character_id UUID)
RETURNS VOID AS $$
DECLARE
    v_character RECORD;
    v_final_stats RECORD;
    v_hp_ratio DECIMAL;
    v_mana_ratio DECIMAL;
    v_new_hp INTEGER;
    v_new_mana INTEGER;
BEGIN
    -- Buscar dados atuais do personagem
    SELECT * INTO v_character
    FROM characters
    WHERE id = p_character_id;
    
    -- Calcular stats finais incluindo equipamentos
    SELECT 
        final_hp,
        final_max_hp,
        final_mana,
        final_max_mana,
        final_atk,
        final_def,
        final_speed
    INTO v_final_stats 
    FROM calculate_final_character_stats(p_character_id);
    
    -- Calcular proporção atual de HP/Mana para manter quando os máximos mudarem
    IF v_character.max_hp > 0 THEN
        v_hp_ratio := v_character.hp::DECIMAL / v_character.max_hp;
    ELSE
        v_hp_ratio := 1.0;
    END IF;
    
    IF v_character.max_mana > 0 THEN
        v_mana_ratio := v_character.mana::DECIMAL / v_character.max_mana;
    ELSE
        v_mana_ratio := 1.0;
    END IF;
    
    -- Calcular novos HP/Mana baseados na proporção
    v_new_hp := CEILING(v_final_stats.final_max_hp * v_hp_ratio);
    v_new_mana := CEILING(v_final_stats.final_max_mana * v_mana_ratio);
    
    -- Atualizar stats finais no personagem
    UPDATE characters
    SET
        max_hp = v_final_stats.final_max_hp,
        max_mana = v_final_stats.final_max_mana,
        atk = v_final_stats.final_atk,
        def = v_final_stats.final_def,
        speed = v_final_stats.final_speed,
        hp = LEAST(v_new_hp, v_final_stats.final_max_hp),
        mana = LEAST(v_new_mana, v_final_stats.final_max_mana)
    WHERE id = p_character_id;
END;
$$ LANGUAGE plpgsql;

-- Função para obter stats detalhados do personagem (incluindo bônus separados)
CREATE OR REPLACE FUNCTION get_character_detailed_stats(p_character_id UUID)
RETURNS TABLE (
    character_id UUID,
    name VARCHAR,
    level INTEGER,
    -- Stats base
    base_hp INTEGER,
    base_max_hp INTEGER,
    base_mana INTEGER,
    base_max_mana INTEGER,
    base_atk INTEGER,
    base_def INTEGER,
    base_speed INTEGER,
    -- Bônus de equipamentos
    equipment_hp_bonus INTEGER,
    equipment_mana_bonus INTEGER,
    equipment_atk_bonus INTEGER,
    equipment_def_bonus INTEGER,
    equipment_speed_bonus INTEGER,
    -- Stats finais
    final_hp INTEGER,
    final_max_hp INTEGER,
    final_mana INTEGER,
    final_max_mana INTEGER,
    final_atk INTEGER,
    final_def INTEGER,
    final_speed INTEGER,
    -- Outros dados
    xp INTEGER,
    xp_next_level INTEGER,
    gold INTEGER,
    floor INTEGER,
    -- Atributos primários
    strength INTEGER,
    dexterity INTEGER,
    intelligence INTEGER,
    wisdom INTEGER,
    vitality INTEGER,
    luck INTEGER,
    attribute_points INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.level,
        -- Stats calculados
        s.base_hp,
        s.base_max_hp,
        s.base_mana,
        s.base_max_mana,
        s.base_atk,
        s.base_def,
        s.base_speed,
        s.equipment_hp_bonus,
        s.equipment_mana_bonus,
        s.equipment_atk_bonus,
        s.equipment_def_bonus,
        s.equipment_speed_bonus,
        s.final_hp,
        s.final_max_hp,
        s.final_mana,
        s.final_max_mana,
        s.final_atk,
        s.final_def,
        s.final_speed,
        -- Outros dados do personagem
        c.xp,
        c.xp_next_level,
        c.gold,
        c.floor,
        c.strength,
        c.dexterity,
        c.intelligence,
        c.wisdom,
        c.vitality,
        c.luck,
        c.attribute_points
    FROM characters c
    CROSS JOIN calculate_final_character_stats(p_character_id) s
    WHERE c.id = p_character_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger para recalcular automaticamente quando equipamentos mudarem
CREATE OR REPLACE FUNCTION trigger_recalculate_on_equipment_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalcular stats quando equipamentos mudarem
    IF TG_OP = 'UPDATE' THEN
        IF OLD.is_equipped != NEW.is_equipped THEN
            PERFORM recalculate_character_stats(NEW.character_id);
        END IF;
    ELSIF TG_OP = 'INSERT' THEN
        IF NEW.is_equipped THEN
            PERFORM recalculate_character_stats(NEW.character_id);
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.is_equipped THEN
            PERFORM recalculate_character_stats(OLD.character_id);
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para recalcular automaticamente
DROP TRIGGER IF EXISTS trigger_recalculate_character_stats_on_equipment ON character_equipment;
CREATE TRIGGER trigger_recalculate_character_stats_on_equipment
    AFTER INSERT OR UPDATE OR DELETE ON character_equipment
    FOR EACH ROW
    EXECUTE FUNCTION trigger_recalculate_on_equipment_change();

-- Atualizar stats de todos os personagens existentes
DO $$
DECLARE
    character_record RECORD;
BEGIN
    FOR character_record IN SELECT id FROM characters WHERE is_alive = true
    LOOP
        PERFORM recalculate_character_stats(character_record.id);
    END LOOP;
END $$; 