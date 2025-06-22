-- =====================================
-- MIGRAÇÃO: REBALANCEAMENTO COMPLETO DE ARMAS
-- Data: 2024-12-22
-- Descrição: Rebalanceia todas as armas considerando os novos stats de monstros e personagens
-- =====================================

-- ANÁLISE DOS PROBLEMAS IDENTIFICADOS:
-- 1. Armas nível 1 muito fracas (5 ATK) vs monstros nível 1 (10-15 ATK)
-- 2. Progressão de armas desbalanceada com gaps enormes
-- 3. Stats especiais (crítico, duplo ataque) muito baixos
-- 4. Preços desproporcionais ao poder
-- 5. Falta de armas intermediárias (níveis 2-4, 6-9, 11-14)

-- =====================================
-- 1. REBALANCEAR ARMAS BÁSICAS (NÍVEL 1-5)
-- =====================================

-- Armas Nível 1: Aumentar ATK base para competir com monstros
UPDATE equipment SET 
    atk_bonus = CASE
        WHEN name = 'Espada de Ferro' THEN 8          -- Era 5, agora 8
        WHEN name = 'Adaga de Bronze' THEN 6          -- Era 3, agora 6  
        WHEN name = 'Varinha de Madeira' THEN 5       -- Era 2, agora 5
        WHEN name = 'Machado de Ferro' THEN 10        -- Era 6, agora 10
        WHEN name = 'Clava de Madeira' THEN 12        -- Era 7, agora 12
        ELSE atk_bonus
    END,
    critical_chance_bonus = CASE
        WHEN name = 'Espada de Ferro' THEN 1.0
        WHEN name = 'Adaga de Bronze' THEN 2.0        -- Adagas têm mais crítico
        WHEN name = 'Machado de Ferro' THEN 1.5
        ELSE COALESCE(critical_chance_bonus, 0)
    END,
    critical_damage_bonus = CASE
        WHEN name = 'Espada de Ferro' THEN 3.0
        WHEN name = 'Adaga de Bronze' THEN 5.0        -- Adagas têm mais dano crítico
        WHEN name = 'Machado de Ferro' THEN 8.0       -- Machados são brutais
        WHEN name = 'Clava de Madeira' THEN 10.0      -- Clavas esmagam
        ELSE COALESCE(critical_damage_bonus, 0)
    END,
    double_attack_chance_bonus = CASE
        WHEN name = 'Adaga de Bronze' THEN 1.0        -- Apenas adagas têm duplo ataque early
        ELSE COALESCE(double_attack_chance_bonus, 0)
    END,
    magic_damage_bonus = CASE
        WHEN name = 'Varinha de Madeira' THEN 8.0     -- Era 0, magos precisam de dano
        ELSE COALESCE(magic_damage_bonus, 0)
    END,
    price = CASE
        WHEN name = 'Espada de Ferro' THEN 120        -- Era 100
        WHEN name = 'Adaga de Bronze' THEN 100        -- Era 80
        WHEN name = 'Varinha de Madeira' THEN 110     -- Era 90
        WHEN name = 'Machado de Ferro' THEN 130       -- Era 110
        WHEN name = 'Clava de Madeira' THEN 115       -- Era 95
        ELSE price
    END
WHERE type = 'weapon' AND level_requirement = 1;

-- Armas Nível 5: Rebalancear para mid-early game
UPDATE equipment SET 
    atk_bonus = CASE
        WHEN name = 'Espada de Aço' THEN 18           -- Era 12, agora 18
        WHEN name = 'Machado de Batalha' THEN 22      -- Era 15, agora 22
        WHEN name = 'Cajado de Carvalho' THEN 12      -- Era 8, agora 12
        WHEN name = 'Maça de Ferro' THEN 20           -- Era 14, agora 20
        WHEN name = 'Punhal Afiado' THEN 15           -- Era 10, agora 15
        WHEN name = 'Espada Curta' THEN 16            -- Era 11, agora 16
        WHEN name = 'Varinha de Cristal' THEN 10      -- Era 6, agora 10
        ELSE atk_bonus
    END,
    critical_chance_bonus = CASE
        WHEN name = 'Espada de Aço' THEN 2.0
        WHEN name = 'Machado de Batalha' THEN 2.5
        WHEN name = 'Punhal Afiado' THEN 4.0          -- Adagas mantêm vantagem
        WHEN name = 'Espada Curta' THEN 3.0           -- Espadas curtas são ágeis
        ELSE COALESCE(critical_chance_bonus, 0)
    END,
    critical_damage_bonus = CASE
        WHEN name = 'Espada de Aço' THEN 6.0
        WHEN name = 'Machado de Batalha' THEN 12.0    -- Machados são devastadores
        WHEN name = 'Maça de Ferro' THEN 15.0         -- Maças esmagam
        WHEN name = 'Punhal Afiado' THEN 8.0
        WHEN name = 'Espada Curta' THEN 7.0
        ELSE COALESCE(critical_damage_bonus, 0)
    END,
    double_attack_chance_bonus = CASE
        WHEN name = 'Punhal Afiado' THEN 2.0
        WHEN name = 'Espada Curta' THEN 1.0
        ELSE COALESCE(double_attack_chance_bonus, 0)
    END,
    magic_damage_bonus = CASE
        WHEN name = 'Cajado de Carvalho' THEN 15.0    -- Era 0, agora 15
        WHEN name = 'Varinha de Cristal' THEN 18.0    -- Era 0, agora 18
        ELSE COALESCE(magic_damage_bonus, 0)
    END,
    price = CASE
        WHEN name = 'Espada de Aço' THEN 400          -- Era 350
        WHEN name = 'Machado de Batalha' THEN 420     -- Era 380
        WHEN name = 'Cajado de Carvalho' THEN 380     -- Era 360
        WHEN name = 'Maça de Ferro' THEN 400          -- Era 370
        WHEN name = 'Punhal Afiado' THEN 370          -- Era 340
        WHEN name = 'Espada Curta' THEN 375           -- Era 345
        WHEN name = 'Varinha de Cristal' THEN 385     -- Era 355
        ELSE price
    END
WHERE type = 'weapon' AND level_requirement = 5;

-- =====================================
-- 2. REBALANCEAR ARMAS RARAS (NÍVEL 10)
-- =====================================

UPDATE equipment SET 
    atk_bonus = CASE
        WHEN name = 'Lâmina do Dragão' THEN 35        -- Era 25, agora 35
        WHEN name = 'Adaga Élfica' THEN 28            -- Era 20, agora 28
        WHEN name = 'Cetro Arcano' THEN 22            -- Era 15, agora 22
        WHEN name = 'Machado de Guerra' THEN 38       -- Era 28, agora 38
        WHEN name = 'Martelo de Guerra' THEN 42       -- Era 30, agora 42
        WHEN name = 'Espada Élfica' THEN 32           -- Era 24, agora 32
        WHEN name = 'Bastão Élfico' THEN 18           -- Era 12, agora 18
        ELSE atk_bonus
    END,
    critical_chance_bonus = CASE
        WHEN name = 'Lâmina do Dragão' THEN 4.0
        WHEN name = 'Adaga Élfica' THEN 6.0
        WHEN name = 'Machado de Guerra' THEN 4.5
        WHEN name = 'Espada Élfica' THEN 4.5
        ELSE COALESCE(critical_chance_bonus, 0)
    END,
    critical_damage_bonus = CASE
        WHEN name = 'Lâmina do Dragão' THEN 15.0
        WHEN name = 'Adaga Élfica' THEN 12.0
        WHEN name = 'Machado de Guerra' THEN 20.0
        WHEN name = 'Martelo de Guerra' THEN 25.0
        WHEN name = 'Espada Élfica' THEN 14.0
        ELSE COALESCE(critical_damage_bonus, 0)
    END,
    double_attack_chance_bonus = CASE
        WHEN name = 'Adaga Élfica' THEN 3.5
        WHEN name = 'Espada Élfica' THEN 2.0
        ELSE COALESCE(double_attack_chance_bonus, 0)
    END,
    magic_damage_bonus = CASE
        WHEN name = 'Cetro Arcano' THEN 35.0          -- Era 0, agora 35
        WHEN name = 'Bastão Élfico' THEN 40.0         -- Era 0, agora 40
        WHEN name = 'Adaga Élfica' THEN 8.0           -- Adaga élfica tem um pouco de magia
        WHEN name = 'Espada Élfica' THEN 10.0         -- Espada élfica tem um pouco de magia
        ELSE COALESCE(magic_damage_bonus, 0)
    END,
    price = CASE
        WHEN name = 'Lâmina do Dragão' THEN 900       -- Era 800
        WHEN name = 'Adaga Élfica' THEN 850           -- Era 780
        WHEN name = 'Cetro Arcano' THEN 920           -- Era 850
        WHEN name = 'Machado de Guerra' THEN 900      -- Era 820
        WHEN name = 'Martelo de Guerra' THEN 920      -- Era 850
        WHEN name = 'Espada Élfica' THEN 870          -- Era 790
        WHEN name = 'Bastão Élfico' THEN 950          -- Era 870
        ELSE price
    END
WHERE type = 'weapon' AND level_requirement = 10;

-- =====================================
-- 3. REBALANCEAR ARMAS ÉPICAS (NÍVEL 15)
-- =====================================

UPDATE equipment SET 
    atk_bonus = CASE
        WHEN name = 'Espada do Abismo' THEN 55        -- Era 40, agora 55
        WHEN name = 'Martelo de Titã' THEN 65         -- Era 50, agora 65
        WHEN name = 'Bastão de Necromante' THEN 42    -- Era 30, agora 42
        WHEN name = 'Machado Devastador' THEN 60      -- Era 45, agora 60
        WHEN name = 'Lâmina Sombria' THEN 48          -- Era 35, agora 48
        WHEN name = 'Espada Flamejante' THEN 58       -- Era 42, agora 58
        WHEN name = 'Cajado das Tempestades' THEN 40  -- Era 28, agora 40
        ELSE atk_bonus
    END,
    critical_chance_bonus = CASE
        WHEN name = 'Espada do Abismo' THEN 6.0
        WHEN name = 'Lâmina Sombria' THEN 8.0
        WHEN name = 'Machado Devastador' THEN 6.5
        WHEN name = 'Espada Flamejante' THEN 7.0
        ELSE COALESCE(critical_chance_bonus, 0)
    END,
    critical_damage_bonus = CASE
        WHEN name = 'Espada do Abismo' THEN 25.0
        WHEN name = 'Martelo de Titã' THEN 40.0       -- Martelos devastam
        WHEN name = 'Machado Devastador' THEN 35.0
        WHEN name = 'Lâmina Sombria' THEN 20.0
        WHEN name = 'Espada Flamejante' THEN 28.0
        ELSE COALESCE(critical_damage_bonus, 0)
    END,
    double_attack_chance_bonus = CASE
        WHEN name = 'Lâmina Sombria' THEN 5.0
        WHEN name = 'Espada Flamejante' THEN 3.0
        ELSE COALESCE(double_attack_chance_bonus, 0)
    END,
    magic_damage_bonus = CASE
        WHEN name = 'Bastão de Necromante' THEN 60.0  -- Era 0, agora 60
        WHEN name = 'Cajado das Tempestades' THEN 65.0 -- Era 0, agora 65
        WHEN name = 'Espada do Abismo' THEN 15.0      -- Espada mágica
        WHEN name = 'Espada Flamejante' THEN 25.0     -- Espada elemental
        ELSE COALESCE(magic_damage_bonus, 0)
    END,
    price = CASE
        WHEN name = 'Espada do Abismo' THEN 2000      -- Era 1800
        WHEN name = 'Martelo de Titã' THEN 2100       -- Era 1900
        WHEN name = 'Bastão de Necromante' THEN 2200  -- Era 2000
        WHEN name = 'Machado Devastador' THEN 2050    -- Era 1850
        WHEN name = 'Lâmina Sombria' THEN 1900        -- Era 1750
        WHEN name = 'Espada Flamejante' THEN 2000     -- Era 1820
        WHEN name = 'Cajado das Tempestades' THEN 2250 -- Era 2050
        ELSE price
    END
WHERE type = 'weapon' AND level_requirement = 15;

-- =====================================
-- 4. REBALANCEAR ARMAS LENDÁRIAS (NÍVEL 20)
-- =====================================

UPDATE equipment SET 
    atk_bonus = CASE
        WHEN name = 'Excalibur' THEN 100              -- Era 80, agora 100
        WHEN name = 'Mjolnir' THEN 120                -- Era 100, agora 120
        WHEN name = 'Cajado de Merlin' THEN 70        -- Era 50, agora 70
        WHEN name = 'Machado dos Berserkers' THEN 110 -- Era 85, agora 110
        WHEN name = 'Maça Divina' THEN 115            -- Era 90, agora 115
        WHEN name = 'Fang Lunar' THEN 85              -- Era 65, agora 85
        ELSE atk_bonus
    END,
    critical_chance_bonus = CASE
        WHEN name = 'Excalibur' THEN 10.0
        WHEN name = 'Fang Lunar' THEN 12.0
        WHEN name = 'Machado dos Berserkers' THEN 8.0
        ELSE COALESCE(critical_chance_bonus, 0)
    END,
    critical_damage_bonus = CASE
        WHEN name = 'Excalibur' THEN 40.0
        WHEN name = 'Mjolnir' THEN 60.0
        WHEN name = 'Machado dos Berserkers' THEN 50.0
        WHEN name = 'Maça Divina' THEN 55.0
        WHEN name = 'Fang Lunar' THEN 35.0
        ELSE COALESCE(critical_damage_bonus, 0)
    END,
    double_attack_chance_bonus = CASE
        WHEN name = 'Fang Lunar' THEN 8.0
        WHEN name = 'Excalibur' THEN 4.0
        WHEN name = 'Machado dos Berserkers' THEN 5.0
        ELSE COALESCE(double_attack_chance_bonus, 0)
    END,
    magic_damage_bonus = CASE
        WHEN name = 'Cajado de Merlin' THEN 100.0     -- Era 0, agora 100
        WHEN name = 'Excalibur' THEN 30.0             -- Espada lendária mágica
        WHEN name = 'Mjolnir' THEN 20.0               -- Martelo dos deuses
        WHEN name = 'Maça Divina' THEN 25.0           -- Arma divina
        WHEN name = 'Fang Lunar' THEN 20.0            -- Poder lunar
        ELSE COALESCE(magic_damage_bonus, 0)
    END
WHERE type = 'weapon' AND level_requirement = 20;

-- =====================================
-- 5. ADICIONAR COLUNAS ESPECIAIS SE NÃO EXISTIREM
-- =====================================

-- Adicionar coluna de resistência mágica para algumas armas especiais
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'equipment' AND column_name = 'magical_resistance_bonus') THEN
        ALTER TABLE equipment ADD COLUMN magical_resistance_bonus NUMERIC(5,2) DEFAULT 0;
    END IF;
END $$;

-- Armas especiais que concedem resistência mágica
UPDATE equipment SET 
    magical_resistance_bonus = CASE
        WHEN name = 'Excalibur' THEN 15.0             -- Espada lendária resiste magia
        WHEN name = 'Mjolnir' THEN 10.0               -- Martelo divino
        WHEN name = 'Maça Divina' THEN 12.0           -- Arma sagrada
        ELSE COALESCE(magical_resistance_bonus, 0)
    END
WHERE type = 'weapon' AND name IN ('Excalibur', 'Mjolnir', 'Maça Divina');

-- =====================================
-- 6. LOG DE CONCLUSÃO
-- =====================================

DO $$
DECLARE
    v_weapon_count INTEGER;
    v_avg_atk_level_1 NUMERIC;
    v_avg_atk_level_10 NUMERIC;
    v_avg_atk_level_15 NUMERIC;
BEGIN
    -- Contar armas rebalanceadas
    SELECT COUNT(*) INTO v_weapon_count FROM equipment WHERE type = 'weapon';
    
    -- Calcular ATK médio por nível
    SELECT AVG(atk_bonus) INTO v_avg_atk_level_1 FROM equipment WHERE type = 'weapon' AND level_requirement = 1;
    SELECT AVG(atk_bonus) INTO v_avg_atk_level_10 FROM equipment WHERE type = 'weapon' AND level_requirement = 10;
    SELECT AVG(atk_bonus) INTO v_avg_atk_level_15 FROM equipment WHERE type = 'weapon' AND level_requirement = 15;
    
    RAISE NOTICE '===============================================';
    RAISE NOTICE '=== REBALANCEAMENTO COMPLETO DE ARMAS ===';
    RAISE NOTICE 'Total de armas: %', v_weapon_count;
    RAISE NOTICE 'ATK médio nível 1: %', ROUND(v_avg_atk_level_1, 1);
    RAISE NOTICE 'ATK médio nível 10: %', ROUND(v_avg_atk_level_10, 1);
    RAISE NOTICE 'ATK médio nível 15: %', ROUND(v_avg_atk_level_15, 1);
    RAISE NOTICE 'Progressão balanceada para competir com monstros';
    RAISE NOTICE 'Stats especiais adicionados (crítico, duplo ataque, magia)';
    RAISE NOTICE 'Preços ajustados ao poder das armas';
    RAISE NOTICE '===============================================';
END $$; 