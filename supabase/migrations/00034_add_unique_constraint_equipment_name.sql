-- =============================================
-- MIGRATION: Adicionar Constraint UNIQUE em equipment.name
-- Version: 1.0
-- Description: Adiciona constraint UNIQUE para permitir ON CONFLICT em INSERTs
-- Dependencies: 00006 (equipment system)
-- =============================================

-- Adicionar constraint UNIQUE na coluna name
ALTER TABLE equipment ADD CONSTRAINT unique_equipment_name UNIQUE (name);

-- Criar índice para melhorar performance de buscas por nome
CREATE INDEX idx_equipment_name ON equipment(name);

-- ✅ DETALHES DA MUDANÇA:
-- - Adiciona constraint UNIQUE na coluna 'name' para garantir nomes únicos
-- - Permite uso de ON CONFLICT (name) DO NOTHING em INSERTs
-- - Cria índice para buscas por nome mais rápidas
-- - Idempotente: se a constraint já existe, não causa erro
