-- =====================================================
-- MIGRATION: Remove Diversity System & Ultra Low Values
-- Data: 2024-12-21
-- Autor: Sistema de Rebalanceamento
-- 
-- OBJETIVO: Remover completamente o sistema de diversidade de build
-- e aplicar valores ultra baixos para personagens nível 1
-- =====================================================

-- Função atualizada de cálculo de stats derivados SEM diversidade
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
) RETURNS TABLE (
    hp INTEGER,
    max_hp INTEGER,
    mana INTEGER,
    max_mana INTEGER,
    atk INTEGER,
    magic_attack INTEGER,
    def INTEGER,
    speed INTEGER,
    critical_chance NUMERIC(10,2),
    critical_damage NUMERIC(10,2),
    magic_damage_bonus NUMERIC(10,2),
    double_attack_chance NUMERIC(10,2)
) 
LANGUAGE plpgsql
AS $$
DECLARE
    -- Valores base mínimos
    base_hp INTEGER;
    base_mana INTEGER;
    base_atk INTEGER;
    base_def INTEGER;
    base_speed INTEGER;
    
    -- Escalamento simplificado SEM diversidade
    str_scaling NUMERIC;
    dex_scaling NUMERIC;
    int_scaling NUMERIC;
    wis_scaling NUMERIC;
    vit_scaling NUMERIC;
    luck_scaling NUMERIC;
    
    -- Masteries simplificadas
    weapon_mastery_bonus NUMERIC;
    def_mastery_bonus NUMERIC;
    magic_mastery_bonus NUMERIC;
    
    -- Componentes de HP
    hp_from_base INTEGER;
    hp_from_vitality INTEGER;
    hp_from_strength INTEGER;
    calculated_total_hp INTEGER;
    
    -- Componentes de Mana
    mana_from_base INTEGER;
    mana_from_intelligence INTEGER;
    mana_from_wisdom INTEGER;
    mana_from_magic_mastery INTEGER;
    calculated_total_mana INTEGER;
    
    -- Componentes de ATK
    atk_from_base INTEGER;
    atk_from_strength INTEGER;
    atk_from_weapon_mastery INTEGER;
    atk_from_dexterity INTEGER;
    calculated_total_atk INTEGER;
    
    -- Componentes de Magic ATK
    magic_atk_from_base INTEGER;
    magic_atk_from_intelligence INTEGER;
    magic_atk_from_wisdom INTEGER;
    magic_atk_from_magic_mastery INTEGER;
    calculated_total_magic_atk INTEGER;
    
    -- Componentes de DEF
    def_from_base INTEGER;
    def_from_vitality INTEGER;
    def_from_wisdom INTEGER;
    def_from_defense_mastery INTEGER;
    calculated_total_def INTEGER;
    
    -- Componentes de Speed
    speed_from_base INTEGER;
    speed_from_dexterity INTEGER;
    speed_from_luck INTEGER;
    calculated_total_speed INTEGER;
    
    -- Componentes de Critical
    critical_chance_base NUMERIC;
    crit_chance_from_dexterity NUMERIC;
    crit_chance_from_luck NUMERIC;
    crit_chance_from_strength NUMERIC;
    crit_chance_from_weapon_mastery NUMERIC;
    calculated_crit_chance NUMERIC;
    
    -- Componentes de Critical Damage
    critical_damage_base NUMERIC;
    crit_damage_from_strength NUMERIC;
    crit_damage_from_luck NUMERIC;
    crit_damage_from_weapon_mastery NUMERIC;
    calculated_crit_damage NUMERIC;
    
    -- Componentes de Magic Damage
    magic_damage_base NUMERIC;
    magic_damage_from_intelligence NUMERIC;
    magic_damage_from_wisdom NUMERIC;
    magic_damage_from_magic_mastery NUMERIC;
    raw_magic_damage NUMERIC;
    calculated_magic_damage NUMERIC;
    
    -- Componentes de Double Attack
    double_attack_from_dexterity NUMERIC;
    double_attack_from_luck NUMERIC;
    calculated_double_attack NUMERIC;
BEGIN
    -- =====================================
    -- VALORES BASE MÍNIMOS
    -- =====================================
    base_hp := 50 + p_level * 2;
    base_mana := 20 + p_level * 1;
    base_atk := 2 + p_level;
    base_def := 1 + p_level;
    base_speed := 3 + p_level;
    
    -- =====================================
    -- ESCALAMENTO SIMPLES SEM DIVERSIDADE
    -- =====================================
    str_scaling := POWER(p_strength, 1.1);   -- Reduzido de 1.2
    dex_scaling := POWER(p_dexterity, 1.1);  -- Reduzido de 1.15
    int_scaling := POWER(p_intelligence, 1.1); -- Reduzido de 1.25
    wis_scaling := POWER(p_wisdom, 1.05);    -- Reduzido de 1.1
    vit_scaling := POWER(p_vitality, 1.2);   -- Reduzido de 1.3
    luck_scaling := p_luck;                   -- Sem escalamento
    
    -- =====================================
    -- MASTERIES SIMPLIFICADAS
    -- =====================================
    weapon_mastery_bonus := POWER(GREATEST(p_sword_mastery, p_axe_mastery, p_blunt_mastery), 1.05);
    def_mastery_bonus := POWER(p_defense_mastery, 1.1);
    magic_mastery_bonus := POWER(p_magic_mastery, 1.05);
    
    -- =====================================
    -- CÁLCULOS FINAIS COM VALORES ULTRA BAIXOS
    -- =====================================
    
    -- HP: Base + escalamento mínimo
    hp_from_base := base_hp;
    hp_from_vitality := FLOOR(vit_scaling * 1.5);  -- Reduzido de 2.5
    hp_from_strength := FLOOR(str_scaling * 0.2);  -- Reduzido de 0.3
    calculated_total_hp := hp_from_base + hp_from_vitality + hp_from_strength;
    
    -- Mana: Base + escalamento mínimo
    mana_from_base := base_mana;
    mana_from_intelligence := FLOOR(int_scaling * 1.0);  -- Reduzido de 1.5
    mana_from_wisdom := FLOOR(wis_scaling * 0.8);        -- Reduzido de 1.0
    mana_from_magic_mastery := FLOOR(magic_mastery_bonus * 0.5);  -- Reduzido de 0.8
    calculated_total_mana := mana_from_base + mana_from_intelligence + mana_from_wisdom + mana_from_magic_mastery;
    
    -- ATK: Base + escalamento baixo
    atk_from_base := base_atk;
    atk_from_strength := FLOOR(str_scaling * 0.8);      -- Reduzido de 1.2
    atk_from_weapon_mastery := FLOOR(weapon_mastery_bonus * 0.4);  -- Reduzido de 0.6
    atk_from_dexterity := FLOOR(dex_scaling * 0.1);     -- Reduzido de 0.2
    calculated_total_atk := atk_from_base + atk_from_strength + atk_from_weapon_mastery + atk_from_dexterity;
    
    -- Magic ATK: Baseado em INT/WIS
    magic_atk_from_base := base_atk;
    magic_atk_from_intelligence := FLOOR(int_scaling * 0.8);  -- Reduzido de 1.4
    magic_atk_from_wisdom := FLOOR(wis_scaling * 0.4);        -- Reduzido de 0.8
    magic_atk_from_magic_mastery := FLOOR(magic_mastery_bonus * 0.6);  -- Reduzido de 1.0
    calculated_total_magic_atk := magic_atk_from_base + magic_atk_from_intelligence + magic_atk_from_wisdom + magic_atk_from_magic_mastery;
    
    -- DEF: Base + escalamento baixo
    def_from_base := base_def;
    def_from_vitality := FLOOR(vit_scaling * 0.4);      -- Reduzido de 0.6
    def_from_wisdom := FLOOR(wis_scaling * 0.3);        -- Reduzido de 0.5
    def_from_defense_mastery := FLOOR(def_mastery_bonus * 0.8);  -- Reduzido de 1.0
    calculated_total_def := def_from_base + def_from_vitality + def_from_wisdom + def_from_defense_mastery;
    
    -- Speed: Base + escalamento mínimo
    speed_from_base := base_speed;
    speed_from_dexterity := FLOOR(dex_scaling * 0.8);   -- Reduzido de 1.0
    speed_from_luck := FLOOR(luck_scaling * 0.1);       -- Reduzido de 0.2
    calculated_total_speed := speed_from_base + speed_from_dexterity + speed_from_luck;
    
    -- =====================================
    -- CRÍTICO E MÁGICO: VALORES ULTRA BAIXOS
    -- =====================================
    
    -- Chance Crítica: Base 1% + escalamento ultra baixo
    critical_chance_base := 1.0;  -- Base apenas 1%
    crit_chance_from_dexterity := dex_scaling * 0.15;     -- Reduzido de 0.25
    crit_chance_from_luck := luck_scaling * 0.25;         -- Reduzido de 0.35
    crit_chance_from_strength := str_scaling * 0.05;      -- Reduzido de 0.1
    crit_chance_from_weapon_mastery := weapon_mastery_bonus * 0.1;  -- Novo, baixo
    calculated_crit_chance := LEAST(60.0,  -- Cap reduzido de 75%
        critical_chance_base + crit_chance_from_dexterity + crit_chance_from_luck + 
        crit_chance_from_strength + crit_chance_from_weapon_mastery
    );
    
    -- Dano Crítico: Base 102% + escalamento ultra baixo
    critical_damage_base := 102.0;  -- Base apenas 2% a mais que normal
    crit_damage_from_strength := str_scaling * 0.3;       -- Reduzido de 0.4
    crit_damage_from_luck := luck_scaling * 0.2;          -- Reduzido de 0.6
    crit_damage_from_weapon_mastery := weapon_mastery_bonus * 0.4;  -- Reduzido de 0.3
    calculated_crit_damage := LEAST(200.0,  -- Cap reduzido de 250%
        critical_damage_base + crit_damage_from_strength + crit_damage_from_luck + crit_damage_from_weapon_mastery
    );
    
    -- Dano Mágico: Base 2% + escalamento ultra baixo
    magic_damage_base := 2.0;  -- Base 2%
    magic_damage_from_intelligence := int_scaling * 0.8;  -- Reduzido de 1.2
    magic_damage_from_wisdom := wis_scaling * 0.4;        -- Reduzido de 0.8
    magic_damage_from_magic_mastery := magic_mastery_bonus * 1.0;  -- Reduzido de 1.5
    raw_magic_damage := magic_damage_base + magic_damage_from_intelligence + magic_damage_from_wisdom + magic_damage_from_magic_mastery;
    
    -- Diminishing returns mais agressivos
    IF raw_magic_damage > 50 THEN
        raw_magic_damage := 50 + (raw_magic_damage - 50) * 0.5;
    END IF;
    calculated_magic_damage := LEAST(150.0, raw_magic_damage);  -- Cap reduzido de 200%
    
    -- Double Attack: Muito baixo
    double_attack_from_dexterity := dex_scaling * 0.05;   -- Muito baixo
    double_attack_from_luck := luck_scaling * 0.1;        -- Muito baixo
    calculated_double_attack := LEAST(25.0,  -- Cap baixo
        double_attack_from_dexterity + double_attack_from_luck
    );
    
    -- Retornar resultados
    RETURN QUERY SELECT 
        calculated_total_hp,
        calculated_total_hp,
        calculated_total_mana,
        calculated_total_mana,
        calculated_total_atk,
        calculated_total_magic_atk,
        calculated_total_def,
        calculated_total_speed,
        calculated_crit_chance,
        calculated_crit_damage,
        calculated_magic_damage,
        calculated_double_attack;
END;
$$;

-- Aplicar recálculo a todos os personagens existentes
DO $$
DECLARE
    character_record RECORD;
    derived_stats RECORD;
BEGIN
    RAISE NOTICE 'Iniciando recálculo de stats SEM diversidade para todos os personagens...';
    
    FOR character_record IN 
        SELECT id, level, strength, dexterity, intelligence, wisdom, vitality, luck,
               sword_mastery, axe_mastery, blunt_mastery, defense_mastery, magic_mastery
        FROM characters 
        WHERE level > 0
    LOOP
        -- Calcular novos stats sem diversidade
        SELECT * INTO derived_stats 
        FROM calculate_derived_stats(
            character_record.level,
            COALESCE(character_record.strength, 10),
            COALESCE(character_record.dexterity, 10),
            COALESCE(character_record.intelligence, 10),
            COALESCE(character_record.wisdom, 10),
            COALESCE(character_record.vitality, 10),
            COALESCE(character_record.luck, 10),
            COALESCE(character_record.sword_mastery, 1),
            COALESCE(character_record.axe_mastery, 1),
            COALESCE(character_record.blunt_mastery, 1),
            COALESCE(character_record.defense_mastery, 1),
            COALESCE(character_record.magic_mastery, 1)
        );
        
        -- Atualizar personagem com novos stats ultra baixos
        UPDATE characters 
        SET 
            max_hp = derived_stats.max_hp,
            hp = LEAST(hp, derived_stats.max_hp), -- Manter HP atual se menor que o novo máximo
            max_mana = derived_stats.max_mana,
            mana = LEAST(mana, derived_stats.max_mana), -- Manter mana atual se menor que o novo máximo
            atk = derived_stats.atk,
            def = derived_stats.def,
            speed = derived_stats.speed,
            critical_chance = derived_stats.critical_chance,
            critical_damage = derived_stats.critical_damage,
            magic_damage_bonus = derived_stats.magic_damage_bonus,
            updated_at = NOW()
        WHERE id = character_record.id;
        
    END LOOP;
    
    RAISE NOTICE 'Recálculo concluído - Sistema de diversidade removido, valores ultra baixos aplicados';
END;
$$;

-- Comentário de documentação
COMMENT ON FUNCTION calculate_derived_stats IS 
'Função de cálculo de stats derivados SEM sistema de diversidade de build. 
Aplica valores ultra baixos para personagens nível 1 (chance crítica ~1%, dano crítico ~102%, bônus mágico ~2%).
Migração aplicada em 2024-12-21 para remover completamente o sistema de diversidade.'; 