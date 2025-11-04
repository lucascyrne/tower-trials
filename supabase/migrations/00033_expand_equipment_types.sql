-- =============================================
-- MIGRATION: Expandir Tipos de Equipamentos
-- Version: 1.0
-- Description: Adiciona novos tipos de equipamento (helmet, chest, legs, boots, shield, ring, necklace)
-- Dependencies: 00002 (ENUMs), 00006 (equipment system)
-- =============================================

-- Expandir o ENUM equipment_type para incluir novos tipos
ALTER TYPE equipment_type ADD VALUE 'helmet' AFTER 'armor';
ALTER TYPE equipment_type ADD VALUE 'chest' AFTER 'helmet';
ALTER TYPE equipment_type ADD VALUE 'legs' AFTER 'chest';
ALTER TYPE equipment_type ADD VALUE 'boots' AFTER 'legs';
ALTER TYPE equipment_type ADD VALUE 'shield' AFTER 'boots';
ALTER TYPE equipment_type ADD VALUE 'ring' AFTER 'shield';
ALTER TYPE equipment_type ADD VALUE 'necklace' AFTER 'ring';

-- ✅ DETALHES DA MUDANÇA:
-- - Tipos de equipamento expandidos de 3 para 10 opções
-- - Permite categorização mais específica de armaduras
-- - Mantém compatibilidade com tipo 'armor' genérico
-- - Novos tipos: helmet, chest, legs, boots, shield, ring, necklace
-- - Acessórios agora têm tipos específicos (ring, necklace) além de 'accessory' genérico
--
-- Mapeamento de tipos:
-- 'weapon' - Armas de combate (sword, axe, staff, etc)
-- 'armor' - Tipo genérico (mantido para compatibilidade)
-- 'accessory' - Acessórios genéricos (braceletes, etc)
-- 'helmet' - Proteção para cabeça
-- 'chest' - Proteção para peito/corpo
-- 'legs' - Proteção para pernas
-- 'boots' - Proteção para pés
-- 'shield' - Escudos
-- 'ring' - Anéis
-- 'necklace' - Colares e amuletos
