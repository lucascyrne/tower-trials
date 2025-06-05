-- Migração para rebalancear o escalamento de dano mágico
-- Data: 2024-12-03
-- Versão: 20241203000008

-- =====================================
-- REBALANCEAMENTO DO SISTEMA DE DANO MÁGICO
-- =====================================

-- Problema identificado: Escalamento exponencial excessivo
-- Cenário atual: Personagem level 20 com Int 30, Wis 25, Magic 15 = 650% de bônus
-- Resultado: Magia de 50 base vira 375 de dano, muito OP

-- =====================================
-- 1. NOVA FUNÇÃO DE DANO MÁGICO BALANCEADA
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
    -- Novos multiplicadores balanceados
    int_bonus DECIMAL(5,2);
    wis_bonus DECIMAL(5,2);
    mastery_bonus DECIMAL(5,2);
    total_bonus DECIMAL(5,2);
    scaled_damage INTEGER;
BEGIN
    -- Cálculos com escalamento logarítmico para reduzir crescimento exponencial
    
    -- Intelligence: 3% por ponto (reduzido de 10%) + diminishing returns
    int_bonus := p_intelligence * 3.0 * (1.0 - (p_intelligence::DECIMAL / 200.0));
    
    -- Wisdom: 2% por ponto (reduzido de 5%) + diminishing returns  
    wis_bonus := p_wisdom * 2.0 * (1.0 - (p_wisdom::DECIMAL / 250.0));
    
    -- Magic Mastery: 4% por nível (reduzido de 15%) + diminishing returns
    mastery_bonus := p_magic_mastery * 4.0 * (1.0 - (p_magic_mastery::DECIMAL / 150.0));
    
    -- Total com cap em 200% (anteriormente sem limite)
    total_bonus := LEAST(200.0, int_bonus + wis_bonus + mastery_bonus);
    
    -- Aplicar bônus ao dano base
    scaled_damage := ROUND(p_base_damage * (1.0 + total_bonus / 100.0));
    
    -- Debug log para teste
    -- RAISE NOTICE 'Magic Damage: Base=%, Int=%% (%), Wis=%% (%), Mas=%% (%), Total=%%, Final=%', 
    --     p_base_damage, int_bonus, p_intelligence, wis_bonus, p_wisdom, mastery_bonus, p_magic_mastery, total_bonus, scaled_damage;
    
    RETURN scaled_damage;
END;
$$;

-- =====================================
-- 2. ATUALIZAR FUNÇÃO DE STATS DERIVADOS
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
    
    -- Nova fórmula de dano mágico balanceada
    int_magic_bonus DECIMAL(5,2);
    wis_magic_bonus DECIMAL(5,2);
    mastery_magic_bonus DECIMAL(5,2);
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
    
    -- NOVA FÓRMULA DE DANO MÁGICO BALANCEADA
    -- Intelligence: 3% por ponto com diminishing returns
    int_magic_bonus := p_intelligence * 3.0 * (1.0 - (p_intelligence::DECIMAL / 200.0));
    
    -- Wisdom: 2% por ponto com diminishing returns
    wis_magic_bonus := p_wisdom * 2.0 * (1.0 - (p_wisdom::DECIMAL / 250.0));
    
    -- Magic Mastery: 4% por nível com diminishing returns
    mastery_magic_bonus := p_magic_mastery * 4.0 * (1.0 - (p_magic_mastery::DECIMAL / 150.0));
    
    -- Total com cap em 200%
    total_magic_bonus := LEAST(200.0, int_magic_bonus + wis_magic_bonus + mastery_magic_bonus);
    
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
        
        -- Bônus de dano mágico BALANCEADO
        total_magic_bonus::DECIMAL(5,2) as derived_magic_damage_bonus;
END;
$$;

-- =====================================
-- 3. ATUALIZAR FUNÇÃO DE CURA ESCALADA
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
    wis_bonus DECIMAL(5,2);
    mastery_bonus DECIMAL(5,2);
    total_bonus DECIMAL(5,2);
    scaled_healing INTEGER;
BEGIN
    -- Wisdom: 4% por ponto (reduzido de 12%) + diminishing returns
    wis_bonus := p_wisdom * 4.0 * (1.0 - (p_wisdom::DECIMAL / 300.0));
    
    -- Magic Mastery: 3% por nível (reduzido de 10%) + diminishing returns
    mastery_bonus := p_magic_mastery * 3.0 * (1.0 - (p_magic_mastery::DECIMAL / 200.0));
    
    -- Total com cap em 150% para cura (menor que dano)
    total_bonus := LEAST(150.0, wis_bonus + mastery_bonus);
    
    -- Aplicar bônus à cura base
    scaled_healing := ROUND(p_base_healing * (1.0 + total_bonus / 100.0));
    
    RETURN scaled_healing;
END;
$$;

-- =====================================
-- 4. COMENTÁRIOS DE DOCUMENTAÇÃO
-- =====================================

COMMENT ON FUNCTION calculate_scaled_spell_damage IS 'Calcula dano de magia com escalamento balanceado e diminishing returns (max 200% bonus)';
COMMENT ON FUNCTION calculate_scaled_spell_healing IS 'Calcula cura de magia com escalamento balanceado (max 150% bonus)';

-- =====================================
-- 5. NOTAS DE BALANCEAMENTO
-- =====================================

-- ANTES (Personagem Int 30, Wis 25, Magic 15):
-- Bônus = (30×10%) + (25×5%) + (15×15%) = 650%
-- Magia 50 base = 375 dano (7.5x)

-- DEPOIS (mesmo personagem):
-- Int: 30×3×(1-30/200) = 90×0.85 = 76.5%
-- Wis: 25×2×(1-25/250) = 50×0.9 = 45%
-- Magic: 15×4×(1-15/150) = 60×0.9 = 54%
-- Total: cap(76.5+45+54, 200) = 175.5%
-- Magia 50 base = 138 dano (2.8x) - MUITO MAIS BALANCEADO

-- Escalamento agora é mais gradual e tem teto realista! 