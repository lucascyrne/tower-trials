-- =====================================
-- MIGRAÇÃO: Receitas de Crafting para Escudos
-- Data: 2024-12-22
-- Descrição: Adiciona receitas craftáveis para escudos early e mid game
-- =====================================

-- Esta migração adiciona:
-- 1. Receitas para escudos níveis 2-8 (early game)
-- 2. Receitas para escudos níveis 9-14 (mid game) 
-- 3. Ingredientes balanceados usando drops existentes
-- 4. Progressão de crafting defensiva acessível

-- Primeiro, marcar escudos como craftáveis
UPDATE equipment SET craftable = true 
WHERE type = 'armor' 
AND is_shield(name)
AND level_requirement IN (2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14)
AND name IN (
    'Escudo de Couro', 'Escudo de Bronze', 'Broquel Reforçado', 'Escudo de Ferro',
    'Escudo do Soldado', 'Escudo de Aço', 'Escudo Rúnico', 'Escudo do Cavaleiro',
    'Escudo Élfico', 'Escudo do Guardião', 'Escudo de Cristal', 'Escudo Dracônico',
    'Escudo das Tempestades'
);

-- =====================================
-- 1. RECEITAS EARLY GAME (NÍVEIS 2-8)
-- =====================================

INSERT INTO equipment_crafting_recipes (result_equipment_id, name, description) VALUES
    -- NÍVEL 2-4 - Escudos básicos
    ((SELECT id FROM equipment WHERE name = 'Escudo de Couro' AND type = 'armor' LIMIT 1), 'Receita: Escudo de Couro', 'Constrói um escudo básico de couro curtido'),
    ((SELECT id FROM equipment WHERE name = 'Escudo de Bronze' AND type = 'armor' LIMIT 1), 'Receita: Escudo de Bronze', 'Forja um escudo circular de bronze'),
    ((SELECT id FROM equipment WHERE name = 'Broquel Reforçado' AND type = 'armor' LIMIT 1), 'Receita: Broquel Reforçado', 'Reforça um broquel com bordas metálicas'),
    
    -- NÍVEL 5-6 - Escudos de ferro
    ((SELECT id FROM equipment WHERE name = 'Escudo de Ferro' AND type = 'armor' LIMIT 1), 'Receita: Escudo de Ferro', 'Forja um escudo sólido de ferro'),
    ((SELECT id FROM equipment WHERE name = 'Escudo do Soldado' AND type = 'armor' LIMIT 1), 'Receita: Escudo do Soldado', 'Cria um escudo militar padrão'),
    
    -- NÍVEL 7-8 - Escudos avançados
    ((SELECT id FROM equipment WHERE name = 'Escudo de Aço' AND type = 'armor' LIMIT 1), 'Receita: Escudo de Aço', 'Forja um escudo pesado de aço temperado'),
    ((SELECT id FROM equipment WHERE name = 'Escudo Rúnico' AND type = 'armor' LIMIT 1), 'Receita: Escudo Rúnico', 'Grava runas de proteção em um escudo'),

    -- NÍVEL 9-14 - Escudos mid game
    ((SELECT id FROM equipment WHERE name = 'Escudo do Cavaleiro' AND type = 'armor' LIMIT 1), 'Receita: Escudo do Cavaleiro', 'Forja um escudo nobre de cavaleiro'),
    ((SELECT id FROM equipment WHERE name = 'Escudo Élfico' AND type = 'armor' LIMIT 1), 'Receita: Escudo Élfico', 'Cria um escudo élfico encantado'),
    ((SELECT id FROM equipment WHERE name = 'Escudo do Guardião' AND type = 'armor' LIMIT 1), 'Receita: Escudo do Guardião', 'Forja o escudo dos guardiões antigos'),
    ((SELECT id FROM equipment WHERE name = 'Escudo de Cristal' AND type = 'armor' LIMIT 1), 'Receita: Escudo de Cristal', 'Molda um escudo de cristal mágico'),
    ((SELECT id FROM equipment WHERE name = 'Escudo Dracônico' AND type = 'armor' LIMIT 1), 'Receita: Escudo Dracônico', 'Forja com escamas de dragão verdadeiras'),
    ((SELECT id FROM equipment WHERE name = 'Escudo das Tempestades' AND type = 'armor' LIMIT 1), 'Receita: Escudo das Tempestades', 'Canaliza o poder das tempestades');

-- =====================================
-- 2. INGREDIENTES PARA RECEITAS EARLY GAME (NÍVEIS 2-8)
-- =====================================

INSERT INTO equipment_crafting_ingredients (recipe_id, item_id, item_type, quantity) VALUES
    -- NÍVEL 2 - Escudo de Couro: materiais básicos
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Escudo de Couro' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Escama de Kobold' LIMIT 1), 'monster_drop', 4),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Escudo de Couro' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Dente de Rato' LIMIT 1), 'monster_drop', 3),
    
    -- NÍVEL 3 - Escudo de Bronze: metal básico
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Escudo de Bronze' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Fragmento de Pedra' LIMIT 1), 'monster_drop', 3),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Escudo de Bronze' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Garra de Goblin' LIMIT 1), 'monster_drop', 2),
    
    -- NÍVEL 4 - Broquel Reforçado: reforços metálicos
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Broquel Reforçado' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Lascas Metálicas' LIMIT 1), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Broquel Reforçado' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Escama de Kobold' LIMIT 1), 'monster_drop', 3),
    
    -- NÍVEL 5 - Escudo de Ferro: ferro puro
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Escudo de Ferro' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Lascas Metálicas' LIMIT 1), 'monster_drop', 4),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Escudo de Ferro' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Fragmento de Osso' LIMIT 1), 'monster_drop', 2),
    
    -- NÍVEL 6 - Escudo do Soldado: padrão militar
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Escudo do Soldado' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Presa de Orc' LIMIT 1), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Escudo do Soldado' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Lascas Metálicas' LIMIT 1), 'monster_drop', 3),
    
    -- NÍVEL 7 - Escudo de Aço: aço temperado
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Escudo de Aço' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Presa de Orc' LIMIT 1), 'monster_drop', 3),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Escudo de Aço' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Fragmento de Pedra' LIMIT 1), 'monster_drop', 4),
    
    -- NÍVEL 8 - Escudo Rúnico: runas mágicas
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Escudo Rúnico' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Orbe Mágico' LIMIT 1), 'monster_drop', 1),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Escudo Rúnico' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Lascas Metálicas' LIMIT 1), 'monster_drop', 3),

    -- NÍVEL 9 - Escudo do Cavaleiro: nobre qualidade
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Escudo do Cavaleiro' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Pena de Harpia' LIMIT 1), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Escudo do Cavaleiro' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Lascas Metálicas' LIMIT 1), 'monster_drop', 5),
    
    -- NÍVEL 10 - Escudo Élfico: encantamentos naturais
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Escudo Élfico' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Orbe Mágico' LIMIT 1), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Escudo Élfico' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Escama de Réptil' LIMIT 1), 'monster_drop', 3),
    
    -- NÍVEL 11 - Escudo do Guardião: poder ancestral
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Escudo do Guardião' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Garra de Alpha' LIMIT 1), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Escudo do Guardião' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Fragmento de Pedra' LIMIT 1), 'monster_drop', 5),
    
    -- NÍVEL 12 - Escudo de Cristal: cristal mágico
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Escudo de Cristal' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Cristal de Gelo' LIMIT 1), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Escudo de Cristal' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Orbe Mágico' LIMIT 1), 'monster_drop', 2),
    
    -- NÍVEL 13 - Escudo Dracônico: escamas de dragão
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Escudo Dracônico' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Escama de Hidra' LIMIT 1), 'monster_drop', 3),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Escudo Dracônico' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Dente de Ogro' LIMIT 1), 'monster_drop', 2),
    
    -- NÍVEL 14 - Escudo das Tempestades: poder elemental
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Escudo das Tempestades' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Essência Elemental' LIMIT 1), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Escudo das Tempestades' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Cristal de Gelo' LIMIT 1), 'monster_drop', 3);

-- =====================================
-- 3. FUNÇÃO PARA VERIFICAR ESCUDOS CRAFTÁVEIS
-- =====================================

CREATE OR REPLACE FUNCTION get_craftable_shields(p_character_level INTEGER)
RETURNS TABLE (
    shield_name TEXT,
    shield_level INTEGER,
    shield_rarity TEXT,
    def_bonus INTEGER,
    hp_bonus INTEGER,
    can_craft BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.name,
        e.level_requirement,
        e.rarity,
        e.def_bonus,
        e.hp_bonus,
        (e.level_requirement <= p_character_level) as can_craft
    FROM equipment e
    WHERE e.type = 'armor'
    AND is_shield(e.name)
    AND e.craftable = true
    ORDER BY e.level_requirement, e.name;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 4. LOG DE CONCLUSÃO
-- =====================================

DO $$
DECLARE
    v_recipes_count INTEGER;
    v_ingredients_count INTEGER;
    v_craftable_shields INTEGER;
BEGIN
    -- Contar receitas adicionadas
    SELECT COUNT(*) INTO v_recipes_count 
    FROM equipment_crafting_recipes 
    WHERE name LIKE 'Receita: %scudo%' 
    OR name LIKE 'Receita: Broquel%'
    OR name LIKE 'Receita: Aegis%';
    
    -- Contar ingredientes adicionados
    SELECT COUNT(*) INTO v_ingredients_count 
    FROM equipment_crafting_ingredients 
    WHERE recipe_id IN (
        SELECT id FROM equipment_crafting_recipes 
        WHERE name LIKE 'Receita: %scudo%' 
        OR name LIKE 'Receita: Broquel%'
        OR name LIKE 'Receita: Aegis%'
    );
    
    -- Contar escudos craftáveis
    SELECT COUNT(*) INTO v_craftable_shields 
    FROM equipment 
    WHERE type = 'armor' 
    AND is_shield(name)
    AND craftable = true;
    
    RAISE NOTICE '===============================================';
    RAISE NOTICE '=== RECEITAS DE CRAFTING PARA ESCUDOS ADICIONADAS ===';
    RAISE NOTICE 'Receitas criadas: %', v_recipes_count;
    RAISE NOTICE 'Ingredientes definidos: %', v_ingredients_count;
    RAISE NOTICE 'Escudos craftáveis: %', v_craftable_shields;
    RAISE NOTICE 'Sistema de crafting defensivo completo';
    RAISE NOTICE 'Progressão balanceada para tanques';
    RAISE NOTICE 'Receitas acessíveis mas desafiadoras';
    RAISE NOTICE 'Função auxiliar criada';
    RAISE NOTICE '===============================================';
END $$; 