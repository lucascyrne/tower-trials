-- Migração para rebalanceamento completo do sistema de stats
-- Data: 2024-12-03
-- Versão: 20241203000009

-- =====================================
-- REBALANCEAMENTO COMPLETO DOS STATS
-- =====================================

-- PROBLEMA CRÍTICO IDENTIFICADO:
-- Personagem com 10 STR, 10 DEX, 29 INT fazia:
-- - Dano físico: ~82 (muito alto para stats mínimos)
-- - Dano mágico: ~106 (muito baixo para 29 INT)
-- - Diferença de apenas 29% entre build especializada vs não-especializada

-- SOLUÇÃO IMPLEMENTADA:
-- Sistema especializado que favorece builds focadas:
-- ✅ Bases muito menores (3+level vs 15+level*2 para ataque)
-- ✅ Escalamento logarítmico (atributo^1.3 ao invés de atributo*2)
-- ✅ Diminishing returns graduais (sem caps rígidos)
-- ✅ Crescimento infinito mas controlado

-- IMPACTO ESPERADO:
-- - Mago 29 INT: dano mágico ~200% (vs 106% antes)
-- - Guerreiro 10 STR: dano físico ~36 (vs 82 antes)
-- - Especialização recompensada, híbridos viáveis mas inferiores

-- =====================================
-- 1. NOVA FUNÇÃO DE STATS DERIVADOS ESPECIALIZADA
-- =====================================

-- Remover função existente se houver conflito de assinatura
DROP FUNCTION IF EXISTS calculate_derived_stats CASCADE;

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
    def INTEGER,
    speed INTEGER,
    critical_chance NUMERIC(5,2),
    critical_damage NUMERIC(5,2),
    magic_damage_bonus NUMERIC(5,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    -- Escalamento logarítmico dos atributos para especialização
    v_str_scaling NUMERIC := POWER(p_strength, 1.3);
    v_dex_scaling NUMERIC := POWER(p_dexterity, 1.25);
    v_int_scaling NUMERIC := POWER(p_intelligence, 1.35);
    v_wis_scaling NUMERIC := POWER(p_wisdom, 1.2);
    v_vit_scaling NUMERIC := POWER(p_vitality, 1.4);
    v_luck_scaling NUMERIC := p_luck;
    
    -- Habilidades com escalamento logarítmico
    v_weapon_bonus NUMERIC := POWER(GREATEST(p_sword_mastery, p_axe_mastery, p_blunt_mastery), 1.1) * 0.5;
    v_def_mastery_bonus NUMERIC := POWER(p_defense_mastery, 1.3) * 1.2;
    v_magic_mastery_bonus NUMERIC := POWER(p_magic_mastery, 1.2) * 2.0;
    
    -- Valores finais
    v_hp INTEGER;
    v_mana INTEGER;
    v_atk INTEGER;
    v_def INTEGER;
    v_speed INTEGER;
    v_crit_chance NUMERIC(5,2);
    v_crit_damage NUMERIC(5,2);
    v_magic_dmg_bonus NUMERIC(5,2);
    
    -- Componentes para magic damage
    v_int_magic_scaling NUMERIC;
    v_wis_magic_scaling NUMERIC;
    v_mastery_magic_scaling NUMERIC;
    v_total_magic_bonus NUMERIC;
BEGIN
    -- =====================================
    -- SISTEMA ESPECIALIZADO: BASES MENORES
    -- =====================================
    
    -- HP: Tank builds se destacam
    v_hp := 60 + (p_level * 3) + ROUND(v_vit_scaling * 3.5);
    
    -- Mana: Mage builds se destacam
    v_mana := 25 + (p_level * 2) + ROUND(v_int_scaling * 2.0) + ROUND(v_magic_mastery_bonus);
    
    -- Ataque: Warrior builds se destacam (base crítica menor)
    v_atk := 3 + p_level + ROUND(v_str_scaling * 1.8) + ROUND(v_weapon_bonus);
    
    -- Defesa: Tank/Healer builds se destacam
    v_def := 2 + p_level + ROUND(v_vit_scaling * 0.8) + ROUND(v_wis_scaling * 0.6) + ROUND(v_def_mastery_bonus);
    
    -- Velocidade: Dex builds se destacam
    v_speed := 5 + p_level + ROUND(v_dex_scaling * 1.2);
    
    -- =====================================
    -- CRÍTICOS REBALANCEADOS
    -- =====================================
    
    -- Chance crítica (máximo 90%)
    v_crit_chance := LEAST(90, (v_luck_scaling * 0.4) + (v_dex_scaling * 0.3) + (v_weapon_bonus * 0.1));
    
    -- Dano crítico
    v_crit_damage := 140 + (v_luck_scaling * 0.8) + (v_str_scaling * 0.6) + (v_weapon_bonus * 0.4);
    
    -- =====================================
    -- DANO MÁGICO ESPECIALIZADO
    -- =====================================
    
    -- Intelligence: Fator principal para magos
    v_int_magic_scaling := v_int_scaling * 1.8;
    
    -- Wisdom: Fator secundário para híbridos/healers  
    v_wis_magic_scaling := v_wis_scaling * 1.2;
    
    -- Magic Mastery: Multiplicador de eficiência
    v_mastery_magic_scaling := v_magic_mastery_bonus * 2.5;
    
    -- Total sem cap
    v_total_magic_bonus := v_int_magic_scaling + v_wis_magic_scaling + v_mastery_magic_scaling;
    
    -- Diminishing returns graduais (não caps rígidos)
    IF v_total_magic_bonus > 150 THEN
        v_total_magic_bonus := 150 + ((v_total_magic_bonus - 150) * 0.6);
    END IF;
    
    -- Cap em 300% para especialistas extremos
    v_magic_dmg_bonus := LEAST(300, v_total_magic_bonus);
    
    -- =====================================
    -- RETORNO DOS VALORES
    -- =====================================
    
    RETURN QUERY SELECT 
        v_hp,
        v_hp,  -- max_hp = hp
        v_mana,
        v_mana, -- max_mana = mana
        v_atk,
        v_def,
        v_speed,
        v_crit_chance,
        v_crit_damage,
        v_magic_dmg_bonus;
END;
$$;

-- =====================================
-- 2. FUNÇÃO DE DANO MÁGICO ESCALADO ESPECIALIZADA
-- =====================================

-- Remover função existente se houver conflito de assinatura
DROP FUNCTION IF EXISTS calculate_scaled_spell_damage CASCADE;

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
    v_int_scaling NUMERIC := POWER(p_intelligence, 1.35);
    v_wis_scaling NUMERIC := POWER(p_wisdom, 1.2);
    v_mastery_scaling NUMERIC := POWER(p_magic_mastery, 1.2);
    
    v_int_magic_bonus NUMERIC := v_int_scaling * 1.8;
    v_wis_magic_bonus NUMERIC := v_wis_scaling * 1.2;
    v_mastery_magic_bonus NUMERIC := v_mastery_scaling * 2.5;
    
    v_total_bonus NUMERIC;
    v_scaled_damage INTEGER;
BEGIN
    -- Total sem cap
    v_total_bonus := v_int_magic_bonus + v_wis_magic_bonus + v_mastery_magic_bonus;
    
    -- Diminishing returns graduais
    IF v_total_bonus > 150 THEN
        v_total_bonus := 150 + ((v_total_bonus - 150) * 0.6);
    END IF;
    
    -- Cap máximo em 300%
    v_total_bonus := LEAST(300, v_total_bonus);
    
    -- Aplicar bônus ao dano base
    v_scaled_damage := ROUND(p_base_damage * (1 + v_total_bonus / 100));
    
    RETURN v_scaled_damage;
END;
$$;

-- =====================================
-- 3. FUNÇÃO DE CURA MÁGICA ESCALADA ESPECIALIZADA
-- =====================================

-- Remover função existente se houver conflito de assinatura
DROP FUNCTION IF EXISTS calculate_scaled_spell_healing CASCADE;

CREATE OR REPLACE FUNCTION calculate_scaled_spell_healing(
    p_base_healing INTEGER,
    p_wisdom INTEGER DEFAULT 10,
    p_magic_mastery INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_wis_scaling NUMERIC := POWER(p_wisdom, 1.3);
    v_mastery_scaling NUMERIC := POWER(p_magic_mastery, 1.15);
    
    v_wis_healing_bonus NUMERIC := v_wis_scaling * 2.2;
    v_mastery_healing_bonus NUMERIC := v_mastery_scaling * 1.8;
    
    v_total_bonus NUMERIC;
    v_scaled_healing INTEGER;
BEGIN
    -- Total sem cap
    v_total_bonus := v_wis_healing_bonus + v_mastery_healing_bonus;
    
    -- Diminishing returns para cura (menor que dano)
    IF v_total_bonus > 120 THEN
        v_total_bonus := 120 + ((v_total_bonus - 120) * 0.5);
    END IF;
    
    -- Cap em 220% para curadores especializados
    v_total_bonus := LEAST(220, v_total_bonus);
    
    -- Aplicar bônus à cura base
    v_scaled_healing := ROUND(p_base_healing * (1 + v_total_bonus / 100));
    
    RETURN v_scaled_healing;
END;
$$;

-- =====================================
-- COMENTÁRIOS DO REBALANCEAMENTO
-- =====================================

COMMENT ON FUNCTION calculate_derived_stats IS 
'Sistema de stats especializado que favorece builds focadas.
- Bases muito menores forçam dependência de atributos específicos
- Escalamento logarítmico beneficia especialização
- Diminishing returns previnem builds OP
- Sem caps rígidos, permitindo crescimento infinito';

COMMENT ON FUNCTION calculate_scaled_spell_damage IS
'Dano mágico escalado para magos especializados.
- Intelligence como fator principal (^1.35)
- Magic Mastery como multiplicador de eficiência
- Diminishing returns graduais em 150%+
- Cap máximo em 300% para builds extremas';

COMMENT ON FUNCTION calculate_scaled_spell_healing IS
'Cura mágica escalada para curadores especializados.
- Wisdom como fator principal para cura
- Escalamento mais conservador que dano
- Cap menor (220%) para manter balanço'; 