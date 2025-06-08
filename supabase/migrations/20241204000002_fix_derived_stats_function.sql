-- Migração para corrigir função calculate_derived_stats
-- Data: 2024-12-04
-- Versão: 20241204000002

-- =====================================
-- REMOVER FUNÇÕES CONFLITANTES
-- =====================================

-- Remover todas as versões da função calculate_derived_stats
DROP FUNCTION IF EXISTS calculate_derived_stats(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS calculate_derived_stats(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, VARCHAR);

-- =====================================
-- RECRIAR FUNÇÃO calculate_derived_stats ÚNICA E ROBUSTA
-- =====================================

-- Função unificada para calcular stats derivados (com ou sem habilidades)
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
    p_equipped_weapon_type VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    derived_hp INTEGER,
    derived_max_hp INTEGER,
    derived_mana INTEGER,
    derived_max_mana INTEGER,
    derived_atk INTEGER,
    derived_def INTEGER,
    derived_speed INTEGER,
    derived_critical_chance DECIMAL,
    derived_critical_damage DECIMAL,
    derived_magic_damage_bonus DECIMAL
) AS $$
DECLARE
    -- Stats base por nível
    base_hp INTEGER := 60 + (p_level * 3);
    base_mana INTEGER := 25 + (p_level * 2);
    base_atk INTEGER := 3 + p_level;
    base_def INTEGER := 2 + p_level;
    base_speed INTEGER := 5 + p_level;
    
    -- Escalamento logarítmico dos atributos
    str_scaling DECIMAL := POWER(p_strength, 1.3);
    dex_scaling DECIMAL := POWER(p_dexterity, 1.25);
    int_scaling DECIMAL := POWER(p_intelligence, 1.35);
    wis_scaling DECIMAL := POWER(p_wisdom, 1.2);
    vit_scaling DECIMAL := POWER(p_vitality, 1.4);
    luck_scaling DECIMAL := p_luck;
    
    -- Bônus de habilidades
    weapon_bonus DECIMAL := 0;
    def_mastery_bonus DECIMAL := POWER(p_defense_mastery, 1.3) * 1.2;
    magic_mastery_bonus DECIMAL := POWER(p_magic_mastery, 1.2) * 2.0;
    
    -- Stats finais
    final_hp INTEGER;
    final_mana INTEGER;
    final_atk INTEGER;
    final_def INTEGER;
    final_speed INTEGER;
    final_crit_chance DECIMAL;
    final_crit_damage DECIMAL;
    final_magic_damage DECIMAL;
BEGIN
    -- Calcular bônus de arma baseado no tipo equipado
    IF p_equipped_weapon_type = 'sword' THEN
        weapon_bonus := POWER(p_sword_mastery, 1.1) * 0.5;
    ELSIF p_equipped_weapon_type = 'axe' THEN
        weapon_bonus := POWER(p_axe_mastery, 1.1) * 0.5;
    ELSIF p_equipped_weapon_type = 'blunt' THEN
        weapon_bonus := POWER(p_blunt_mastery, 1.1) * 0.5;
    ELSE
        -- Sem arma equipada, usar a maior maestria
        weapon_bonus := POWER(GREATEST(p_sword_mastery, p_axe_mastery, p_blunt_mastery), 1.1) * 0.5;
    END IF;
    
    -- Calcular stats finais
    final_hp := base_hp + FLOOR(vit_scaling * 3.5);
    final_mana := base_mana + FLOOR(int_scaling * 2.0) + FLOOR(magic_mastery_bonus);
    final_atk := base_atk + FLOOR(str_scaling * 1.8) + FLOOR(weapon_bonus);
    final_def := base_def + FLOOR(vit_scaling * 0.8) + FLOOR(wis_scaling * 0.6) + FLOOR(def_mastery_bonus);
    final_speed := base_speed + FLOOR(dex_scaling * 1.2);
    
    -- Calcular crítico
    final_crit_chance := LEAST(90, (luck_scaling * 0.4) + (dex_scaling * 0.3) + (weapon_bonus * 0.1));
    final_crit_damage := 140 + (luck_scaling * 0.8) + (str_scaling * 0.6) + (weapon_bonus * 0.4);
    
    -- Calcular dano mágico
    final_magic_damage := (int_scaling * 1.8) + (wis_scaling * 1.2) + (magic_mastery_bonus * 2.5);
    
    -- Diminishing returns para magia
    IF final_magic_damage > 150 THEN
        final_magic_damage := 150 + ((final_magic_damage - 150) * 0.6);
    END IF;
    
    -- Cap de magia em 300%
    final_magic_damage := LEAST(300, final_magic_damage);
    
    RETURN QUERY
    SELECT
        final_hp as derived_hp,
        final_hp as derived_max_hp,
        final_mana as derived_mana,
        final_mana as derived_max_mana,
        final_atk as derived_atk,
        final_def as derived_def,
        final_speed as derived_speed,
        ROUND(final_crit_chance, 2) as derived_critical_chance,
        ROUND(final_crit_damage, 2) as derived_critical_damage,
        ROUND(final_magic_damage, 2) as derived_magic_damage_bonus;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- DOCUMENTAÇÃO
-- =====================================

COMMENT ON FUNCTION calculate_derived_stats(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, VARCHAR) IS 
'Calcula stats derivados com base em nível, atributos primários, habilidades e equipamento. Funciona tanto para criação de personagens (parâmetros básicos) quanto para cálculos avançados com equipamento.';

-- Migração concluída com sucesso! 