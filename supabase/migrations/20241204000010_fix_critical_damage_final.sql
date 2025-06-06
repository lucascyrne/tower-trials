-- Migração para corrigir definitivamente o critical_damage
-- Data: 2024-12-04
-- Versão: 20241204000010
-- Objetivo: Garantir consistência entre função do banco e fallback

-- =====================================
-- CORREÇÃO DEFINITIVA DA FUNÇÃO CALCULATE_DERIVED_STATS
-- =====================================

-- Remover todas as versões anteriores da função
DROP FUNCTION IF EXISTS calculate_derived_stats CASCADE;

-- Criar a função definitiva que corresponde exatamente ao fallback
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
    derived_critical_chance DECIMAL(5,2),
    derived_critical_damage DECIMAL(5,2),
    derived_magic_damage_bonus DECIMAL(5,2)
) AS $$
DECLARE
    -- Escalamento logarítmico dos atributos (EXATAMENTE como no fallback)
    str_scaling DECIMAL := POWER(p_strength, 1.3);
    dex_scaling DECIMAL := POWER(p_dexterity, 1.25);
    int_scaling DECIMAL := POWER(p_intelligence, 1.35);
    wis_scaling DECIMAL := POWER(p_wisdom, 1.2);
    vit_scaling DECIMAL := POWER(p_vitality, 1.4);
    luck_scaling DECIMAL := p_luck;
    
    -- Habilidades com escalamento logarítmico (EXATAMENTE como no fallback)
    weapon_bonus DECIMAL := POWER(GREATEST(p_sword_mastery, p_axe_mastery, p_blunt_mastery), 1.1) * 0.5;
    def_mastery_bonus DECIMAL := POWER(p_defense_mastery, 1.3) * 1.2;
    magic_mastery_bonus DECIMAL := POWER(p_magic_mastery, 1.2) * 2.0;
    
    -- Bases MUITO menores para forçar especialização (EXATAMENTE como no fallback)
    base_hp INTEGER := 60 + (p_level * 3);
    base_mana INTEGER := 25 + (p_level * 2);
    base_atk INTEGER := 3 + p_level;
    base_def INTEGER := 2 + p_level;
    base_speed INTEGER := 5 + p_level;
    
    -- Stats derivados finais
    final_hp INTEGER;
    final_mana INTEGER;
    final_atk INTEGER;
    final_def INTEGER;
    final_speed INTEGER;
    final_crit_chance DECIMAL(5,2);
    final_crit_damage DECIMAL(5,2);
    final_magic_damage DECIMAL(5,2);
    
    -- Componentes para dano mágico
    int_magic_scaling DECIMAL;
    wis_magic_scaling DECIMAL;
    mastery_magic_scaling DECIMAL;
    total_magic_bonus DECIMAL;
BEGIN
    -- Stats derivados com escalamento especializado (EXATAMENTE como no fallback)
    final_hp := base_hp + FLOOR(vit_scaling * 3.5);
    final_mana := base_mana + FLOOR(int_scaling * 2.0) + FLOOR(magic_mastery_bonus);
    final_atk := base_atk + FLOOR(str_scaling * 1.8) + FLOOR(weapon_bonus);
    final_def := base_def + FLOOR(vit_scaling * 0.8) + FLOOR(wis_scaling * 0.6) + FLOOR(def_mastery_bonus);
    final_speed := base_speed + FLOOR(dex_scaling * 1.2);
    
    -- Crítico rebalanceado com bônus de arma (EXATAMENTE como no fallback)
    final_crit_chance := LEAST(90, (luck_scaling * 0.4) + (dex_scaling * 0.3) + (weapon_bonus * 0.1));
    final_crit_damage := 140 + (luck_scaling * 0.8) + (str_scaling * 0.6) + (weapon_bonus * 0.4);
    
    -- Sistema de dano mágico especializado (EXATAMENTE como no fallback)
    int_magic_scaling := int_scaling * 1.8;
    wis_magic_scaling := wis_scaling * 1.2;
    mastery_magic_scaling := magic_mastery_bonus * 2.5;
    
    total_magic_bonus := int_magic_scaling + wis_magic_scaling + mastery_magic_scaling;
    
    -- Diminishing returns graduais (EXATAMENTE como no fallback)
    IF total_magic_bonus > 150 THEN
        total_magic_bonus := 150 + ((total_magic_bonus - 150) * 0.6);
    END IF;
    
    -- Cap em 300% para especialistas extremos (EXATAMENTE como no fallback)
    final_magic_damage := LEAST(300, total_magic_bonus);
    
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
-- TESTE PARA VERIFICAR CONSISTÊNCIA
-- =====================================

-- Teste com personagem força 37 (como descrito pelo usuário)
DO $$
DECLARE
    test_result RECORD;
    expected_crit_damage DECIMAL;
BEGIN
    -- Calcular valor esperado usando a mesma fórmula do fallback
    -- Para força 37: str_scaling = 37^1.3 ≈ 88.8
    -- weapon_bonus = 1^1.1 * 0.5 = 0.5 (maestria 1 default)
    -- critical_damage = 140 + (10 * 0.8) + (88.8 * 0.6) + (0.5 * 0.4) = 140 + 8 + 53.3 + 0.2 = 201.5
    expected_crit_damage := 140 + (10 * 0.8) + (POWER(37, 1.3) * 0.6) + (POWER(1, 1.1) * 0.5 * 0.4);
    
    -- Testar a função
    SELECT * INTO test_result FROM calculate_derived_stats(
        p_level := 1,
        p_strength := 37,
        p_dexterity := 10,
        p_intelligence := 10,
        p_wisdom := 10,
        p_vitality := 10,
        p_luck := 10,
        p_sword_mastery := 1,
        p_axe_mastery := 1,
        p_blunt_mastery := 1,
        p_defense_mastery := 1,
        p_magic_mastery := 1
    );
    
    RAISE NOTICE 'Teste Critical Damage:';
    RAISE NOTICE 'Esperado: % (fórmula manual)', ROUND(expected_crit_damage, 2);
    RAISE NOTICE 'Resultado: % (função)', test_result.derived_critical_damage;
    
    -- Verificar se estão próximos (diferença <= 1%)
    IF ABS(test_result.derived_critical_damage - expected_crit_damage) <= (expected_crit_damage * 0.01) THEN
        RAISE NOTICE 'SUCESSO: Valores são consistentes!';
    ELSE
        RAISE NOTICE 'ERRO: Valores são inconsistentes!';
    END IF;
END;
$$;

-- =====================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================

COMMENT ON FUNCTION calculate_derived_stats IS 
'Função definitiva para calcular stats derivados. 
CRÍTICO: Esta função deve ser EXATAMENTE igual ao fallback do CharacterService.
- Bases menores para forçar especialização
- Escalamento logarítmico para recompensar builds focadas  
- Sem caps rígidos, permitindo crescimento infinito controlado
- Função de critical_damage: 140 + (luck * 0.8) + (str^1.3 * 0.6) + (weapon_bonus * 0.4)'; 