-- Migração para melhorar escalamento de magias e sistema de atributos
-- Data: 2024-12-03
-- Versão: 20241203000007

-- =====================================
-- 1. MELHORAR FUNÇÃO DE STATS DERIVADOS COM NOVOS BÔNUS
-- =====================================

-- Remover a função antiga primeiro para evitar conflitos de assinatura
DROP FUNCTION IF EXISTS calculate_derived_stats(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER);

-- Atualizar função para incluir destreza no cálculo de crítico e força no dano crítico
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
    p_magic_mastery INTEGER DEFAULT 1,
    p_equipped_weapon_type TEXT DEFAULT NULL
)
RETURNS TABLE (
    derived_hp INTEGER,
    derived_max_hp INTEGER,
    derived_mana INTEGER,
    derived_max_mana INTEGER,
    derived_atk INTEGER,
    derived_def INTEGER,
    derived_speed INTEGER,
    derived_critical_chance DECIMAL(5,2),
    derived_critical_damage DECIMAL(5,2),
    derived_magic_damage_bonus DECIMAL(5,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    -- Cálculos base
    base_hp INTEGER;
    base_mana INTEGER;
    base_atk INTEGER;
    base_def INTEGER;
    base_speed INTEGER;
    
    -- Bônus de habilidades
    weapon_bonus INTEGER;
    def_mastery_bonus INTEGER;
    magic_mastery_bonus INTEGER;
    
    -- Bônus de crítico e dano crítico
    total_crit_chance DECIMAL(5,2);
    total_crit_damage DECIMAL(5,2);
    total_magic_bonus DECIMAL(5,2);
BEGIN
    -- Cálculos base
    base_hp := 80 + (p_level * 5);
    base_mana := 40 + (p_level * 3);
    base_atk := 15 + (p_level * 2);
    base_def := 8 + p_level;
    base_speed := 8 + p_level;
    
    -- Determinar bônus de habilidade baseado na arma equipada
    weapon_bonus := 0;
    CASE p_equipped_weapon_type
        WHEN 'sword' THEN weapon_bonus := p_sword_mastery;
        WHEN 'axe' THEN weapon_bonus := p_axe_mastery;
        WHEN 'blunt' THEN weapon_bonus := p_blunt_mastery;
        ELSE weapon_bonus := 0;
    END CASE;
    
    -- Bônus de defesa
    def_mastery_bonus := p_defense_mastery * 2;
    
    -- Bônus de magia
    magic_mastery_bonus := p_magic_mastery * 3;
    
    -- Cálculo de chance crítica: Sorte (0.5%) + Destreza (0.3%) + Habilidade (0.2%)
    total_crit_chance := (p_luck * 0.5) + (p_dexterity * 0.3) + (weapon_bonus * 0.2);
    
    -- Cálculo de dano crítico: 150% base + Sorte (1%) + Força (0.5%) + Habilidade (3%)
    total_crit_damage := 150.0 + (p_luck * 1.0) + (p_strength * 0.5) + (weapon_bonus * 3.0);
    
    -- Cálculo de bônus de dano mágico: Inteligência (10%) + Sabedoria (5%) + Maestria Mágica (15%)
    total_magic_bonus := (p_intelligence * 10.0) + (p_wisdom * 5.0) + (p_magic_mastery * 15.0);
    
    -- Retornar stats calculados
    RETURN QUERY SELECT
        -- HP: base + bônus de vitalidade
        (base_hp + (p_vitality * 8))::INTEGER as derived_hp,
        (base_hp + (p_vitality * 8))::INTEGER as derived_max_hp,
        
        -- Mana: base + bônus de inteligência + maestria mágica
        (base_mana + (p_intelligence * 5) + magic_mastery_bonus)::INTEGER as derived_mana,
        (base_mana + (p_intelligence * 5) + magic_mastery_bonus)::INTEGER as derived_max_mana,
        
        -- Ataque: base + força + habilidade de arma
        (base_atk + (p_strength * 2) + weapon_bonus)::INTEGER as derived_atk,
        
        -- Defesa: base + vitalidade + sabedoria + maestria defensiva
        (base_def + p_vitality + p_wisdom + def_mastery_bonus)::INTEGER as derived_def,
        
        -- Velocidade: base + destreza
        (base_speed + (p_dexterity * 1.5))::INTEGER as derived_speed,
        
        -- Chance crítica
        LEAST(total_crit_chance, 95.0)::DECIMAL(5,2) as derived_critical_chance,
        
        -- Dano crítico
        total_crit_damage::DECIMAL(5,2) as derived_critical_damage,
        
        -- Bônus de dano mágico
        total_magic_bonus::DECIMAL(5,2) as derived_magic_damage_bonus;
END;
$$;

-- =====================================
-- 2. FUNÇÃO PARA CALCULAR DANO DE MAGIA ESCALADO
-- =====================================

CREATE OR REPLACE FUNCTION calculate_scaled_spell_damage(
    p_base_damage INTEGER,
    p_intelligence INTEGER DEFAULT 10,
    p_wisdom INTEGER DEFAULT 10,
    p_magic_mastery INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    total_bonus DECIMAL(5,2);
    scaled_damage INTEGER;
BEGIN
    -- Calcular bônus total: Int (10%) + Sabedoria (5%) + Maestria Mágica (15%)
    total_bonus := (p_intelligence * 10.0) + (p_wisdom * 5.0) + (p_magic_mastery * 15.0);
    
    -- Aplicar bônus ao dano base
    scaled_damage := ROUND(p_base_damage * (1.0 + total_bonus / 100.0));
    
    RETURN scaled_damage;
END;
$$;

-- =====================================
-- 3. FUNÇÃO PARA CALCULAR CURA ESCALADA
-- =====================================

CREATE OR REPLACE FUNCTION calculate_scaled_spell_healing(
    p_base_healing INTEGER,
    p_wisdom INTEGER DEFAULT 10,
    p_magic_mastery INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    total_bonus DECIMAL(5,2);
    scaled_healing INTEGER;
BEGIN
    -- Calcular bônus total: Sabedoria (12%) + Maestria Mágica (10%)
    total_bonus := (p_wisdom * 12.0) + (p_magic_mastery * 10.0);
    
    -- Aplicar bônus à cura base
    scaled_healing := ROUND(p_base_healing * (1.0 + total_bonus / 100.0));
    
    RETURN scaled_healing;
END;
$$;

-- =====================================
-- 4. FUNÇÃO PARA CALCULAR DANO CRÍTICO ESCALADO
-- =====================================

CREATE OR REPLACE FUNCTION calculate_critical_damage(
    p_base_damage INTEGER,
    p_strength INTEGER DEFAULT 10,
    p_luck INTEGER DEFAULT 10,
    p_weapon_mastery INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    critical_multiplier DECIMAL(5,2);
    critical_damage INTEGER;
BEGIN
    -- Calcular multiplicador crítico: 150% base + Sorte (1%) + Força (0.5%) + Habilidade (3%)
    critical_multiplier := 1.5 + (p_luck * 0.01) + (p_strength * 0.005) + (p_weapon_mastery * 0.03);
    
    -- Aplicar multiplicador ao dano base
    critical_damage := ROUND(p_base_damage * critical_multiplier);
    
    RETURN critical_damage;
END;
$$;

-- =====================================
-- 5. COMENTÁRIOS DE DOCUMENTAÇÃO
-- =====================================

COMMENT ON FUNCTION calculate_derived_stats IS 'Calcula todos os stats derivados de um personagem incluindo novos bônus de atributos e habilidades';
COMMENT ON FUNCTION calculate_scaled_spell_damage IS 'Calcula dano de magia escalado com inteligência, sabedoria e maestria mágica';
COMMENT ON FUNCTION calculate_scaled_spell_healing IS 'Calcula cura de magia escalada com sabedoria e maestria mágica';
COMMENT ON FUNCTION calculate_critical_damage IS 'Calcula dano crítico baseado em força, sorte e maestria de arma'; 