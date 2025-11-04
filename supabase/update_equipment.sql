-- =============================================
-- SCRIPT DE ATUALIZAÇÃO: Equipamentos
-- Version: 1.0
-- Description: Atualiza tipos de equipamentos existentes e adiciona novos itens
-- IMPORTANTE: Execute APÓS aplicar a migration 00033_expand_equipment_types.sql
-- =============================================

-- =====================================
-- PARTE 1: VERIFICAR SE MIGRATION FOI APLICADA
-- =====================================
-- Se receber erro de tipo inválido, aplique a migration 00033 primeiro!

-- =====================================
-- PARTE 2: ATUALIZAR ACESSÓRIOS EXISTENTES PARA TIPOS ESPECÍFICOS
-- =====================================

-- Atualizar botas existentes
UPDATE equipment SET type = 'boots' WHERE name IN ('Botas Velozes', 'Botas Aladas');

-- Atualizar anéis
UPDATE equipment SET type = 'ring' WHERE name IN ('Anel de Mana', 'Anel de Força', 'Anel do Poder Supremo');

-- Atualizar amuletos/colares
UPDATE equipment SET type = 'necklace' WHERE name IN ('Amuleto de Proteção', 'Amuleto Arcano', 'Amuleto do Guardião', 'Amuleto do Tempo');

-- Manter os acessórios genéricos
UPDATE equipment SET type = 'accessory' WHERE name IN ('Braceletes de Defesa', 'Coroa da Sabedoria', 'Olho de Observador', 'Coração Petrificado', 'Asas Fantasmagóricas', 'Coração de Fênix');

-- =====================================
-- PARTE 3: ATUALIZAR TIPOS DE ARMADURA GENÉRICA PARA ESPECÍFICOS
-- =====================================

-- Atualizar peitorais (chests)
UPDATE equipment SET type = 'chest' WHERE type = 'armor';

-- =====================================
-- PARTE 4: ADICIONAR NOVOS EQUIPAMENTOS
-- =====================================

-- Inserir novos equipamentos (capacetes, perneiras, escudos)
INSERT INTO equipment (name, description, type, weapon_subtype, rarity, level_requirement, atk_bonus, def_bonus, mana_bonus, speed_bonus, price, is_unlocked, is_two_handed) VALUES
    -- =============================
    -- CAPACETES (HELMETS)
    -- =============================
    -- Common (Nível 1)
    ('Capacete de Couro', 'Proteção básica para a cabeça', 'helmet', NULL, 'common', 1, 0, 3, 0, 0, 90, true, false),
    ('Chapéu de Pano', 'Chapéu simples de tecido', 'helmet', NULL, 'common', 1, 0, 1, 3, 0, 75, true, false),
    
    -- Uncommon (Nível 5)
    ('Elmo de Ferro', 'Proteção sólida de ferro forjado', 'helmet', NULL, 'uncommon', 5, 0, 8, 0, -1, 320, true, false),
    ('Capuz Místico', 'Capuz que amplifica poder mágico', 'helmet', NULL, 'uncommon', 5, 0, 5, 8, 0, 340, true, false),
    ('Capacete Alado', 'Capacete leve com detalhes de asas', 'helmet', NULL, 'uncommon', 5, 0, 6, 0, 2, 310, true, false),
    
    -- Rare (Nível 10)
    ('Elmo de Placas', 'Elmo pesado de metal completo', 'helmet', NULL, 'rare', 10, 0, 15, 0, -2, 750, true, false),
    ('Coroa Arcana', 'Coroa imbuída com poder mágico', 'helmet', NULL, 'rare', 10, 3, 10, 15, 0, 800, true, false),
    ('Capacete Dracônico', 'Feito de escamas de dragão', 'helmet', NULL, 'rare', 10, 3, 12, 0, 3, 820, false, false),
    
    -- Epic (Nível 15)
    ('Elmo de Mithril', 'Elmo lendário de mithril', 'helmet', NULL, 'epic', 15, 3, 25, 0, 3, 1700, false, false),
    ('Diadema do Arquimago', 'Amplifica drasticamente o poder mágico', 'helmet', NULL, 'epic', 15, 5, 15, 25, 0, 1800, false, false),
    ('Máscara do Vazio', 'Máscara que oculta a existência', 'helmet', NULL, 'epic', 15, 8, 20, 10, 8, 1850, false, false),
    
    -- Legendary (Nível 20)
    ('Coroa dos Deuses', 'Coroa divina dos céus', 'helmet', NULL, 'legendary', 20, 15, 50, 40, 10, 5000, false, false),
    ('Elmo do Leviatã', 'Elmo feito da carapaça do leviatã', 'helmet', NULL, 'legendary', 20, 20, 60, 0, 20, 5000, false, false),
    ('Capuz Celestial', 'Capuz tecido com luz estelar', 'helmet', NULL, 'legendary', 20, 10, 30, 60, 15, 5000, false, false),

    -- =============================
    -- PERNEIRAS (LEGS)
    -- =============================
    -- Common (Nível 1)
    ('Calças de Couro', 'Proteção básica para as pernas', 'legs', NULL, 'common', 1, 0, 3, 0, 1, 85, true, false),
    ('Calças de Pano', 'Calças leves e confortáveis', 'legs', NULL, 'common', 1, 0, 1, 3, 2, 70, true, false),
    
    -- Uncommon (Nível 5)
    ('Perneiras de Malha', 'Proteção de anéis metálicos entrelaçados', 'legs', NULL, 'uncommon', 5, 0, 8, 0, 0, 310, true, false),
    ('Calças Reforçadas', 'Calças com reforços de couro', 'legs', NULL, 'uncommon', 5, 0, 6, 5, 1, 320, true, false),
    ('Perneiras de Escamas', 'Feitas de escamas resistentes', 'legs', NULL, 'uncommon', 5, 0, 7, 0, 2, 300, true, false),
    
    -- Rare (Nível 10)
    ('Perneiras de Placas', 'Proteção pesada de metal', 'legs', NULL, 'rare', 10, 0, 15, 0, -1, 730, true, false),
    ('Calças Elementais', 'Imbuídas com magia elemental', 'legs', NULL, 'rare', 10, 3, 10, 12, 0, 780, true, false),
    ('Perneiras Dracônicas', 'Feitas de escamas de dragão', 'legs', NULL, 'rare', 10, 3, 13, 0, 4, 800, false, false),
    
    -- Epic (Nível 15)
    ('Perneiras de Mithril', 'Leves mas extremamente resistentes', 'legs', NULL, 'epic', 15, 3, 25, 0, 4, 1650, false, false),
    ('Calças do Arquimago', 'Calças imbuídas com poder arcano', 'legs', NULL, 'epic', 15, 5, 15, 20, 0, 1750, false, false),
    ('Perneiras Sombrias', 'Aumentam mobilidade nas sombras', 'legs', NULL, 'epic', 15, 8, 18, 8, 12, 1800, false, false),
    
    -- Legendary (Nível 20)
    ('Perneiras Divinas', 'Forjadas nos céus pelos deuses', 'legs', NULL, 'legendary', 20, 15, 50, 15, 15, 5000, false, false),
    ('Calças do Leviatã', 'Feitas da pele do lendário leviatã', 'legs', NULL, 'legendary', 20, 20, 55, 0, 25, 5000, false, false),
    ('Perneiras Celestiais', 'Brilham com luz das estrelas', 'legs', NULL, 'legendary', 20, 10, 35, 50, 20, 5000, false, false),

    -- =============================
    -- ESCUDOS (SHIELDS)
    -- =============================
    -- Common (Nível 1)
    ('Escudo de Madeira', 'Escudo simples mas funcional', 'shield', NULL, 'common', 1, 0, 4, 0, -1, 95, true, false),
    ('Broquel de Bronze', 'Pequeno escudo de bronze', 'shield', NULL, 'common', 1, 1, 3, 0, 1, 85, true, false),
    
    -- Uncommon (Nível 5)
    ('Escudo de Ferro', 'Escudo resistente de ferro', 'shield', NULL, 'uncommon', 5, 0, 10, 0, -1, 330, true, false),
    ('Escudo Místico', 'Escudo com runas protetoras', 'shield', NULL, 'uncommon', 5, 0, 8, 5, 0, 350, true, false),
    ('Escudo de Escamas', 'Feito de escamas de répteis', 'shield', NULL, 'uncommon', 5, 0, 9, 0, 1, 320, true, false),
    
    -- Rare (Nível 10)
    ('Escudo de Torre', 'Grande escudo que cobre o corpo todo', 'shield', NULL, 'rare', 10, 0, 20, 0, -3, 770, true, false),
    ('Égide Arcana', 'Escudo mágico que deflecte feitiços', 'shield', NULL, 'rare', 10, 0, 15, 10, 0, 820, true, false),
    ('Escudo Dracônico', 'Forjado com escamas de dragão', 'shield', NULL, 'rare', 10, 2, 18, 0, 2, 850, false, false),
    
    -- Epic (Nível 15)
    ('Escudo de Mithril', 'Leve mas incrivelmente resistente', 'shield', NULL, 'epic', 15, 0, 30, 0, 2, 1700, false, false),
    ('Escudo Rúnico', 'Coberto com runas antigas de poder', 'shield', NULL, 'epic', 15, 3, 25, 15, 0, 1800, false, false),
    ('Égide do Guardião', 'Protege contra todos os tipos de dano', 'shield', NULL, 'epic', 15, 5, 28, 10, 3, 1850, false, false),
    
    -- Legendary (Nível 20)
    ('Escudo Divino', 'Abençoado pelos deuses', 'shield', NULL, 'legendary', 20, 10, 60, 20, 5, 5000, false, false),
    ('Égide de Atena', 'Lendário escudo da deusa da guerra', 'shield', NULL, 'legendary', 20, 15, 65, 25, 10, 5000, false, false),
    ('Escudo do Leviatã', 'Indestrutível como o próprio leviatã', 'shield', NULL, 'legendary', 20, 20, 70, 0, 15, 5000, false, false),

    -- =============================
    -- BOTAS ADICIONAIS
    -- =============================
    -- Common (Nível 1)
    ('Sandálias de Couro', 'Calçado básico e leve', 'boots', NULL, 'common', 1, 0, 1, 0, 3, 75, true, false),
    
    -- Uncommon (Nível 5)
    ('Botas de Couro Reforçado', 'Botas resistentes para combate', 'boots', NULL, 'uncommon', 5, 0, 5, 0, 5, 300, true, false),
    ('Botas Élficas', 'Botas leves que silenciam os passos', 'boots', NULL, 'uncommon', 5, 0, 3, 3, 8, 330, true, false),
    
    -- Rare (Nível 10)
    ('Botas de Ferro', 'Botas pesadas mas protetoras', 'boots', NULL, 'rare', 10, 0, 12, 0, -1, 700, true, false),
    ('Botas do Vento', 'Concedem velocidade sobrenatural', 'boots', NULL, 'rare', 10, 0, 5, 5, 15, 850, true, false),
    
    -- Epic (Nível 15)
    ('Botas de Mithril', 'Leves e extremamente duráveis', 'boots', NULL, 'epic', 15, 0, 20, 0, 12, 1600, false, false),
    ('Botas do Viajante', 'Permitem atravessar qualquer terreno', 'boots', NULL, 'epic', 15, 3, 15, 8, 18, 1750, false, false),
    
    -- Legendary (Nível 20)
    ('Botas Divinas', 'Concedem mobilidade divina', 'boots', NULL, 'legendary', 20, 10, 40, 20, 40, 5000, false, false),
    ('Botas de Hermes', 'As lendárias botas aladas', 'boots', NULL, 'legendary', 20, 15, 35, 30, 50, 5000, false, false)
ON CONFLICT (name) DO NOTHING;

-- =====================================
-- MENSAGEM DE CONCLUSÃO
-- =====================================
-- Se você vir esta mensagem, a atualização foi bem-sucedida!
DO $$
BEGIN
    RAISE NOTICE '✓ Equipamentos atualizados com sucesso!';
    RAISE NOTICE '✓ Total de capacetes:', (SELECT COUNT(*) FROM equipment WHERE type = 'helmet');
    RAISE NOTICE '✓ Total de perneiras:', (SELECT COUNT(*) FROM equipment WHERE type = 'legs');
    RAISE NOTICE '✓ Total de escudos:', (SELECT COUNT(*) FROM equipment WHERE type = 'shield');
    RAISE NOTICE '✓ Total de botas:', (SELECT COUNT(*) FROM equipment WHERE type = 'boots');
END $$;

