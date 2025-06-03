-- Migração para corrigir funções seguras e permissões (versão final)
-- Data: 2024-12-02 
-- Resolve problemas de permissões para funções que requerem service_role

-- =====================================================
-- VERIFICAR E CORRIGIR FUNÇÕES SEGURAS
-- =====================================================

-- 1. Garantir que secure_process_combat_drops existe e está funcionando
DO $$
BEGIN
    -- Recriar a função garantindo que está completa
    CREATE OR REPLACE FUNCTION secure_process_combat_drops(
        p_character_id UUID,
        p_drops JSONB -- Array de {drop_id, quantity}
    )
    RETURNS INTEGER AS $func$
    DECLARE
        v_drop RECORD;
        v_drops_processed INTEGER := 0;
        v_max_drops_per_combat INTEGER := 10; -- Limite de drops por combate
        v_total_drops INTEGER;
    BEGIN
        -- Validar entrada
        IF p_drops IS NULL OR jsonb_array_length(p_drops) = 0 THEN
            RETURN 0;
        END IF;
        
        -- Contar total de drops
        SELECT jsonb_array_length(p_drops) INTO v_total_drops;
        
        -- Validar limite de drops por combate
        IF v_total_drops > v_max_drops_per_combat THEN
            RAISE EXCEPTION 'Muitos drops por combate (máximo: %)', v_max_drops_per_combat;
        END IF;
        
        -- Verificar se o personagem existe
        IF NOT EXISTS (SELECT 1 FROM characters WHERE id = p_character_id) THEN
            RAISE EXCEPTION 'Personagem não encontrado: %', p_character_id;
        END IF;
        
        -- Processar cada drop
        FOR v_drop IN (
            SELECT 
                (item->>'drop_id')::UUID as drop_id,
                (item->>'quantity')::INTEGER as quantity
            FROM jsonb_array_elements(p_drops) as item
        ) LOOP
            -- Validar drop_id
            IF v_drop.drop_id IS NULL OR v_drop.quantity IS NULL OR v_drop.quantity <= 0 THEN
                RAISE WARNING 'Drop inválido ignorado: drop_id=%, quantity=%', v_drop.drop_id, v_drop.quantity;
                CONTINUE;
            END IF;
            
            -- Usar função interna segura
            PERFORM internal_add_monster_drop(
                p_character_id,
                v_drop.drop_id,
                v_drop.quantity
            );
            
            v_drops_processed := v_drops_processed + 1;
        END LOOP;
        
        RETURN v_drops_processed;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Erro ao processar drops para personagem %: %', p_character_id, SQLERRM;
            RAISE;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;
    
    RAISE NOTICE 'Função secure_process_combat_drops criada/atualizada com sucesso';
END;
$$;

-- 2. Garantir que internal_add_monster_drop existe
DO $$
BEGIN
    CREATE OR REPLACE FUNCTION internal_add_monster_drop(
        p_character_id UUID,
        p_drop_id UUID,
        p_quantity INTEGER
    )
    RETURNS VOID AS $func$
    DECLARE
        v_max_quantity_per_drop INTEGER := 50; -- Limite anti-cheat por drop
        v_drop_rarity VARCHAR;
    BEGIN
        -- Validações anti-cheat
        IF p_quantity <= 0 THEN
            RAISE EXCEPTION 'Quantidade deve ser positiva: %', p_quantity;
        END IF;
        
        -- Verificar se o drop existe e obter raridade
        SELECT rarity INTO v_drop_rarity FROM monster_drops WHERE id = p_drop_id;
        
        IF v_drop_rarity IS NULL THEN
            RAISE EXCEPTION 'Drop não encontrado: %', p_drop_id;
        END IF;
        
        -- Limites mais restritivos para itens raros
        CASE v_drop_rarity
            WHEN 'legendary' THEN v_max_quantity_per_drop := 5;
            WHEN 'epic' THEN v_max_quantity_per_drop := 10;
            WHEN 'rare' THEN v_max_quantity_per_drop := 20;
            WHEN 'uncommon' THEN v_max_quantity_per_drop := 30;
            ELSE v_max_quantity_per_drop := 50; -- common
        END CASE;
        
        IF p_quantity > v_max_quantity_per_drop THEN
            RAISE EXCEPTION 'Quantidade suspeita para % (máximo: %)', v_drop_rarity, v_max_quantity_per_drop;
        END IF;
        
        -- Log da operação para auditoria (se a tabela existir)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'character_activity_log') THEN
            INSERT INTO character_activity_log (character_id, action, details, created_at)
            VALUES (p_character_id, 'drop_received', json_build_object(
                'drop_id', p_drop_id, 
                'quantity', p_quantity, 
                'rarity', v_drop_rarity
            ), NOW())
            ON CONFLICT DO NOTHING;
        END IF;
        
        -- Utilizar padrão UPSERT para evitar problemas de concorrência
        INSERT INTO character_drops (character_id, drop_id, quantity)
        VALUES (p_character_id, p_drop_id, p_quantity)
        ON CONFLICT (character_id, drop_id) 
        DO UPDATE SET 
            quantity = character_drops.quantity + EXCLUDED.quantity,
            updated_at = NOW();
            
    EXCEPTION
        WHEN unique_violation THEN
            -- Fallback em caso de condição de corrida
            UPDATE character_drops
            SET quantity = quantity + p_quantity,
                updated_at = NOW()
            WHERE character_id = p_character_id AND drop_id = p_drop_id;
        WHEN OTHERS THEN
            RAISE WARNING 'Erro ao adicionar drop % para personagem %: %', p_drop_id, p_character_id, SQLERRM;
            RAISE;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;
    
    RAISE NOTICE 'Função internal_add_monster_drop criada/atualizada com sucesso';
END;
$$;

-- =====================================================
-- CONFIGURAR PERMISSÕES CORRETAMENTE
-- =====================================================

-- Revogar acesso público e conceder apenas ao service_role
DO $$
BEGIN
    -- secure_process_combat_drops
    REVOKE ALL ON FUNCTION secure_process_combat_drops(UUID, JSONB) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION secure_process_combat_drops(UUID, JSONB) TO service_role;
    
    -- internal_add_monster_drop
    REVOKE ALL ON FUNCTION internal_add_monster_drop(UUID, UUID, INTEGER) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION internal_add_monster_drop(UUID, UUID, INTEGER) TO service_role;
    
    RAISE NOTICE 'Permissões configuradas para service_role apenas';
END;
$$;

-- =====================================================
-- VERIFICAR OUTRAS FUNÇÕES CRÍTICAS
-- =====================================================

DO $$
BEGIN
    -- Verificar e corrigir permissões de outras funções seguras
    
    -- secure_grant_xp
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'secure_grant_xp') THEN
        REVOKE ALL ON FUNCTION secure_grant_xp(UUID, INTEGER, VARCHAR) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION secure_grant_xp(UUID, INTEGER, VARCHAR) TO service_role;
        RAISE NOTICE 'Permissões de secure_grant_xp configuradas';
    ELSE
        RAISE WARNING 'Função secure_grant_xp não encontrada!';
    END IF;
    
    -- secure_grant_gold
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'secure_grant_gold') THEN
        REVOKE ALL ON FUNCTION secure_grant_gold(UUID, INTEGER, VARCHAR) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION secure_grant_gold(UUID, INTEGER, VARCHAR) TO service_role;
        RAISE NOTICE 'Permissões de secure_grant_gold configuradas';
    ELSE
        RAISE WARNING 'Função secure_grant_gold não encontrada!';
    END IF;
    
    -- secure_advance_floor
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'secure_advance_floor') THEN
        REVOKE ALL ON FUNCTION secure_advance_floor(UUID, INTEGER) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION secure_advance_floor(UUID, INTEGER) TO service_role;
        RAISE NOTICE 'Permissões de secure_advance_floor configuradas';
    ELSE
        RAISE WARNING 'Função secure_advance_floor não encontrada!';
    END IF;
    
    -- internal_update_character_hp_mana
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'internal_update_character_hp_mana') THEN
        REVOKE ALL ON FUNCTION internal_update_character_hp_mana(UUID, INTEGER, INTEGER) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION internal_update_character_hp_mana(UUID, INTEGER, INTEGER) TO service_role;
        RAISE NOTICE 'Permissões de internal_update_character_hp_mana configuradas';
    ELSE
        RAISE WARNING 'Função internal_update_character_hp_mana não encontrada!';
    END IF;
END;
$$;

-- =====================================================
-- CRIAR TABELA DE LOG SE NÃO EXISTIR
-- =====================================================

-- Garantir que a tabela de log existe para auditoria
CREATE TABLE IF NOT EXISTS character_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Índice para consultas por personagem e data
CREATE INDEX IF NOT EXISTS idx_character_activity_log_character_date 
ON character_activity_log(character_id, created_at DESC);

-- =====================================================
-- COMENTÁRIOS FINAIS
-- =====================================================

COMMENT ON FUNCTION secure_process_combat_drops(UUID, JSONB) IS 
'Função segura para processar múltiplos drops de combate - apenas service_role - versão final';

COMMENT ON FUNCTION internal_add_monster_drop(UUID, UUID, INTEGER) IS 
'Função interna para adicionar drops com validação anti-cheat - apenas service_role - versão final';

-- Log de conclusão
DO $$
BEGIN
    RAISE NOTICE '✅ Migração 20241202000018_fix_secure_functions_final concluída com sucesso!';
    RAISE NOTICE '🔒 Funções seguras configuradas apenas para service_role';
    RAISE NOTICE '📊 Tabela de auditoria character_activity_log disponível';
END;
$$; 