-- Criar enum para tipos de equipamento
CREATE TYPE equipment_type AS ENUM (
    'weapon',    -- Armas
    'armor',     -- Armaduras
    'accessory'  -- Acessórios
);

-- Criar enum para sub-tipos de armas
CREATE TYPE weapon_subtype AS ENUM (
    'sword',     -- Espadas
    'axe',       -- Machados
    'blunt',     -- Armas de concussão (maças, martelos)
    'staff',     -- Cajados mágicos
    'dagger'     -- Adagas
);

-- Criar enum para raridades
CREATE TYPE equipment_rarity AS ENUM (
    'common',    -- Comum
    'uncommon',  -- Incomum
    'rare',      -- Raro
    'epic',      -- Épico
    'legendary'  -- Lendário
);

-- Criar tabela de equipamentos
CREATE TABLE IF NOT EXISTS equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    type equipment_type NOT NULL,
    weapon_subtype weapon_subtype DEFAULT NULL, -- Para armas apenas
    rarity equipment_rarity NOT NULL,
    level_requirement INTEGER NOT NULL CHECK (level_requirement > 0),
    
    -- Bônus de atributos primários
    strength_bonus INTEGER DEFAULT 0,
    dexterity_bonus INTEGER DEFAULT 0,
    intelligence_bonus INTEGER DEFAULT 0,
    wisdom_bonus INTEGER DEFAULT 0,
    vitality_bonus INTEGER DEFAULT 0,
    luck_bonus INTEGER DEFAULT 0,
    
    -- Bônus de stats derivados (para compatibilidade e itens especiais)
    atk_bonus INTEGER DEFAULT 0,
    def_bonus INTEGER DEFAULT 0,
    mana_bonus INTEGER DEFAULT 0,
    speed_bonus INTEGER DEFAULT 0,
    hp_bonus INTEGER DEFAULT 0,
    
    -- Propriedades especiais
    critical_chance_bonus DECIMAL DEFAULT 0,
    critical_damage_bonus DECIMAL DEFAULT 0,
    
    -- Trade-offs (penalidades para balanceamento)
    strength_penalty INTEGER DEFAULT 0,
    dexterity_penalty INTEGER DEFAULT 0,
    intelligence_penalty INTEGER DEFAULT 0,
    wisdom_penalty INTEGER DEFAULT 0,
    vitality_penalty INTEGER DEFAULT 0,
    luck_penalty INTEGER DEFAULT 0,
    speed_penalty INTEGER DEFAULT 0,
    
    price INTEGER NOT NULL CHECK (price > 0),
    is_unlocked BOOLEAN DEFAULT FALSE, -- Novo campo para controlar desbloqueio na loja
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint para garantir que weapon_subtype seja definido apenas para armas
    CONSTRAINT weapon_subtype_check CHECK (
        (type = 'weapon' AND weapon_subtype IS NOT NULL) OR 
        (type != 'weapon' AND weapon_subtype IS NULL)
    )
);

-- Criar tabela de equipamentos do personagem
CREATE TABLE IF NOT EXISTS character_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    is_equipped BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(character_id, equipment_id)
);

-- Trigger para atualizar o updated_at
CREATE TRIGGER update_equipment_updated_at
    BEFORE UPDATE ON equipment
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_character_equipment_updated_at
    BEFORE UPDATE ON character_equipment
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Função para calcular bônus total de equipamentos
CREATE OR REPLACE FUNCTION calculate_equipment_bonuses(p_character_id UUID)
RETURNS TABLE (
    total_strength_bonus INTEGER,
    total_dexterity_bonus INTEGER,
    total_intelligence_bonus INTEGER,
    total_wisdom_bonus INTEGER,
    total_vitality_bonus INTEGER,
    total_luck_bonus INTEGER,
    total_atk_bonus INTEGER,
    total_def_bonus INTEGER,
    total_mana_bonus INTEGER,
    total_speed_bonus INTEGER,
    total_hp_bonus INTEGER,
    total_critical_chance_bonus DECIMAL,
    total_critical_damage_bonus DECIMAL,
    total_strength_penalty INTEGER,
    total_dexterity_penalty INTEGER,
    total_intelligence_penalty INTEGER,
    total_wisdom_penalty INTEGER,
    total_vitality_penalty INTEGER,
    total_luck_penalty INTEGER,
    total_speed_penalty INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(e.strength_bonus), 0)::INTEGER - COALESCE(SUM(e.strength_penalty), 0)::INTEGER,
        COALESCE(SUM(e.dexterity_bonus), 0)::INTEGER - COALESCE(SUM(e.dexterity_penalty), 0)::INTEGER,
        COALESCE(SUM(e.intelligence_bonus), 0)::INTEGER - COALESCE(SUM(e.intelligence_penalty), 0)::INTEGER,
        COALESCE(SUM(e.wisdom_bonus), 0)::INTEGER - COALESCE(SUM(e.wisdom_penalty), 0)::INTEGER,
        COALESCE(SUM(e.vitality_bonus), 0)::INTEGER - COALESCE(SUM(e.vitality_penalty), 0)::INTEGER,
        COALESCE(SUM(e.luck_bonus), 0)::INTEGER - COALESCE(SUM(e.luck_penalty), 0)::INTEGER,
        COALESCE(SUM(e.atk_bonus), 0)::INTEGER,
        COALESCE(SUM(e.def_bonus), 0)::INTEGER,
        COALESCE(SUM(e.mana_bonus), 0)::INTEGER,
        COALESCE(SUM(e.speed_bonus), 0)::INTEGER - COALESCE(SUM(e.speed_penalty), 0)::INTEGER,
        COALESCE(SUM(e.hp_bonus), 0)::INTEGER,
        COALESCE(SUM(e.critical_chance_bonus), 0)::DECIMAL,
        COALESCE(SUM(e.critical_damage_bonus), 0)::DECIMAL,
        COALESCE(SUM(e.strength_penalty), 0)::INTEGER,
        COALESCE(SUM(e.dexterity_penalty), 0)::INTEGER,
        COALESCE(SUM(e.intelligence_penalty), 0)::INTEGER,
        COALESCE(SUM(e.wisdom_penalty), 0)::INTEGER,
        COALESCE(SUM(e.vitality_penalty), 0)::INTEGER,
        COALESCE(SUM(e.luck_penalty), 0)::INTEGER,
        COALESCE(SUM(e.speed_penalty), 0)::INTEGER
    FROM character_equipment ce
    JOIN equipment e ON ce.equipment_id = e.id
    WHERE ce.character_id = p_character_id
    AND ce.is_equipped = true;
END;
$$ LANGUAGE plpgsql;

-- Função para equipar/desequipar item com validação de maestria
CREATE OR REPLACE FUNCTION toggle_equipment(
    p_character_id UUID,
    p_equipment_id UUID,
    p_equip BOOLEAN
) RETURNS VOID AS $$
DECLARE
    v_equipment_type equipment_type;
    v_weapon_subtype weapon_subtype;
    v_character_level INTEGER;
    v_required_level INTEGER;
    v_sword_mastery INTEGER;
    v_axe_mastery INTEGER;
    v_blunt_mastery INTEGER;
    v_magic_mastery INTEGER;
    v_min_mastery INTEGER := 10; -- Nível mínimo de maestria para usar equipamentos avançados
BEGIN
    -- Obter dados do equipamento
    SELECT type, weapon_subtype, level_requirement 
    INTO v_equipment_type, v_weapon_subtype, v_required_level
    FROM equipment
    WHERE id = p_equipment_id;
    
    -- Obter dados do personagem
    SELECT level, sword_mastery, axe_mastery, blunt_mastery, magic_mastery
    INTO v_character_level, v_sword_mastery, v_axe_mastery, v_blunt_mastery, v_magic_mastery
    FROM characters
    WHERE id = p_character_id;
    
    -- Verificar nível do personagem
    IF v_character_level < v_required_level THEN
        RAISE EXCEPTION 'Nível insuficiente para usar este equipamento (necessário: %)', v_required_level;
    END IF;
    
    -- Verificar maestria necessária para armas (apenas para itens raros+)
    IF p_equip AND v_equipment_type = 'weapon' AND v_required_level >= 10 THEN
        CASE v_weapon_subtype
            WHEN 'sword' THEN
                IF v_sword_mastery < v_min_mastery THEN
                    RAISE EXCEPTION 'Maestria com espadas insuficiente (necessário: %)', v_min_mastery;
                END IF;
            WHEN 'dagger' THEN
                -- Adagas usam maestria com espadas
                IF v_sword_mastery < v_min_mastery THEN
                    RAISE EXCEPTION 'Maestria com espadas insuficiente para usar adagas (necessário: %)', v_min_mastery;
                END IF;
            WHEN 'axe' THEN
                IF v_axe_mastery < v_min_mastery THEN
                    RAISE EXCEPTION 'Maestria com machados insuficiente (necessário: %)', v_min_mastery;
                END IF;
            WHEN 'blunt' THEN
                IF v_blunt_mastery < v_min_mastery THEN
                    RAISE EXCEPTION 'Maestria com armas de concussão insuficiente (necessário: %)', v_min_mastery;
                END IF;
            WHEN 'staff' THEN
                IF v_magic_mastery < v_min_mastery THEN
                    RAISE EXCEPTION 'Maestria em magia insuficiente (necessário: %)', v_min_mastery;
                END IF;
        END CASE;
    END IF;
    
    -- Se for para equipar, desequipar item do mesmo tipo primeiro
    IF p_equip THEN
        UPDATE character_equipment ce
        SET is_equipped = false
        FROM equipment e
        WHERE ce.equipment_id = e.id
        AND ce.character_id = p_character_id
        AND e.type = v_equipment_type
        AND ce.is_equipped = true;
    END IF;
    
    -- Equipar/desequipar o item selecionado
    UPDATE character_equipment
    SET is_equipped = p_equip
    WHERE character_id = p_character_id
    AND equipment_id = p_equipment_id;
    
    -- Recalcular stats do personagem após mudança de equipamento
    PERFORM recalculate_character_stats(p_character_id);
END;
$$ LANGUAGE plpgsql;

-- Função para comprar equipamento
CREATE OR REPLACE FUNCTION buy_equipment(
    p_character_id UUID,
    p_equipment_id UUID,
    p_price INTEGER
) RETURNS VOID AS $$
DECLARE
    v_character_gold INTEGER;
    v_character_level INTEGER;
    v_equipment_level INTEGER;
    v_equipment_unlocked BOOLEAN;
BEGIN
    -- Obter dados do equipamento
    SELECT level_requirement, is_unlocked INTO v_equipment_level, v_equipment_unlocked
    FROM equipment
    WHERE id = p_equipment_id;
    
    -- Verificar se o equipamento está desbloqueado
    IF NOT v_equipment_unlocked THEN
        RAISE EXCEPTION 'Este equipamento ainda não foi desbloqueado';
    END IF;
    
    -- Verificar se o personagem tem gold suficiente
    SELECT gold, level INTO v_character_gold, v_character_level
    FROM characters
    WHERE id = p_character_id;
    
    -- Verificar se o personagem tem nível suficiente
    IF v_character_level < v_equipment_level THEN
        RAISE EXCEPTION 'Nível insuficiente para usar este equipamento';
    END IF;
    
    -- Verificar gold
    IF v_character_gold < p_price THEN
        RAISE EXCEPTION 'Gold insuficiente para comprar o equipamento';
    END IF;
    
    -- Deduzir gold do personagem
    UPDATE characters
    SET gold = gold - p_price
    WHERE id = p_character_id;
    
    -- Adicionar equipamento ao inventário do personagem
    INSERT INTO character_equipment (character_id, equipment_id)
    VALUES (p_character_id, p_equipment_id);
END;
$$ LANGUAGE plpgsql;

-- Função para vender equipamento
CREATE OR REPLACE FUNCTION sell_equipment(
    p_character_id UUID,
    p_equipment_id UUID
) RETURNS VOID AS $$
DECLARE
    v_price INTEGER;
    v_rarity equipment_rarity;
BEGIN
    -- Obter preço e raridade do equipamento
    SELECT price, rarity INTO v_price, v_rarity
    FROM equipment
    WHERE id = p_equipment_id;
    
    -- Ajustar valor de venda com base na raridade (para balancear a economia)
    -- Equipamentos mais raros têm um melhor retorno percentual
    CASE v_rarity
        WHEN 'common' THEN v_price := v_price * 0.3;
        WHEN 'uncommon' THEN v_price := v_price * 0.35;
        WHEN 'rare' THEN v_price := v_price * 0.4;
        WHEN 'epic' THEN v_price := v_price * 0.45;
        WHEN 'legendary' THEN v_price := v_price * 0.5;
    END CASE;
    
    -- Arredondar para inteiro
    v_price := FLOOR(v_price);
    
    -- Adicionar gold ao personagem
    UPDATE characters
    SET gold = gold + v_price
    WHERE id = p_character_id;
    
    -- Remover equipamento do inventário
    DELETE FROM character_equipment
    WHERE character_id = p_character_id
    AND equipment_id = p_equipment_id;
    
    -- Recalcular stats após venda
    PERFORM recalculate_character_stats(p_character_id);
END;
$$ LANGUAGE plpgsql;

-- Função para desbloquear equipamento
CREATE OR REPLACE FUNCTION unlock_equipment(
    p_equipment_id UUID
) RETURNS VOID AS $$
BEGIN
    UPDATE equipment
    SET is_unlocked = true
    WHERE id = p_equipment_id;
END;
$$ LANGUAGE plpgsql;

-- Habilitar RLS
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_equipment ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para equipment (leitura pública - dados de referência)
CREATE POLICY "Allow public read equipment" ON equipment
    FOR SELECT 
    USING (true);

-- Políticas RLS para character_equipment (acesso apenas ao dono do personagem)
CREATE POLICY "Users can view own character equipment" ON character_equipment
    FOR SELECT
    TO authenticated
    USING (character_id IN (
        SELECT id FROM characters WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can manage own character equipment" ON character_equipment
    FOR ALL
    TO authenticated
    USING (character_id IN (
        SELECT id FROM characters WHERE user_id = auth.uid()
    ))
    WITH CHECK (character_id IN (
        SELECT id FROM characters WHERE user_id = auth.uid()
    )); 