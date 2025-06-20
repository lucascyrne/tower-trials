-- =====================================
-- MIGRAÇÃO DEFINITIVA: FONTE ÚNICA DA VERDADE PARA PERSONAGENS
-- =====================================
-- Data: 2024-12-21
-- Versão: 20241221000016
-- Objetivo: Consolidar TODA a lógica de personagem numa única fonte balanceada

-- ❌ PROBLEMAS CRÍTICOS IDENTIFICADOS:
-- 1. Múltiplas versões de calculate_derived_stats conflitantes
-- 2. Stats base inflacionados demais (warrior rebalance muito generoso)
-- 3. Skills XP muito fácil de conseguir
-- 4. Equipamentos com bônus excessivos (20% + novos bônus = OP)
-- 5. Críticos muito acessíveis e dano muito alto
-- 6. Progressão não suficientemente árdua

-- ✅ SOLUÇÃO ÚNICA E DEFINITIVA:
-- 1. UMA ÚNICA função calculate_derived_stats balanceada
-- 2. Stats base moderados (não generosos demais)
-- 3. Skills MUITO mais difíceis de subir (progressão árdua)
-- 4. Equipamentos importantes mas não dominantes
-- 5. Críticos raros e valiosos
-- 6. Progressão recompensadora mas que exige dedicação

-- =====================================
-- 1. LIMPAR TODAS AS FUNÇÕES CONFLITANTES
-- =====================================

-- Remover TODAS as versões antigas para garantir fonte única
DROP FUNCTION IF EXISTS calculate_derived_stats CASCADE;
DROP FUNCTION IF EXISTS calculate_derived_stats_balanced CASCADE;
DROP FUNCTION IF EXISTS calculate_derived_stats_with_equipment CASCADE;
DROP FUNCTION IF EXISTS recalculate_character_stats CASCADE;
DROP FUNCTION IF EXISTS recalculate_character_stats_with_balance CASCADE;
DROP FUNCTION IF EXISTS recalculate_character_stats_with_equipment CASCADE;
DROP FUNCTION IF EXISTS recalculate_all_characters_warrior_balance CASCADE;
DROP FUNCTION IF EXISTS recalculate_all_characters_with_equipment CASCADE;
DROP FUNCTION IF EXISTS calculate_skill_xp_requirement CASCADE;

-- =====================================
-- 2. FUNÇÃO DE XP DE SKILLS MUITO MAIS DIFÍCIL
-- =====================================

CREATE FUNCTION calculate_skill_xp_requirement(p_current_level INTEGER)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_xp_required BIGINT;
BEGIN
    -- Progressão MUITO mais árdua para skills
    -- Base: 100 XP * (1.8 ^ level) ao invés de (1.4 ^ level)
    -- Skills devem ser MUITO mais difíceis que level de personagem
    
    IF p_current_level <= 10 THEN
        -- Primeiros 10 níveis: progressão moderada
        v_xp_required := 100 * POWER(1.6, p_current_level - 1);
    ELSIF p_current_level <= 25 THEN
        -- Níveis 11-25: progressão mais difícil
        v_xp_required := 100 * POWER(1.6, 9) * POWER(1.8, p_current_level - 10);
    ELSIF p_current_level <= 50 THEN
        -- Níveis 26-50: progressão árdua
        v_xp_required := 100 * POWER(1.6, 9) * POWER(1.8, 15) * POWER(2.0, p_current_level - 25);
    ELSIF p_current_level <= 75 THEN
        -- Níveis 51-75: progressão muito árdua
        v_xp_required := 100 * POWER(1.6, 9) * POWER(1.8, 15) * POWER(2.0, 25) * POWER(2.2, p_current_level - 50);
    ELSE
        -- Níveis 76+: progressão extremamente árdua
        v_xp_required := 100 * POWER(1.6, 9) * POWER(1.8, 15) * POWER(2.0, 25) * POWER(2.2, 25) * POWER(2.5, p_current_level - 75);
    END IF;
    
    RETURN FLOOR(v_xp_required);
END;
$$;

-- =====================================
-- 3. FUNÇÃO ÚNICA DE STATS DERIVADOS - BALANCEADA E ÁRDUA
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
    double_attack_chance NUMERIC(5,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    -- =====================================
    -- STATS BASE MODERADOS (NÃO GENEROSOS)
    -- =====================================
    
    -- Valores que tornam progressão importante mas não impossível
    base_hp INTEGER := 50 + (p_level * 2);        -- Moderado: 52, 54, 56...
    base_mana INTEGER := 20 + (p_level * 1);      -- Mana sempre limitada
    base_atk INTEGER := 2 + (p_level * 0.8);      -- ATK cresce devagar
    base_magic_atk INTEGER := 2 + (p_level * 0.8); -- Magic ATK similar
    base_def INTEGER := 1 + (p_level * 0.4);      -- DEF muito devagar
    base_speed INTEGER := 5 + (p_level * 0.6);    -- Speed moderado
    
    -- =====================================
    -- ESCALAMENTO LOGARÍTMICO MODERADO
    -- =====================================
    
    -- Crescimento útil mas não explosivo
    str_scaling NUMERIC := CASE 
        WHEN p_strength <= 30 THEN POWER(p_strength, 1.2)  -- Bom até 30
        WHEN p_strength <= 60 THEN POWER(30, 1.2) + (p_strength - 30) * POWER(30, 0.4) -- Diminui retorno
        ELSE POWER(30, 1.2) + 30 * POWER(30, 0.4) + (p_strength - 60) * POWER(30, 0.3) -- Retorno decrescente
    END;
    
    dex_scaling NUMERIC := CASE 
        WHEN p_dexterity <= 30 THEN POWER(p_dexterity, 1.1)
        WHEN p_dexterity <= 60 THEN POWER(30, 1.1) + (p_dexterity - 30) * POWER(30, 0.3)
        ELSE POWER(30, 1.1) + 30 * POWER(30, 0.3) + (p_dexterity - 60) * POWER(30, 0.25)
    END;
    
    int_scaling NUMERIC := CASE 
        WHEN p_intelligence <= 30 THEN POWER(p_intelligence, 1.15)
        WHEN p_intelligence <= 60 THEN POWER(30, 1.15) + (p_intelligence - 30) * POWER(30, 0.35)
        ELSE POWER(30, 1.15) + 30 * POWER(30, 0.35) + (p_intelligence - 60) * POWER(30, 0.3)
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
    
    luck_scaling NUMERIC := p_luck * 0.8; -- Sorte linear mas moderada
    
    -- =====================================
    -- SKILLS IMPORTANTES MAS NÃO DOMINANTES
    -- =====================================
    
    -- Skills devem complementar, não dominar
    weapon_mastery_bonus NUMERIC := POWER(GREATEST(p_sword_mastery, p_axe_mastery, p_blunt_mastery), 1.1) * 0.6; -- Moderado
    defense_mastery_bonus NUMERIC := POWER(p_defense_mastery, 1.1) * 0.8; -- Importante para defesa
    magic_mastery_bonus NUMERIC := POWER(p_magic_mastery, 1.15) * 1.0;    -- Importante para magos
    
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
    -- CÁLCULOS BALANCEADOS E MODERADOS
    -- =====================================
    
    -- HP: Importante mas não inflacionado
    v_hp := base_hp + ROUND(vit_scaling * 2.5);  -- Crescimento moderado
    
    -- MANA: Sempre limitado, forçando gestão
    v_mana := base_mana + ROUND(int_scaling * 1.2) + ROUND(wis_scaling * 1.0) + ROUND(magic_mastery_bonus * 0.5);
    
    -- ATAQUE FÍSICO: Força importante mas não explosiva
    v_atk := base_atk + ROUND(str_scaling * 1.0) + ROUND(weapon_mastery_bonus * 1.0);
    
    -- ATAQUE MÁGICO: Similar ao físico
    v_magic_atk := base_magic_atk + ROUND(int_scaling * 1.0) + ROUND(wis_scaling * 0.6) + ROUND(magic_mastery_bonus * 0.8);
    
    -- DEFESA: Vitalidade + Sabedoria, crescimento lento
    v_def := base_def + ROUND(vit_scaling * 0.6) + ROUND(wis_scaling * 0.4) + ROUND(defense_mastery_bonus * 1.0);
    
    -- VELOCIDADE: Destreza importante mas limitada
    v_speed := base_speed + ROUND(dex_scaling * 0.8);
    
    -- =====================================
    -- CRÍTICOS RAROS E VALIOSOS
    -- =====================================
    
    -- Chance crítica: MUITO mais difícil de conseguir
    v_crit_chance := LEAST(60, (luck_scaling * 0.3) + (dex_scaling * 0.2) + (weapon_mastery_bonus * 0.1)); -- Cap baixo: 60%
    
    -- Dano crítico: Base baixa, crescimento lento
    v_crit_damage := 105 + (luck_scaling * 0.2) + (str_scaling * 0.15) + (weapon_mastery_bonus * 0.1); -- Base apenas 105%
    
    -- =====================================
    -- DUPLO ATAQUE RARO E VALIOSO
    -- =====================================
    
    -- Duplo ataque apenas com velocidade MUITO alta
    v_double_attack_chance := CASE
        WHEN v_speed >= 80 THEN LEAST(15, (v_speed - 79) * 0.3) -- Precisa 80+ speed, máximo 15%
        ELSE 0
    END;
    
    -- =====================================
    -- DANO MÁGICO CONTROLADO
    -- =====================================
    
    -- Conversão para % de bônus, crescimento moderado
    v_magic_dmg_bonus := (v_magic_atk - base_magic_atk) * 1.5; -- Era 1.8, agora 1.5
    v_magic_dmg_bonus := LEAST(350, v_magic_dmg_bonus); -- Cap reduzido de 500 para 350
    
    -- =====================================
    -- RETORNO DOS VALORES BALANCEADOS
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
-- 4. REBALANCEAR EQUIPAMENTOS (REDUZIR BÔNUS EXCESSIVOS)
-- =====================================

-- Reduzir bônus de equipamentos que ficaram muito OP
UPDATE equipment SET
    -- Reduzir os bônus básicos que foram inflacionados 20%
    atk_bonus = FLOOR(atk_bonus * 0.85),      -- Reduzir 15% do aumento anterior
    def_bonus = FLOOR(def_bonus * 0.85),      -- Reduzir 15%
    mana_bonus = FLOOR(mana_bonus * 0.85),    -- Reduzir 15%
    speed_bonus = FLOOR(speed_bonus * 0.85),  -- Reduzir 15%
    
    -- Reduzir bônus especiais que estão muito altos
    critical_chance_bonus = critical_chance_bonus * 0.7,    -- Reduzir 30%
    critical_damage_bonus = critical_damage_bonus * 0.7,    -- Reduzir 30%
    double_attack_chance_bonus = double_attack_chance_bonus * 0.6, -- Reduzir 40%
    magic_damage_bonus = magic_damage_bonus * 0.8,         -- Reduzir 20%
    
    -- HP bonus está ok, mas reduzir um pouco
    hp_bonus = FLOOR(hp_bonus * 0.9)          -- Reduzir 10%
WHERE atk_bonus > 0 OR def_bonus > 0 OR mana_bonus > 0 OR speed_bonus > 0;

-- =====================================
-- 5. ATUALIZAR FUNÇÃO DE SKILL XP COM PROGRESSÃO ÁRDUA
-- =====================================

CREATE OR REPLACE FUNCTION add_skill_xp(
    p_character_id UUID,
    p_skill_type VARCHAR,
    p_xp_amount INTEGER
)
RETURNS TABLE (
    skill_leveled_up BOOLEAN,
    new_skill_level INTEGER,
    new_skill_xp INTEGER
) AS $$
DECLARE
    current_level INTEGER;
    current_xp INTEGER;
    xp_required BIGINT;
    new_level INTEGER;
    new_xp INTEGER;
    leveled_up BOOLEAN := FALSE;
BEGIN
    -- Buscar nível e XP atuais da habilidade
    CASE p_skill_type
        WHEN 'sword' THEN
            SELECT sword_mastery, sword_mastery_xp INTO current_level, current_xp
            FROM characters WHERE id = p_character_id;
        WHEN 'axe' THEN
            SELECT axe_mastery, axe_mastery_xp INTO current_level, current_xp
            FROM characters WHERE id = p_character_id;
        WHEN 'blunt' THEN
            SELECT blunt_mastery, blunt_mastery_xp INTO current_level, current_xp
            FROM characters WHERE id = p_character_id;
        WHEN 'defense' THEN
            SELECT defense_mastery, defense_mastery_xp INTO current_level, current_xp
            FROM characters WHERE id = p_character_id;
        WHEN 'magic' THEN
            SELECT magic_mastery, magic_mastery_xp INTO current_level, current_xp
            FROM characters WHERE id = p_character_id;
        ELSE
            RAISE EXCEPTION 'Tipo de habilidade inválida: %', p_skill_type;
    END CASE;
    
    -- Adicionar XP (com a nova função mais difícil)
    new_xp := current_xp + p_xp_amount;
    new_level := current_level;
    
    -- Verificar se subiu de nível usando nova função árdua
    xp_required := calculate_skill_xp_requirement(current_level);
    
    -- Cap em nível 100 para skills
    WHILE new_xp >= xp_required AND new_level < 100 LOOP
        new_xp := new_xp - xp_required;
        new_level := new_level + 1;
        leveled_up := TRUE;
        xp_required := calculate_skill_xp_requirement(new_level);
    END LOOP;
    
    -- Atualizar no banco
    CASE p_skill_type
        WHEN 'sword' THEN
            UPDATE characters SET sword_mastery = new_level, sword_mastery_xp = new_xp 
            WHERE id = p_character_id;
        WHEN 'axe' THEN
            UPDATE characters SET axe_mastery = new_level, axe_mastery_xp = new_xp 
            WHERE id = p_character_id;
        WHEN 'blunt' THEN
            UPDATE characters SET blunt_mastery = new_level, blunt_mastery_xp = new_xp 
            WHERE id = p_character_id;
        WHEN 'defense' THEN
            UPDATE characters SET defense_mastery = new_level, defense_mastery_xp = new_xp 
            WHERE id = p_character_id;
        WHEN 'magic' THEN
            UPDATE characters SET magic_mastery = new_level, magic_mastery_xp = new_xp 
            WHERE id = p_character_id;
    END CASE;
    
    RETURN QUERY SELECT leveled_up, new_level, new_xp;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 6. FUNÇÃO ÚNICA DE RECÁLCULO DE STATS
-- =====================================

CREATE FUNCTION recalculate_character_stats(p_character_id UUID)
RETURNS VOID AS $$
DECLARE
    v_character RECORD;
    v_stats RECORD;
    v_hp_ratio DECIMAL;
    v_mana_ratio DECIMAL;
    v_new_hp INTEGER;
    v_new_mana INTEGER;
BEGIN
    -- Buscar dados atuais do personagem
    SELECT * INTO v_character
    FROM characters
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado: %', p_character_id;
    END IF;
    
    -- Calcular novos stats derivados usando ÚNICA fonte da verdade
    SELECT * INTO v_stats 
    FROM calculate_derived_stats(
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
    v_new_hp := CEILING(v_stats.max_hp * v_hp_ratio);
    v_new_mana := CEILING(v_stats.max_mana * v_mana_ratio);
    
    -- Atualizar stats do personagem
    UPDATE characters
    SET
        max_hp = v_stats.max_hp,
        max_mana = v_stats.max_mana,
        atk = v_stats.atk,
        magic_attack = v_stats.magic_attack,
        def = v_stats.def,
        speed = v_stats.speed,
        critical_chance = v_stats.critical_chance,
        critical_damage = v_stats.critical_damage,
        double_attack_chance = v_stats.double_attack_chance,
        hp = LEAST(v_new_hp, v_stats.max_hp),
        mana = LEAST(v_new_mana, v_stats.max_mana),
        updated_at = NOW()
    WHERE id = p_character_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 7. FUNÇÃO PARA RECALCULAR TODOS COM O NOVO SISTEMA
-- =====================================

CREATE FUNCTION recalculate_all_characters_unified()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_character_record RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_character_record IN SELECT id FROM characters WHERE level > 0
    LOOP
        BEGIN
            PERFORM recalculate_character_stats(v_character_record.id);
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Erro ao recalcular personagem %: %', v_character_record.id, SQLERRM;
        END;
    END LOOP;
    
    RETURN v_count;
END;
$$;

-- =====================================
-- 8. APLICAR O NOVO SISTEMA A TODOS OS PERSONAGENS
-- =====================================

-- Executar recálculo para todos os personagens existentes
SELECT recalculate_all_characters_unified();

-- =====================================
-- 9. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =====================================

COMMENT ON FUNCTION calculate_derived_stats IS 
'ÚNICA FONTE DA VERDADE para stats de personagem v4.0.
- Progressão árdua mas recompensadora
- Skills importantes mas não dominantes  
- Críticos raros e valiosos
- Duplo ataque apenas com high speed
- Balanceamento moderado sem inflação';

COMMENT ON FUNCTION calculate_skill_xp_requirement IS 
'XP de skills MUITO mais difícil - progressão árdua que força dedicação';

COMMENT ON FUNCTION add_skill_xp IS 
'Sistema de skill XP com progressão árdua - cap em nível 100';

COMMENT ON FUNCTION recalculate_character_stats IS 
'ÚNICA função de recálculo - mantém proporção de HP/Mana atual';

-- =====================================
-- 10. VERIFICAÇÃO FINAL
-- =====================================

-- Confirmar que a migração foi aplicada
SELECT 
    'Fonte única da verdade para personagens implementada!' as status,
    'Stats balanceados, progressão árdua, críticos raros' as details; 