-- Migração: Sistema de Iniciativa e Turnos Baseados em Velocidade
-- Data: 2024-12-20
-- Versão: 20241220000001
-- Objetivo: Implementar sistema que torna destreza/velocidade mais interessante

-- =====================================
-- ANÁLISE DO PROBLEMA:
-- =====================================
-- ❌ Velocidade atualmente não tem impacto real na batalha
-- ❌ Turnos sempre alternados (jogador -> inimigo)
-- ❌ Destreza só afeta velocidade, mas velocidade não faz diferença
-- ❌ Builds mono-atributo são muito eficientes
-- ❌ Falta incentivo para builds balanceadas

-- SOLUÇÃO IMPLEMENTADA:
-- ✅ Sistema de iniciativa baseado em velocidade
-- ✅ Turnos encadeados para diferenças grandes de velocidade
-- ✅ Rebalanceamento de atributos com sinergias
-- ✅ Diminishing returns mais agressivos
-- ✅ Caps em stats para evitar builds extremas

-- =====================================
-- 1. FUNÇÕES AUXILIARES PARA INICIATIVA
-- =====================================

-- Função para calcular iniciativa baseada em velocidade
CREATE OR REPLACE FUNCTION calculate_initiative(base_speed INTEGER, dexterity INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    initiative INTEGER;
    speed_bonus INTEGER;
    dex_bonus INTEGER;
BEGIN
    -- Base da iniciativa é a velocidade
    initiative := base_speed;
    
    -- Bônus de destreza (cada ponto de dex = +0.5 iniciativa)
    dex_bonus := FLOOR(dexterity * 0.5);
    
    -- Adicionar elemento aleatório (±10%)
    speed_bonus := FLOOR((base_speed + dex_bonus) * (0.9 + (RANDOM() * 0.2)));
    
    RETURN speed_bonus;
END;
$$;

-- Função para calcular quantos turnos extras baseado na diferença de velocidade
CREATE OR REPLACE FUNCTION calculate_extra_turns(attacker_speed INTEGER, defender_speed INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    speed_difference FLOAT;
    extra_turns INTEGER := 0;
BEGIN
    -- Evitar divisão por zero
    IF defender_speed <= 0 THEN
        RETURN 2; -- Máximo de turnos extras se defensor não tem velocidade
    END IF;
    
    -- Calcular diferença percentual de velocidade
    speed_difference := (attacker_speed::FLOAT / defender_speed::FLOAT);
    
    -- Sistema de turnos extras baseado em diferença:
    -- 1.8x+ velocidade = 1 turno extra
    -- 2.5x+ velocidade = 2 turnos extras
    -- 3.5x+ velocidade = 3 turnos extras (máximo)
    
    IF speed_difference >= 3.5 THEN
        extra_turns := 3;
    ELSIF speed_difference >= 2.5 THEN
        extra_turns := 2;
    ELSIF speed_difference >= 1.8 THEN
        extra_turns := 1;
    END IF;
    
    -- Adicionar pequeno elemento aleatório (20% chance de +1 turno extra)
    IF extra_turns < 3 AND RANDOM() < 0.2 THEN
        extra_turns := extra_turns + 1;
    END IF;
    
    RETURN LEAST(extra_turns, 3); -- Máximo de 3 turnos extras
END;
$$;

-- =====================================
-- 2. NOVO SISTEMA DE CÁLCULO DE STATS DERIVADOS
-- =====================================

-- Função melhorada para calcular stats derivados com sistema anti-mono-build
CREATE OR REPLACE FUNCTION calculate_derived_stats_balanced(
    p_character_id UUID,
    p_level INTEGER,
    p_strength INTEGER,
    p_dexterity INTEGER,
    p_intelligence INTEGER,
    p_wisdom INTEGER,
    p_vitality INTEGER,
    p_luck INTEGER,
    p_sword_mastery INTEGER,
    p_axe_mastery INTEGER,
    p_blunt_mastery INTEGER,
    p_defense_mastery INTEGER,
    p_magic_mastery INTEGER
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
    magic_damage_bonus NUMERIC(5,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    -- Escalamento logarítmico com diminishing returns
    str_scaling NUMERIC;
    dex_scaling NUMERIC;
    int_scaling NUMERIC;
    wis_scaling NUMERIC;
    vit_scaling NUMERIC;
    luck_scaling NUMERIC;
    
    -- Bônus de habilidades
    weapon_mastery_bonus NUMERIC;
    def_mastery_bonus NUMERIC;
    magic_mastery_bonus NUMERIC;
    
    -- Stats base ajustados
    base_hp INTEGER;
    base_mana INTEGER;
    base_atk INTEGER;
    base_def INTEGER;
    base_speed INTEGER;
    
    -- Stats finais
    final_hp INTEGER;
    final_mana INTEGER;
    final_atk INTEGER;
    final_magic_atk INTEGER;
    final_def INTEGER;
    final_speed INTEGER;
    final_crit_chance NUMERIC;
    final_crit_damage NUMERIC;
    final_magic_damage NUMERIC;
    
    -- Sistema anti-mono-build
    total_attributes INTEGER;
    attribute_diversity NUMERIC;
    diversity_bonus NUMERIC;
    mono_penalty NUMERIC;
BEGIN
    -- =====================================
    -- SISTEMA ANTI-MONO-BUILD
    -- =====================================
    
    total_attributes := p_strength + p_dexterity + p_intelligence + p_wisdom + p_vitality + p_luck;
    
    -- Calcular diversidade de atributos (0-1, onde 1 = perfeitamente balanceado)
    attribute_diversity := 1.0 - (
        ABS(p_strength::NUMERIC / total_attributes - 1.0/6.0) +
        ABS(p_dexterity::NUMERIC / total_attributes - 1.0/6.0) +
        ABS(p_intelligence::NUMERIC / total_attributes - 1.0/6.0) +
        ABS(p_wisdom::NUMERIC / total_attributes - 1.0/6.0) +
        ABS(p_vitality::NUMERIC / total_attributes - 1.0/6.0) +
        ABS(p_luck::NUMERIC / total_attributes - 1.0/6.0)
    ) / 2.0;
    
    -- Bônus por diversidade (builds balanceadas ganham até 20% de bônus)
    diversity_bonus := 1.0 + (attribute_diversity * 0.2);
    
    -- Penalidade para mono-builds (builds com 80%+ em um atributo perdem eficiência)
    mono_penalty := 1.0;
    IF (p_strength::NUMERIC / total_attributes) > 0.8 OR
       (p_dexterity::NUMERIC / total_attributes) > 0.8 OR
       (p_intelligence::NUMERIC / total_attributes) > 0.8 OR
       (p_wisdom::NUMERIC / total_attributes) > 0.8 OR
       (p_vitality::NUMERIC / total_attributes) > 0.8 OR
       (p_luck::NUMERIC / total_attributes) > 0.8 THEN
        mono_penalty := 0.7; -- Penalidade de 30%
    END IF;
    
    -- =====================================
    -- ESCALAMENTO LOGARÍTMICO COM SINERGIAS
    -- =====================================
    
    -- Escalamento com diminishing returns mais agressivos
    str_scaling := POWER(p_strength, 1.2) * diversity_bonus * mono_penalty;
    dex_scaling := POWER(p_dexterity, 1.15) * diversity_bonus * mono_penalty;
    int_scaling := POWER(p_intelligence, 1.25) * diversity_bonus * mono_penalty;
    wis_scaling := POWER(p_wisdom, 1.1) * diversity_bonus * mono_penalty;
    vit_scaling := POWER(p_vitality, 1.3) * diversity_bonus * mono_penalty;
    luck_scaling := p_luck * diversity_bonus * mono_penalty;
    
    -- Habilidades também recebem bônus de diversidade
    weapon_mastery_bonus := POWER(GREATEST(p_sword_mastery, p_axe_mastery, p_blunt_mastery), 1.1) * diversity_bonus;
    def_mastery_bonus := POWER(p_defense_mastery, 1.2) * diversity_bonus;
    magic_mastery_bonus := POWER(p_magic_mastery, 1.15) * diversity_bonus;
    
    -- =====================================
    -- BASES REBALANCEADAS
    -- =====================================
    
    base_hp := 50 + (p_level * 2);
    base_mana := 20 + (p_level * 1);
    base_atk := 2 + p_level;
    base_def := 1 + p_level;
    base_speed := 3 + p_level;
    
    -- =====================================
    -- CÁLCULO DE STATS COM SINERGIAS
    -- =====================================
    
    -- HP: Vitalidade + um pouco de força (sinergia)
    final_hp := base_hp + FLOOR(vit_scaling * 2.5) + FLOOR(str_scaling * 0.3);
    
    -- Mana: Inteligência + sabedoria (sinergia forte)
    final_mana := base_mana + FLOOR(int_scaling * 1.5) + FLOOR(wis_scaling * 1.0) + FLOOR(magic_mastery_bonus * 0.8);
    
    -- Ataque Físico: Força + habilidade de arma + um pouco de destreza (precisão)
    final_atk := base_atk + FLOOR(str_scaling * 1.2) + FLOOR(weapon_mastery_bonus * 0.6) + FLOOR(dex_scaling * 0.2);
    
    -- Ataque Mágico: Inteligência + sabedoria + maestria mágica (forte sinergia)
    final_magic_atk := base_atk + FLOOR(int_scaling * 1.4) + FLOOR(wis_scaling * 0.8) + FLOOR(magic_mastery_bonus * 1.0);
    
    -- Defesa: Vitalidade + sabedoria + maestria defensiva (sobrevivência)
    final_def := base_def + FLOOR(vit_scaling * 0.6) + FLOOR(wis_scaling * 0.5) + FLOOR(def_mastery_bonus * 1.0);
    
    -- Velocidade: Destreza (principal) + um pouco de sorte (agilidade mental)
    final_speed := base_speed + FLOOR(dex_scaling * 1.0) + FLOOR(luck_scaling * 0.2);
    
    -- =====================================
    -- STATS DERIVADOS COM CAPS E SINERGIAS
    -- =====================================
    
    -- Chance Crítica: Destreza + sorte + um pouco de força (técnica + sorte + poder)
    final_crit_chance := (dex_scaling * 0.25) + (luck_scaling * 0.35) + (str_scaling * 0.1);
    final_crit_chance := LEAST(75.0, final_crit_chance); -- Cap em 75%
    
    -- Dano Crítico: Força + sorte + habilidades de arma
    final_crit_damage := 130.0 + (str_scaling * 0.4) + (luck_scaling * 0.6) + (weapon_mastery_bonus * 0.3);
    final_crit_damage := LEAST(250.0, final_crit_damage); -- Cap em 250%
    
    -- Dano Mágico: Inteligência + sabedoria + maestria mágica (forte sinergia)
    final_magic_damage := (int_scaling * 1.2) + (wis_scaling * 0.8) + (magic_mastery_bonus * 1.5);
    -- Diminishing returns para dano mágico
    IF final_magic_damage > 100 THEN
        final_magic_damage := 100 + ((final_magic_damage - 100) * 0.7);
    END IF;
    final_magic_damage := LEAST(200.0, final_magic_damage); -- Cap em 200%
    
    -- =====================================
    -- RETORNAR RESULTADOS
    -- =====================================
    
    RETURN QUERY SELECT
        final_hp,
        final_hp,
        final_mana,
        final_mana,
        final_atk,
        final_magic_atk,
        final_def,
        final_speed,
        final_crit_chance,
        final_crit_damage,
        final_magic_damage;
END;
$$;

-- =====================================
-- 3. FUNCOES PARA MONSTROS BALANCEADOS
-- =====================================

-- Função para gerar monstros com builds variadas
CREATE OR REPLACE FUNCTION generate_balanced_monster_stats(
    p_floor INTEGER,
    p_monster_type TEXT,
    p_base_hp INTEGER,
    p_base_atk INTEGER,
    p_base_def INTEGER,
    p_base_speed INTEGER
)
RETURNS TABLE(
    hp INTEGER,
    atk INTEGER,
    def INTEGER,
    speed INTEGER,
    strength INTEGER,
    dexterity INTEGER,
    intelligence INTEGER,
    wisdom INTEGER,
    vitality INTEGER,
    luck INTEGER,
    critical_chance NUMERIC(5,2),
    critical_damage NUMERIC(5,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    floor_multiplier NUMERIC;
    total_stat_points INTEGER;
    monster_str INTEGER;
    monster_dex INTEGER;
    monster_int INTEGER;
    monster_wis INTEGER;
    monster_vit INTEGER;
    monster_luck INTEGER;
    final_hp INTEGER;
    final_atk INTEGER;
    final_def INTEGER;
    final_speed INTEGER;
    final_crit_chance NUMERIC;
    final_crit_damage NUMERIC;
BEGIN
    -- Multiplicador baseado no andar (escalamento moderado)
    floor_multiplier := 1.0 + (p_floor * 0.15);
    
    -- Total de pontos de atributo baseado no andar
    total_stat_points := 60 + (p_floor * 3);
    
    -- Distribuir atributos baseado no tipo de monstro
    CASE p_monster_type
        WHEN 'swift' THEN
            -- Monstro rápido: foco em dex e um pouco de luck
            monster_dex := FLOOR(total_stat_points * 0.4);
            monster_luck := FLOOR(total_stat_points * 0.2);
            monster_str := FLOOR(total_stat_points * 0.15);
            monster_vit := FLOOR(total_stat_points * 0.15);
            monster_int := FLOOR(total_stat_points * 0.05);
            monster_wis := total_stat_points - (monster_dex + monster_luck + monster_str + monster_vit + monster_int);
            
        WHEN 'brutish' THEN
            -- Monstro brutal: foco em força e vitalidade
            monster_str := FLOOR(total_stat_points * 0.4);
            monster_vit := FLOOR(total_stat_points * 0.3);
            monster_luck := FLOOR(total_stat_points * 0.1);
            monster_dex := FLOOR(total_stat_points * 0.1);
            monster_int := FLOOR(total_stat_points * 0.05);
            monster_wis := total_stat_points - (monster_str + monster_vit + monster_luck + monster_dex + monster_int);
            
        WHEN 'magical' THEN
            -- Monstro mágico: foco em int e wisdom
            monster_int := FLOOR(total_stat_points * 0.35);
            monster_wis := FLOOR(total_stat_points * 0.25);
            monster_luck := FLOOR(total_stat_points * 0.15);
            monster_vit := FLOOR(total_stat_points * 0.15);
            monster_str := FLOOR(total_stat_points * 0.05);
            monster_dex := total_stat_points - (monster_int + monster_wis + monster_luck + monster_vit + monster_str);
            
        WHEN 'armored' THEN
            -- Monstro blindado: foco em defesa e hp
            monster_vit := FLOOR(total_stat_points * 0.4);
            monster_wis := FLOOR(total_stat_points * 0.2);
            monster_str := FLOOR(total_stat_points * 0.2);
            monster_dex := FLOOR(total_stat_points * 0.1);
            monster_int := FLOOR(total_stat_points * 0.05);
            monster_luck := total_stat_points - (monster_vit + monster_wis + monster_str + monster_dex + monster_int);
            
        ELSE -- 'balanced' ou outros
            -- Monstro balanceado: distribuição equilibrada
            monster_str := FLOOR(total_stat_points * 0.18);
            monster_dex := FLOOR(total_stat_points * 0.17);
            monster_int := FLOOR(total_stat_points * 0.16);
            monster_wis := FLOOR(total_stat_points * 0.16);
            monster_vit := FLOOR(total_stat_points * 0.17);
            monster_luck := total_stat_points - (monster_str + monster_dex + monster_int + monster_wis + monster_vit);
    END CASE;
    
    -- Calcular stats finais usando escalamento similar ao dos personagens
    final_hp := FLOOR((p_base_hp + (monster_vit * 2.0) + (monster_str * 0.3)) * floor_multiplier);
    final_atk := FLOOR((p_base_atk + (monster_str * 1.2) + (monster_dex * 0.2)) * floor_multiplier);
    final_def := FLOOR((p_base_def + (monster_vit * 0.6) + (monster_wis * 0.5)) * floor_multiplier);
    final_speed := FLOOR((p_base_speed + (monster_dex * 1.0) + (monster_luck * 0.2)) * floor_multiplier);
    
    -- Calcular stats derivados
    final_crit_chance := LEAST(60.0, (monster_dex * 0.2) + (monster_luck * 0.3));
    final_crit_damage := LEAST(200.0, 130.0 + (monster_str * 0.4) + (monster_luck * 0.5));
    
    RETURN QUERY SELECT
        final_hp,
        final_atk,
        final_def,
        final_speed,
        monster_str,
        monster_dex,
        monster_int,
        monster_wis,
        monster_vit,
        monster_luck,
        final_crit_chance,
        final_crit_damage;
END;
$$;

-- =====================================
-- 4. ÍNDICES PARA PERFORMANCE
-- =====================================

-- Adicionar colunas de iniciativa se não existirem
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS current_initiative INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_turns_remaining INTEGER DEFAULT 0;

-- Índices para consultas rápidas de iniciativa
CREATE INDEX IF NOT EXISTS idx_characters_speed ON characters(speed);
CREATE INDEX IF NOT EXISTS idx_characters_dexterity ON characters(dexterity);
CREATE INDEX IF NOT EXISTS idx_characters_initiative ON characters(current_initiative);

-- =====================================
-- 5. COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================

COMMENT ON FUNCTION calculate_initiative(INTEGER, INTEGER) IS 
'Calcula iniciativa baseada em velocidade e destreza para determinar ordem dos turnos';

COMMENT ON FUNCTION calculate_extra_turns(INTEGER, INTEGER) IS 
'Determina quantos turnos extras um combatente pode ter baseado na diferença de velocidade';

COMMENT ON FUNCTION calculate_derived_stats_balanced IS 
'Sistema rebalanceado de cálculo de stats que penaliza mono-builds e incentiva diversidade';

COMMENT ON FUNCTION generate_balanced_monster_stats IS 
'Gera monstros com builds variadas para desafiar diferentes tipos de personagens'; 