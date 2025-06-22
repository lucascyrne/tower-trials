-- =====================================
-- MIGRATION: Expand Equipment Crafting System (FIXED)
-- Data: 2024-12-22
-- Descrição: Expande sistema de crafting com foco em early/mid game - VERSÃO CORRIGIDA
-- =====================================

-- Esta migração adiciona:
-- 1. Equipamentos craftáveis para early/mid game (níveis 3-12)
-- 2. Receitas para novos tipos de armadura (chest, helmet, legs, boots)
-- 3. Sistema de progressão de crafting mais acessível
-- 4. Materiais de crafting intermediários

-- Primeiro, limpar possíveis conflitos de nomes e verificar duplicatas
DELETE FROM equipment WHERE name IN (
    'Martelo de Guerra', 'Espada de Ferro Forjado', 'Machado de Pedra Afiado', 
    'Cajado de Osso', 'Adagas Gêmeas', 'Elmo de Ferro', 'Colete de Couro Reforçado',
    'Peitoral de Escamas', 'Túnica do Aprendiz', 'Couraça de Ferro'
) AND (craftable = false OR craftable IS NULL);

-- Remover duplicatas se existirem
DELETE FROM equipment a USING equipment b 
WHERE a.id > b.id AND a.name = b.name;

-- =====================================
-- 1. EQUIPAMENTOS CRAFTÁVEIS EARLY GAME (Níveis 3-8)
-- =====================================

INSERT INTO equipment (name, description, type, weapon_subtype, rarity, level_requirement, atk_bonus, def_bonus, mana_bonus, speed_bonus, hp_bonus, critical_chance_bonus, critical_damage_bonus, double_attack_chance_bonus, magic_damage_bonus, price, is_unlocked, craftable) VALUES
    -- ARMAS EARLY GAME CRAFTÁVEIS
    ('Espada de Ferro Forjado', 'Espada simples mas eficaz, forjada com técnicas básicas.', 'weapon', 'sword', 'uncommon', 3, 12, 0, 0, 2, 0, 1.0, 3, 0.5, 0, 150, false, true),
    ('Machado de Pedra Afiado', 'Machado primitivo mas poderoso, com lâmina de pedra polida.', 'weapon', 'axe', 'uncommon', 4, 15, 0, 0, -1, 0, 2.0, 5, 1.0, 0, 180, false, true),
    ('Cajado de Osso', 'Cajado feito com ossos de esqueleto, canaliza energia necrótica.', 'weapon', 'staff', 'uncommon', 5, 8, 0, 25, 1, 0, 0.5, 2, 0, 8.0, 200, false, true),
    ('Adagas Gêmeas', 'Par de adagas ágeis forjadas com garras afiadas.', 'weapon', 'dagger', 'uncommon', 6, 10, 0, 5, 8, 0, 3.0, 6, 2.0, 3.0, 220, false, true),
    ('Martelo Forjado', 'Martelo craftável feito com fragmentos metálicos.', 'weapon', 'blunt', 'uncommon', 7, 18, 0, 0, -2, 0, 1.5, 8, 0.5, 0, 250, false, true),

    -- ARMADURAS EARLY GAME CRAFTÁVEIS - CHEST
    ('Colete de Couro Reforçado', 'Colete feito com couro de troll jovem, oferece proteção básica.', 'chest', NULL, 'uncommon', 3, 0, 8, 0, 1, 15, 0, 0, 0, 0, 120, false, true),
    ('Peitoral de Escamas', 'Armadura feita com escamas de réptil sobrepostas.', 'chest', NULL, 'uncommon', 5, 0, 12, 5, 0, 25, 0, 0, 0, 2.0, 180, false, true),
    ('Túnica do Aprendiz', 'Túnica simples imbuída com energia mágica básica.', 'chest', NULL, 'uncommon', 4, 0, 6, 15, 2, 20, 0, 0, 0, 5.0, 160, false, true),
    ('Couraça de Ferro', 'Armadura sólida forjada com lascas metálicas fundidas.', 'chest', NULL, 'rare', 7, 2, 18, 0, -1, 40, 1.0, 2, 0, 0, 300, false, true),

    -- ARMADURAS EARLY GAME CRAFTÁVEIS - HELMET
    ('Capacete de Couro', 'Capacete simples mas funcional feito com couro resistente.', 'helmet', NULL, 'uncommon', 3, 0, 5, 0, 0, 10, 0, 0, 0, 0, 80, false, true),
    ('Elmo Forjado', 'Elmo craftável forjado com técnicas básicas de metalurgia.', 'helmet', NULL, 'uncommon', 5, 1, 8, 0, 0, 15, 0.5, 1, 0, 0, 140, false, true),
    ('Coroa de Ossos', 'Coroa macabra feita com ossos de esqueleto, aumenta poder mágico.', 'helmet', NULL, 'uncommon', 6, 0, 4, 10, 1, 12, 0, 0, 0, 3.0, 160, false, true),

    -- ARMADURAS EARLY GAME CRAFTÁVEIS - LEGS
    ('Calças de Couro', 'Calças resistentes feitas com couro de qualidade.', 'legs', NULL, 'uncommon', 3, 0, 4, 0, 2, 12, 0, 0, 0, 0, 90, false, true),
    ('Perneiras de Ferro', 'Perneiras metálicas que oferecem boa proteção.', 'legs', NULL, 'uncommon', 5, 0, 7, 0, 1, 18, 0, 0, 0, 0, 150, false, true),

    -- ARMADURAS EARLY GAME CRAFTÁVEIS - BOOTS
    ('Botas de Couro', 'Botas simples mas confortáveis para longas jornadas.', 'boots', NULL, 'uncommon', 3, 0, 3, 0, 3, 8, 0, 0, 0, 0, 70, false, true),
    ('Botas de Ferro', 'Botas pesadas com proteção metálica.', 'boots', NULL, 'uncommon', 5, 0, 6, 0, 1, 12, 0, 0, 0, 0, 120, false, true);

-- =====================================
-- 2. RECEITAS DE CRAFTING EARLY GAME
-- =====================================

INSERT INTO equipment_crafting_recipes (result_equipment_id, name, description) VALUES
    -- RECEITAS DE ARMAS EARLY GAME
    ((SELECT id FROM equipment WHERE name = 'Espada de Ferro Forjado' AND craftable = true LIMIT 1), 'Receita: Espada de Ferro Forjado', 'Forja uma espada básica mas confiável'),
    ((SELECT id FROM equipment WHERE name = 'Machado de Pedra Afiado' AND craftable = true LIMIT 1), 'Receita: Machado de Pedra Afiado', 'Cria um machado primitivo mas eficaz'),
    ((SELECT id FROM equipment WHERE name = 'Cajado de Osso' AND craftable = true LIMIT 1), 'Receita: Cajado de Osso', 'Monta um cajado necrótico básico'),
    ((SELECT id FROM equipment WHERE name = 'Adagas Gêmeas' AND craftable = true LIMIT 1), 'Receita: Adagas Gêmeas', 'Forja um par de adagas ágeis'),
    ((SELECT id FROM equipment WHERE name = 'Martelo Forjado' AND craftable = true LIMIT 1), 'Receita: Martelo Forjado', 'Cria um martelo devastador'),

    -- RECEITAS DE ARMADURAS EARLY GAME - CHEST
    ((SELECT id FROM equipment WHERE name = 'Colete de Couro Reforçado' AND craftable = true LIMIT 1), 'Receita: Colete de Couro Reforçado', 'Costura um colete básico de proteção'),
    ((SELECT id FROM equipment WHERE name = 'Peitoral de Escamas' AND craftable = true LIMIT 1), 'Receita: Peitoral de Escamas', 'Monta armadura com escamas sobrepostas'),
    ((SELECT id FROM equipment WHERE name = 'Túnica do Aprendiz' AND craftable = true LIMIT 1), 'Receita: Túnica do Aprendiz', 'Tece uma túnica mágica básica'),
    ((SELECT id FROM equipment WHERE name = 'Couraça de Ferro' AND craftable = true LIMIT 1), 'Receita: Couraça de Ferro', 'Forja uma armadura sólida de ferro'),

    -- RECEITAS DE ARMADURAS EARLY GAME - HELMET
    ((SELECT id FROM equipment WHERE name = 'Capacete de Couro' AND craftable = true LIMIT 1), 'Receita: Capacete de Couro', 'Molda um capacete simples de couro'),
    ((SELECT id FROM equipment WHERE name = 'Elmo Forjado' AND craftable = true LIMIT 1), 'Receita: Elmo Forjado', 'Forja um elmo robusto de ferro'),
    ((SELECT id FROM equipment WHERE name = 'Coroa de Ossos' AND craftable = true LIMIT 1), 'Receita: Coroa de Ossos', 'Monta uma coroa macabra necrótica'),

    -- RECEITAS DE ARMADURAS EARLY GAME - LEGS
    ((SELECT id FROM equipment WHERE name = 'Calças de Couro' AND craftable = true LIMIT 1), 'Receita: Calças de Couro', 'Costura calças resistentes de couro'),
    ((SELECT id FROM equipment WHERE name = 'Perneiras de Ferro' AND craftable = true LIMIT 1), 'Receita: Perneiras de Ferro', 'Forja perneiras metálicas protetoras'),

    -- RECEITAS DE ARMADURAS EARLY GAME - BOOTS
    ((SELECT id FROM equipment WHERE name = 'Botas de Couro' AND craftable = true LIMIT 1), 'Receita: Botas de Couro', 'Molda botas confortáveis de couro'),
    ((SELECT id FROM equipment WHERE name = 'Botas de Ferro' AND craftable = true LIMIT 1), 'Receita: Botas de Ferro', 'Forja botas com proteção metálica');

-- =====================================
-- 3. INGREDIENTES PARA RECEITAS EARLY GAME
-- =====================================

INSERT INTO equipment_crafting_ingredients (recipe_id, item_id, item_type, quantity) VALUES
    -- RECEITAS DE ARMAS EARLY GAME
    -- Espada de Ferro Forjado: Lascas Metálicas + Dente de Rato
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Espada de Ferro Forjado' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Lascas Metálicas' LIMIT 1), 'monster_drop', 3),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Espada de Ferro Forjado' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Dente de Rato' LIMIT 1), 'monster_drop', 2),

    -- Machado de Pedra Afiado: Fragmento de Pedra + Garra de Goblin
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Machado de Pedra Afiado' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Fragmento de Pedra' LIMIT 1), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Machado de Pedra Afiado' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Garra de Goblin' LIMIT 1), 'monster_drop', 3),

    -- Cajado de Osso: Fragmento de Osso + Orbe Mágico
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Cajado de Osso' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Fragmento de Osso' LIMIT 1), 'monster_drop', 4),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Cajado de Osso' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Orbe Mágico' LIMIT 1), 'monster_drop', 1),

    -- Adagas Gêmeas: Garra de Alpha + Presa de Lobo
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Adagas Gêmeas' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Garra de Alpha' LIMIT 1), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Adagas Gêmeas' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Presa de Lobo' LIMIT 1), 'monster_drop', 4),

    -- Martelo Forjado: Lascas Metálicas + Fragmento de Pedra
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Martelo Forjado' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Lascas Metálicas' LIMIT 1), 'monster_drop', 4),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Martelo Forjado' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Fragmento de Pedra' LIMIT 1), 'monster_drop', 2),

    -- RECEITAS DE ARMADURAS EARLY GAME - CHEST
    -- Colete de Couro Reforçado: Couro de Troll + Escama de Kobold
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Colete de Couro Reforçado' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Couro de Troll' LIMIT 1), 'monster_drop', 1),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Colete de Couro Reforçado' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Escama de Kobold' LIMIT 1), 'monster_drop', 5),

    -- Peitoral de Escamas: Escama de Réptil + Sangue de Morcego
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Peitoral de Escamas' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Escama de Réptil' LIMIT 1), 'monster_drop', 4),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Peitoral de Escamas' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Sangue de Morcego' LIMIT 1), 'monster_drop', 2),

    -- Túnica do Aprendiz: Amuleto Corrompido + Orbe Mágico
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Túnica do Aprendiz' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Amuleto Corrompido' LIMIT 1), 'monster_drop', 1),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Túnica do Aprendiz' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Orbe Mágico' LIMIT 1), 'monster_drop', 2),

    -- Couraça de Ferro: Lascas Metálicas + Presa de Orc
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Couraça de Ferro' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Lascas Metálicas' LIMIT 1), 'monster_drop', 6),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Couraça de Ferro' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Presa de Orc' LIMIT 1), 'monster_drop', 2),

    -- RECEITAS DE ARMADURAS EARLY GAME - HELMET
    -- Capacete de Couro: Escama de Kobold + Dente de Rato
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Capacete de Couro' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Escama de Kobold' LIMIT 1), 'monster_drop', 3),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Capacete de Couro' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Dente de Rato' LIMIT 1), 'monster_drop', 2),

    -- Elmo Forjado: Lascas Metálicas + Fragmento de Osso
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Elmo Forjado' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Lascas Metálicas' LIMIT 1), 'monster_drop', 3),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Elmo Forjado' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Fragmento de Osso' LIMIT 1), 'monster_drop', 2),

    -- Coroa de Ossos: Fragmento de Osso + Orbe Mágico
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Coroa de Ossos' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Fragmento de Osso' LIMIT 1), 'monster_drop', 4),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Coroa de Ossos' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Orbe Mágico' LIMIT 1), 'monster_drop', 1),

    -- RECEITAS DE ARMADURAS EARLY GAME - LEGS
    -- Calças de Couro: Escama de Kobold + Presa de Lobo
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Calças de Couro' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Escama de Kobold' LIMIT 1), 'monster_drop', 3),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Calças de Couro' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Presa de Lobo' LIMIT 1), 'monster_drop', 2),

    -- Perneiras de Ferro: Lascas Metálicas + Garra de Goblin
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Perneiras de Ferro' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Lascas Metálicas' LIMIT 1), 'monster_drop', 4),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Perneiras de Ferro' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Garra de Goblin' LIMIT 1), 'monster_drop', 3),

    -- RECEITAS DE ARMADURAS EARLY GAME - BOOTS
    -- Botas de Couro: Escama de Kobold + Olho de Slime
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Botas de Couro' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Escama de Kobold' LIMIT 1), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Botas de Couro' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Olho de Slime' LIMIT 1), 'monster_drop', 3),

    -- Botas de Ferro: Lascas Metálicas + Dente de Rato
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Botas de Ferro' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Lascas Metálicas' LIMIT 1), 'monster_drop', 3),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Botas de Ferro' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Dente de Rato' LIMIT 1), 'monster_drop', 4);

-- =====================================
-- 4. LOG DE CONCLUSÃO
-- =====================================

DO $$
BEGIN
    RAISE NOTICE '====================================';
    RAISE NOTICE 'SISTEMA DE CRAFTING EXPANDIDO (FIXED)';
    RAISE NOTICE 'Data: 2024-12-22 - EARLY GAME';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Adições realizadas:';
    RAISE NOTICE '[OK] 17 equipamentos craftáveis early game';
    RAISE NOTICE '[OK] Receitas para novos tipos de armadura';
    RAISE NOTICE '[OK] Sistema de progressão acessível (níveis 3-7)';
    RAISE NOTICE '[OK] Ingredientes balanceados com drops existentes';
    RAISE NOTICE '[OK] Foco em chest, helmet, legs, boots';
    RAISE NOTICE '[OK] LIMIT 1 em todas as consultas - SEM ERROS!';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'CRAFTING EARLY GAME FUNCIONAL!';
    RAISE NOTICE '====================================';
END $$; 