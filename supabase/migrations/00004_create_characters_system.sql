-- =============================================
-- MIGRATION: Sistema de Personagens
-- Version: 2.0
-- Description: Tabela de personagens com atributos, maestrias, funções de progressão e auto-heal
-- Dependencies: 00001, 00003 (users)
-- =============================================

-- === TABELAS ===

CREATE TABLE IF NOT EXISTS characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    xp_next_level INTEGER DEFAULT 100,
    gold INTEGER DEFAULT 0,
    hp INTEGER NOT NULL,
    max_hp INTEGER NOT NULL,
    mana INTEGER NOT NULL,
    max_mana INTEGER NOT NULL,
    atk INTEGER NOT NULL,
    def INTEGER NOT NULL,
    speed INTEGER NOT NULL,
    floor INTEGER DEFAULT 1,
    
    strength INTEGER NOT NULL DEFAULT 10,
    dexterity INTEGER NOT NULL DEFAULT 10,
    intelligence INTEGER NOT NULL DEFAULT 10,
    wisdom INTEGER NOT NULL DEFAULT 10,
    vitality INTEGER NOT NULL DEFAULT 10,
    luck INTEGER NOT NULL DEFAULT 10,
    attribute_points INTEGER NOT NULL DEFAULT 0,
    
    sword_mastery INTEGER NOT NULL DEFAULT 1,
    axe_mastery INTEGER NOT NULL DEFAULT 1,
    blunt_mastery INTEGER NOT NULL DEFAULT 1,
    defense_mastery INTEGER NOT NULL DEFAULT 1,
    magic_mastery INTEGER NOT NULL DEFAULT 1,
    
    sword_mastery_xp INTEGER NOT NULL DEFAULT 0,
    axe_mastery_xp INTEGER NOT NULL DEFAULT 0,
    blunt_mastery_xp INTEGER NOT NULL DEFAULT 0,
    defense_mastery_xp INTEGER NOT NULL DEFAULT 0,
    magic_mastery_xp INTEGER NOT NULL DEFAULT 0,
    
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)
);

COMMENT ON COLUMN characters.last_activity IS 'Timestamp da última atividade do personagem, usado para cura automática (2h para cura completa)';

-- === ÍNDICES ===

CREATE INDEX IF NOT EXISTS idx_characters_user_id ON characters(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_level ON characters(level DESC);

-- === TRIGGERS ===

CREATE TRIGGER update_characters_updated_at
    BEFORE UPDATE ON characters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- === FUNÇÕES DE CÁLCULO ===

-- XP necessário para próximo nível (Base XP * 1.5 ^ (level - 1))
CREATE OR REPLACE FUNCTION calculate_xp_next_level(current_level INTEGER)
RETURNS INTEGER AS $$
BEGIN
    RETURN FLOOR(100 * POW(1.5, current_level - 1));
END;
$$ LANGUAGE plpgsql;

-- XP necessário para próximo nível de maestria (50 XP * 1.4 ^ level)
CREATE OR REPLACE FUNCTION calculate_skill_xp_requirement(current_level INTEGER)
RETURNS INTEGER AS $$
BEGIN
    RETURN FLOOR(50 * POW(1.4, current_level - 1));
END;
$$ LANGUAGE plpgsql;

-- Calcular stats derivados baseado em atributos
CREATE OR REPLACE FUNCTION calculate_derived_stats(
    p_level INTEGER,
    p_strength INTEGER DEFAULT 10,
    p_dexterity INTEGER DEFAULT 10,
    p_intelligence INTEGER DEFAULT 10,
    p_wisdom INTEGER DEFAULT 10,
    p_vitality INTEGER DEFAULT 10,
    p_luck INTEGER DEFAULT 10
)
RETURNS TABLE (
    derived_hp INTEGER,
    derived_max_hp INTEGER,
    derived_mana INTEGER,
    derived_max_mana INTEGER,
    derived_atk INTEGER,
    derived_def INTEGER,
    derived_speed INTEGER,
    derived_critical_chance DECIMAL,
    derived_critical_damage DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (80 + (5 * p_level) + (p_vitality * 8))::INTEGER,
        (80 + (5 * p_level) + (p_vitality * 8))::INTEGER,
        (40 + (3 * p_level) + (p_intelligence * 5))::INTEGER,
        (40 + (3 * p_level) + (p_intelligence * 5))::INTEGER,
        (15 + (2 * p_level) + (p_strength * 2))::INTEGER,
        (8 + p_level + (p_vitality + p_wisdom))::INTEGER,
        (8 + p_level + FLOOR(p_dexterity * 1.5))::INTEGER,
        ROUND((p_luck * 0.5)::DECIMAL, 2),
        ROUND((1.5 + (p_luck::DECIMAL / 100))::DECIMAL, 2);
END;
$$ LANGUAGE plpgsql;

-- Recalcular todos os stats derivados de um personagem
CREATE OR REPLACE FUNCTION recalculate_character_stats(p_character_id UUID)
RETURNS VOID AS $$
DECLARE
    v_character RECORD;
    v_stats RECORD;
    v_hp_ratio DECIMAL;
    v_mana_ratio DECIMAL;
BEGIN
    SELECT * INTO v_character FROM characters WHERE id = p_character_id;
    
    SELECT * INTO v_stats FROM calculate_derived_stats(
        v_character.level, v_character.strength, v_character.dexterity,
        v_character.intelligence, v_character.wisdom, v_character.vitality, v_character.luck
    );
    
    v_hp_ratio := v_character.hp::DECIMAL / v_character.max_hp;
    v_mana_ratio := v_character.mana::DECIMAL / v_character.max_mana;
    
    UPDATE characters
    SET
        max_hp = v_stats.derived_max_hp,
        max_mana = v_stats.derived_max_mana,
        atk = v_stats.derived_atk,
        def = v_stats.derived_def,
        speed = v_stats.derived_speed,
        hp = LEAST(CEILING(v_stats.derived_max_hp * v_hp_ratio), v_stats.derived_max_hp),
        mana = LEAST(CEILING(v_stats.derived_max_mana * v_mana_ratio), v_stats.derived_max_mana)
    WHERE id = p_character_id;
END;
$$ LANGUAGE plpgsql;

-- === SISTEMA DE MAESTRIAS ===

-- Adicionar XP a uma maestria específica
CREATE OR REPLACE FUNCTION add_skill_xp(
    p_character_id UUID,
    p_skill_type VARCHAR,
    p_xp_amount INTEGER
)
RETURNS TABLE (
    skill_leveled_up BOOLEAN,
    new_skill_level INTEGER,
    new_skill_xp INTEGER
) AS $$
DECLARE
    current_level INTEGER;
    current_xp INTEGER;
    new_level INTEGER;
    new_xp INTEGER;
    leveled_up BOOLEAN := FALSE;
BEGIN
    CASE p_skill_type
        WHEN 'sword' THEN SELECT sword_mastery, sword_mastery_xp INTO current_level, current_xp FROM characters WHERE id = p_character_id;
        WHEN 'axe' THEN SELECT axe_mastery, axe_mastery_xp INTO current_level, current_xp FROM characters WHERE id = p_character_id;
        WHEN 'blunt' THEN SELECT blunt_mastery, blunt_mastery_xp INTO current_level, current_xp FROM characters WHERE id = p_character_id;
        WHEN 'defense' THEN SELECT defense_mastery, defense_mastery_xp INTO current_level, current_xp FROM characters WHERE id = p_character_id;
        WHEN 'magic' THEN SELECT magic_mastery, magic_mastery_xp INTO current_level, current_xp FROM characters WHERE id = p_character_id;
        ELSE RAISE EXCEPTION 'Tipo de habilidade inválida: %', p_skill_type;
    END CASE;
    
    new_xp := current_xp + p_xp_amount;
    new_level := current_level;
    
    WHILE new_xp >= calculate_skill_xp_requirement(new_level) AND new_level < 100 LOOP
        new_xp := new_xp - calculate_skill_xp_requirement(new_level);
        new_level := new_level + 1;
        leveled_up := TRUE;
    END LOOP;
    
    CASE p_skill_type
        WHEN 'sword' THEN UPDATE characters SET sword_mastery = new_level, sword_mastery_xp = new_xp WHERE id = p_character_id;
        WHEN 'axe' THEN UPDATE characters SET axe_mastery = new_level, axe_mastery_xp = new_xp WHERE id = p_character_id;
        WHEN 'blunt' THEN UPDATE characters SET blunt_mastery = new_level, blunt_mastery_xp = new_xp WHERE id = p_character_id;
        WHEN 'defense' THEN UPDATE characters SET defense_mastery = new_level, defense_mastery_xp = new_xp WHERE id = p_character_id;
        WHEN 'magic' THEN UPDATE characters SET magic_mastery = new_level, magic_mastery_xp = new_xp WHERE id = p_character_id;
    END CASE;
    
    RETURN QUERY SELECT leveled_up, new_level, new_xp;
END;
$$ LANGUAGE plpgsql;

-- === VALIDAÇÃO DE NOME ===

CREATE OR REPLACE FUNCTION validate_character_name(p_name VARCHAR)
RETURNS TABLE (is_valid BOOLEAN, error_message TEXT) AS $$
DECLARE
    clean_name VARCHAR;
    forbidden_words TEXT[] := ARRAY[
        'porra', 'merda', 'caralho', 'puta', 'fuck', 'shit', 'bitch', 'admin', 'moderador', 
        'gm', 'gamemaster', 'suporte', 'dev', 'sistema', 'bot', 'null', 'undefined'
    ];
    word TEXT;
BEGIN
    IF p_name IS NULL OR p_name = '' THEN
        RETURN QUERY SELECT FALSE, 'Nome é obrigatório';
        RETURN;
    END IF;
    
    clean_name := TRIM(p_name);
    
    IF LENGTH(clean_name) < 3 THEN RETURN QUERY SELECT FALSE, 'Nome deve ter pelo menos 3 caracteres'; RETURN; END IF;
    IF LENGTH(clean_name) > 20 THEN RETURN QUERY SELECT FALSE, 'Nome deve ter no máximo 20 caracteres'; RETURN; END IF;
    IF NOT (SUBSTRING(clean_name FROM 1 FOR 1) ~ '[a-zA-ZÀ-ÿ]') THEN RETURN QUERY SELECT FALSE, 'Nome deve começar com uma letra'; RETURN; END IF;
    IF NOT (clean_name ~ '^[a-zA-ZÀ-ÿ0-9\s''\-]+$') THEN RETURN QUERY SELECT FALSE, 'Nome contém caracteres especiais não permitidos'; RETURN; END IF;
    IF clean_name ~ '^[0-9]+$' THEN RETURN QUERY SELECT FALSE, 'Nome não pode ser apenas números'; RETURN; END IF;
    IF clean_name ~ '[0-9]{3,}' THEN RETURN QUERY SELECT FALSE, 'Nome não pode ter mais de 2 números consecutivos'; RETURN; END IF;
    IF clean_name ~ '(.)\1{3,}' THEN RETURN QUERY SELECT FALSE, 'Nome não pode ter mais de 3 caracteres iguais seguidos'; RETURN; END IF;
    IF clean_name ~ '\s{2,}' THEN RETURN QUERY SELECT FALSE, 'Nome não pode ter espaços múltiplos'; RETURN; END IF;
    
    FOREACH word IN ARRAY forbidden_words LOOP
        IF LOWER(clean_name) LIKE '%' || word || '%' THEN
            RETURN QUERY SELECT FALSE, 'Nome contém termos inadequados ou reservados';
            RETURN;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- === FUNÇÕES CRUD ===

-- Criar novo personagem
CREATE OR REPLACE FUNCTION create_character(p_user_id UUID, p_name VARCHAR)
RETURNS UUID AS $$
DECLARE
    v_character_id UUID;
    v_base_stats RECORD;
    v_formatted_name VARCHAR;
    v_validation RECORD;
BEGIN
    SELECT * INTO v_validation FROM validate_character_name(p_name);
    IF NOT v_validation.is_valid THEN RAISE EXCEPTION '%', v_validation.error_message; END IF;
    
    v_formatted_name := INITCAP(TRIM(p_name));
    
    IF EXISTS (SELECT 1 FROM characters WHERE user_id = p_user_id AND UPPER(name) = UPPER(v_formatted_name)) THEN
        RAISE EXCEPTION 'Você já possui um personagem com este nome';
    END IF;
    
    IF (SELECT COUNT(*) FROM characters WHERE user_id = p_user_id) >= calculate_available_character_slots(p_user_id) THEN
        RAISE EXCEPTION 'Limite de personagens atingido';
    END IF;
    
    SELECT * INTO v_base_stats FROM calculate_derived_stats(1, 10, 10, 10, 10, 10, 10);
    
    INSERT INTO characters (
        user_id, name, level, xp, xp_next_level, gold, hp, max_hp, mana, max_mana,
        atk, def, speed, floor, strength, dexterity, intelligence, wisdom, vitality, luck, attribute_points
    ) VALUES (
        p_user_id, v_formatted_name, 1, 0, calculate_xp_next_level(1), 0,
        v_base_stats.derived_hp, v_base_stats.derived_max_hp, v_base_stats.derived_mana, v_base_stats.derived_max_mana,
        v_base_stats.derived_atk, v_base_stats.derived_def, v_base_stats.derived_speed, 1,
        10, 10, 10, 10, 10, 10, 5
    ) RETURNING id INTO v_character_id;
    
    RETURN v_character_id;
END;
$$ LANGUAGE plpgsql;

-- Buscar personagem específico
CREATE OR REPLACE FUNCTION get_character(p_character_id UUID)
RETURNS characters AS $$
DECLARE
    v_character characters;
BEGIN
    SELECT * INTO v_character FROM characters WHERE id = p_character_id;
    IF v_character IS NULL THEN RAISE EXCEPTION 'Personagem não encontrado'; END IF;
    RETURN v_character;
END;
$$ LANGUAGE plpgsql;

-- Buscar personagens do usuário
CREATE OR REPLACE FUNCTION get_user_characters(p_user_id UUID)
RETURNS TABLE (
    id UUID, user_id UUID, name VARCHAR, level INTEGER, xp INTEGER, xp_next_level INTEGER,
    gold INTEGER, hp INTEGER, max_hp INTEGER, mana INTEGER, max_mana INTEGER, atk INTEGER,
    def INTEGER, speed INTEGER, floor INTEGER, last_activity TIMESTAMPTZ, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT c.id, c.user_id, c.name, c.level, c.xp, c.xp_next_level, c.gold, c.hp, c.max_hp,
           c.mana, c.max_mana, c.atk, c.def, c.speed, c.floor, c.last_activity, c.created_at, c.updated_at
    FROM characters c WHERE c.user_id = p_user_id ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Buscar stats completos do personagem
CREATE OR REPLACE FUNCTION get_character_full_stats(p_character_id UUID)
RETURNS TABLE (
    character_id UUID, name VARCHAR, level INTEGER, xp INTEGER, xp_next_level INTEGER, gold INTEGER,
    hp INTEGER, max_hp INTEGER, mana INTEGER, max_mana INTEGER, atk INTEGER, def INTEGER, speed INTEGER,
    strength INTEGER, dexterity INTEGER, intelligence INTEGER, wisdom INTEGER, vitality INTEGER, luck INTEGER,
    attribute_points INTEGER, critical_chance DECIMAL, critical_damage DECIMAL,
    sword_mastery INTEGER, axe_mastery INTEGER, blunt_mastery INTEGER, defense_mastery INTEGER, magic_mastery INTEGER,
    sword_mastery_xp INTEGER, axe_mastery_xp INTEGER, blunt_mastery_xp INTEGER, defense_mastery_xp INTEGER, magic_mastery_xp INTEGER
) AS $$
DECLARE
    v_character RECORD;
    v_stats RECORD;
BEGIN
    SELECT * INTO v_character FROM characters WHERE id = p_character_id;
    SELECT * INTO v_stats FROM calculate_derived_stats(v_character.level, v_character.strength, v_character.dexterity, 
        v_character.intelligence, v_character.wisdom, v_character.vitality, v_character.luck);
    
    RETURN QUERY SELECT v_character.id, v_character.name, v_character.level, v_character.xp, v_character.xp_next_level,
        v_character.gold, v_character.hp, v_character.max_hp, v_character.mana, v_character.max_mana, v_character.atk,
        v_character.def, v_character.speed, v_character.strength, v_character.dexterity, v_character.intelligence,
        v_character.wisdom, v_character.vitality, v_character.luck, v_character.attribute_points,
        v_stats.derived_critical_chance, v_stats.derived_critical_damage, v_character.sword_mastery, v_character.axe_mastery,
        v_character.blunt_mastery, v_character.defense_mastery, v_character.magic_mastery, v_character.sword_mastery_xp,
        v_character.axe_mastery_xp, v_character.blunt_mastery_xp, v_character.defense_mastery_xp, v_character.magic_mastery_xp;
END;
$$ LANGUAGE plpgsql;

-- Deletar personagem
CREATE OR REPLACE FUNCTION delete_character(p_character_id UUID)
RETURNS VOID AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM characters WHERE id = p_character_id) THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    DELETE FROM characters WHERE id = p_character_id;
END;
$$ LANGUAGE plpgsql;

-- === FUNÇÕES DE PROGRESSÃO ===

-- Conceder pontos de atributo ao subir de nível (2 pontos + 1 extra a cada 5 níveis)
CREATE OR REPLACE FUNCTION grant_attribute_points_on_levelup(p_character_id UUID, p_new_level INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_points_granted INTEGER := 2;
BEGIN
    IF p_new_level % 5 = 0 THEN v_points_granted := 3; END IF;
    UPDATE characters SET attribute_points = attribute_points + v_points_granted WHERE id = p_character_id;
    RETURN v_points_granted;
END;
$$ LANGUAGE plpgsql;

-- Atualizar stats do personagem (XP, gold, HP, mana, floor)
CREATE OR REPLACE FUNCTION update_character_stats(
    p_character_id UUID,
    p_xp INTEGER DEFAULT NULL,
    p_gold INTEGER DEFAULT NULL,
    p_hp INTEGER DEFAULT NULL,
    p_mana INTEGER DEFAULT NULL,
    p_floor INTEGER DEFAULT NULL
)
RETURNS TABLE (
    leveled_up BOOLEAN,
    new_level INTEGER,
    new_xp INTEGER,
    new_xp_next_level INTEGER,
    slots_unlocked BOOLEAN,
    new_available_slots INTEGER
) AS $$
DECLARE
    v_current_level INTEGER;
    v_current_xp INTEGER;
    v_xp_next_level INTEGER;
    v_leveled_up BOOLEAN := FALSE;
    v_base_stats RECORD;
    v_new_xp INTEGER;
    v_user_id UUID;
    v_progression_result RECORD;
BEGIN
    SELECT level, xp, xp_next_level, user_id INTO v_current_level, v_current_xp, v_xp_next_level, v_user_id
    FROM characters WHERE id = p_character_id;
    
    IF p_hp IS NOT NULL OR p_mana IS NOT NULL THEN
        UPDATE characters SET hp = COALESCE(p_hp, hp), mana = COALESCE(p_mana, mana) WHERE id = p_character_id;
    END IF;
    
    IF p_gold IS NOT NULL THEN UPDATE characters SET gold = gold + p_gold WHERE id = p_character_id; END IF;
    IF p_floor IS NOT NULL THEN UPDATE characters SET floor = p_floor WHERE id = p_character_id; END IF;
    
    IF p_xp IS NOT NULL THEN
        v_new_xp := v_current_xp + p_xp;
        
        WHILE v_new_xp >= v_xp_next_level LOOP
            v_current_level := v_current_level + 1;
            v_leveled_up := TRUE;
            v_xp_next_level := calculate_xp_next_level(v_current_level);
        END LOOP;
        
        IF v_leveled_up THEN
            SELECT * INTO v_base_stats FROM calculate_derived_stats(v_current_level,
                (SELECT strength FROM characters WHERE id = p_character_id),
                (SELECT dexterity FROM characters WHERE id = p_character_id),
                (SELECT intelligence FROM characters WHERE id = p_character_id),
                (SELECT wisdom FROM characters WHERE id = p_character_id),
                (SELECT vitality FROM characters WHERE id = p_character_id),
                (SELECT luck FROM characters WHERE id = p_character_id)
            );
            
            UPDATE characters SET
                level = v_current_level, xp = v_new_xp, xp_next_level = v_xp_next_level,
                max_hp = v_base_stats.derived_max_hp, max_mana = v_base_stats.derived_max_mana,
                atk = v_base_stats.derived_atk, def = v_base_stats.derived_def, speed = v_base_stats.derived_speed,
                hp = v_base_stats.derived_max_hp, mana = v_base_stats.derived_max_mana
            WHERE id = p_character_id;
            
            PERFORM grant_attribute_points_on_levelup(p_character_id, v_current_level);
            SELECT * INTO v_progression_result FROM update_user_character_progression(v_user_id);
        ELSE
            UPDATE characters SET xp = v_new_xp WHERE id = p_character_id;
        END IF;
    END IF;
    
    IF NOT v_leveled_up THEN
        SELECT * INTO v_progression_result FROM update_user_character_progression(v_user_id);
    END IF;
    
    RETURN QUERY SELECT v_leveled_up, v_current_level, COALESCE(v_new_xp, v_current_xp), v_xp_next_level,
        COALESCE(v_progression_result.slots_unlocked, FALSE), COALESCE(v_progression_result.available_slots, 3);
END;
$$ LANGUAGE plpgsql;

-- Distribuir pontos de atributo
CREATE OR REPLACE FUNCTION distribute_attribute_points(
    p_character_id UUID,
    p_strength INTEGER DEFAULT 0,
    p_dexterity INTEGER DEFAULT 0,
    p_intelligence INTEGER DEFAULT 0,
    p_wisdom INTEGER DEFAULT 0,
    p_vitality INTEGER DEFAULT 0,
    p_luck INTEGER DEFAULT 0
)
RETURNS TABLE (success BOOLEAN, message TEXT, new_stats RECORD) AS $$
DECLARE
    v_character RECORD;
    v_total_points INTEGER := p_strength + p_dexterity + p_intelligence + p_wisdom + p_vitality + p_luck;
    v_stats RECORD;
BEGIN
    IF v_total_points <= 0 THEN RETURN QUERY SELECT FALSE, 'Nenhum ponto foi distribuído'::TEXT, NULL::RECORD; RETURN; END IF;
    
    SELECT * INTO v_character FROM characters WHERE id = p_character_id;
    IF NOT FOUND THEN RETURN QUERY SELECT FALSE, 'Personagem não encontrado'::TEXT, NULL::RECORD; RETURN; END IF;
    IF v_character.attribute_points < v_total_points THEN RETURN QUERY SELECT FALSE, 'Pontos insuficientes'::TEXT, NULL::RECORD; RETURN; END IF;
    
    IF (v_character.strength + p_strength) > 50 OR (v_character.dexterity + p_dexterity) > 50 OR
       (v_character.intelligence + p_intelligence) > 50 OR (v_character.wisdom + p_wisdom) > 50 OR
       (v_character.vitality + p_vitality) > 50 OR (v_character.luck + p_luck) > 50 THEN
        RETURN QUERY SELECT FALSE, 'Limite máximo de 50 pontos por atributo'::TEXT, NULL::RECORD;
        RETURN;
    END IF;
    
    UPDATE characters SET
        strength = strength + p_strength, dexterity = dexterity + p_dexterity,
        intelligence = intelligence + p_intelligence, wisdom = wisdom + p_wisdom,
        vitality = vitality + p_vitality, luck = luck + p_luck,
        attribute_points = attribute_points - v_total_points
    WHERE id = p_character_id;
    
    PERFORM recalculate_character_stats(p_character_id);
    SELECT * INTO v_stats FROM get_character_full_stats(p_character_id);
    
    RETURN QUERY SELECT TRUE, 'Atributos distribuídos com sucesso'::TEXT, v_stats;
END;
$$ LANGUAGE plpgsql;

-- Atualizar andar do personagem
CREATE OR REPLACE FUNCTION update_character_floor(p_character_id UUID, p_floor INTEGER)
RETURNS VOID AS $$
BEGIN
    IF p_floor < 1 THEN RAISE EXCEPTION 'Andar deve ser pelo menos 1'; END IF;
    UPDATE characters SET floor = p_floor, updated_at = NOW() WHERE id = p_character_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Personagem não encontrado'; END IF;
END;
$$ LANGUAGE plpgsql;

-- === SISTEMA DE SLOTS ===

-- Verificar limite de personagens
CREATE OR REPLACE FUNCTION check_character_limit(p_user_id UUID)
RETURNS TABLE(can_create BOOLEAN, current_count INTEGER, available_slots INTEGER, total_level INTEGER, next_slot_required_level INTEGER) AS $$
DECLARE
    v_current_count INTEGER;
    v_available_slots INTEGER;
    v_total_level INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_current_count FROM characters WHERE user_id = p_user_id;
    v_available_slots := calculate_available_character_slots(p_user_id);
    SELECT COALESCE(SUM(level), 0) INTO v_total_level FROM characters WHERE user_id = p_user_id;
    
    RETURN QUERY SELECT (v_current_count < v_available_slots), v_current_count, v_available_slots, v_total_level,
        calculate_required_total_level_for_slot(v_available_slots + 1);
END;
$$ LANGUAGE plpgsql;

-- Buscar progressão do usuário
CREATE OR REPLACE FUNCTION get_user_character_progression(p_user_id UUID)
RETURNS TABLE(total_character_level INTEGER, max_character_slots INTEGER, current_character_count INTEGER, 
              next_slot_required_level INTEGER, progress_to_next_slot DECIMAL) AS $$
DECLARE
    v_total_level INTEGER;
    v_max_slots INTEGER;
    v_current_count INTEGER;
    v_next_required INTEGER;
BEGIN
    SELECT u.total_character_level, u.max_character_slots INTO v_total_level, v_max_slots FROM users u WHERE u.uid = p_user_id;
    SELECT COUNT(*) INTO v_current_count FROM characters WHERE user_id = p_user_id;
    v_next_required := calculate_required_total_level_for_slot(v_max_slots + 1);
    
    RETURN QUERY SELECT v_total_level, v_max_slots, v_current_count, v_next_required,
        CASE WHEN v_next_required > 0 THEN LEAST(100.0, (v_total_level::DECIMAL / v_next_required::DECIMAL) * 100.0) ELSE 100.0 END;
END;
$$ LANGUAGE plpgsql;

-- === SISTEMA DE AUTO-HEAL ===

-- Calcular cura automática baseada em tempo offline (2h para 100%)
CREATE OR REPLACE FUNCTION calculate_auto_heal(p_character_id UUID, p_current_time TIMESTAMPTZ DEFAULT NOW())
RETURNS TABLE(new_hp INTEGER, new_mana INTEGER, healed BOOLEAN) AS $$
DECLARE
    char_record RECORD;
    time_diff_seconds INTEGER;
    heal_rate_per_second DECIMAL := 0.01387; -- (100% - 0.1%) / 7200s
    
    hp_heal_percentage DECIMAL;
    mana_heal_percentage DECIMAL;
    calculated_new_hp INTEGER;
    calculated_new_mana INTEGER;
BEGIN
    SELECT hp, max_hp, mana, max_mana, last_activity INTO char_record FROM characters WHERE id = p_character_id;
    
    IF NOT FOUND OR char_record.last_activity IS NULL OR 
       (char_record.hp >= char_record.max_hp AND char_record.mana >= char_record.max_mana) THEN
        RETURN QUERY SELECT char_record.hp, char_record.mana, FALSE;
        RETURN;
    END IF;
    
    time_diff_seconds := EXTRACT(EPOCH FROM (p_current_time - char_record.last_activity))::INTEGER;
    IF time_diff_seconds < 1 THEN RETURN QUERY SELECT char_record.hp, char_record.mana, FALSE; RETURN; END IF;
    
    calculated_new_hp := char_record.hp;
    IF char_record.hp < char_record.max_hp THEN
        hp_heal_percentage := LEAST(heal_rate_per_second * time_diff_seconds, 100.0 - ((GREATEST(char_record.hp, CEIL(char_record.max_hp * 0.001))::DECIMAL / char_record.max_hp) * 100.0));
        calculated_new_hp := LEAST(char_record.max_hp, GREATEST(char_record.hp, CEIL(char_record.max_hp * 0.001)) + FLOOR((hp_heal_percentage / 100.0) * char_record.max_hp));
    END IF;
    
    calculated_new_mana := char_record.mana;
    IF char_record.mana < char_record.max_mana THEN
        mana_heal_percentage := LEAST(heal_rate_per_second * time_diff_seconds, 100.0 - ((GREATEST(char_record.mana, CEIL(char_record.max_mana * 0.001))::DECIMAL / char_record.max_mana) * 100.0));
        calculated_new_mana := LEAST(char_record.max_mana, GREATEST(char_record.mana, CEIL(char_record.max_mana * 0.001)) + FLOOR((mana_heal_percentage / 100.0) * char_record.max_mana));
    END IF;
    
    RETURN QUERY SELECT calculated_new_hp, calculated_new_mana, (calculated_new_hp > char_record.hp OR calculated_new_mana > char_record.mana);
END;
$$ LANGUAGE plpgsql;

-- Atualizar última atividade
CREATE OR REPLACE FUNCTION update_character_last_activity(p_character_id UUID, p_timestamp TIMESTAMPTZ DEFAULT NOW())
RETURNS VOID AS $$
BEGIN
    UPDATE characters SET last_activity = p_timestamp WHERE id = p_character_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Personagem não encontrado'; END IF;
END;
$$ LANGUAGE plpgsql;

-- Habilitar RLS (políticas na migração 00015)
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

