-- =====================================
-- SCRIPT DE TESTE DE BALANCEAMENTO DE MONSTROS
-- =====================================
-- Use este script no SQL Editor do Supabase para testar o balanceamento
-- Não depende de funções complexas - testa dados diretos

-- =====================================
-- 1. VERIFICAR ESTADO ATUAL DOS MONSTROS
-- =====================================

-- Mostrar stats base atuais dos monstros
SELECT 
    min_floor,
    name,
    hp,
    atk,
    def,
    speed,
    mana,
    behavior,
    is_boss,
    reward_xp,
    reward_gold,
    CASE 
        WHEN hp <= 60 AND atk <= 20 THEN '✅ BALANCEADO'
        WHEN hp <= 120 AND atk <= 35 THEN '⚠️ MODERADO' 
        ELSE '❌ MUITO FORTE'
    END as status_balance
FROM monsters 
WHERE min_floor <= 20
ORDER BY min_floor, is_boss DESC;

-- =====================================
-- 2. ANÁLISE DE RESISTÊNCIAS
-- =====================================

-- Verificar se as resistências estão em níveis aceitáveis
SELECT 
    min_floor,
    name,
    ROUND(critical_resistance * 100, 1) as crit_res_percent,
    ROUND(physical_resistance * 100, 1) as phys_res_percent,
    ROUND(magical_resistance * 100, 1) as mag_res_percent,
    ROUND(debuff_resistance * 100, 1) as debuff_res_percent,
    CASE 
        WHEN critical_resistance <= 0.15 AND physical_resistance <= 0.12 AND magical_resistance <= 0.12 
        THEN '✅ SUSTENTÁVEL'
        WHEN critical_resistance <= 0.25 AND physical_resistance <= 0.20 AND magical_resistance <= 0.20
        THEN '⚠️ MODERADO'
        ELSE '❌ MUITO ALTO'
    END as resistance_status
FROM monsters 
WHERE min_floor <= 20
ORDER BY min_floor, is_boss DESC;

-- =====================================
-- 3. TESTE DE PROGRESSION POR ANDAR
-- =====================================

-- Verificar a progressão dos stats por andar
WITH monster_progression AS (
    SELECT 
        min_floor,
        AVG(hp) as avg_hp,
        AVG(atk) as avg_atk,
        AVG(def) as avg_def,
        COUNT(*) as monster_count
    FROM monsters 
    WHERE min_floor <= 20
    GROUP BY min_floor
    ORDER BY min_floor
),
progression_analysis AS (
    SELECT 
        min_floor,
        ROUND(avg_hp) as hp,
        ROUND(avg_atk) as atk,
        ROUND(avg_def) as def,
        monster_count,
        -- Calcular crescimento em relação ao andar anterior
        ROUND((avg_hp - LAG(avg_hp) OVER (ORDER BY min_floor)) / NULLIF(LAG(avg_hp) OVER (ORDER BY min_floor), 0) * 100, 1) as hp_growth_percent,
        ROUND((avg_atk - LAG(avg_atk) OVER (ORDER BY min_floor)) / NULLIF(LAG(avg_atk) OVER (ORDER BY min_floor), 0) * 100, 1) as atk_growth_percent
    FROM monster_progression
)
SELECT 
    min_floor,
    hp,
    atk,
    def,
    COALESCE(hp_growth_percent, 0) as hp_growth,
    COALESCE(atk_growth_percent, 0) as atk_growth,
    CASE 
        WHEN min_floor <= 5 AND hp <= 60 THEN '✅ EARLY GAME OK'
        WHEN min_floor <= 10 AND hp <= 100 THEN '✅ MID EARLY OK'
        WHEN min_floor <= 20 AND hp <= 150 THEN '✅ LATE EARLY OK'
        ELSE '❌ MUITO FORTE'
    END as progression_status
FROM progression_analysis;

-- =====================================
-- 4. VERIFICAR CHECKPOINTS
-- =====================================

-- Verificar se o checkpoint do andar 5 foi implementado
SELECT 
    'Verificação de Checkpoints' as test_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM monsters 
            WHERE min_floor = 5 AND is_boss = true
        ) THEN '✅ Checkpoint andar 5 implementado'
        ELSE '❌ Checkpoint andar 5 não encontrado'
    END as checkpoint_5_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM monsters 
            WHERE min_floor = 10 AND is_boss = true
        ) THEN '✅ Checkpoint andar 10 OK'
        ELSE '❌ Checkpoint andar 10 problema'
    END as checkpoint_10_status;

-- =====================================
-- 5. ANÁLISE DE EARLY GAME (Andares 1-10)
-- =====================================

-- Focar no early game que é crítico para retenção
SELECT 
    'EARLY GAME ANALYSIS' as section,
    min_floor,
    name,
    hp,
    atk,
    def,
    is_boss,
    reward_xp,
    reward_gold,
    CASE 
        WHEN min_floor <= 3 AND hp <= 45 AND atk <= 12 THEN '✅ TUTORIAL OK'
        WHEN min_floor = 5 AND hp <= 70 AND atk <= 18 THEN '✅ PRIMEIRO CHECKPOINT OK'
        WHEN min_floor <= 10 AND hp <= 90 AND atk <= 25 THEN '✅ EARLY GAME OK'
        ELSE '❌ MUITO DIFÍCIL PARA EARLY'
    END as early_game_status
FROM monsters 
WHERE min_floor <= 10
ORDER BY min_floor, is_boss DESC;

-- =====================================
-- 6. COMPARAÇÃO COM STATS DE PERSONAGEM TÍPICO
-- =====================================

-- Estimar se um personagem nivel 3-5 consegue enfrentar os monstros
SELECT 
    'COMPARAÇÃO PLAYER vs MONSTER' as analysis_type,
    min_floor,
    name,
    hp as monster_hp,
    atk as monster_atk,
    -- Estimar stats de personagem level 3-5
    CASE 
        WHEN min_floor <= 5 THEN 80 -- HP típico de personagem level 3-5
        WHEN min_floor <= 10 THEN 120 -- HP típico de personagem level 5-8
        ELSE 160 -- HP típico de personagem level 8+
    END as estimated_player_hp,
    CASE 
        WHEN min_floor <= 5 THEN 25 -- ATK típico de personagem level 3-5
        WHEN min_floor <= 10 THEN 35 -- ATK típico de personagem level 5-8
        ELSE 50 -- ATK típico de personagem level 8+
    END as estimated_player_atk,
    -- Análise de viabilidade
    CASE 
        WHEN hp <= (CASE WHEN min_floor <= 5 THEN 80 WHEN min_floor <= 10 THEN 120 ELSE 160 END) * 0.6
        AND atk <= (CASE WHEN min_floor <= 5 THEN 25 WHEN min_floor <= 10 THEN 35 ELSE 50 END) * 0.8
        THEN '✅ BALANCEADO - Player pode vencer'
        WHEN hp <= (CASE WHEN min_floor <= 5 THEN 80 WHEN min_floor <= 10 THEN 120 ELSE 160 END) * 1.2
        AND atk <= (CASE WHEN min_floor <= 5 THEN 25 WHEN min_floor <= 10 THEN 35 ELSE 50 END) * 1.2
        THEN '⚠️ DESAFIADOR - Precisa de estratégia/poções'
        ELSE '❌ MUITO DIFÍCIL - Fuga necessária'
    END as combat_viability
FROM monsters 
WHERE min_floor <= 15
ORDER BY min_floor;

-- =====================================
-- 7. VERIFICAR FUNÇÕES EXISTENTES
-- =====================================

-- Listar funções relacionadas a monstros para diagnosticar o erro
SELECT 
    routine_name,
    routine_type,
    data_type as return_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_name LIKE '%monster%' 
   OR routine_name LIKE '%floor%'
ORDER BY routine_name;

-- =====================================
-- 8. RESUMO EXECUTIVO
-- =====================================

-- Resumo final do status do balanceamento
WITH balance_summary AS (
    SELECT 
        COUNT(*) as total_monsters,
        COUNT(*) FILTER (WHERE min_floor <= 10 AND hp <= 90 AND atk <= 25) as early_balanced,
        COUNT(*) FILTER (WHERE critical_resistance <= 0.15) as low_resistance,
        COUNT(*) FILTER (WHERE is_boss = true AND min_floor = 5) as checkpoint_5_exists,
        COUNT(*) FILTER (WHERE min_floor <= 10) as early_monsters
    FROM monsters 
    WHERE min_floor <= 20
)
SELECT 
    '=== RESUMO DO BALANCEAMENTO ===' as summary,
    total_monsters as total_testado,
    early_balanced as early_balanceado,
    ROUND((early_balanced::NUMERIC / early_monsters) * 100, 1) as percent_early_balanceado,
    low_resistance as resistencias_baixas,
    CASE WHEN checkpoint_5_exists > 0 THEN 'SIM' ELSE 'NÃO' END as checkpoint_5_implementado,
    CASE 
        WHEN (early_balanced::NUMERIC / early_monsters) >= 0.8 AND low_resistance >= total_monsters * 0.8
        THEN '🎉 BALANCEAMENTO SUSTENTÁVEL ALCANÇADO!'
        WHEN (early_balanced::NUMERIC / early_monsters) >= 0.6
        THEN '⚠️ MELHORIAS NECESSÁRIAS'
        ELSE '❌ REBALANCEAMENTO CRÍTICO NECESSÁRIO'
    END as status_geral
FROM balance_summary;

-- =====================================
-- INSTRUÇÕES DE USO:
-- =====================================
-- 1. Copie este script completo
-- 2. Cole no SQL Editor do Supabase
-- 3. Execute seção por seção ou tudo de uma vez
-- 4. Analise os resultados de cada seção
-- 5. O resumo final dirá se o balanceamento está OK 