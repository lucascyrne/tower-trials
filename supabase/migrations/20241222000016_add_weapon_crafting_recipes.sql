-- =====================================
-- MIGRAÇÃO: RECEITAS DE CRAFTING PARA NOVAS ARMAS
-- Data: 2024-12-22
-- Descrição: Adiciona receitas craftáveis para as novas armas early e mid game
-- =====================================

-- Esta migração adiciona:
-- 1. Receitas para armas níveis 2-4 (early game)
-- 2. Receitas para armas níveis 6-9 (mid-early game)
-- 3. Receitas para armas níveis 11-14 (mid game)
-- 4. Ingredientes balanceados usando drops existentes
-- 5. Progressão de crafting acessível mas desafiadora

-- Primeiro, marcar as novas armas como craftáveis
UPDATE equipment SET craftable = true 
WHERE type = 'weapon' 
AND level_requirement IN (2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14)
AND name IN (
    'Espada Afiada', 'Adaga de Ferro', 'Bastão de Madeira', 'Machado Leve', 'Martelo Pequeno',
    'Lâmina Polida', 'Punhal Curvado', 'Varinha Encantada', 'Machado de Bronze', 'Maza de Guerra',
    'Espada Temperada', 'Adaga Serrilhada', 'Cetro Menor', 'Machado Pesado', 'Martelo de Ferro',
    'Espada do Soldado', 'Adaga Venenosa', 'Bastão de Cristal', 'Machado Bárbaro', 'Martelo de Batalha',
    'Lâmina Élfica Menor', 'Stiletto', 'Cajado de Prata', 'Machado Duplo', 'Maça Cravejada',
    'Espada do Cavaleiro', 'Adaga da Lua', 'Bastão do Sábio', 'Machado do Executor', 'Martelo do Forjador',
    'Espada Encantada', 'Adaga das Sombras', 'Cetro de Energia', 'Machado Sangrento', 'Martelo do Trovão',
    'Lâmina do Vento', 'Adaga Viper', 'Bastão da Tempestade', 'Machado do Berserker', 'Martelo dos Ancestrais',
    'Espada do Paladino', 'Adaga do Assassino', 'Cajado do Arquimago', 'Machado Tribal', 'Martelo Sagrado',
    'Espada Flamejante Menor', 'Adaga do Caos', 'Bastão Cristalino', 'Machado Demoníaco', 'Martelo da Justiça',
    'Lâmina Espectral', 'Adaga do Vazio', 'Cetro Real', 'Machado do Apocalipse', 'Martelo Cósmico'
);

-- =====================================
-- 1. RECEITAS EARLY GAME (NÍVEIS 2-4)
-- =====================================

INSERT INTO equipment_crafting_recipes (result_equipment_id, name, description) VALUES
    -- NÍVEL 2
    ((SELECT id FROM equipment WHERE name = 'Espada Afiada' LIMIT 1), 'Receita: Espada Afiada', 'Afia uma espada básica com técnicas simples'),
    ((SELECT id FROM equipment WHERE name = 'Adaga de Ferro' LIMIT 1), 'Receita: Adaga de Ferro', 'Forja uma adaga rápida de ferro'),
    ((SELECT id FROM equipment WHERE name = 'Bastão de Madeira' LIMIT 1), 'Receita: Bastão de Madeira', 'Talla um bastão mágico básico'),
    ((SELECT id FROM equipment WHERE name = 'Machado Leve' LIMIT 1), 'Receita: Machado Leve', 'Cria um machado ágil e eficaz'),
    ((SELECT id FROM equipment WHERE name = 'Martelo Pequeno' LIMIT 1), 'Receita: Martelo Pequeno', 'Forja um martelo compacto'),
    
    -- NÍVEL 3
    ((SELECT id FROM equipment WHERE name = 'Lâmina Polida' LIMIT 1), 'Receita: Lâmina Polida', 'Poli uma lâmina até o brilho perfeito'),
    ((SELECT id FROM equipment WHERE name = 'Punhal Curvado' LIMIT 1), 'Receita: Punhal Curvado', 'Curva uma lâmina para cortes precisos'),
    ((SELECT id FROM equipment WHERE name = 'Varinha Encantada' LIMIT 1), 'Receita: Varinha Encantada', 'Encanta uma varinha com magia básica'),
    ((SELECT id FROM equipment WHERE name = 'Machado de Bronze' LIMIT 1), 'Receita: Machado de Bronze', 'Forja um machado resistente de bronze'),
    ((SELECT id FROM equipment WHERE name = 'Maza de Guerra' LIMIT 1), 'Receita: Maza de Guerra', 'Cria uma maza pesada para combate'),
    
    -- NÍVEL 4
    ((SELECT id FROM equipment WHERE name = 'Espada Temperada' LIMIT 1), 'Receita: Espada Temperada', 'Tempera uma espada com fogo e água'),
    ((SELECT id FROM equipment WHERE name = 'Adaga Serrilhada' LIMIT 1), 'Receita: Adaga Serrilhada', 'Serrilha uma adaga para máximo dano'),
    ((SELECT id FROM equipment WHERE name = 'Cetro Menor' LIMIT 1), 'Receita: Cetro Menor', 'Monta um cetro com cristal pequeno'),
    ((SELECT id FROM equipment WHERE name = 'Machado Pesado' LIMIT 1), 'Receita: Machado Pesado', 'Forja um machado de cabeça dupla'),
    ((SELECT id FROM equipment WHERE name = 'Martelo de Ferro' LIMIT 1), 'Receita: Martelo de Ferro', 'Cria um martelo sólido de ferro'),

    -- NÍVEL 6-9 (Seleção das mais importantes)
    ((SELECT id FROM equipment WHERE name = 'Espada do Soldado' LIMIT 1), 'Receita: Espada do Soldado', 'Forja espada padrão militar'),
    ((SELECT id FROM equipment WHERE name = 'Adaga Venenosa' LIMIT 1), 'Receita: Adaga Venenosa', 'Trata lâmina com venenos mortais'),
    ((SELECT id FROM equipment WHERE name = 'Bastão de Cristal' LIMIT 1), 'Receita: Bastão de Cristal', 'Incrusta cristal mágico em bastão'),
    ((SELECT id FROM equipment WHERE name = 'Machado Bárbaro' LIMIT 1), 'Receita: Machado Bárbaro', 'Forja machado tribal selvagem'),
    ((SELECT id FROM equipment WHERE name = 'Martelo de Batalha' LIMIT 1), 'Receita: Martelo de Batalha', 'Cria martelo para grandes batalhas'),
    
    -- NÍVEL 11-14 (Seleção das mais importantes)
    ((SELECT id FROM equipment WHERE name = 'Lâmina do Vento' LIMIT 1), 'Receita: Lâmina do Vento', 'Forja espada leve como o vento'),
    ((SELECT id FROM equipment WHERE name = 'Adaga Viper' LIMIT 1), 'Receita: Adaga Viper', 'Cria adaga mortal como víbora'),
    ((SELECT id FROM equipment WHERE name = 'Bastão da Tempestade' LIMIT 1), 'Receita: Bastão da Tempestade', 'Controla ventos e tempestades'),
    ((SELECT id FROM equipment WHERE name = 'Machado do Berserker' LIMIT 1), 'Receita: Machado do Berserker', 'Desperta fúria interior'),
    ((SELECT id FROM equipment WHERE name = 'Martelo dos Ancestrais' LIMIT 1), 'Receita: Martelo dos Ancestrais', 'Abençoado pelos ancestrais');

-- =====================================
-- 2. INGREDIENTES PARA RECEITAS EARLY GAME (NÍVEIS 2-4)
-- =====================================

INSERT INTO equipment_crafting_ingredients (recipe_id, item_id, item_type, quantity) VALUES
    -- NÍVEL 2 - Ingredientes muito básicos
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Espada Afiada' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Dente de Rato' LIMIT 1), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Espada Afiada' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Olho de Slime' LIMIT 1), 'monster_drop', 1),
    
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Adaga de Ferro' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Garra de Goblin' LIMIT 1), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Adaga de Ferro' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Dente de Rato' LIMIT 1), 'monster_drop', 1),
    
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Bastão de Madeira' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Gosma Azulada' LIMIT 1), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Bastão de Madeira' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Olho de Slime' LIMIT 1), 'monster_drop', 1),
    
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Machado Leve' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Escama de Kobold' LIMIT 1), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Machado Leve' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Garra de Goblin' LIMIT 1), 'monster_drop', 1),
    
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Martelo Pequeno' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Fragmento de Osso' LIMIT 1), 'monster_drop', 3),
    
    -- NÍVEL 3 - Ingredientes um pouco mais complexos
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Lâmina Polida' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Presa de Lobo' LIMIT 1), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Lâmina Polida' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Escama de Kobold' LIMIT 1), 'monster_drop', 2),
    
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Punhal Curvado' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Glândula Venenosa' LIMIT 1), 'monster_drop', 1),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Punhal Curvado' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Garra de Goblin' LIMIT 1), 'monster_drop', 2),
    
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Varinha Encantada' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Gosma Azulada' LIMIT 1), 'monster_drop', 3),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Varinha Encantada' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Fragmento de Osso' LIMIT 1), 'monster_drop', 1),
    
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Machado de Bronze' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Presa de Lobo' LIMIT 1), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Machado de Bronze' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Fragmento de Osso' LIMIT 1), 'monster_drop', 2),
    
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Maza de Guerra' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Fragmento de Osso' LIMIT 1), 'monster_drop', 4),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Maza de Guerra' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Presa de Lobo' LIMIT 1), 'monster_drop', 1),
    
    -- NÍVEL 4 - Transição para mid-early
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Espada Temperada' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Presa de Orc' LIMIT 1), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Espada Temperada' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Glândula Venenosa' LIMIT 1), 'monster_drop', 1),
    
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Adaga Serrilhada' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Presa de Orc' LIMIT 1), 'monster_drop', 1),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Adaga Serrilhada' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Glândula Venenosa' LIMIT 1), 'monster_drop', 2),
    
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Cetro Menor' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Carne Putrefata' LIMIT 1), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Cetro Menor' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Gosma Azulada' LIMIT 1), 'monster_drop', 2),
    
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Machado Pesado' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Presa de Orc' LIMIT 1), 'monster_drop', 3),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Machado Pesado' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Fragmento de Osso' LIMIT 1), 'monster_drop', 2),
    
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Martelo de Ferro' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Fragmento de Pedra' LIMIT 1), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Martelo de Ferro' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Presa de Orc' LIMIT 1), 'monster_drop', 1),

    -- NÍVEL 6-9 - Drops intermediários
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Espada do Soldado' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Pena de Harpia' LIMIT 1), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Espada do Soldado' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Lascas Metálicas' LIMIT 1), 'monster_drop', 3),
    
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Adaga Venenosa' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Sangue de Morcego' LIMIT 1), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Adaga Venenosa' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Glândula Venenosa' LIMIT 1), 'monster_drop', 3),
    
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Bastão de Cristal' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Orbe Mágico' LIMIT 1), 'monster_drop', 1),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Bastão de Cristal' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Escama de Réptil' LIMIT 1), 'monster_drop', 2),
    
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Machado Bárbaro' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Garra de Alpha' LIMIT 1), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Machado Bárbaro' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Fragmento de Pedra' LIMIT 1), 'monster_drop', 3),
    
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Martelo de Batalha' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Lascas Metálicas' LIMIT 1), 'monster_drop', 4),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Martelo de Batalha' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Fragmento de Pedra' LIMIT 1), 'monster_drop', 2),

    -- NÍVEL 11-14 - Drops raros necessários
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Lâmina do Vento' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Escama de Hidra' LIMIT 1), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Lâmina do Vento' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Essência Elemental' LIMIT 1), 'monster_drop', 1),
    
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Adaga Viper' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Dente de Ogro' LIMIT 1), 'monster_drop', 1),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Adaga Viper' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Sangue de Morcego' LIMIT 1), 'monster_drop', 3),
    
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Bastão da Tempestade' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Cristal de Gelo' LIMIT 1), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Bastão da Tempestade' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Essência Elemental' LIMIT 1), 'monster_drop', 1),
    
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Machado do Berserker' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Couro de Troll' LIMIT 1), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Machado do Berserker' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Dente de Ogro' LIMIT 1), 'monster_drop', 2),
    
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Martelo dos Ancestrais' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Fragmento de Cristal' LIMIT 1), 'monster_drop', 3),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Martelo dos Ancestrais' LIMIT 1),
     (SELECT id FROM monster_drops WHERE name = 'Escama de Hidra' LIMIT 1), 'monster_drop', 1);

-- =====================================
-- 3. LOG DE CONCLUSÃO
-- =====================================

DO $$
DECLARE
    v_recipes_count INTEGER;
    v_ingredients_count INTEGER;
    v_craftable_weapons INTEGER;
BEGIN
    -- Contar receitas adicionadas
    SELECT COUNT(*) INTO v_recipes_count 
    FROM equipment_crafting_recipes 
    WHERE name LIKE 'Receita: %' 
    AND result_equipment_id IN (
        SELECT id FROM equipment 
        WHERE type = 'weapon' 
        AND level_requirement IN (2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14)
        AND craftable = true
    );
    
    -- Contar ingredientes adicionados
    SELECT COUNT(*) INTO v_ingredients_count 
    FROM equipment_crafting_ingredients 
    WHERE recipe_id IN (
        SELECT id FROM equipment_crafting_recipes 
        WHERE name LIKE 'Receita: %' 
        AND result_equipment_id IN (
            SELECT id FROM equipment 
            WHERE type = 'weapon' 
            AND level_requirement IN (2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14)
            AND craftable = true
        )
    );
    
    -- Contar armas craftáveis
    SELECT COUNT(*) INTO v_craftable_weapons 
    FROM equipment 
    WHERE type = 'weapon' 
    AND craftable = true 
    AND level_requirement IN (2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14);
    
    RAISE NOTICE '===============================================';
    RAISE NOTICE '=== RECEITAS DE CRAFTING PARA ARMAS ADICIONADAS ===';
    RAISE NOTICE 'Receitas criadas: %', v_recipes_count;
    RAISE NOTICE 'Ingredientes definidos: %', v_ingredients_count;
    RAISE NOTICE 'Armas craftáveis: %', v_craftable_weapons;
    RAISE NOTICE 'Sistema de crafting completo para early/mid game';
    RAISE NOTICE 'Progressão balanceada usando drops existentes';
    RAISE NOTICE 'Receitas acessíveis mas desafiadoras';
    RAISE NOTICE '===============================================';
END $$; 