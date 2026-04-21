-- Cliente browser: RPCs seguras com JWT (authenticated), sem service_role.
-- Verificação de dono alinhada a secure_grant_xp (hardening).

CREATE OR REPLACE FUNCTION secure_grant_gold(
    p_character_id UUID,
    p_gold_amount INTEGER,
    p_source VARCHAR DEFAULT 'combat'
)
RETURNS INTEGER AS $$
DECLARE
    v_new_gold INTEGER;
    v_max_gold_per_call INTEGER := 50000;
    v_owner UUID;
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

    IF p_gold_amount <= 0 THEN
        RAISE EXCEPTION 'Quantidade de gold deve ser positiva';
    END IF;

    IF p_gold_amount > v_max_gold_per_call THEN
        RAISE EXCEPTION 'Quantidade de gold suspeita detectada (máximo: %)', v_max_gold_per_call;
    END IF;

    INSERT INTO character_activity_log (character_id, action, details, created_at)
    VALUES (p_character_id, 'gold_gain', json_build_object('amount', p_gold_amount, 'source', p_source), NOW())
    ON CONFLICT DO NOTHING;

    UPDATE characters
    SET
        gold = gold + p_gold_amount,
        last_activity = NOW()
    WHERE id = p_character_id
    RETURNING gold INTO v_new_gold;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;

    RETURN v_new_gold;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION secure_advance_floor(
    p_character_id UUID,
    p_new_floor INTEGER
)
RETURNS VOID AS $$
DECLARE
    v_current_floor INTEGER;
    v_owner UUID;
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

    SELECT floor INTO v_current_floor
    FROM characters
    WHERE id = p_character_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;

    IF p_new_floor != 1 AND p_new_floor <= v_current_floor THEN
        RAISE EXCEPTION 'Só é possível avançar andares ou resetar para o andar 1';
    END IF;

    IF p_new_floor < 1 OR p_new_floor > 1000 THEN
        RAISE EXCEPTION 'Andar inválido (permitido: 1-1000)';
    END IF;

    INSERT INTO character_activity_log (character_id, action, details, created_at)
    VALUES (p_character_id, 'floor_change', json_build_object('old_floor', v_current_floor, 'new_floor', p_new_floor), NOW())
    ON CONFLICT DO NOTHING;

    UPDATE characters
    SET
        floor = p_new_floor,
        last_activity = NOW()
    WHERE id = p_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION secure_process_combat_drops(
    p_character_id UUID,
    p_drops JSONB
)
RETURNS INTEGER AS $$
DECLARE
    v_drop RECORD;
    v_drops_processed INTEGER := 0;
    v_max_drops_per_combat INTEGER := 10;
    v_total_drops INTEGER;
    v_owner UUID;
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

    SELECT jsonb_array_length(p_drops) INTO v_total_drops;

    IF v_total_drops > v_max_drops_per_combat THEN
        RAISE EXCEPTION 'Muitos drops por combate (máximo: %)', v_max_drops_per_combat;
    END IF;

    FOR v_drop IN (
        SELECT
            (item->>'drop_id')::UUID AS drop_id,
            (item->>'quantity')::INTEGER AS quantity
        FROM jsonb_array_elements(p_drops) AS item
    ) LOOP
        PERFORM internal_add_monster_drop(
            p_character_id,
            v_drop.drop_id,
            v_drop.quantity
        );
        v_drops_processed := v_drops_processed + 1;
    END LOOP;

    RETURN v_drops_processed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION consume_potion_from_slot(
    p_character_id UUID,
    p_slot_position INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_character RECORD;
    v_slot RECORD;
    v_consumable RECORD;
    v_new_hp INTEGER;
    v_new_mana INTEGER;
    v_effect_value INTEGER;
    v_result JSON;
BEGIN
    IF p_slot_position < 1 OR p_slot_position > 3 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Posição do slot inválida (1-3)'
        );
    END IF;

    SELECT * INTO v_character FROM characters WHERE id = p_character_id;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Personagem não encontrado'
        );
    END IF;

    IF current_setting('request.jwt.claim.role', true) <> 'service_role'
       AND v_character.user_id IS DISTINCT FROM auth.uid() THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Operação não autorizada'
        );
    END IF;

    SELECT * INTO v_slot FROM character_potion_slots
    WHERE character_id = p_character_id AND slot_position = p_slot_position;

    IF NOT FOUND OR v_slot.consumable_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Slot vazio ou não configurado'
        );
    END IF;

    SELECT * INTO v_consumable FROM consumables WHERE id = v_slot.consumable_id;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Consumível não encontrado'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM character_consumables
        WHERE character_id = p_character_id
        AND consumable_id = v_slot.consumable_id
        AND quantity > 0
    ) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Quantidade insuficiente do consumível'
        );
    END IF;

    v_effect_value := FLOOR(v_consumable.effect_value);
    v_new_hp := v_character.hp;
    v_new_mana := v_character.mana;

    CASE v_consumable.type
        WHEN 'potion' THEN
            IF v_consumable.description ILIKE '%HP%' OR v_consumable.description ILIKE '%Vida%' THEN
                v_new_hp := LEAST(v_character.max_hp, v_character.hp + v_effect_value);
            ELSIF v_consumable.description ILIKE '%Mana%' THEN
                v_new_mana := LEAST(v_character.max_mana, v_character.mana + v_effect_value);
            END IF;
        WHEN 'antidote' THEN
            v_new_hp := LEAST(v_character.max_hp, v_character.hp + FLOOR(v_effect_value / 2));
        ELSE
            NULL;
    END CASE;

    v_new_hp := FLOOR(v_new_hp);
    v_new_mana := FLOOR(v_new_mana);

    UPDATE characters
    SET
        hp = v_new_hp,
        mana = v_new_mana,
        updated_at = NOW()
    WHERE id = p_character_id;

    UPDATE character_consumables
    SET
        quantity = quantity - 1,
        updated_at = NOW()
    WHERE character_id = p_character_id AND consumable_id = v_slot.consumable_id;

    DELETE FROM character_consumables
    WHERE character_id = p_character_id
    AND consumable_id = v_slot.consumable_id
    AND quantity <= 0;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'character_activity_log') THEN
        INSERT INTO character_activity_log (character_id, action, details, created_at)
        VALUES (p_character_id, 'potion_consumed', json_build_object(
            'consumable_id', v_slot.consumable_id,
            'consumable_name', v_consumable.name,
            'slot_position', p_slot_position,
            'effect_value', v_effect_value,
            'old_hp', v_character.hp,
            'new_hp', v_new_hp,
            'old_mana', v_character.mana,
            'new_mana', v_new_mana
        ), NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN json_build_object(
        'success', true,
        'message', format('Você usou %s e recuperou %s!',
            v_consumable.name,
            CASE
                WHEN v_new_hp > v_character.hp THEN format('%s HP', v_new_hp - v_character.hp)
                WHEN v_new_mana > v_character.mana THEN format('%s Mana', v_new_mana - v_character.mana)
                ELSE 'energia'
            END
        ),
        'new_hp', v_new_hp,
        'new_mana', v_new_mana
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', format('Erro ao consumir poção: %s', SQLERRM)
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION secure_grant_gold(UUID, INTEGER, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION secure_grant_gold(UUID, INTEGER, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION secure_grant_gold(UUID, INTEGER, VARCHAR) TO authenticated;

REVOKE ALL ON FUNCTION secure_advance_floor(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION secure_advance_floor(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION secure_advance_floor(UUID, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION secure_process_combat_drops(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION secure_process_combat_drops(UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION secure_process_combat_drops(UUID, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION consume_potion_from_slot(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consume_potion_from_slot(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION consume_potion_from_slot(UUID, INTEGER) TO authenticated;

GRANT EXECUTE ON FUNCTION secure_grant_xp(UUID, INTEGER, VARCHAR) TO authenticated;
