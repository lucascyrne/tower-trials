-- secure_grant_xp: pontos por múltiplos level-ups + validação de origem/autorização.
-- Substitui a versão em 20241205000005 dentro do squash anterior.

CREATE OR REPLACE FUNCTION secure_grant_xp(
    p_character_id UUID,
    p_xp_amount INTEGER,
    p_source VARCHAR DEFAULT 'combat'
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
    v_points_granted_total INTEGER := 0;
    v_points_for_level INTEGER;
    v_caller_uid UUID;
BEGIN
    v_caller_uid := auth.uid();

    IF p_xp_amount <= 0 THEN
        RAISE EXCEPTION 'Quantidade de XP deve ser positiva';
    END IF;

    IF p_xp_amount > 100000 THEN
        RAISE EXCEPTION 'Quantidade de XP acima do limite permitido por chamada';
    END IF;

    IF p_source NOT IN ('combat', 'quest', 'event', 'admin') THEN
        RAISE EXCEPTION 'Fonte de XP inválida: %', p_source;
    END IF;

    IF p_source = 'admin' AND current_setting('request.jwt.claim.role', true) <> 'service_role' THEN
        RAISE EXCEPTION 'Fonte admin não autorizada para esta sessão';
    END IF;

    INSERT INTO character_activity_log (character_id, action, details, created_at)
    VALUES (p_character_id, 'xp_gain', json_build_object('amount', p_xp_amount, 'source', p_source), NOW())
    ON CONFLICT DO NOTHING;

    SELECT level, xp, xp_next_level, user_id
    INTO v_current_level, v_current_xp, v_xp_next_level, v_user_id
    FROM characters
    WHERE id = p_character_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;

    IF current_setting('request.jwt.claim.role', true) <> 'service_role'
       AND v_caller_uid IS DISTINCT FROM v_user_id THEN
        RAISE EXCEPTION 'Operação não autorizada para este personagem';
    END IF;

    IF to_regprocedure('validate_xp_gain(uuid,integer,character varying)') IS NOT NULL THEN
        IF NOT validate_xp_gain(p_character_id, p_xp_amount, p_source) THEN
            RAISE EXCEPTION 'Quantidade de XP suspeita detectada: % (fonte: %)', p_xp_amount, p_source;
        END IF;
    END IF;

    v_new_xp := v_current_xp + p_xp_amount;

    WHILE v_new_xp >= v_xp_next_level AND v_current_level < 100 LOOP
        v_current_level := v_current_level + 1;
        v_leveled_up := TRUE;
        v_xp_next_level := calculate_xp_next_level(v_current_level);

        v_points_for_level := 2;
        IF v_current_level % 5 = 0 THEN
            v_points_for_level := v_points_for_level + 1;
        END IF;
        v_points_granted_total := v_points_granted_total + v_points_for_level;
    END LOOP;

    IF v_leveled_up THEN
        SELECT
            hp, max_hp, mana, max_mana, atk, def, speed
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
            hp = v_base_stats.max_hp,
            mana = v_base_stats.max_mana,
            attribute_points = attribute_points + v_points_granted_total,
            last_activity = NOW()
        WHERE id = p_character_id;

        SELECT * INTO v_progression_result
        FROM update_user_character_progression(v_user_id);
    ELSE
        UPDATE characters
        SET
            xp = v_new_xp,
            last_activity = NOW()
        WHERE id = p_character_id;
    END IF;

    IF NOT v_leveled_up THEN
        SELECT * INTO v_progression_result
        FROM update_user_character_progression(v_user_id);
    END IF;

    RETURN QUERY
    SELECT
        v_leveled_up,
        v_current_level,
        v_new_xp,
        v_xp_next_level,
        CASE WHEN v_progression_result IS NOT NULL THEN v_progression_result.slots_unlocked ELSE FALSE END,
        CASE WHEN v_progression_result IS NOT NULL THEN v_progression_result.available_slots ELSE 3 END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION secure_grant_xp(UUID, INTEGER, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION secure_grant_xp(UUID, INTEGER, VARCHAR) TO service_role;

COMMENT ON FUNCTION secure_grant_xp(UUID, INTEGER, VARCHAR) IS
'Concede XP com validação de origem, autorização do personagem e pontos por nível (incl. múltiplos level-ups).';
