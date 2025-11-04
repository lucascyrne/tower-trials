-- =============================================
-- MIGRATION: Adicionar suporte a armas two-handed
-- Version: 1.0
-- Description: Adiciona coluna is_two_handed para controlar armas que ocupam ambas as mãos
-- Dependencies: 00006 (equipment system)
-- =============================================

-- Adicionar coluna is_two_handed com valor padrão false
ALTER TABLE equipment ADD COLUMN is_two_handed BOOLEAN DEFAULT FALSE;

-- Criar índice para buscar armas two-handed rapidamente
CREATE INDEX idx_equipment_two_handed ON equipment(is_two_handed) WHERE is_two_handed = TRUE;

-- ✅ DETALHES DA MUDANÇA:
-- - Armas two-handed ocupam ambos os slots (main_hand + off_hand)
-- - Não podem ser equipadas em off_hand diretamente
-- - Bloqueiam o uso de escudos e duas armas
-- - Exemplos: Machados pesados, martelos grandes, cajados de duas mãos
-- 
-- SQL para identificar armas two-handed:
-- SELECT * FROM equipment 
-- WHERE type = 'weapon' 
-- AND is_two_handed = TRUE;
--
-- Armas que devem ser marcadas como two-handed (pelo seed.sql):
-- - Martelo de Titã (weapon, blunt)
-- - Cajado de Merlin (weapon, staff) - se > 1.5x damage
-- - Machados Devastadores (weapon, axe) - armas muito pesadas
