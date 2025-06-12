-- Criar tabela potion_slots e corrigir funções dependentes
-- Migração: 20241220000011_create_potion_slots_table.sql

-- Criar tabela potion_slots se não existir
CREATE TABLE IF NOT EXISTS potion_slots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    slot_position INTEGER NOT NULL CHECK (slot_position >= 1 AND slot_position <= 3),
    consumable_id UUID REFERENCES consumables(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Garantir que cada personagem tenha apenas um consumível por slot
    UNIQUE(character_id, slot_position)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_potion_slots_character_id ON potion_slots(character_id);
CREATE INDEX IF NOT EXISTS idx_potion_slots_character_slot ON potion_slots(character_id, slot_position);

-- Função para inicializar slots para novos personagens
CREATE OR REPLACE FUNCTION initialize_character_slots()
RETURNS TRIGGER AS $$
BEGIN
    -- Criar 3 slots de poção vazios para o novo personagem
    INSERT INTO potion_slots (character_id, slot_position, consumable_id)
    VALUES 
        (NEW.id, 1, NULL),
        (NEW.id, 2, NULL),
        (NEW.id, 3, NULL)
    ON CONFLICT (character_id, slot_position) DO NOTHING;
    
    -- Criar 3 spell slots vazios para o novo personagem
    INSERT INTO spell_slots (character_id, slot_position, spell_id)
    VALUES 
        (NEW.id, 1, NULL),
        (NEW.id, 2, NULL),
        (NEW.id, 3, NULL)
    ON CONFLICT (character_id, slot_position) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para criar slots automaticamente quando um personagem é criado
DROP TRIGGER IF EXISTS trigger_initialize_potion_slots ON characters;
DROP TRIGGER IF EXISTS trigger_initialize_slots ON characters;
CREATE TRIGGER trigger_initialize_slots
    AFTER INSERT ON characters
    FOR EACH ROW
    EXECUTE FUNCTION initialize_character_slots();

-- Recriar função get_character_potion_slots com verificação de existência da tabela
DROP FUNCTION IF EXISTS get_character_potion_slots(UUID);
CREATE FUNCTION get_character_potion_slots(p_character_id UUID)
RETURNS TABLE (
    slot_position INTEGER,
    consumable_id UUID,
    consumable_name TEXT,
    consumable_description TEXT,
    effect_value INTEGER,
    consumable_type TEXT,
    available_quantity INTEGER,
    consumable_price INTEGER
) 
LANGUAGE plpgsql
AS $$
BEGIN
    -- Garantir que o personagem tem slots (inicializar se necessário)
    INSERT INTO potion_slots (character_id, slot_position, consumable_id)
    SELECT p_character_id, generate_series(1, 3), NULL
    WHERE NOT EXISTS (
        SELECT 1 FROM potion_slots WHERE character_id = p_character_id
    )
    ON CONFLICT (character_id, slot_position) DO NOTHING;

    -- Retornar dados dos slots
    RETURN QUERY
    SELECT 
        ps.slot_position,
        ps.consumable_id,
        c.name as consumable_name,
        c.description as consumable_description,
        c.effect_value,
        c.type as consumable_type,
        COALESCE(cc.quantity, 0) as available_quantity,
        c.price as consumable_price
    FROM potion_slots ps
    LEFT JOIN consumables c ON ps.consumable_id = c.id
    LEFT JOIN character_consumables cc ON (
        cc.character_id = p_character_id 
        AND cc.consumable_id = ps.consumable_id
    )
    WHERE ps.character_id = p_character_id
    ORDER BY ps.slot_position;
END;
$$;

-- Dropar função existente para permitir alteração
DROP FUNCTION IF EXISTS set_potion_slot(UUID, INTEGER, UUID);

-- Função para configurar slot de poção
CREATE FUNCTION set_potion_slot(
    p_character_id UUID,
    p_slot_position INTEGER,
    p_consumable_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
BEGIN
    -- Validar slot position
    IF p_slot_position < 1 OR p_slot_position > 3 THEN
        RETURN JSON_BUILD_OBJECT('success', false, 'error', 'Posição do slot inválida (1-3)');
    END IF;

    -- Verificar se o consumível existe
    IF p_consumable_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM consumables WHERE id = p_consumable_id
    ) THEN
        RETURN JSON_BUILD_OBJECT('success', false, 'error', 'Consumível não encontrado');
    END IF;

    -- Verificar se o personagem possui o consumível
    IF p_consumable_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM character_consumables 
        WHERE character_id = p_character_id 
        AND consumable_id = p_consumable_id 
        AND quantity > 0
    ) THEN
        RETURN JSON_BUILD_OBJECT('success', false, 'error', 'Você não possui este consumível');
    END IF;

    -- Inicializar slots se necessário
    INSERT INTO potion_slots (character_id, slot_position, consumable_id)
    SELECT p_character_id, generate_series(1, 3), NULL
    WHERE NOT EXISTS (
        SELECT 1 FROM potion_slots WHERE character_id = p_character_id
    )
    ON CONFLICT (character_id, slot_position) DO NOTHING;

    -- Verificar se o consumível já está em outro slot (evitar duplicatas)
    IF p_consumable_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM potion_slots 
        WHERE character_id = p_character_id 
        AND consumable_id = p_consumable_id 
        AND slot_position != p_slot_position
    ) THEN
        RETURN JSON_BUILD_OBJECT('success', false, 'error', 'Este consumível já está em outro slot');
    END IF;

    -- Atualizar o slot
    UPDATE potion_slots 
    SET 
        consumable_id = p_consumable_id,
        updated_at = NOW()
    WHERE character_id = p_character_id 
    AND slot_position = p_slot_position;

    RETURN JSON_BUILD_OBJECT('success', true, 'message', 'Slot configurado com sucesso');
END;
$$;

-- Dropar função existente para permitir alteração
DROP FUNCTION IF EXISTS clear_potion_slot(UUID, INTEGER);

-- Função para limpar slot de poção
CREATE FUNCTION clear_potion_slot(
    p_character_id UUID,
    p_slot_position INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
BEGIN
    -- Validar slot position
    IF p_slot_position < 1 OR p_slot_position > 3 THEN
        RETURN JSON_BUILD_OBJECT('success', false, 'error', 'Posição do slot inválida (1-3)');
    END IF;

    -- Limpar o slot
    UPDATE potion_slots 
    SET 
        consumable_id = NULL,
        updated_at = NOW()
    WHERE character_id = p_character_id 
    AND slot_position = p_slot_position;

    RETURN JSON_BUILD_OBJECT('success', true, 'message', 'Slot limpo com sucesso');
END;
$$;

-- Criar tabela spell_slots se não existir (para completude)
CREATE TABLE IF NOT EXISTS spell_slots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    slot_position INTEGER NOT NULL CHECK (slot_position >= 1 AND slot_position <= 3),
    spell_id UUID REFERENCES spells(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Garantir que cada personagem tenha apenas uma spell por slot
    UNIQUE(character_id, slot_position)
);

-- Índices para spell_slots
CREATE INDEX IF NOT EXISTS idx_spell_slots_character_id ON spell_slots(character_id);
CREATE INDEX IF NOT EXISTS idx_spell_slots_character_slot ON spell_slots(character_id, slot_position);

-- Dropar função existente para permitir alteração do tipo de retorno
DROP FUNCTION IF EXISTS get_character_spell_slots(UUID);

-- Função para obter spell slots
CREATE FUNCTION get_character_spell_slots(p_character_id UUID)
RETURNS TABLE (
    slot_position INTEGER,
    spell_id UUID,
    spell_name TEXT,
    spell_description TEXT,
    mana_cost INTEGER,
    damage INTEGER,
    spell_type TEXT
) 
LANGUAGE plpgsql
AS $$
BEGIN
    -- Garantir que o personagem tem spell slots (inicializar se necessário)
    INSERT INTO spell_slots (character_id, slot_position, spell_id)
    SELECT p_character_id, generate_series(1, 3), NULL
    WHERE NOT EXISTS (
        SELECT 1 FROM spell_slots WHERE character_id = p_character_id
    )
    ON CONFLICT (character_id, slot_position) DO NOTHING;

    -- Retornar dados dos spell slots
    RETURN QUERY
    SELECT 
        ss.slot_position,
        ss.spell_id,
        s.name as spell_name,
        s.description as spell_description,
        s.mana_cost,
        s.damage,
        s.type as spell_type
    FROM spell_slots ss
    LEFT JOIN spells s ON ss.spell_id = s.id
    WHERE ss.character_id = p_character_id
    ORDER BY ss.slot_position;
END;
$$;

-- Dropar função existente para permitir alteração
DROP FUNCTION IF EXISTS set_spell_slot(UUID, INTEGER, UUID);

-- Função para configurar spell slot
CREATE FUNCTION set_spell_slot(
    p_character_id UUID,
    p_slot_position INTEGER,
    p_spell_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
BEGIN
    -- Validar slot position
    IF p_slot_position < 1 OR p_slot_position > 3 THEN
        RETURN JSON_BUILD_OBJECT('success', false, 'error', 'Posição do slot inválida (1-3)');
    END IF;

    -- Verificar se a spell existe
    IF p_spell_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM spells WHERE id = p_spell_id
    ) THEN
        RETURN JSON_BUILD_OBJECT('success', false, 'error', 'Spell não encontrada');
    END IF;

    -- Inicializar slots se necessário
    INSERT INTO spell_slots (character_id, slot_position, spell_id)
    SELECT p_character_id, generate_series(1, 3), NULL
    WHERE NOT EXISTS (
        SELECT 1 FROM spell_slots WHERE character_id = p_character_id
    )
    ON CONFLICT (character_id, slot_position) DO NOTHING;

    -- Atualizar o slot
    UPDATE spell_slots 
    SET 
        spell_id = p_spell_id,
        updated_at = NOW()
    WHERE character_id = p_character_id 
    AND slot_position = p_slot_position;

    RETURN JSON_BUILD_OBJECT('success', true, 'message', 'Spell slot configurado com sucesso');
END;
$$;

-- Inicializar slots para personagens existentes que não têm slots
INSERT INTO potion_slots (character_id, slot_position, consumable_id)
SELECT c.id, generate_series(1, 3), NULL
FROM characters c
WHERE NOT EXISTS (
    SELECT 1 FROM potion_slots ps WHERE ps.character_id = c.id
)
ON CONFLICT (character_id, slot_position) DO NOTHING;

-- Inicializar spell slots para personagens existentes
INSERT INTO spell_slots (character_id, slot_position, spell_id)
SELECT c.id, generate_series(1, 3), NULL
FROM characters c
WHERE NOT EXISTS (
    SELECT 1 FROM spell_slots ss WHERE ss.character_id = c.id
)
ON CONFLICT (character_id, slot_position) DO NOTHING; 