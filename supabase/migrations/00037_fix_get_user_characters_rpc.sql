-- =============================================
-- MIGRATION: Correção da RPC get_user_characters
-- Version: 2.0
-- Description: Atualiza RPC para filtrar apenas personagens vivos
-- Issue: Personagens mortos estavam aparecendo na seleção de personagens
-- Solution: Usar DROP FUNCTION para remover versão antiga antes de recriar
-- =============================================

-- === REMOVER FUNÇÃO ANTIGA COM ASSINATURA ANTERIOR ===
-- Necessário fazer DROP porque estamos adicionando coluna ao RETURNS TABLE

DROP FUNCTION IF EXISTS get_user_characters(UUID);

-- === CRIAR NOVA FUNÇÃO COM FILTRO DE PERSONAGENS VIVOS ===

CREATE OR REPLACE FUNCTION get_user_characters(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    name VARCHAR,
    level INTEGER,
    xp INTEGER,
    xp_next_level INTEGER,
    gold INTEGER,
    hp INTEGER,
    max_hp INTEGER,
    mana INTEGER,
    max_mana INTEGER,
    atk INTEGER,
    def INTEGER,
    speed INTEGER,
    floor INTEGER,
    last_activity TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.user_id,
        c.name,
        c.level,
        c.xp,
        c.xp_next_level,
        c.gold,
        c.hp,
        c.max_hp,
        c.mana,
        c.max_mana,
        c.atk,
        c.def,
        c.speed,
        c.floor,
        c.last_activity,
        c.created_at,
        c.updated_at
    FROM characters c
    WHERE c.user_id = p_user_id
      AND COALESCE(c.is_alive, TRUE) = TRUE
    ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- === COMENTÁRIO ===
COMMENT ON FUNCTION get_user_characters(UUID) IS 
'Retorna todos os personagens vivos do usuário. Filtra automaticamente personagens marcados como mortos (is_alive = FALSE).';

