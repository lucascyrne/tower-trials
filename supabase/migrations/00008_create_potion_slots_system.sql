-- =============================================
-- MIGRATION: Sistema de Slots de Poção
-- Version: 2.0
-- Description: Sistema de slots para atalhos de poções (3 slots por personagem)
-- Dependencies: 00004 (characters), 00007 (consumables)
-- =============================================

-- === TABELAS ===

CREATE TABLE IF NOT EXISTS potion_slots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    slot_position INTEGER NOT NULL CHECK (slot_position >= 1 AND slot_position <= 3),
    consumable_id UUID REFERENCES consumables(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(character_id, slot_position)
);

-- === ÍNDICES ===

CREATE INDEX IF NOT EXISTS idx_potion_slots_character_id ON potion_slots(character_id);
CREATE INDEX IF NOT EXISTS idx_potion_slots_character_slot ON potion_slots(character_id, slot_position);

-- === TRIGGERS ===

CREATE TRIGGER update_potion_slots_updated_at
    BEFORE UPDATE ON potion_slots
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- === FUNÇÕES ===

-- Inicializar slots automaticamente para novos personagens
CREATE OR REPLACE FUNCTION initialize_character_slots()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO potion_slots (character_id, slot_position, consumable_id)
    VALUES (NEW.id, 1, NULL), (NEW.id, 2, NULL), (NEW.id, 3, NULL)
    ON CONFLICT (character_id, slot_position) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_initialize_potion_slots ON characters;
DROP TRIGGER IF EXISTS trigger_initialize_slots ON characters;
CREATE TRIGGER trigger_initialize_slots
    AFTER INSERT ON characters
    FOR EACH ROW
    EXECUTE FUNCTION initialize_character_slots();

-- Buscar slots de poção do personagem
CREATE OR REPLACE FUNCTION get_character_potion_slots(p_character_id UUID)
RETURNS TABLE (
    slot_position INTEGER,
    consumable_id UUID,
    consumable_name TEXT,
    consumable_description TEXT,
    effect_value INTEGER,
    consumable_type TEXT,
    available_quantity INTEGER,
    consumable_price INTEGER
) AS $$
BEGIN
    INSERT INTO potion_slots (character_id, slot_position, consumable_id)
    SELECT p_character_id, generate_series(1, 3), NULL
    WHERE NOT EXISTS (SELECT 1 FROM potion_slots WHERE character_id = p_character_id)
    ON CONFLICT (character_id, slot_position) DO NOTHING;

    RETURN QUERY
    SELECT 
        ps.slot_position,
        ps.consumable_id,
        c.name,
        c.description,
        c.effect_value,
        c.type,
        COALESCE(cc.quantity, 0),
        c.price
    FROM potion_slots ps
    LEFT JOIN consumables c ON ps.consumable_id = c.id
    LEFT JOIN character_consumables cc ON (cc.character_id = p_character_id AND cc.consumable_id = ps.consumable_id)
    WHERE ps.character_id = p_character_id
    ORDER BY ps.slot_position;
END;
$$ LANGUAGE plpgsql;

-- Definir consumível em slot
CREATE OR REPLACE FUNCTION set_potion_slot(p_character_id UUID, p_slot_position INTEGER, p_consumable_id UUID)
RETURNS VOID AS $$
BEGIN
    IF p_slot_position < 1 OR p_slot_position > 3 THEN RAISE EXCEPTION 'Posição de slot inválida. Deve ser entre 1 e 3.'; END IF;
    
    IF p_consumable_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM character_consumables WHERE character_id = p_character_id AND consumable_id = p_consumable_id AND quantity > 0) THEN
            RAISE EXCEPTION 'Personagem não possui este consumível no inventário';
        END IF;
    END IF;
    
    INSERT INTO potion_slots (character_id, slot_position, consumable_id)
    VALUES (p_character_id, p_slot_position, p_consumable_id)
    ON CONFLICT (character_id, slot_position) 
    DO UPDATE SET consumable_id = p_consumable_id, updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Limpar slot
CREATE OR REPLACE FUNCTION clear_potion_slot(p_character_id UUID, p_slot_position INTEGER)
RETURNS VOID AS $$
BEGIN
    IF p_slot_position < 1 OR p_slot_position > 3 THEN RAISE EXCEPTION 'Posição de slot inválida. Deve ser entre 1 e 3.'; END IF;
    
    UPDATE potion_slots SET consumable_id = NULL, updated_at = NOW()
    WHERE character_id = p_character_id AND slot_position = p_slot_position;
END;
$$ LANGUAGE plpgsql;

-- Usar poção de um slot
CREATE OR REPLACE FUNCTION use_potion_from_slot(p_character_id UUID, p_slot_position INTEGER)
RETURNS TABLE(success BOOLEAN, new_hp INTEGER, new_mana INTEGER, message TEXT) AS $$
DECLARE
    v_consumable_id UUID;
    v_result RECORD;
BEGIN
    SELECT consumable_id INTO v_consumable_id FROM potion_slots 
    WHERE character_id = p_character_id AND slot_position = p_slot_position;
    
    IF v_consumable_id IS NULL THEN 
        RETURN QUERY SELECT FALSE, 0, 0, 'Slot vazio'::TEXT; 
        RETURN; 
    END IF;
    
    SELECT * INTO v_result FROM consume_potion(p_character_id, v_consumable_id);
    
    IF NOT EXISTS (SELECT 1 FROM character_consumables WHERE character_id = p_character_id AND consumable_id = v_consumable_id AND quantity > 0) THEN
        PERFORM clear_potion_slot(p_character_id, p_slot_position);
    END IF;
    
    RETURN QUERY SELECT v_result.success, v_result.new_hp, v_result.new_mana, v_result.message;
END;
$$ LANGUAGE plpgsql;

-- Atualizar slots após compra de consumível
CREATE OR REPLACE FUNCTION update_potion_slots_after_purchase()
RETURNS TRIGGER AS $$
BEGIN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Habilitar RLS (políticas na migração 00015)
ALTER TABLE potion_slots ENABLE ROW LEVEL SECURITY;

