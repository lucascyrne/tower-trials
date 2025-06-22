-- =====================================
-- MIGRATION: Fixed Craftable Equipment (Corrige duplicatas)
-- Data: 2024-12-22  
-- Descrição: Versão corrigida que resolve problemas de duplicatas
-- =====================================

-- Esta migração substitui a 20241222000007 com correções para duplicatas

-- Primeiro, limpar possíveis dados inconsistentes
DELETE FROM equipment_crafting_ingredients WHERE recipe_id IN (
    SELECT id FROM equipment_crafting_recipes 
    WHERE name LIKE 'Receita:%'
);

DELETE FROM equipment_crafting_recipes WHERE name LIKE 'Receita:%';

-- Limpar equipamentos craftáveis duplicados (mantém apenas os com craftable = true)
DELETE FROM equipment 
WHERE name IN (
    'Lâmina do Vazio', 'Mjolnir Menor', 'Cajado do Necromante', 'Garras Sombrias', 'Machado Vulcânico',
    'Armadura do Leviatã', 'Vestes do Arquinecromante', 'Couraça Dracônica',
    'Anel das Chamas Eternas', 'Anel do Gelo Perpétuo', 'Anel da Tempestade', 'Anel do Tempo',
    'Colar do Dragão Ancião', 'Torque dos Elementos', 'Corrente do Vazio Cósmico', 'Colar da Fênix',
    'Emblema do Conquistador', 'Talismã do Protetor', 'Medalha dos Heróis Perdidos', 'Broche do Destino',
    'Excalibur Sombria', 'Aegis Primordial', 'Anel do Criador', 'Anel da Destruição', 
    'Colar do Cosmos', 'Amuleto da Eternidade'
) AND craftable = false;

-- =====================================
-- EQUIPAMENTOS CRAFTÁVEIS ÚNICOS
-- =====================================

INSERT INTO equipment (name, description, type, weapon_subtype, rarity, level_requirement, atk_bonus, def_bonus, mana_bonus, speed_bonus, hp_bonus, critical_chance_bonus, critical_damage_bonus, double_attack_chance_bonus, magic_damage_bonus, price, is_unlocked, craftable) VALUES
    -- ARMAS CRAFTÁVEIS MÍTICAS (Nível 12-15) - Superiores aos raros da loja
    ('Lâmina do Vazio', 'Forjada com essência de Lich e escamas de dragão. Corta através das dimensões.', 'weapon', 'sword', 'epic', 12, 45, 5, 15, 8, 0, 5.0, 12, 2.0, 8.0, 2500, false, true),
    ('Mjolnir Menor', 'Versão menor do lendário martelo, forjada com núcleos de titã.', 'weapon', 'blunt', 'epic', 14, 55, 0, 0, -2, 0, 4.0, 15, 1.5, 0, 3000, false, true),
    ('Cajado do Necromante', 'Bastão imbuído com energia necrótica pura.', 'weapon', 'staff', 'epic', 13, 35, 0, 60, 3, 0, 2.5, 8, 0.5, 18.0, 2800, false, true),
    ('Garras Sombrias', 'Adagas gêmeas forjadas com cristais glaciais e essência demoníaca.', 'weapon', 'dagger', 'epic', 15, 40, 0, 20, 20, 0, 6.0, 15, 3.5, 12.0, 2700, false, true),
    ('Machado Vulcânico', 'Machado forjado com pedras de lava e coração de demônio.', 'weapon', 'axe', 'epic', 14, 50, 0, 10, 5, 0, 4.5, 18, 2.0, 6.0, 2900, false, true),
    
    -- ARMADURAS CRAFTÁVEIS MÍTICAS (Nível 12-15) - Superiores às raras da loja
    ('Armadura do Leviatã', 'Forjada com escamas de hidra e núcleos ancestrais.', 'armor', NULL, 'epic', 12, 10, 50, 15, 8, 80, 3.0, 8, 1.0, 8.0, 3200, false, true),
    ('Vestes do Arquinecromante', 'Robes tecidas com energia necrótica e cristais glaciais.', 'armor', NULL, 'epic', 13, 15, 35, 50, 5, 60, 2.5, 6, 0.5, 15.0, 3000, false, true),
    ('Couraça Dracônica', 'Armadura feita com escamas de dragão adulto e núcleos de pedra.', 'armor', NULL, 'epic', 14, 20, 45, 25, 10, 100, 4.0, 10, 1.5, 10.0, 3100, false, true),
    
    -- ANÉIS CRAFTÁVEIS MÍTICOS (Nível 12-15) - Superiores aos raros da loja
    ('Anel das Chamas Eternas', 'Forjado com essências de fogo primordial e lágrimas de dragão.', 'ring', NULL, 'epic', 12, 10, 3, 20, 5, 30, 4.0, 10, 2.0, 8.0, 2200, false, true),
    ('Anel do Gelo Perpétuo', 'Cristalizado nas profundezas geladas com magia ancestral.', 'ring', NULL, 'epic', 13, 6, 8, 35, 8, 25, 3.5, 6, 1.0, 12.0, 2400, false, true),
    ('Anel da Tempestade', 'Forjado durante uma tempestade cósmica com raios primordiais.', 'ring', NULL, 'epic', 14, 12, 5, 25, 12, 20, 5.0, 8, 2.5, 6.0, 2300, false, true),
    ('Anel do Tempo', 'Permite manipular pequenas frações temporais.', 'ring', NULL, 'epic', 15, 8, 6, 40, 15, 35, 4.5, 12, 3.0, 10.0, 2600, false, true),

    -- COLARES CRAFTÁVEIS MÍTICOS (Nível 12-15) - Superiores aos raros da loja
    ('Colar do Dragão Ancião', 'Feito com vértebras de dragão ancião e gemas de poder.', 'necklace', NULL, 'epic', 12, 15, 12, 35, 8, 50, 3.5, 8, 1.5, 12.0, 2800, false, true),
    ('Torque dos Elementos', 'Canaliza o poder de todos os elementos primordiais.', 'necklace', NULL, 'epic', 13, 12, 15, 45, 6, 60, 4.0, 10, 1.0, 15.0, 3000, false, true),
    ('Corrente do Vazio Cósmico', 'Liga o portador às energias do espaço sideral.', 'necklace', NULL, 'epic', 14, 10, 18, 50, 10, 45, 3.0, 6, 0.5, 18.0, 2700, false, true),
    ('Colar da Fênix', 'Imbuído com o poder de renascimento da fênix.', 'necklace', NULL, 'epic', 15, 18, 10, 40, 12, 70, 4.5, 12, 2.0, 10.0, 3200, false, true),

    -- AMULETOS CRAFTÁVEIS MÍTICOS (Nível 12-15) - Superiores aos raros da loja
    ('Emblema do Conquistador', 'Símbolo de poder usado por antigos imperadores.', 'amulet', NULL, 'epic', 12, 12, 8, 30, 6, 40, 3.5, 10, 1.5, 8.0, 2400, false, true),
    ('Talismã do Protetor', 'Protege o portador com barreiras mágicas ancestrais.', 'amulet', NULL, 'epic', 13, 6, 15, 35, 4, 60, 2.5, 5, 0.5, 12.0, 2600, false, true),
    ('Medalha dos Heróis Perdidos', 'Honra daqueles que sacrificaram tudo pela humanidade.', 'amulet', NULL, 'epic', 14, 15, 10, 25, 10, 45, 4.0, 8, 2.0, 6.0, 2500, false, true),
    ('Broche do Destino', 'Permite vislumbrar fragmentos do futuro.', 'amulet', NULL, 'epic', 15, 10, 12, 45, 8, 50, 3.5, 6, 1.0, 15.0, 2700, false, true),
    
    -- EQUIPAMENTOS LENDÁRIOS CRAFTÁVEIS (Nível 18+) - End Game
    ('Excalibur Sombria', 'A versão corrompida da lendária Excalibur.', 'weapon', 'sword', 'legendary', 18, 100, 30, 30, 30, 0, 8.0, 25, 4.0, 20.0, 10000, false, true),
    ('Aegis Primordial', 'Escudo lendário que protege contra todo tipo de dano.', 'armor', NULL, 'legendary', 18, 30, 100, 50, 20, 150, 6.0, 15, 2.0, 25.0, 12000, false, true),
    
    -- ACESSÓRIOS LENDÁRIOS CRAFTÁVEIS (Nível 18+) - End Game
    ('Anel do Criador', 'Forjado pelos próprios deuses para controlar a criação.', 'ring', NULL, 'legendary', 18, 20, 15, 60, 20, 80, 8.0, 20, 4.0, 25.0, 8000, false, true),
    ('Anel da Destruição', 'Contrapartida sombria do Anel do Criador.', 'ring', NULL, 'legendary', 18, 25, 10, 50, 25, 60, 10.0, 30, 5.0, 15.0, 8000, false, true),
    ('Colar do Cosmos', 'Liga o portador ao tecido do próprio universo.', 'necklace', NULL, 'legendary', 19, 25, 25, 80, 15, 120, 6.0, 18, 3.0, 30.0, 10000, false, true),
    ('Amuleto da Eternidade', 'Concede compreensão sobre os mistérios do tempo infinito.', 'amulet', NULL, 'legendary', 20, 20, 20, 75, 20, 100, 7.0, 15, 3.5, 35.0, 9000, false, true);

-- =====================================
-- LOG DE CONCLUSÃO
-- =====================================

DO $$
BEGIN
    RAISE NOTICE '====================================';
    RAISE NOTICE 'EQUIPAMENTOS CRAFTÁVEIS CORRIGIDOS';
    RAISE NOTICE 'Data: 2024-12-22 - VERSÃO LIMPA';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Correções aplicadas:';
    RAISE NOTICE '[OK] Duplicatas removidas';
    RAISE NOTICE '[OK] Equipamentos craftáveis únicos criados';
    RAISE NOTICE '[OK] Sistema de crafting preparado';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'PRONTO PARA CRIAÇÃO DE RECEITAS!';
    RAISE NOTICE '====================================';
END $$; 