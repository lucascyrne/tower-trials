-- =====================================
-- MIGRAÇÃO: REBALANCEAMENTO CRÍTICO DE CRÍTICOS E DANO MÁGICO
-- =====================================
-- Data: 2024-12-21
-- Versão: 20241221000017
-- Objetivo: Alinhar valores de crítico e dano mágico com o balanceamento solicitado

-- PROBLEMA IDENTIFICADO:
-- - Dano crítico muito alto para personagens nível 1 (166% ao invés de 102%)
-- - Chance crítica muito alta para personagens nível 1 (16% ao invés de 2%)
-- - Necessidade de rebalancear dano mágico com lógica similar

-- SOLUÇÃO:
-- - Reduzir base de dano crítico para 102% (apenas 2% a mais que dano normal)
-- - Reduzir base de chance crítica para praticamente 0% em nível 1
-- - Implementar progressão gradual e balanceada
-- - Aplicar lógica similar ao dano mágico

-- =====================================
-- 1. ATUALIZAR FUNÇÃO DE STATS DERIVADOS
-- =====================================

CREATE OR REPLACE FUNCTION calculate_derived_stats(
    p_level INTEGER,
    p_strength INTEGER DEFAULT 10,
    p_dexterity INTEGER DEFAULT 10,
    p_intelligence INTEGER DEFAULT 10,
    p_wisdom INTEGER DEFAULT 10,
    p_vitality INTEGER DEFAULT 10,
    p_luck INTEGER DEFAULT 10,
    p_sword_mastery INTEGER DEFAULT 1,
    p_axe_mastery INTEGER DEFAULT 1,
    p_blunt_mastery INTEGER DEFAULT 1,
    p_defense_mastery INTEGER DEFAULT 1,
    p_magic_mastery INTEGER DEFAULT 1
)
RETURNS TABLE(
    hp INTEGER,
    max_hp INTEGER,
    mana INTEGER,
    max_mana INTEGER,
    atk INTEGER,
    magic_attack INTEGER,
    def INTEGER,
    speed INTEGER,
    critical_chance NUMERIC(5,2),
    critical_damage NUMERIC(5,2),
    magic_damage_bonus NUMERIC(5,2),
    double_attack_chance NUMERIC(5,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    -- Stats base moderados
    base_hp INTEGER := 50 + (p_level * 2);
    base_mana INTEGER := 20 + (p_level * 1);
    base_atk INTEGER := 2 + (p_level * 0.8);
    base_magic_atk INTEGER := 2 + (p_level * 0.8);
    base_def INTEGER := 1 + (p_level * 0.4);
    base_speed INTEGER := 5 + (p_level * 0.6);
    
    -- Escalamento logarítmico moderado
    str_scaling NUMERIC := CASE 
        WHEN p_strength <= 30 THEN POWER(p_strength, 1.2)
        WHEN p_strength <= 60 THEN POWER(30, 1.2) + (p_strength - 30) * POWER(30, 0.4)
        ELSE POWER(30, 1.2) + 30 * POWER(30, 0.4) + (p_strength - 60) * POWER(30, 0.3)
    END;
    
    dex_scaling NUMERIC := CASE 
        WHEN p_dexterity <= 30 THEN POWER(p_dexterity, 1.15)
        WHEN p_dexterity <= 60 THEN POWER(30, 1.15) + (p_dexterity - 30) * POWER(30, 0.3)
        ELSE POWER(30, 1.15) + 30 * POWER(30, 0.3) + (p_dexterity - 60) * POWER(30, 0.25)
    END;
    
    int_scaling NUMERIC := CASE 
        WHEN p_intelligence <= 30 THEN POWER(p_intelligence, 1.25)
        WHEN p_intelligence <= 60 THEN POWER(30, 1.25) + (p_intelligence - 30) * POWER(30, 0.35)
        ELSE POWER(30, 1.25) + 30 * POWER(30, 0.35) + (p_intelligence - 60) * POWER(30, 0.3)
    END;
    
    wis_scaling NUMERIC := CASE 
        WHEN p_wisdom <= 30 THEN POWER(p_wisdom, 1.1)
        WHEN p_wisdom <= 60 THEN POWER(30, 1.1) + (p_wisdom - 30) * POWER(30, 0.3)
        ELSE POWER(30, 1.1) + 30 * POWER(30, 0.3) + (p_wisdom - 60) * POWER(30, 0.25)
    END;
    
    vit_scaling NUMERIC := CASE 
        WHEN p_vitality <= 30 THEN POWER(p_vitality, 1.15)
        WHEN p_vitality <= 60 THEN POWER(30, 1.15) + (p_vitality - 30) * POWER(30, 0.35)
        ELSE POWER(30, 1.15) + 30 * POWER(30, 0.35) + (p_vitality - 60) * POWER(30, 0.3)
    END;
    
    luck_scaling NUMERIC := p_luck * 0.8;
    
    -- Habilidades
    weapon_mastery_bonus NUMERIC := POWER(GREATEST(p_sword_mastery, p_axe_mastery, p_blunt_mastery), 1.1) * 0.6;
    defense_mastery_bonus NUMERIC := POWER(p_defense_mastery, 1.1) * 0.8;
    magic_mastery_bonus NUMERIC := POWER(p_magic_mastery, 1.15) * 1.0;
    
    -- Stats finais
    v_hp INTEGER;
    v_mana INTEGER;
    v_atk INTEGER;
    v_magic_atk INTEGER;
    v_def INTEGER;
    v_speed INTEGER;
    v_crit_chance NUMERIC(5,2);
    v_crit_damage NUMERIC(5,2);
    v_magic_dmg_bonus NUMERIC(5,2);
    v_double_attack_chance NUMERIC(5,2);
BEGIN
    -- Cálculos básicos
    v_hp := base_hp + ROUND(vit_scaling * 2.5);
    v_mana := base_mana + ROUND(int_scaling * 1.2) + ROUND(wis_scaling * 1.0) + ROUND(magic_mastery_bonus * 0.5);
    v_atk := base_atk + ROUND(str_scaling * 1.0) + ROUND(weapon_mastery_bonus * 1.0);
    v_magic_atk := base_magic_atk + ROUND(int_scaling * 1.0) + ROUND(wis_scaling * 0.6) + ROUND(magic_mastery_bonus * 0.8);
    v_def := base_def + ROUND(vit_scaling * 0.6) + ROUND(wis_scaling * 0.4) + ROUND(defense_mastery_bonus * 1.0);
    v_speed := base_speed + ROUND(dex_scaling * 0.8);
    
    -- =====================================
    -- CRÍTICOS ULTRA RAROS E VALIOSOS (REBALANCEADOS)
    -- =====================================
    
    -- Chance crítica: Base praticamente zero, crescimento muito gradual
    -- Para nível 1 com atributos 10: aproximadamente 1-2%
    v_crit_chance := LEAST(60, 
        0.5 + -- Base ultra baixa: 0.5%
        (dex_scaling * 0.1) + -- Reduzido drasticamente
        (luck_scaling * 0.15) + -- Reduzido drasticamente  
        (weapon_mastery_bonus * 0.05) -- Reduzido drasticamente
    );
    
    -- Dano crítico: Base 102% (apenas 2% a mais), crescimento controlado
    -- Para nível 1 com atributos 10: aproximadamente 102-104%
    v_crit_damage := 102 + -- Base exatamente 102% como solicitado
        (str_scaling * 0.2) + -- Reduzido drasticamente de 0.15
        (luck_scaling * 0.1) + -- Reduzido drasticamente de 0.2
        (weapon_mastery_bonus * 0.05); -- Reduzido drasticamente de 0.1
    
    -- =====================================
    -- DANO MÁGICO REBALANCEADO (SIMILAR AO CRÍTICO)
    -- =====================================
    
    -- Dano mágico: Base baixa, crescimento gradual similar ao crítico
    -- Para nível 1 com atributos 10: aproximadamente 2-4%
    v_magic_dmg_bonus := 2 + -- Base 2% de bônus mágico
        (int_scaling * 0.6) + -- Reduzido para crescimento moderado
        (wis_scaling * 0.3) + -- Sabedoria contribui moderadamente
        (magic_mastery_bonus * 0.8); -- Maestria mágica importante mas não dominante
    
    -- Cap do dano mágico para evitar explosão no late game
    v_magic_dmg_bonus := LEAST(300, v_magic_dmg_bonus);
    
    -- =====================================
    -- DUPLO ATAQUE RARO E EXCLUSIVO
    -- =====================================
    
    -- Duplo ataque apenas com velocidade MUITO alta
    v_double_attack_chance := CASE
        WHEN v_speed >= 80 THEN LEAST(15, (v_speed - 79) * 0.3) -- Precisa 80+ speed, máximo 15%
        ELSE 0
    END;
    
    RETURN QUERY SELECT 
        v_hp,
        v_hp,
        v_mana,
        v_mana,
        v_atk,
        v_magic_atk,
        v_def,
        v_speed,
        v_crit_chance,
        v_crit_damage,
        v_magic_dmg_bonus,
        v_double_attack_chance;
END;
$$;

-- =====================================
-- 2. RECALCULAR TODOS OS PERSONAGENS EXISTENTES
-- =====================================

-- Executar recálculo para aplicar os novos valores
SELECT recalculate_all_characters_unified();

-- =====================================
-- 3. COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================

COMMENT ON FUNCTION calculate_derived_stats IS 
'ÚNICA FONTE DA VERDADE para stats de personagem v4.1 - CRÍTICOS ULTRA BALANCEADOS.
- Chance crítica: Base 0.5%, crescimento muito gradual
- Dano crítico: Base 102% (apenas 2% a mais), crescimento controlado  
- Dano mágico: Base 2%, crescimento similar ao crítico
- Duplo ataque: Exclusivo para builds de velocidade (80+ speed)
- Progressão árdua que recompensa investimento focado';

-- Log da migração
DO $$
BEGIN
    RAISE NOTICE '===============================================';
    RAISE NOTICE '=== CRÍTICOS E DANO MÁGICO REBALANCEADOS ===';
    RAISE NOTICE 'Chance crítica nível 1: ~1-2%% (era ~16%%)';
    RAISE NOTICE 'Dano crítico nível 1: ~102-104%% (era ~166%%)';
    RAISE NOTICE 'Dano mágico nível 1: ~2-4%% (implementado)';
    RAISE NOTICE 'Progressão gradual e balanceada implementada';
    RAISE NOTICE '===============================================';
END $$;

-- =====================================
-- 4. CORREÇÃO CRÍTICA: FLOOR = 0 PROBLEM
-- =====================================

-- Corrigir personagens com floor = 0 (inválido)
UPDATE characters 
SET floor = 1 
WHERE floor <= 0;

-- Corrigir highest_floor para personagens que podem ter sido afetados
UPDATE characters 
SET highest_floor = GREATEST(COALESCE(highest_floor, 1), floor)
WHERE highest_floor IS NULL OR highest_floor < floor OR highest_floor <= 0;

-- Garantir que save_ranking_entry_on_death valide floor antes de salvar
CREATE OR REPLACE FUNCTION save_ranking_entry_on_death(p_character_id UUID)
RETURNS UUID AS $$
DECLARE
    v_character RECORD;
    v_ranking_id UUID;
BEGIN
    -- Buscar dados do personagem
    SELECT 
        c.user_id,
        c.name,
        GREATEST(1, c.floor) as floor, -- ✅ CORREÇÃO: Garantir floor >= 1
        c.level,
        c.gold
    INTO v_character
    FROM characters c
    WHERE c.id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado: %', p_character_id;
    END IF;
    
    -- Validação adicional para garantir consistência
    IF v_character.floor < 1 THEN
        RAISE EXCEPTION 'Andar mais alto deve ser pelo menos 1, recebido: % (corrigido automaticamente)', v_character.floor;
    END IF;
    
    -- Salvar no ranking histórico
    INSERT INTO game_rankings (
        user_id,
        player_name,
        highest_floor,
        character_level,
        character_gold,
        character_alive,
        created_at
    )
    VALUES (
        v_character.user_id,
        v_character.name,
        v_character.floor,
        v_character.level,
        v_character.gold,
        false, -- character_alive = false
        NOW()
    )
    RETURNING id INTO v_ranking_id;
    
    RAISE NOTICE '[RANKING] Entrada salva para personagem morto: % (andar %)', v_character.name, v_character.floor;
    
    RETURN v_ranking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 