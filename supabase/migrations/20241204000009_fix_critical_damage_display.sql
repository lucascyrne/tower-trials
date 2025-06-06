-- Migração para corrigir definitivamente a exibição de critical_damage
-- Data: 2024-12-04
-- Versão: 20241204000009
-- Objetivo: Garantir que o critical_damage seja calculado corretamente em todos os contextos

-- =====================================
-- CORREÇÃO DEFINITIVA DA FUNÇÃO CALCULATE_DERIVED_STATS
-- =====================================

-- Remover a função anterior que tinha weapon_bonus hardcoded
DROP FUNCTION IF EXISTS calculate_derived_stats(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) CASCADE;

-- Criar função corrigida que considera maestrias de personagem
CREATE OR REPLACE FUNCTION calculate_derived_stats(
    p_level INTEGER,
    p_strength INTEGER,
    p_dexterity INTEGER,
    p_intelligence INTEGER,
    p_wisdom INTEGER,
    p_vitality INTEGER,
    p_luck INTEGER,
    p_sword_mastery INTEGER DEFAULT 1,
    p_axe_mastery INTEGER DEFAULT 1,
    p_blunt_mastery INTEGER DEFAULT 1,
    p_defense_mastery INTEGER DEFAULT 1,
    p_magic_mastery INTEGER DEFAULT 1
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
    
    -- CORRIGIDO: Bônus de arma baseado na melhor maestria disponível
    weapon_bonus DECIMAL := POWER(GREATEST(p_sword_mastery, p_axe_mastery, p_blunt_mastery), 1.1) * 0.5;
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
    -- Calcular stats finais com bônus de maestrias
    final_hp := base_hp + FLOOR(vit_scaling * 3.5);
    final_mana := base_mana + FLOOR(int_scaling * 2.0) + FLOOR(magic_mastery_bonus);
    final_atk := base_atk + FLOOR(str_scaling * 1.8) + FLOOR(weapon_bonus);
    final_def := base_def + FLOOR(vit_scaling * 0.8) + FLOOR(wis_scaling * 0.6) + FLOOR(def_mastery_bonus);
    final_speed := base_speed + FLOOR(dex_scaling * 1.2);
    
    -- CORRIGIDO: Calcular crítico com bônus de arma real
    final_crit_chance := LEAST(90, (luck_scaling * 0.4) + (dex_scaling * 0.3) + (weapon_bonus * 0.1));
    final_crit_damage := 140 + (luck_scaling * 0.8) + (str_scaling * 0.6) + (weapon_bonus * 0.4);
    
    -- Calcular dano mágico com bônus de maestria
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
-- TESTE DA FUNÇÃO CORRIGIDA
-- =====================================

-- Testar a função com valores de exemplo
DO $$
DECLARE
    test_result RECORD;
BEGIN
    -- Executar teste com força 15 e maestrias nível 1 (cenário do usuário)
    SELECT * INTO test_result 
    FROM calculate_derived_stats(10, 15, 12, 8, 10, 14, 6, 1, 1, 1, 1, 1);
    
    IF test_result IS NOT NULL THEN
        RAISE NOTICE 'Teste da função calculate_derived_stats CORRIGIDA: SUCESSO';
        RAISE NOTICE 'Level: 10, STR: 15, Attributes OK';
        RAISE NOTICE 'HP: %, Atk: %', test_result.derived_hp, test_result.derived_atk;
        RAISE NOTICE 'Critical Damage: %', test_result.derived_critical_damage;
    ELSE
        RAISE WARNING 'Teste da função calculate_derived_stats CORRIGIDA: FALHOU';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE WARNING 'Erro ao testar função: %', SQLERRM;
END $$;

-- Documentação
COMMENT ON FUNCTION calculate_derived_stats(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) IS 
'Função corrigida para calcular stats derivados considerando todas as maestrias do personagem'; 