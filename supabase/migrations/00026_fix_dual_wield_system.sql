-- =============================================
-- MIGRATION: Corrigir Sistema de Dual-Wielding
-- Version: 1.0
-- Description: Permite equipar múltiplas armas do mesmo tipo (ex: 2 espadas)
--              Remove a lógica de "one per type" que desequipava itens automaticamente
-- Dependencies: 00006
-- =============================================

-- Remover função antiga que desequipava todos os itens do mesmo tipo
DROP FUNCTION IF EXISTS toggle_equipment(UUID, UUID) CASCADE;

-- ✅ NOVA FUNÇÃO: toggle_equipment com suporte a dual-wielding
-- Permite múltiplos itens do mesmo tipo equipados simultaneamente
CREATE OR REPLACE FUNCTION toggle_equipment(p_character_id UUID, p_equipment_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_is_equipped BOOLEAN;
BEGIN
    -- Verificar se o personagem possui este equipamento
    SELECT is_equipped INTO v_is_equipped 
    FROM character_equipment 
    WHERE character_id = p_character_id AND equipment_id = p_equipment_id;
    
    IF NOT FOUND THEN 
        RAISE EXCEPTION 'Personagem não possui este equipamento'; 
    END IF;
    
    -- ✅ CORRIGIDO: Apenas inverter o estado do item específico (sem afetar outros do mesmo tipo)
    -- Isso permite dual-wielding de armas
    UPDATE character_equipment 
    SET is_equipped = NOT v_is_equipped
    WHERE character_id = p_character_id 
    AND equipment_id = p_equipment_id;
    
    -- Recalcular stats do personagem com os novos equipamentos
    PERFORM recalculate_character_stats(p_character_id);
    
    RETURN NOT v_is_equipped;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- COMENTÁRIO: O que mudou?
-- =============================================
-- ANTES:
--   - Equipar Adaga em main_hand
--   - Equipar Clava em off_hand
--   - ❌ Clava SUBSTITUÍA Adaga (ambas tipo 'weapon')
--
-- DEPOIS:
--   - Equipar Adaga em main_hand
--   - Equipar Clava em off_hand  
--   - ✅ AMBAS EQUIPADAS (dual-wielding funcionando!)
--
-- A determinação do SLOT (main_hand vs off_hand) acontece no FRONTEND
-- baseado na lógica de equipamento.type em useEquipment.ts
-- =============================================
