-- =====================================
-- MIGRAÇÃO: Reorganizar Armaduras Existentes
-- Data: 2024-12-22
-- Descrição: Converte armaduras existentes para os novos tipos específicos
-- =====================================

-- =====================================
-- 1. CONVERTER ARMADURAS BASEADO NO NOME
-- =====================================

-- Converter armaduras que são claramente peitorais
UPDATE equipment 
SET type = 'chest'::equipment_type
WHERE type = 'armor' 
AND (
  name ILIKE '%armadura%' OR 
  name ILIKE '%couraça%' OR
  name ILIKE '%peitoral%' OR
  name ILIKE '%manto%' OR
  name ILIKE '%túnica%' OR
  name ILIKE '%corselete%' OR
  name ILIKE '%gibão%' OR
  name ILIKE '%casaco%' OR
  name ILIKE '%chest%' OR
  name ILIKE '%armor%' OR
  name ILIKE '%vest%' OR
  name ILIKE '%robe%' OR
  name ILIKE '%chainmail%'
);

-- Converter armaduras que são claramente capacetes/elmos
UPDATE equipment 
SET type = 'helmet'::equipment_type
WHERE type = 'armor' 
AND (
  name ILIKE '%elmo%' OR 
  name ILIKE '%capacete%' OR
  name ILIKE '%helm%' OR
  name ILIKE '%tiara%' OR
  name ILIKE '%coroa%' OR
  name ILIKE '%capuz%' OR
  name ILIKE '%chapéu%' OR
  name ILIKE '%cabeça%'
);

-- Converter armaduras que são claramente perneiras/calças
UPDATE equipment 
SET type = 'legs'::equipment_type
WHERE type = 'armor' 
AND (
  name ILIKE '%perneira%' OR 
  name ILIKE '%calça%' OR
  name ILIKE '%saia%' OR
  name ILIKE '%kilt%' OR
  name ILIKE '%shorts%' OR
  name ILIKE '%leggings%' OR
  name ILIKE '%pants%' OR
  name ILIKE '%greaves%'
);

-- Converter armaduras que são claramente botas/calçados
UPDATE equipment 
SET type = 'boots'::equipment_type
WHERE type = 'armor' 
AND (
  name ILIKE '%bota%' OR 
  name ILIKE '%sapato%' OR
  name ILIKE '%sandália%' OR
  name ILIKE '%chinelo%' OR
  name ILIKE '%sapatilha%' OR
  name ILIKE '%boots%' OR
  name ILIKE '%shoes%' OR
  name ILIKE '%sandals%'
);

-- =====================================
-- 2. CONVERTER ESCUDOS PARA TIPO ESPECIAL
-- =====================================

-- Escudos permanecem como 'armor' para compatibilidade com sistema off-hand
-- Não fazer nada com escudos por enquanto

-- =====================================
-- 3. CONVERTER ARMADURAS RESTANTES PARA CHEST
-- =====================================

-- Todas as armaduras restantes que não foram categorizadas viram chest (peitorais)
UPDATE equipment 
SET type = 'chest'::equipment_type
WHERE type = 'armor' 
AND name NOT ILIKE '%escudo%' 
AND name NOT ILIKE '%shield%' 
AND name NOT ILIKE '%broquel%';

-- =====================================
-- 4. ATUALIZAR CHARACTER_EQUIPMENT SLOTS
-- =====================================

-- Atualizar slot_type de equipamentos já equipados
UPDATE character_equipment 
SET slot_type = 'chest'
WHERE slot_type = 'armor' 
AND equipment_id IN (
    SELECT id FROM equipment WHERE type = 'chest'
);

-- =====================================
-- 5. ADICIONAR COLUNAS PARA RESISTÊNCIAS SE NÃO EXISTIR
-- =====================================

-- Adicionar coluna de resistência crítica se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'equipment' AND column_name = 'critical_resistance_bonus') THEN
        ALTER TABLE equipment ADD COLUMN critical_resistance_bonus NUMERIC(5,2) DEFAULT 0;
    END IF;
END $$;

-- =====================================
-- 6. REBALANCEAR BÔNUS POR TIPO
-- =====================================

-- Peitorais: Foco em HP e defesa
UPDATE equipment 
SET 
    hp_bonus = FLOOR(hp_bonus * 1.2),
    def_bonus = FLOOR(def_bonus * 1.1)
WHERE type = 'chest';

-- Capacetes: Foco em mana e resistências especiais
UPDATE equipment 
SET 
    mana_bonus = FLOOR(mana_bonus * 1.3 + level_requirement * 2),
    critical_resistance_bonus = COALESCE(critical_resistance_bonus, 0) + FLOOR(level_requirement * 0.5)
WHERE type = 'helmet';

-- Perneiras: Foco em velocidade e HP
UPDATE equipment 
SET 
    speed_bonus = FLOOR(speed_bonus * 1.4 + level_requirement * 1),
    hp_bonus = FLOOR(hp_bonus * 0.8)
WHERE type = 'legs';

-- Botas: Foco em velocidade e stats especiais
UPDATE equipment 
SET 
    speed_bonus = FLOOR(speed_bonus * 1.5 + level_requirement * 1.5),
    double_attack_chance_bonus = COALESCE(double_attack_chance_bonus, 0) + FLOOR(level_requirement * 0.1)
WHERE type = 'boots';

-- =====================================
-- 7. LOG DE CONCLUSÃO
-- =====================================

DO $$
DECLARE
    v_chest_count INTEGER;
    v_helmet_count INTEGER;
    v_legs_count INTEGER;
    v_boots_count INTEGER;
    v_armor_remaining INTEGER;
BEGIN
    -- Contar equipamentos por tipo
    SELECT COUNT(*) INTO v_chest_count FROM equipment WHERE type = 'chest';
    SELECT COUNT(*) INTO v_helmet_count FROM equipment WHERE type = 'helmet';
    SELECT COUNT(*) INTO v_legs_count FROM equipment WHERE type = 'legs';
    SELECT COUNT(*) INTO v_boots_count FROM equipment WHERE type = 'boots';
    SELECT COUNT(*) INTO v_armor_remaining FROM equipment WHERE type = 'armor';
    
    RAISE NOTICE '===============================================';
    RAISE NOTICE '=== REORGANIZAÇÃO DE ARMADURAS COMPLETA ===';
    RAISE NOTICE 'Peitorais (chest): % equipamentos', v_chest_count;
    RAISE NOTICE 'Capacetes (helmet): % equipamentos', v_helmet_count;
    RAISE NOTICE 'Perneiras (legs): % equipamentos', v_legs_count;
    RAISE NOTICE 'Botas (boots): % equipamentos', v_boots_count;
    RAISE NOTICE 'Armaduras restantes (escudos): % equipamentos', v_armor_remaining;
    RAISE NOTICE 'Bônus rebalanceados por categoria';
    RAISE NOTICE 'Slots atualizados automaticamente';
    RAISE NOTICE '===============================================';
END $$; 