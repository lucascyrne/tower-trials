-- Checkpoints: andar 1, andar 5 (se highest >= 5), depois 11, 21, 31... (pós-boss).
-- secure_advance_floor: auth + highest_floor + avanço +1 OU teleporte para checkpoint desbloqueado.

CREATE OR REPLACE FUNCTION get_unlocked_checkpoints(p_highest_floor INTEGER)
RETURNS TABLE (
    floor_number INTEGER,
    description TEXT
) AS $$
DECLARE
    i INTEGER;
    cp INTEGER;
BEGIN
    RETURN QUERY
    SELECT 1, 'Andar 1 - Início da Torre'::TEXT;

    IF p_highest_floor >= 5 THEN
        RETURN QUERY
        SELECT 5, 'Andar 5 - Checkpoint'::TEXT;
    END IF;

    FOR i IN 1..100 LOOP
        cp := 10 * i + 1;
        EXIT WHEN cp > p_highest_floor;
        RETURN QUERY
        SELECT cp, format('Andar %s - Checkpoint Pós-Boss', cp)::TEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_floor_data(p_floor_number INTEGER)
RETURNS TABLE (
    floor_number INTEGER,
    type floor_type,
    is_checkpoint BOOLEAN,
    min_level INTEGER,
    description TEXT
) AS $$
DECLARE
    v_floor floors;
    v_floor_type floor_type;
    v_is_checkpoint BOOLEAN;
    v_min_level INTEGER;
    v_description TEXT;
BEGIN
    SELECT * INTO v_floor
    FROM floors f
    WHERE f.floor_number = p_floor_number;

    IF v_floor IS NULL THEN
        v_floor_type := CASE
            WHEN p_floor_number % 10 = 0 THEN 'boss'::floor_type
            WHEN p_floor_number % 5 = 0 THEN 'elite'::floor_type
            WHEN p_floor_number % 7 = 0 THEN 'event'::floor_type
            ELSE 'common'::floor_type
        END;

        v_is_checkpoint := (p_floor_number IN (1, 5))
            OR (p_floor_number > 10 AND (p_floor_number - 1) % 10 = 0);

        v_min_level := GREATEST(1, p_floor_number / 2);

        v_description := CASE
            WHEN p_floor_number = 1 THEN 'Entrada da Torre'
            WHEN p_floor_number % 10 = 0 THEN 'Covil do Chefe - Andar ' || p_floor_number
            WHEN p_floor_number % 5 = 0 THEN 'Domínio de Elite - Andar ' || p_floor_number
            WHEN p_floor_number % 7 = 0 THEN 'Câmara de Eventos - Andar ' || p_floor_number
            WHEN v_is_checkpoint THEN 'Santuário Seguro - Andar ' || p_floor_number
            ELSE 'Corredor Sombrio - Andar ' || p_floor_number
        END;

        RETURN QUERY
        SELECT p_floor_number, v_floor_type, v_is_checkpoint, v_min_level, v_description;
    ELSE
        v_is_checkpoint := (v_floor.floor_number IN (1, 5))
            OR (v_floor.floor_number > 10 AND (v_floor.floor_number - 1) % 10 = 0);

        RETURN QUERY
        SELECT
            v_floor.floor_number,
            v_floor.type,
            v_is_checkpoint,
            v_floor.min_level,
            v_floor.description;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

UPDATE floors
SET is_checkpoint = (
    floor_number IN (1, 5)
    OR (floor_number > 10 AND (floor_number - 1) % 10 = 0)
);

CREATE OR REPLACE FUNCTION secure_advance_floor(
    p_character_id UUID,
    p_new_floor INTEGER
)
RETURNS VOID AS $$
DECLARE
    v_current_floor INTEGER;
    v_highest_floor INTEGER;
    v_owner UUID;
    v_can_teleport BOOLEAN;
BEGIN
    IF current_setting('request.jwt.claim.role', true) <> 'service_role' THEN
        SELECT user_id INTO v_owner FROM characters WHERE id = p_character_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Personagem não encontrado';
        END IF;
        IF v_owner IS DISTINCT FROM auth.uid() THEN
            RAISE EXCEPTION 'Operação não autorizada para este personagem';
        END IF;
    END IF;

    SELECT floor, COALESCE(highest_floor, floor)
    INTO v_current_floor, v_highest_floor
    FROM characters
    WHERE id = p_character_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;

    IF p_new_floor < 1 OR p_new_floor > 1000 THEN
        RAISE EXCEPTION 'Andar inválido (permitido: 1-1000)';
    END IF;

    IF p_new_floor = 1 THEN
        UPDATE characters
        SET floor = 1, last_activity = NOW()
        WHERE id = p_character_id;
        RETURN;
    END IF;

    IF p_new_floor = v_current_floor + 1 AND p_new_floor <= v_highest_floor + 1 THEN
        UPDATE characters
        SET
            floor = p_new_floor,
            highest_floor = GREATEST(COALESCE(highest_floor, floor), p_new_floor),
            last_activity = NOW()
        WHERE id = p_character_id;

        INSERT INTO character_activity_log (character_id, action, details, created_at)
        VALUES (p_character_id, 'floor_change', json_build_object('old_floor', v_current_floor, 'new_floor', p_new_floor), NOW());
        RETURN;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM get_unlocked_checkpoints(v_highest_floor) u
        WHERE u.floor_number = p_new_floor
    )
    INTO v_can_teleport;

    IF v_can_teleport AND p_new_floor <> v_current_floor THEN
        UPDATE characters
        SET floor = p_new_floor, last_activity = NOW()
        WHERE id = p_character_id;

        INSERT INTO character_activity_log (character_id, action, details, created_at)
        VALUES (
            p_character_id,
            'checkpoint_warp',
            json_build_object('from_floor', v_current_floor, 'to_floor', p_new_floor),
            NOW()
        );
        RETURN;
    END IF;

    RAISE EXCEPTION
        'Avanço de andar inválido (atual: %, tentativa: %, máximo alcançado: %)',
        v_current_floor, p_new_floor, v_highest_floor;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION secure_advance_floor(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION secure_advance_floor(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION secure_advance_floor(UUID, INTEGER) TO authenticated;

COMMENT ON FUNCTION get_unlocked_checkpoints(INTEGER) IS
'Checkpoints: 1, 5 (se highest>=5), 11,21,... pós-boss (10k+1).';
