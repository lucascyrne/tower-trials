-- Migração para corrigir definitivamente a função calculate_derived_stats
-- Data: 2024-12-04
-- Versão: 20241204000004

-- =====================================
-- LIMPEZA E CRIAÇÃO DA FUNÇÃO
-- =====================================

-- Remover todas as versões da função calculate_derived_stats
DROP FUNCTION IF EXISTS calculate_derived_stats CASCADE;

-- Criar função correta
CREATE OR REPLACE FUNCTION calculate_derived_stats(
    p_level INTEGER,
    p_strength INTEGER,
    p_dexterity INTEGER,
    p_intelligence INTEGER,
    p_wisdom INTEGER,
    p_vitality INTEGER,
    p_luck INTEGER
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
    -- Calcular stats finais
    final_hp := base_hp + FLOOR(vit_scaling * 3.5);
    final_mana := base_mana + FLOOR(int_scaling * 2.0);
    final_atk := base_atk + FLOOR(str_scaling * 1.8);
    final_def := base_def + FLOOR(vit_scaling * 0.8) + FLOOR(wis_scaling * 0.6);
    final_speed := base_speed + FLOOR(dex_scaling * 1.2);
    
    -- Calcular crítico
    final_crit_chance := LEAST(90, (luck_scaling * 0.4) + (dex_scaling * 0.3));
    final_crit_damage := 140 + (luck_scaling * 0.8) + (str_scaling * 0.6);
    
    -- Calcular dano mágico
    final_magic_damage := (int_scaling * 1.8) + (wis_scaling * 1.2);
    
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
-- TESTE DA FUNÇÃO
-- =====================================

-- Testar a função calculate_derived_stats
DO $$
DECLARE
    test_result RECORD;
BEGIN
    -- Executar teste simples
    SELECT * INTO test_result 
    FROM calculate_derived_stats(10, 15, 12, 8, 10, 14, 6);
    
    IF test_result IS NOT NULL THEN
        RAISE NOTICE 'Teste da função calculate_derived_stats: SUCESSO';
        RAISE NOTICE 'HP: %, Atk: %, Def: %', test_result.derived_hp, test_result.derived_atk, test_result.derived_def;
    ELSE
        RAISE WARNING 'Teste da função calculate_derived_stats: FALHOU';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE WARNING 'Erro ao testar função calculate_derived_stats: %', SQLERRM;
END $$;

-- Documentação
COMMENT ON FUNCTION calculate_derived_stats(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) IS 
'Função para calcular stats derivados de personagens baseados em nível e atributos primários'; 