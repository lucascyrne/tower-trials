-- Eleva o teto global de XP de combat para acomodar recompensas legítimas de boss.
-- Mantém os demais guardrails anti-cheat (rate-limit por minuto e logs de auditoria).

CREATE OR REPLACE FUNCTION validate_xp_gain(
    p_character_id UUID,
    p_xp_amount INTEGER,
    p_source VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    v_character_level INTEGER;
    v_max_xp_per_source INTEGER;
    v_recent_xp_gains INTEGER;
BEGIN
    SELECT level INTO v_character_level
    FROM characters
    WHERE id = p_character_id;

    IF NOT FOUND OR p_xp_amount <= 0 THEN
        RETURN FALSE;
    END IF;

    CASE p_source
        WHEN 'combat' THEN
            -- Aumentado de 300 para 500 para cobrir bosses sem bloquear progresso.
            v_max_xp_per_source := GREATEST(500, v_character_level * 25);
        WHEN 'quest' THEN
            v_max_xp_per_source := GREATEST(800, v_character_level * 60);
        WHEN 'event' THEN
            v_max_xp_per_source := GREATEST(400, v_character_level * 35);
        WHEN 'admin' THEN
            v_max_xp_per_source := 100000;
        ELSE
            v_max_xp_per_source := GREATEST(150, v_character_level * 15);
    END CASE;

    IF p_xp_amount > v_max_xp_per_source THEN
        INSERT INTO character_activity_log (character_id, action, details, created_at)
        VALUES (
            p_character_id,
            'suspicious_xp',
            json_build_object(
                'amount', p_xp_amount,
                'source', p_source,
                'max_allowed', v_max_xp_per_source,
                'character_level', v_character_level
            ),
            NOW()
        );
        RETURN FALSE;
    END IF;

    SELECT COALESCE(SUM(
        CASE
            WHEN details->>'amount' ~ '^[0-9]+$' THEN (details->>'amount')::INTEGER
            ELSE 0
        END
    ), 0)
    INTO v_recent_xp_gains
    FROM character_activity_log
    WHERE character_id = p_character_id
      AND action = 'xp_gain'
      AND created_at > NOW() - INTERVAL '1 minute';

    IF v_recent_xp_gains > (v_max_xp_per_source * 5) THEN
        INSERT INTO character_activity_log (character_id, action, details, created_at)
        VALUES (
            p_character_id,
            'rapid_xp_gain',
            json_build_object(
                'recent_xp', v_recent_xp_gains,
                'new_xp', p_xp_amount,
                'source', p_source,
                'max_allowed', v_max_xp_per_source
            ),
            NOW()
        );
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
