-- =====================================
-- MIGRAÇÃO: REBALANCEAMENTO ABRANGENTE PARA VIABILIZAR GUERREIROS
-- =====================================
-- Data: 2024-12-20
-- Versão: 20241220000003
-- Objetivo: Tornar builds de guerreiro viáveis e implementar progressão infinita

-- ❌ PROBLEMAS IDENTIFICADOS:
-- - Stats base muito baixos tornam guerreiros inviáveis
-- - Magos dominam completamente o early game
-- - Dano crítico excessivo mas chance muito baixa
-- - Velocidade sem benefícios tangíveis
-- - Cap artificial de atributos em 50
-- - Progressão limitada

-- ✅ SOLUÇÕES IMPLEMENTADAS:
-- - Stats base aumentados ~25% para viabilidade inicial
-- - Rebalanceamento crítico: menos dano, mais chance
-- - Sistema de duplo ataque baseado em velocidade
-- - Remoção do cap de atributos com progressão logarítmica
-- - Ajuste de dificuldade dos monstros iniciais
-- - Progressão infinita implementada

-- =====================================
-- 0. LIMPAR FUNÇÕES EXISTENTES QUE PODEM CAUSAR CONFLITO
-- =====================================

-- Dropar funções que serão recriadas com tipos diferentes
DROP FUNCTION IF EXISTS recalculate_character_stats_with_balance(UUID);
DROP FUNCTION IF EXISTS recalculate_all_characters_warrior_balance();
DROP FUNCTION IF EXISTS calculate_derived_stats CASCADE;
DROP FUNCTION IF EXISTS calculate_attribute_cost_logarithmic(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS calculate_xp_required_logarithmic(INTEGER);
DROP FUNCTION IF EXISTS scale_monster_stats_early_game(INTEGER, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS distribute_attribute_points_infinite CASCADE;

-- =====================================
-- 1. REMOVER CAP DE ATRIBUTOS E IMPLEMENTAR PROGRESSÃO LOGARÍTMICA
-- =====================================

-- Remover constraints que limitam atributos a 50
ALTER TABLE characters DROP CONSTRAINT IF EXISTS chk_attribute_limits;

-- Função para calcular custo logarítmico de atributos
CREATE FUNCTION calculate_attribute_cost_logarithmic(
    p_current_value INTEGER,
    p_target_value INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_cost INTEGER := 0;
    v_current INTEGER := p_current_value;
BEGIN
    -- Custo logarítmico: mais caro conforme aumenta
    WHILE v_current < p_target_value LOOP
        v_current := v_current + 1;
        
        -- Custo escala logaritmicamente após 50
        IF v_current <= 50 THEN
            v_total_cost := v_total_cost + 1; -- Custo normal até 50
        ELSIF v_current <= 100 THEN
            v_total_cost := v_total_cost + 2; -- 2x mais caro 51-100
        ELSIF v_current <= 200 THEN
            v_total_cost := v_total_cost + 3; -- 3x mais caro 101-200
        ELSIF v_current <= 500 THEN
            v_total_cost := v_total_cost + 5; -- 5x mais caro 201-500
        ELSE
            -- Após 500, custo logarítmico extremo
            v_total_cost := v_total_cost + FLOOR(LOG(v_current - 499) * 10);
        END IF;
    END LOOP;
    
    RETURN v_total_cost;
END;
$$;

-- =====================================
-- 2. FUNÇÃO DE STATS DERIVADOS REBALANCEADA PARA GUERREIROS
-- =====================================

CREATE FUNCTION calculate_derived_stats(
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
    double_attack_chance NUMERIC(5,2) -- NOVO: chance de duplo ataque
)
LANGUAGE plpgsql
AS $$
DECLARE
    -- =====================================
    -- STATS BASE AUMENTADOS PARA VIABILIDADE (~25% MAIOR)
    -- =====================================
    
    base_hp INTEGER := 60 + (p_level * 3);        -- Era 40+2, agora 60+3 (+50% HP)
    base_mana INTEGER := 20 + (p_level * 1.5);    -- Era 15+1, agora 20+1.5 (+33% Mana)
    base_atk INTEGER := 3 + (p_level * 1);        -- Era 1+0.5, agora 3+1 (+200% ATK!)
    base_magic_atk INTEGER := 2 + (p_level * 0.8); -- Era 1+0.5, agora 2+0.8 (+60% Magic)
    base_def INTEGER := 2 + (p_level * 0.5);      -- Era 1+0.3, agora 2+0.5 (+67% DEF)
    base_speed INTEGER := 5 + (p_level * 0.8);    -- Era 3+0.5, agora 5+0.8 (+60% Speed)
    
    -- =====================================
    -- ESCALAMENTO LOGARÍTMICO PARA ALTOS VALORES
    -- =====================================
    
    -- Função logarítmica suave para valores altos
    str_scaling NUMERIC := CASE 
        WHEN p_strength <= 50 THEN POWER(p_strength, 1.3)
        WHEN p_strength <= 100 THEN POWER(50, 1.3) + (p_strength - 50) * POWER(50, 0.3)
        ELSE POWER(50, 1.3) + 50 * POWER(50, 0.3) + (p_strength - 100) * POWER(50, 0.2)
    END;
    
    dex_scaling NUMERIC := CASE 
        WHEN p_dexterity <= 50 THEN POWER(p_dexterity, 1.2)
        WHEN p_dexterity <= 100 THEN POWER(50, 1.2) + (p_dexterity - 50) * POWER(50, 0.2)
        ELSE POWER(50, 1.2) + 50 * POWER(50, 0.2) + (p_dexterity - 100) * POWER(50, 0.15)
    END;
    
    int_scaling NUMERIC := CASE 
        WHEN p_intelligence <= 50 THEN POWER(p_intelligence, 1.25)
        WHEN p_intelligence <= 100 THEN POWER(50, 1.25) + (p_intelligence - 50) * POWER(50, 0.25)
        ELSE POWER(50, 1.25) + 50 * POWER(50, 0.25) + (p_intelligence - 100) * POWER(50, 0.2)
    END;
    
    wis_scaling NUMERIC := CASE 
        WHEN p_wisdom <= 50 THEN POWER(p_wisdom, 1.15)
        WHEN p_wisdom <= 100 THEN POWER(50, 1.15) + (p_wisdom - 50) * POWER(50, 0.15)
        ELSE POWER(50, 1.15) + 50 * POWER(50, 0.15) + (p_wisdom - 100) * POWER(50, 0.1)
    END;
    
    vit_scaling NUMERIC := CASE 
        WHEN p_vitality <= 50 THEN POWER(p_vitality, 1.2)
        WHEN p_vitality <= 100 THEN POWER(50, 1.2) + (p_vitality - 50) * POWER(50, 0.2)
        ELSE POWER(50, 1.2) + 50 * POWER(50, 0.2) + (p_vitality - 100) * POWER(50, 0.15)
    END;
    
    luck_scaling NUMERIC := p_luck * 1.0; -- Linear, mas sem penalidade agora
    
    -- Habilidades com maior impacto
    weapon_mastery_bonus NUMERIC := POWER(GREATEST(p_sword_mastery, p_axe_mastery, p_blunt_mastery), 1.15) * 0.8; -- Era 0.2, agora 0.8
    defense_mastery_bonus NUMERIC := POWER(p_defense_mastery, 1.2) * 1.0; -- Era 0.4, agora 1.0
    magic_mastery_bonus NUMERIC := POWER(p_magic_mastery, 1.2) * 1.2;    -- Era 0.8, agora 1.2
    
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
    -- =====================================
    -- CÁLCULOS REBALANCEADOS PARA GUERREIROS
    -- =====================================
    
    -- HP: Vitalidade importante mas guerreiros têm base decente
    v_hp := base_hp + ROUND(vit_scaling * 3.5);  -- Aumentado de 2.5 para 3.5
    
    -- MANA: INT/WIS críticos para magos
    v_mana := base_mana + ROUND(int_scaling * 1.8) + ROUND(wis_scaling * 1.4) + ROUND(magic_mastery_bonus * 0.8);
    
    -- ATAQUE FÍSICO: Força + armas mais efetivas 
    v_atk := base_atk + ROUND(str_scaling * 1.8) + ROUND(weapon_mastery_bonus * 1.2);  -- Aumentado de 1.2 para 1.8
    
    -- ATAQUE MÁGICO: Balanceado mas não nerfado
    v_magic_atk := base_magic_atk + ROUND(int_scaling * 1.6) + ROUND(wis_scaling * 0.8) + ROUND(magic_mastery_bonus * 1.0);
    
    -- DEFESA: Melhor escalamento
    v_def := base_def + ROUND(vit_scaling * 0.8) + ROUND(wis_scaling * 0.6) + ROUND(defense_mastery_bonus * 1.2);  -- Aumentado
    
    -- VELOCIDADE: Importante para duplo ataque
    v_speed := base_speed + ROUND(dex_scaling * 1.2);  -- Aumentado de 0.8 para 1.2
    
    -- =====================================
    -- SISTEMA DE CRÍTICOS REBALANCEADO
    -- =====================================
    
    -- Chance crítica: Maior e mais acessível
    v_crit_chance := LEAST(85, (luck_scaling * 0.6) + (dex_scaling * 0.4) + (weapon_mastery_bonus * 0.2));  -- Cap 85%, mais acessível
    
    -- Dano crítico: MENOR base, crescimento moderado
    v_crit_damage := 110 + (luck_scaling * 0.4) + (str_scaling * 0.3) + (weapon_mastery_bonus * 0.2);  -- Base 110% (era 130%)
    
    -- =====================================
    -- NOVO: SISTEMA DE DUPLO ATAQUE
    -- =====================================
    
    -- Chance de duplo ataque baseada em velocidade alta
    v_double_attack_chance := CASE
        WHEN v_speed >= 50 THEN LEAST(25, (v_speed - 49) * 0.5) -- Max 25% chance
        ELSE 0
    END;
    
    -- =====================================
    -- DANO MÁGICO COMO % (COMPATIBILIDADE)
    -- =====================================
    
    v_magic_dmg_bonus := (v_magic_atk - base_magic_atk) * 1.8;  -- Era 2.0, agora 1.8
    v_magic_dmg_bonus := LEAST(500, v_magic_dmg_bonus); -- Cap aumentado de 400 para 500
    
    -- =====================================
    -- RETORNO DOS VALORES REBALANCEADOS
    -- =====================================
    
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
-- 3. PROGRESSÃO INFINITA COM XP LOGARÍTMICO
-- =====================================

-- Função para calcular XP necessário com progressão logarítmica
CREATE FUNCTION calculate_xp_required_logarithmic(p_level INTEGER)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_xp_required BIGINT;
BEGIN
    -- Progressão normal até nível 100
    IF p_level <= 100 THEN
        v_xp_required := 100 * POWER(1.05, p_level - 1);
    -- Progressão mais lenta 101-500
    ELSIF p_level <= 500 THEN
        v_xp_required := 100 * POWER(1.05, 99) * POWER(1.02, p_level - 100);
    -- Progressão mais lenta 501-1000
    ELSIF p_level <= 1000 THEN
        v_xp_required := 100 * POWER(1.05, 99) * POWER(1.02, 400) * POWER(1.01, p_level - 500);
    -- Progressão logarítmica extrema após 1000
    ELSE
        v_xp_required := 100 * POWER(1.05, 99) * POWER(1.02, 400) * POWER(1.01, 500) 
                        * POWER(LOG(p_level - 999), 3);
    END IF;
    
    RETURN FLOOR(v_xp_required);
END;
$$;

-- =====================================
-- 4. AJUSTAR DIFICULDADE DOS MONSTROS INICIAIS
-- =====================================

-- Função para reduzir stats dos monstros nos primeiros andares
CREATE FUNCTION scale_monster_stats_early_game(
    p_floor INTEGER,
    p_base_hp INTEGER,
    p_base_atk INTEGER,
    p_base_def INTEGER
)
RETURNS TABLE(
    scaled_hp INTEGER,
    scaled_atk INTEGER,
    scaled_def INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_early_game_reduction NUMERIC := 1.0;
BEGIN
    -- Reduzir stats dos monstros nos primeiros 20 andares
    IF p_floor <= 10 THEN
        v_early_game_reduction := 0.7; -- 30% mais fracos
    ELSIF p_floor <= 20 THEN
        v_early_game_reduction := 0.8; -- 20% mais fracos
    ELSIF p_floor <= 30 THEN
        v_early_game_reduction := 0.9; -- 10% mais fracos
    END IF;
    
    RETURN QUERY SELECT
        FLOOR(p_base_hp * v_early_game_reduction)::INTEGER,
        FLOOR(p_base_atk * v_early_game_reduction)::INTEGER,
        FLOOR(p_base_def * v_early_game_reduction)::INTEGER;
END;
$$;

-- =====================================
-- 5. ATUALIZAR SISTEMA DE DISTRIBUIÇÃO DE ATRIBUTOS
-- =====================================

-- Função melhorada para distribuição com custo logarítmico
CREATE FUNCTION distribute_attribute_points_infinite(
    p_character_id UUID,
    p_strength_increase INTEGER DEFAULT 0,
    p_dexterity_increase INTEGER DEFAULT 0,
    p_intelligence_increase INTEGER DEFAULT 0,
    p_wisdom_increase INTEGER DEFAULT 0,
    p_vitality_increase INTEGER DEFAULT 0,
    p_luck_increase INTEGER DEFAULT 0
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    points_spent INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_character RECORD;
    v_total_cost INTEGER := 0;
    v_current_points INTEGER;
BEGIN
    -- Buscar personagem
    SELECT * INTO v_character FROM characters WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Personagem não encontrado', 0;
        RETURN;
    END IF;
    
    -- Calcular custo total usando função logarítmica
    v_total_cost := v_total_cost + calculate_attribute_cost_logarithmic(v_character.strength, v_character.strength + p_strength_increase);
    v_total_cost := v_total_cost + calculate_attribute_cost_logarithmic(v_character.dexterity, v_character.dexterity + p_dexterity_increase);
    v_total_cost := v_total_cost + calculate_attribute_cost_logarithmic(v_character.intelligence, v_character.intelligence + p_intelligence_increase);
    v_total_cost := v_total_cost + calculate_attribute_cost_logarithmic(v_character.wisdom, v_character.wisdom + p_wisdom_increase);
    v_total_cost := v_total_cost + calculate_attribute_cost_logarithmic(v_character.vitality, v_character.vitality + p_vitality_increase);
    v_total_cost := v_total_cost + calculate_attribute_cost_logarithmic(v_character.luck, v_character.luck + p_luck_increase);
    
    -- Verificar se tem pontos suficientes
    IF v_character.attribute_points < v_total_cost THEN
        RETURN QUERY SELECT FALSE, 
            FORMAT('Pontos insuficientes. Necessário: %s, Disponível: %s', v_total_cost, v_character.attribute_points),
            v_total_cost;
        RETURN;
    END IF;
    
    -- Aplicar mudanças
    UPDATE characters SET
        strength = strength + p_strength_increase,
        dexterity = dexterity + p_dexterity_increase,
        intelligence = intelligence + p_intelligence_increase,
        wisdom = wisdom + p_wisdom_increase,
        vitality = vitality + p_vitality_increase,
        luck = luck + p_luck_increase,
        attribute_points = attribute_points - v_total_cost,
        updated_at = NOW()
    WHERE id = p_character_id;
    
    -- Recalcular stats derivados
    PERFORM recalculate_character_stats_with_balance(p_character_id);
    
    RETURN QUERY SELECT TRUE, 
        FORMAT('Atributos distribuídos com sucesso! Pontos gastos: %s', v_total_cost),
        v_total_cost;
END;
$$;

-- =====================================
-- 6. ATUALIZAR FUNÇÃO DE RECÁLCULO GERAL
-- =====================================

CREATE FUNCTION recalculate_character_stats_with_balance(p_character_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_character RECORD;
    v_derived_stats RECORD;
BEGIN
    -- Buscar dados do personagem
    SELECT * INTO v_character FROM characters WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado: %', p_character_id;
    END IF;
    
    -- Calcular stats derivados com a nova função
    SELECT * INTO v_derived_stats FROM calculate_derived_stats(
        v_character.level,
        COALESCE(v_character.strength, 10),
        COALESCE(v_character.dexterity, 10),
        COALESCE(v_character.intelligence, 10),
        COALESCE(v_character.wisdom, 10),
        COALESCE(v_character.vitality, 10),
        COALESCE(v_character.luck, 10),
        COALESCE(v_character.sword_mastery, 1),
        COALESCE(v_character.axe_mastery, 1),
        COALESCE(v_character.blunt_mastery, 1),
        COALESCE(v_character.defense_mastery, 1),
        COALESCE(v_character.magic_mastery, 1)
    );
    
    -- Atualizar personagem com novos stats
    UPDATE characters SET
        hp = LEAST(v_derived_stats.hp, hp + (v_derived_stats.hp - COALESCE(max_hp, v_derived_stats.hp))), -- Manter HP atual se possível
        max_hp = v_derived_stats.max_hp,
        mana = LEAST(v_derived_stats.mana, mana + (v_derived_stats.mana - COALESCE(max_mana, v_derived_stats.mana))), -- Manter Mana atual se possível
        max_mana = v_derived_stats.max_mana,
        atk = v_derived_stats.atk,
        magic_attack = v_derived_stats.magic_attack,
        def = v_derived_stats.def,
        speed = v_derived_stats.speed,
        critical_chance = v_derived_stats.critical_chance,
        critical_damage = v_derived_stats.critical_damage,
        double_attack_chance = v_derived_stats.double_attack_chance, -- NOVO: campo duplo ataque
        updated_at = NOW()
    WHERE id = p_character_id;
END;
$$;

-- =====================================
-- 7. RECALCULAR TODOS OS PERSONAGENS EXISTENTES
-- =====================================

-- Função para recalcular todos com o novo sistema
CREATE FUNCTION recalculate_all_characters_warrior_balance()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_character_record RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_character_record IN SELECT id FROM characters WHERE is_alive = true
    LOOP
        BEGIN
            PERFORM recalculate_character_stats_with_balance(v_character_record.id);
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Erro ao recalcular personagem %: %', v_character_record.id, SQLERRM;
        END;
    END LOOP;
    
    RETURN v_count;
END;
$$;

-- =====================================
-- 8. ADICIONAR CAMPO PARA DUPLO ATAQUE
-- =====================================

-- Adicionar campo para tracking de duplo ataque se não existe
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS double_attack_chance NUMERIC(5,2) DEFAULT 0;

-- =====================================
-- 9. EXECUTAR RECÁLCULO GERAL
-- =====================================

-- Aplicar o novo balanceamento a todos os personagens
SELECT recalculate_all_characters_warrior_balance();

-- =====================================
-- 10. ÍNDICES PARA PERFORMANCE
-- =====================================

CREATE INDEX IF NOT EXISTS idx_characters_double_attack_chance ON characters(double_attack_chance);
CREATE INDEX IF NOT EXISTS idx_characters_high_attributes ON characters(strength, dexterity, intelligence, wisdom, vitality, luck);

-- =====================================
-- 11. COMENTÁRIOS PARA TRACKING
-- =====================================

COMMENT ON FUNCTION calculate_derived_stats IS 'Função rebalanceada v3.0 - Viabiliza guerreiros, progressão infinita';
COMMENT ON FUNCTION calculate_attribute_cost_logarithmic IS 'Sistema de custo logarítmico para progressão infinita';
COMMENT ON FUNCTION calculate_xp_required_logarithmic IS 'XP logarítmico com dificuldade após nível 1000';
COMMENT ON FUNCTION distribute_attribute_points_infinite IS 'Distribuição sem caps com custo progressivo';

-- Confirmar aplicação
SELECT 'Rebalanceamento para guerreiros aplicado com sucesso!' as status; 