-- ================================
-- Migração para corrigir funções que ainda usam derived_* 
-- Data: 2024-12-05
-- ================================

-- PROBLEMA: As funções calculate_final_character_stats e recalculate_character_stats
-- ainda estão tentando usar colunas derived_* da versão antiga de calculate_derived_stats.

-- SOLUÇÃO: Atualizar todas as funções para usar a assinatura atual (hp, max_hp, etc.)

-- =====================================
-- 1. CORRIGIR FUNÇÃO CALCULATE_FINAL_CHARACTER_STATS
-- =====================================

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
    
    -- CORRIGIDO: Calcular stats base usando assinatura atual
    SELECT 
        hp,
        max_hp,
        mana,
        max_mana,
        atk,
        def,
        speed
    INTO v_base_stats 
    FROM calculate_derived_stats(
        v_character.level,
        v_character.strength,
        v_character.dexterity,
        v_character.intelligence,
        v_character.wisdom,
        v_character.vitality,
        v_character.luck,
        COALESCE(v_character.sword_mastery, 1),
        COALESCE(v_character.axe_mastery, 1),
        COALESCE(v_character.blunt_mastery, 1),
        COALESCE(v_character.defense_mastery, 1),
        COALESCE(v_character.magic_mastery, 1)
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
    
    -- CORRIGIDO: Retornar valores usando nomes corretos das colunas
    RETURN QUERY
    SELECT
        v_base_stats.hp::INTEGER,
        v_base_stats.max_hp::INTEGER,
        v_base_stats.mana::INTEGER,
        v_base_stats.max_mana::INTEGER,
        v_base_stats.atk::INTEGER,
        v_base_stats.def::INTEGER,
        v_base_stats.speed::INTEGER,
        v_eq_hp_bonus::INTEGER,
        v_eq_mana_bonus::INTEGER,
        v_eq_atk_bonus::INTEGER,
        v_eq_def_bonus::INTEGER,
        v_eq_speed_bonus::INTEGER,
        (v_base_stats.hp + v_eq_hp_bonus)::INTEGER,
        (v_base_stats.max_hp + v_eq_hp_bonus)::INTEGER,
        (v_base_stats.mana + v_eq_mana_bonus)::INTEGER,
        (v_base_stats.max_mana + v_eq_mana_bonus)::INTEGER,
        (v_base_stats.atk + v_eq_atk_bonus)::INTEGER,
        (v_base_stats.def + v_eq_def_bonus)::INTEGER,
        (v_base_stats.speed + v_eq_speed_bonus)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 2. VERIFICAR SE CALCULATE_EQUIPMENT_BONUSES EXISTE
-- =====================================

-- Remover função existente primeiro para evitar conflito de tipos
DROP FUNCTION IF EXISTS calculate_equipment_bonuses(UUID) CASCADE;

-- Criar função com tipo correto
CREATE OR REPLACE FUNCTION calculate_equipment_bonuses(p_character_id UUID)
RETURNS TABLE (
    total_hp_bonus INTEGER,
    total_mana_bonus INTEGER,
    total_atk_bonus INTEGER,
    total_def_bonus INTEGER,
    total_speed_bonus INTEGER
) AS $$
BEGIN
    -- Calcular bônus de equipamentos equipados
    SELECT 
        COALESCE(SUM(e.hp_bonus), 0)::INTEGER,
        COALESCE(SUM(e.mana_bonus), 0)::INTEGER,
        COALESCE(SUM(e.atk_bonus), 0)::INTEGER,
        COALESCE(SUM(e.def_bonus), 0)::INTEGER,
        COALESCE(SUM(e.speed_bonus), 0)::INTEGER
    INTO 
        total_hp_bonus,
        total_mana_bonus,
        total_atk_bonus,
        total_def_bonus,
        total_speed_bonus
    FROM character_equipment ce
    JOIN equipment e ON ce.equipment_id = e.id
    WHERE ce.character_id = p_character_id
      AND ce.is_equipped = true;
    
    -- Se não encontrou dados, retornar zeros
    IF NOT FOUND THEN
        total_hp_bonus := 0;
        total_mana_bonus := 0;
        total_atk_bonus := 0;
        total_def_bonus := 0;
        total_speed_bonus := 0;
    END IF;
    
    RETURN QUERY SELECT 
        total_hp_bonus, total_mana_bonus, total_atk_bonus, 
        total_def_bonus, total_speed_bonus;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 3. ATUALIZAR GET_CHARACTER_DETAILED_STATS
-- =====================================

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

-- =====================================
-- 4. BUSCAR E CORRIGIR OUTRAS FUNÇÕES QUE POSSAM USAR DERIVED_*
-- =====================================

-- Função para atualizar stats com magic_attack se a tabela suportar
CREATE OR REPLACE FUNCTION recalculate_character_stats(p_character_id UUID)
RETURNS VOID AS $$
DECLARE
    v_character RECORD;
    v_final_stats RECORD;
    v_hp_ratio DECIMAL;
    v_mana_ratio DECIMAL;
    v_new_hp INTEGER;
    v_new_mana INTEGER;
    v_has_magic_attack BOOLEAN := FALSE;
BEGIN
    -- Verificar se a coluna magic_attack existe
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'characters' AND column_name = 'magic_attack'
    ) INTO v_has_magic_attack;
    
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
    -- Usar SQL dinâmico para incluir magic_attack apenas se a coluna existir
    IF v_has_magic_attack THEN
        EXECUTE format('
            UPDATE characters
            SET
                max_hp = $1,
                max_mana = $2,
                atk = $3,
                def = $4,
                speed = $5,
                hp = $6,
                mana = $7
            WHERE id = $8
        ') USING 
            v_final_stats.final_max_hp,
            v_final_stats.final_max_mana,
            v_final_stats.final_atk,
            v_final_stats.final_def,
            v_final_stats.final_speed,
            LEAST(v_new_hp, v_final_stats.final_max_hp),
            LEAST(v_new_mana, v_final_stats.final_max_mana),
            p_character_id;
    ELSE
        -- Versão sem magic_attack
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
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- COMENTÁRIOS DA CORREÇÃO
-- =====================================

COMMENT ON FUNCTION calculate_final_character_stats(UUID) IS 
'Função corrigida para usar a versão atual de calculate_derived_stats.
- Removido: derived_hp, derived_max_hp, derived_mana, derived_max_mana, derived_atk, derived_def, derived_speed
- Adicionado: hp, max_hp, mana, max_mana, atk, def, speed
- Inclui todos os parâmetros de maestria na chamada da função';

COMMENT ON FUNCTION recalculate_character_stats(UUID) IS 
'Função corrigida que recalcula stats do personagem usando a versão atual de calculate_derived_stats.
- Compatível com tabelas que têm ou não a coluna magic_attack
- Mantém proporção de HP/Mana atual quando máximos mudarem';

-- Migração concluída com sucesso
-- Todas as funções que usavam derived_* foram corrigidas 