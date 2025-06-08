-- Criação da tabela para slots de poções do personagem
CREATE TABLE IF NOT EXISTS character_potion_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    slot_position INTEGER NOT NULL CHECK (slot_position BETWEEN 1 AND 3),
    consumable_id UUID REFERENCES consumables(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(character_id, slot_position)
);

-- Criação da tabela para slots de spells do personagem  
CREATE TABLE IF NOT EXISTS character_spell_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    slot_position INTEGER NOT NULL CHECK (slot_position BETWEEN 1 AND 3),
    spell_id UUID REFERENCES spells(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(character_id, slot_position)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_character_potion_slots_character_id ON character_potion_slots(character_id);
CREATE INDEX IF NOT EXISTS idx_character_spell_slots_character_id ON character_spell_slots(character_id);

-- Triggers para atualização automática de updated_at
CREATE TRIGGER update_character_potion_slots_updated_at
    BEFORE UPDATE ON character_potion_slots
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_character_spell_slots_updated_at
    BEFORE UPDATE ON character_spell_slots
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Função para configurar slots de poção
CREATE OR REPLACE FUNCTION set_potion_slot(
    p_character_id UUID,
    p_slot_position INTEGER,
    p_consumable_id UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    -- Validar slot position
    IF p_slot_position < 1 OR p_slot_position > 3 THEN
        RAISE EXCEPTION 'Slot position deve estar entre 1 e 3';
    END IF;
    
    -- Se consumable_id é NULL, remove o slot
    IF p_consumable_id IS NULL THEN
        DELETE FROM character_potion_slots 
        WHERE character_id = p_character_id 
        AND slot_position = p_slot_position;
        RETURN;
    END IF;
    
    -- Verificar se o personagem possui este consumível
    IF NOT EXISTS (
        SELECT 1 FROM character_consumables 
        WHERE character_id = p_character_id 
        AND consumable_id = p_consumable_id 
        AND quantity > 0
    ) THEN
        RAISE EXCEPTION 'Personagem não possui este consumível ou quantidade é zero';
    END IF;
    
    -- Verificar se é uma poção válida
    IF NOT EXISTS (
        SELECT 1 FROM consumables 
        WHERE id = p_consumable_id 
        AND type IN ('potion')
    ) THEN
        RAISE EXCEPTION 'Item deve ser uma poção';
    END IF;
    
    -- Inserir ou atualizar slot
    INSERT INTO character_potion_slots (character_id, slot_position, consumable_id)
    VALUES (p_character_id, p_slot_position, p_consumable_id)
    ON CONFLICT (character_id, slot_position)
    DO UPDATE SET 
        consumable_id = p_consumable_id,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Função para configurar slots de spell
CREATE OR REPLACE FUNCTION set_spell_slot(
    p_character_id UUID,
    p_slot_position INTEGER,
    p_spell_id UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    -- Validar slot position
    IF p_slot_position < 1 OR p_slot_position > 3 THEN
        RAISE EXCEPTION 'Slot position deve estar entre 1 e 3';
    END IF;
    
    -- Se spell_id é NULL, remove o slot
    IF p_spell_id IS NULL THEN
        DELETE FROM character_spell_slots 
        WHERE character_id = p_character_id 
        AND slot_position = p_slot_position;
        RETURN;
    END IF;
    
    -- Verificar se o spell existe
    IF NOT EXISTS (SELECT 1 FROM spells WHERE id = p_spell_id) THEN
        RAISE EXCEPTION 'Spell não encontrado';
    END IF;
    
    -- Inserir ou atualizar slot
    INSERT INTO character_spell_slots (character_id, slot_position, spell_id)
    VALUES (p_character_id, p_slot_position, p_spell_id)
    ON CONFLICT (character_id, slot_position)
    DO UPDATE SET 
        spell_id = p_spell_id,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Função para obter slots de poção do personagem
CREATE OR REPLACE FUNCTION get_character_potion_slots(p_character_id UUID)
RETURNS TABLE (
    slot_position INTEGER,
    consumable_id UUID,
    consumable_name VARCHAR,
    consumable_description TEXT,
    effect_value INTEGER,
    icon VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cps.slot_position,
        cps.consumable_id,
        c.name,
        c.description,
        c.effect_value,
        c.icon
    FROM character_potion_slots cps
    LEFT JOIN consumables c ON cps.consumable_id = c.id
    WHERE cps.character_id = p_character_id
    ORDER BY cps.slot_position;
END;
$$ LANGUAGE plpgsql;

-- Função para obter slots de spell do personagem
CREATE OR REPLACE FUNCTION get_character_spell_slots(p_character_id UUID)
RETURNS TABLE (
    slot_position INTEGER,
    spell_id UUID,
    spell_name VARCHAR,
    spell_description TEXT,
    mana_cost INTEGER,
    damage INTEGER,
    spell_type VARCHAR,
    icon VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        css.slot_position,
        css.spell_id,
        s.name,
        s.description,
        s.mana_cost,
        s.damage,
        s.type,
        s.icon
    FROM character_spell_slots css
    LEFT JOIN spells s ON css.spell_id = s.id
    WHERE css.character_id = p_character_id
    ORDER BY css.slot_position;
END;
$$ LANGUAGE plpgsql;

-- Função para usar poção de um slot específico
CREATE OR REPLACE FUNCTION use_potion_from_slot(
    p_character_id UUID,
    p_slot_position INTEGER
) RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    new_hp INTEGER,
    new_mana INTEGER
) AS $$
DECLARE
    v_consumable_id UUID;
    v_character_consumable RECORD;
    v_consumable RECORD;
    v_character RECORD;
    v_new_hp INTEGER;
    v_new_mana INTEGER;
    v_message TEXT := '';
BEGIN
    -- Buscar o consumível do slot
    SELECT consumable_id INTO v_consumable_id
    FROM character_potion_slots
    WHERE character_id = p_character_id AND slot_position = p_slot_position;
    
    IF v_consumable_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Slot vazio'::TEXT, 0, 0;
        RETURN;
    END IF;
    
    -- Verificar se o personagem ainda possui o consumível
    SELECT * INTO v_character_consumable
    FROM character_consumables
    WHERE character_id = p_character_id AND consumable_id = v_consumable_id;
    
    IF v_character_consumable.quantity <= 0 THEN
        -- Remove do slot se não tem mais
        DELETE FROM character_potion_slots 
        WHERE character_id = p_character_id AND slot_position = p_slot_position;
        
        RETURN QUERY SELECT FALSE, 'Poção esgotada'::TEXT, 0, 0;
        RETURN;
    END IF;
    
    -- Buscar dados do consumível e personagem
    SELECT * INTO v_consumable FROM consumables WHERE id = v_consumable_id;
    SELECT * INTO v_character FROM characters WHERE id = p_character_id;
    
    -- Aplicar efeito da poção
    v_new_hp := v_character.hp;
    v_new_mana := v_character.mana;
    
    IF v_consumable.description ILIKE '%HP%' OR v_consumable.description ILIKE '%Vida%' THEN
        v_new_hp := LEAST(v_character.max_hp, v_character.hp + v_consumable.effect_value);
        v_message := 'HP restaurado!';
    ELSIF v_consumable.description ILIKE '%Mana%' THEN
        v_new_mana := LEAST(v_character.max_mana, v_character.mana + v_consumable.effect_value);
        v_message := 'Mana restaurada!';
    END IF;
    
    -- Atualizar HP/Mana do personagem
    UPDATE characters 
    SET hp = v_new_hp, mana = v_new_mana
    WHERE id = p_character_id;
    
    -- Decrementar quantidade do consumível
    UPDATE character_consumables
    SET quantity = quantity - 1
    WHERE character_id = p_character_id AND consumable_id = v_consumable_id;
    
    -- Remover do inventário se quantidade chegou a 0
    DELETE FROM character_consumables
    WHERE character_id = p_character_id 
    AND consumable_id = v_consumable_id 
    AND quantity <= 0;
    
    -- Se não tem mais poções, limpar o slot
    IF v_character_consumable.quantity - 1 <= 0 THEN
        DELETE FROM character_potion_slots 
        WHERE character_id = p_character_id AND slot_position = p_slot_position;
    END IF;
    
    RETURN QUERY SELECT TRUE, v_message, v_new_hp, v_new_mana;
END;
$$ LANGUAGE plpgsql; 