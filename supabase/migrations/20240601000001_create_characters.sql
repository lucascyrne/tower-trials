-- Criar tabela de personagens
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
    
    -- Atributos primários do personagem
    strength INTEGER NOT NULL DEFAULT 10,        -- Força: aumenta ataque físico e carry weight
    dexterity INTEGER NOT NULL DEFAULT 10,       -- Destreza: aumenta velocidade e precisão
    intelligence INTEGER NOT NULL DEFAULT 10,    -- Inteligência: aumenta mana máxima e dano mágico
    wisdom INTEGER NOT NULL DEFAULT 10,          -- Sabedoria: aumenta regeneração de mana e resistências
    vitality INTEGER NOT NULL DEFAULT 10,        -- Vitalidade: aumenta HP máximo e resistência
    luck INTEGER NOT NULL DEFAULT 10,            -- Sorte: aumenta drop rate e chance crítica
    
    -- Pontos de atributo disponíveis para distribuir
    attribute_points INTEGER NOT NULL DEFAULT 0,
    
    -- Habilidades específicas (levels que sobem com uso)
    sword_mastery INTEGER NOT NULL DEFAULT 1,        -- Maestria com espadas
    axe_mastery INTEGER NOT NULL DEFAULT 1,          -- Maestria com machados  
    blunt_mastery INTEGER NOT NULL DEFAULT 1,        -- Maestria com armas de concussão
    defense_mastery INTEGER NOT NULL DEFAULT 1,      -- Maestria em defesa
    magic_mastery INTEGER NOT NULL DEFAULT 1,        -- Maestria em magia
    
    -- XP das habilidades
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

-- Índices
CREATE INDEX IF NOT EXISTS idx_characters_user_id ON characters(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_level ON characters(level DESC);

-- Trigger para atualizar o updated_at
CREATE TRIGGER update_characters_updated_at
    BEFORE UPDATE ON characters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Função para calcular XP necessário para o próximo nível
CREATE OR REPLACE FUNCTION calculate_xp_next_level(current_level INTEGER)
RETURNS INTEGER AS $$
BEGIN
    -- Base XP * (1.5 ^ (level - 1))
    RETURN FLOOR(100 * POW(1.5, current_level - 1));
END;
$$ LANGUAGE plpgsql;

-- Função para calcular stats base considerando atributos
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
DECLARE
    base_hp INTEGER := 80 + (5 * p_level);
    base_mana INTEGER := 40 + (3 * p_level);
    base_atk INTEGER := 15 + (2 * p_level);
    base_def INTEGER := 8 + p_level;
    base_speed INTEGER := 8 + p_level;
BEGIN
    RETURN QUERY
    SELECT
        -- HP derivado de Vitality (cada ponto = +8 HP máximo)
        (base_hp + (p_vitality * 8))::INTEGER as derived_hp,
        (base_hp + (p_vitality * 8))::INTEGER as derived_max_hp,
        
        -- Mana derivado de Intelligence (cada ponto = +5 mana máximo)
        (base_mana + (p_intelligence * 5))::INTEGER as derived_mana,
        (base_mana + (p_intelligence * 5))::INTEGER as derived_max_mana,
        
        -- Ataque derivado de Strength (cada ponto = +2 ataque)
        (base_atk + (p_strength * 2))::INTEGER as derived_atk,
        
        -- Defesa derivado de Vitality e Wisdom (cada ponto = +1 defesa)
        (base_def + (p_vitality + p_wisdom))::INTEGER as derived_def,
        
        -- Velocidade derivado de Dexterity (cada ponto = +1.5 speed)
        (base_speed + FLOOR(p_dexterity * 1.5))::INTEGER as derived_speed,
        
        -- Chance crítica derivada de Luck (cada ponto = +0.5% crítico)
        ROUND((p_luck * 0.5)::DECIMAL, 2) as derived_critical_chance,
        
        -- Dano crítico base (150% + Luck/10)
        ROUND((1.5 + (p_luck::DECIMAL / 100))::DECIMAL, 2) as derived_critical_damage;
END;
$$ LANGUAGE plpgsql;

-- Função para recalcular todos os stats derivados de um personagem
-- IMPORTANTE: Definida aqui para ser usada por outras funções
CREATE OR REPLACE FUNCTION recalculate_character_stats(p_character_id UUID)
RETURNS VOID AS $$
DECLARE
    v_character RECORD;
    v_stats RECORD;
    v_hp_ratio DECIMAL;
    v_mana_ratio DECIMAL;
    v_new_hp INTEGER;
    v_new_mana INTEGER;
BEGIN
    -- Buscar dados atuais do personagem
    SELECT * INTO v_character
    FROM characters
    WHERE id = p_character_id;
    
    -- Calcular novos stats derivados
    SELECT 
        derived_hp,
        derived_max_hp,
        derived_mana,
        derived_max_mana,
        derived_atk,
        derived_def,
        derived_speed
    INTO v_stats 
    FROM calculate_derived_stats(
        v_character.level,
        v_character.strength,
        v_character.dexterity,
        v_character.intelligence,
        v_character.wisdom,
        v_character.vitality,
        v_character.luck
    );
    
    -- Calcular diferença de HP/Mana para manter proporção atual
    v_hp_ratio := v_character.hp::DECIMAL / v_character.max_hp;
    v_mana_ratio := v_character.mana::DECIMAL / v_character.max_mana;
    v_new_hp := CEILING(v_stats.derived_max_hp * v_hp_ratio);
    v_new_mana := CEILING(v_stats.derived_max_mana * v_mana_ratio);
    
    -- Atualizar stats
    UPDATE characters
    SET
        max_hp = v_stats.derived_max_hp,
        max_mana = v_stats.derived_max_mana,
        atk = v_stats.derived_atk,
        def = v_stats.derived_def,
        speed = v_stats.derived_speed,
        hp = LEAST(v_new_hp, v_stats.derived_max_hp),
        mana = LEAST(v_new_mana, v_stats.derived_max_mana)
    WHERE id = p_character_id;
END;
$$ LANGUAGE plpgsql;

-- Função para calcular XP necessário para próximo nível de habilidade
CREATE OR REPLACE FUNCTION calculate_skill_xp_requirement(current_level INTEGER)
RETURNS INTEGER AS $$
BEGIN
    -- Progressão exponencial similar ao sistema do personagem
    -- Base: 50 XP * (1.4 ^ level)
    RETURN FLOOR(50 * POW(1.4, current_level - 1));
END;
$$ LANGUAGE plpgsql;

-- Função para processar ganho de XP de habilidade
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
    xp_required INTEGER;
    new_level INTEGER;
    new_xp INTEGER;
    leveled_up BOOLEAN := FALSE;
BEGIN
    -- Buscar nível e XP atuais da habilidade
    CASE p_skill_type
        WHEN 'sword' THEN
            SELECT sword_mastery, sword_mastery_xp INTO current_level, current_xp
            FROM characters WHERE id = p_character_id;
        WHEN 'axe' THEN
            SELECT axe_mastery, axe_mastery_xp INTO current_level, current_xp
            FROM characters WHERE id = p_character_id;
        WHEN 'blunt' THEN
            SELECT blunt_mastery, blunt_mastery_xp INTO current_level, current_xp
            FROM characters WHERE id = p_character_id;
        WHEN 'defense' THEN
            SELECT defense_mastery, defense_mastery_xp INTO current_level, current_xp
            FROM characters WHERE id = p_character_id;
        WHEN 'magic' THEN
            SELECT magic_mastery, magic_mastery_xp INTO current_level, current_xp
            FROM characters WHERE id = p_character_id;
        ELSE
            RAISE EXCEPTION 'Tipo de habilidade inválida: %', p_skill_type;
    END CASE;
    
    -- Adicionar XP
    new_xp := current_xp + p_xp_amount;
    new_level := current_level;
    
    -- Verificar se subiu de nível
    xp_required := calculate_skill_xp_requirement(current_level);
    
    WHILE new_xp >= xp_required AND new_level < 100 LOOP
        new_xp := new_xp - xp_required;
        new_level := new_level + 1;
        leveled_up := TRUE;
        xp_required := calculate_skill_xp_requirement(new_level);
    END LOOP;
    
    -- Atualizar no banco
    CASE p_skill_type
        WHEN 'sword' THEN
            UPDATE characters SET sword_mastery = new_level, sword_mastery_xp = new_xp 
            WHERE id = p_character_id;
        WHEN 'axe' THEN
            UPDATE characters SET axe_mastery = new_level, axe_mastery_xp = new_xp 
            WHERE id = p_character_id;
        WHEN 'blunt' THEN
            UPDATE characters SET blunt_mastery = new_level, blunt_mastery_xp = new_xp 
            WHERE id = p_character_id;
        WHEN 'defense' THEN
            UPDATE characters SET defense_mastery = new_level, defense_mastery_xp = new_xp 
            WHERE id = p_character_id;
        WHEN 'magic' THEN
            UPDATE characters SET magic_mastery = new_level, magic_mastery_xp = new_xp 
            WHERE id = p_character_id;
    END CASE;
    
    RETURN QUERY SELECT leveled_up, new_level, new_xp;
END;
$$ LANGUAGE plpgsql;

-- Função para validar nome de personagem no banco
CREATE OR REPLACE FUNCTION validate_character_name(p_name VARCHAR)
RETURNS TABLE (
    is_valid BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    clean_name VARCHAR;
    name_length INTEGER;
    letter_count INTEGER;
    number_count INTEGER;
    
    -- Lista completa de palavras ofensivas e reservadas
    forbidden_words TEXT[] := ARRAY[
        -- Português - palavras de baixo calão
        'porra', 'merda', 'caralho', 'puta', 'putaria', 'viado', 'bicha', 'cu', 'buceta',
        'piroca', 'pinto', 'rola', 'foda', 'foder', 'fodido', 'cuzao', 'cuzão', 'babaca',
        'otario', 'otário', 'idiota', 'imbecil', 'retardado', 'mongoloide', 'burro',
        'desgraça', 'desgraçado', 'filho da puta', 'fdp', 'vagabundo', 'safado',
        'cachorro', 'cadela', 'prostituta', 'vagabunda', 'piranha', 'galinha',
        
        -- Inglês - palavras de baixo calão
        'fuck', 'shit', 'bitch', 'damn', 'hell', 'ass', 'asshole', 'bastard',
        'crap', 'piss', 'dick', 'cock', 'pussy', 'cunt', 'whore', 'slut',
        'fag', 'faggot', 'nigger', 'retard', 'moron', 'idiot', 'stupid',
        'gay', 'lesbian', 'homo', 'nazi', 'hitler', 'rape', 'kill', 'murder',
        
        -- Espanhol - palavras de baixo calão
        'mierda', 'joder', 'puta', 'puto', 'cabron', 'cabrón', 'pendejo',
        'estupido', 'estúpido', 'culo', 'coño', 'verga', 'chingar', 'pinche',
        'mamada', 'putada', 'hijo de puta', 'hdp', 'marica', 'maricon', 'maricón',
        
        -- Palavras relacionadas a drogas
        'droga', 'cocaina', 'heroina', 'crack', 'cocaine',
        'heroin', 'drug', 'dealer', 'traficante',
        
        -- Termos inadequados gerais
        'sexo', 'sex', 'porn', 'porno', 'nude', 'naked', 'xxx', 'fetish',
        
        -- Palavras reservadas do sistema
        'admin', 'administrator', 'moderador', 'moderator', 'mod', 'gm', 'gamemaster',
        'suporte', 'support', 'help', 'ajuda', 'oficial', 'official', 'staff',
        'dev', 'developer', 'sistema', 'system', 'bot', 'null', 'undefined',
        'test', 'teste', 'demo', 'sample', 'example', 'exemplo', 'guest', 'visitante',
        'player', 'jogador', 'user', 'usuario', 'usuário', 'npc', 'monster', 'monstro'
    ];
    
    word TEXT;
BEGIN
    -- Verificar se nome foi fornecido
    IF p_name IS NULL OR p_name = '' THEN
        RETURN QUERY SELECT FALSE, 'Nome é obrigatório';
        RETURN;
    END IF;
    
    -- Limpar espaços desnecessários
    clean_name := TRIM(p_name);
    name_length := LENGTH(clean_name);
    
    -- Verificar comprimento
    IF name_length < 3 THEN
        RETURN QUERY SELECT FALSE, 'Nome deve ter pelo menos 3 caracteres';
        RETURN;
    END IF;
    
    IF name_length > 20 THEN
        RETURN QUERY SELECT FALSE, 'Nome deve ter no máximo 20 caracteres';
        RETURN;
    END IF;
    
    -- Verificar se começa com letra
    IF NOT (SUBSTRING(clean_name FROM 1 FOR 1) ~ '[a-zA-ZÀ-ÿ]') THEN
        RETURN QUERY SELECT FALSE, 'Nome deve começar com uma letra';
        RETURN;
    END IF;
    
    -- Verificar caracteres válidos (letras, números, espaços, hífen, apostrofe)
    IF NOT (clean_name ~ '^[a-zA-ZÀ-ÿ0-9\s''\-]+$') THEN
        RETURN QUERY SELECT FALSE, 'Nome contém caracteres especiais não permitidos';
        RETURN;
    END IF;
    
    -- Verificar se é apenas números
    IF clean_name ~ '^[0-9]+$' THEN
        RETURN QUERY SELECT FALSE, 'Nome não pode ser apenas números';
        RETURN;
    END IF;
    
    -- Verificar números consecutivos (mais de 2)
    IF clean_name ~ '[0-9]{3,}' THEN
        RETURN QUERY SELECT FALSE, 'Nome não pode ter mais de 2 números consecutivos';
        RETURN;
    END IF;
    
    -- Verificar caracteres repetidos (mais de 3 iguais)
    IF clean_name ~ '(.)\1{3,}' THEN
        RETURN QUERY SELECT FALSE, 'Nome não pode ter mais de 3 caracteres iguais seguidos';
        RETURN;
    END IF;
    
    -- Verificar espaços múltiplos
    IF clean_name ~ '\s{2,}' THEN
        RETURN QUERY SELECT FALSE, 'Nome não pode ter espaços múltiplos';
        RETURN;
    END IF;
    
    -- Contar letras e números
    letter_count := LENGTH(clean_name) - LENGTH(REGEXP_REPLACE(clean_name, '[a-zA-ZÀ-ÿ]', '', 'g'));
    number_count := LENGTH(clean_name) - LENGTH(REGEXP_REPLACE(clean_name, '[0-9]', '', 'g'));
    
    -- Verificar se tem pelo menos uma letra
    IF letter_count = 0 THEN
        RETURN QUERY SELECT FALSE, 'Nome deve conter pelo menos uma letra';
        RETURN;
    END IF;
    
    -- Verificar proporção de números
    IF number_count > letter_count THEN
        RETURN QUERY SELECT FALSE, 'Nome não pode ter mais números que letras';
        RETURN;
    END IF;
    
    -- Verificar palavras proibidas (completas e substrings)
    FOREACH word IN ARRAY forbidden_words LOOP
        IF LOWER(clean_name) LIKE '%' || word || '%' THEN
            RETURN QUERY SELECT FALSE, 'Nome contém termos inadequados ou reservados';
            RETURN;
        END IF;
    END LOOP;
    
    -- Nome válido
    RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Função para criar um novo personagem
CREATE OR REPLACE FUNCTION create_character(
    p_user_id UUID,
    p_name VARCHAR
)
RETURNS UUID AS $$
DECLARE
    v_character_id UUID;
    v_base_stats RECORD;
    v_character_count INTEGER;
    v_available_slots INTEGER;
    v_validation RECORD;
    v_formatted_name VARCHAR;
BEGIN
    -- Validar nome do personagem
    SELECT * INTO v_validation FROM validate_character_name(p_name);
    
    IF NOT v_validation.is_valid THEN
        RAISE EXCEPTION '%', v_validation.error_message;
    END IF;
    
    -- Formatar nome (capitalizar primeira letra de cada palavra)
    v_formatted_name := INITCAP(TRIM(p_name));
    
    -- Verificar se já existe personagem com mesmo nome para o usuário
    IF EXISTS (
        SELECT 1 FROM characters 
        WHERE user_id = p_user_id 
        AND UPPER(name) = UPPER(v_formatted_name)
    ) THEN
        RAISE EXCEPTION 'Você já possui um personagem com este nome';
    END IF;
    
    -- Contar personagens atuais
    SELECT COUNT(*)
    INTO v_character_count
    FROM characters
    WHERE user_id = p_user_id;
    
    -- Calcular slots disponíveis baseado no nível total
    v_available_slots := calculate_available_character_slots(p_user_id);
    
    -- Verificar se pode criar mais personagens
    IF v_character_count >= v_available_slots THEN
        DECLARE
            next_slot_level INTEGER;
        BEGIN
            next_slot_level := calculate_required_total_level_for_slot(v_available_slots + 1);
            RAISE EXCEPTION 'Limite de personagens atingido. Para criar o %º personagem, você precisa de % níveis totais entre todos os seus personagens.', 
                v_available_slots + 1, next_slot_level;
        END;
    END IF;

    -- Calcular stats iniciais usando novos atributos
    SELECT 
        derived_hp,
        derived_max_hp,
        derived_mana,
        derived_max_mana,
        derived_atk,
        derived_def,
        derived_speed
    INTO v_base_stats 
    FROM calculate_derived_stats(
        1, -- level
        10, -- strength
        10, -- dexterity  
        10, -- intelligence
        10, -- wisdom
        10, -- vitality
        10  -- luck
    );
    
    -- Inserir novo personagem
    INSERT INTO characters (
        user_id,
        name,
        level,
        xp,
        xp_next_level,
        gold,
        hp,
        max_hp,
        mana,
        max_mana,
        atk,
        def,
        speed,
        floor,
        strength,
        dexterity,
        intelligence,
        wisdom,
        vitality,
        luck,
        attribute_points
    )
    VALUES (
        p_user_id,
        v_formatted_name, -- Usar nome formatado
        1, -- level inicial
        0, -- xp inicial
        calculate_xp_next_level(1), -- xp necessário para level 2
        0, -- gold inicial
        v_base_stats.derived_hp,
        v_base_stats.derived_max_hp,
        v_base_stats.derived_mana,
        v_base_stats.derived_max_mana,
        v_base_stats.derived_atk,
        v_base_stats.derived_def,
        v_base_stats.derived_speed,
        1,  -- andar inicial
        10, -- strength inicial
        10, -- dexterity inicial
        10, -- intelligence inicial
        10, -- wisdom inicial
        10, -- vitality inicial
        10, -- luck inicial
        5   -- pontos de atributo iniciais para personalizar build
    )
    RETURNING id INTO v_character_id;
    
    RETURN v_character_id;
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar stats do personagem
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
    -- Obter dados atuais do personagem
    SELECT level, xp, xp_next_level, user_id
    INTO v_current_level, v_current_xp, v_xp_next_level, v_user_id
    FROM characters 
    WHERE id = p_character_id;
    
    -- Atualizar HP e Mana se fornecidos
    IF p_hp IS NOT NULL OR p_mana IS NOT NULL THEN
        UPDATE characters
        SET
            hp = COALESCE(p_hp, hp),
            mana = COALESCE(p_mana, mana)
        WHERE id = p_character_id;
    END IF;
    
    -- Atualizar gold se fornecido
    IF p_gold IS NOT NULL THEN
        UPDATE characters
        SET gold = gold + p_gold
        WHERE id = p_character_id;
    END IF;
    
    -- Atualizar andar se fornecido
    IF p_floor IS NOT NULL THEN
        UPDATE characters
        SET floor = p_floor
        WHERE id = p_character_id;
    END IF;
    
    -- Se XP foi fornecido, verificar level up
    IF p_xp IS NOT NULL THEN
        -- Atualizar XP primeiro sem salvar
        v_new_xp := v_current_xp + p_xp;
        
        -- Verificar level up antes de salvar
        WHILE v_new_xp >= v_xp_next_level LOOP
            v_current_level := v_current_level + 1;
            v_leveled_up := TRUE;
            
            -- Atualizar variáveis para próxima iteração
            v_xp_next_level := calculate_xp_next_level(v_current_level);
        END LOOP;
        
        -- Calcular stats derivados para o nível atual
        SELECT 
            derived_hp,
            derived_max_hp,
            derived_mana,
            derived_max_mana,
            derived_atk,
            derived_def,
            derived_speed
        INTO v_base_stats 
        FROM calculate_derived_stats(
            v_current_level,
            (SELECT strength FROM characters WHERE id = p_character_id),
            (SELECT dexterity FROM characters WHERE id = p_character_id),
            (SELECT intelligence FROM characters WHERE id = p_character_id),
            (SELECT wisdom FROM characters WHERE id = p_character_id),
            (SELECT vitality FROM characters WHERE id = p_character_id),
            (SELECT luck FROM characters WHERE id = p_character_id)
        );
        
        -- Agora aplicar todas as mudanças de uma vez
        IF v_leveled_up THEN
            -- Se subiu de nível, atualizar todos os stats
            UPDATE characters
            SET
                level = v_current_level,
                xp = v_new_xp,
                xp_next_level = v_xp_next_level,
                max_hp = v_base_stats.derived_max_hp,
                max_mana = v_base_stats.derived_max_mana,
                atk = v_base_stats.derived_atk,
                def = v_base_stats.derived_def,
                speed = v_base_stats.derived_speed,
                hp = v_base_stats.derived_max_hp, -- Recupera HP totalmente ao subir de nível
                mana = v_base_stats.derived_max_mana -- Recupera Mana totalmente ao subir de nível
            WHERE id = p_character_id;
            
            -- Conceder pontos de atributo por subir de nível
            PERFORM grant_attribute_points_on_levelup(p_character_id, v_current_level);
            
            -- Atualizar progressão do usuário quando um personagem sobe de nível
            SELECT * INTO v_progression_result 
            FROM update_user_character_progression(v_user_id);
        ELSE
            -- Se não subiu de nível, atualizar apenas XP
            UPDATE characters
            SET
                xp = v_new_xp
            WHERE id = p_character_id;
        END IF;
    END IF;
    
    -- Se não houve level up, ainda verificar progressão (para casos onde outros personagens podem ter mudado)
    IF NOT v_leveled_up THEN
        SELECT * INTO v_progression_result 
        FROM update_user_character_progression(v_user_id);
    END IF;
    
    RETURN QUERY
    SELECT 
        v_leveled_up,
        v_current_level,
        COALESCE(v_new_xp, v_current_xp) AS new_xp,
        v_xp_next_level,
        CASE WHEN v_progression_result IS NOT NULL THEN v_progression_result.slots_unlocked ELSE FALSE END AS slots_unlocked,
        CASE WHEN v_progression_result IS NOT NULL THEN v_progression_result.available_slots ELSE 3 END AS new_available_slots;
END;
$$ LANGUAGE plpgsql;

-- Função para distribuir pontos de atributo
CREATE OR REPLACE FUNCTION distribute_attribute_points(
    p_character_id UUID,
    p_strength INTEGER DEFAULT 0,
    p_dexterity INTEGER DEFAULT 0,
    p_intelligence INTEGER DEFAULT 0,
    p_wisdom INTEGER DEFAULT 0,
    p_vitality INTEGER DEFAULT 0,
    p_luck INTEGER DEFAULT 0
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    new_stats RECORD
) AS $$
DECLARE
    v_character RECORD;
    v_total_points INTEGER;
    v_stats RECORD;
BEGIN
    -- Validar entrada
    v_total_points := p_strength + p_dexterity + p_intelligence + p_wisdom + p_vitality + p_luck;
    
    IF v_total_points <= 0 THEN
        RETURN QUERY SELECT FALSE, 'Nenhum ponto foi distribuído'::TEXT, NULL::RECORD;
        RETURN;
    END IF;
    
    -- Buscar personagem atual
    SELECT * INTO v_character
    FROM characters
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Personagem não encontrado'::TEXT, NULL::RECORD;
        RETURN;
    END IF;
    
    -- Verificar se tem pontos suficientes
    IF v_character.attribute_points < v_total_points THEN
        RETURN QUERY SELECT FALSE, 
            format('Pontos insuficientes. Disponível: %s, Necessário: %s', 
                v_character.attribute_points, v_total_points)::TEXT, 
            NULL::RECORD;
        RETURN;
    END IF;
    
    -- Verificar limites máximos (cap em 50 por atributo)
    IF (v_character.strength + p_strength) > 50 OR
       (v_character.dexterity + p_dexterity) > 50 OR
       (v_character.intelligence + p_intelligence) > 50 OR
       (v_character.wisdom + p_wisdom) > 50 OR
       (v_character.vitality + p_vitality) > 50 OR
       (v_character.luck + p_luck) > 50 THEN
        RETURN QUERY SELECT FALSE, 'Limite máximo de 50 pontos por atributo'::TEXT, NULL::RECORD;
        RETURN;
    END IF;
    
    -- Atualizar atributos
    UPDATE characters
    SET
        strength = strength + p_strength,
        dexterity = dexterity + p_dexterity,
        intelligence = intelligence + p_intelligence,
        wisdom = wisdom + p_wisdom,
        vitality = vitality + p_vitality,
        luck = luck + p_luck,
        attribute_points = attribute_points - v_total_points
    WHERE id = p_character_id;
    
    -- Recalcular stats derivados
    PERFORM recalculate_character_stats(p_character_id);
    
    -- Buscar novos stats completos
    SELECT * INTO v_stats FROM get_character_full_stats(p_character_id);
    
    RETURN QUERY SELECT TRUE, 'Atributos distribuídos com sucesso'::TEXT, v_stats;
END;
$$ LANGUAGE plpgsql;



-- Função para obter stats completos do personagem
CREATE OR REPLACE FUNCTION get_character_full_stats(p_character_id UUID)
RETURNS TABLE (
    character_id UUID,
    name VARCHAR,
    level INTEGER,
    xp INTEGER,
    xp_next_level INTEGER,
    gold INTEGER,
    hp INTEGER,
    max_hp INTEGER,
    mana INTEGER,
    max_mana INTEGER,
    atk INTEGER,
    def INTEGER,
    speed INTEGER,
    strength INTEGER,
    dexterity INTEGER,
    intelligence INTEGER,
    wisdom INTEGER,
    vitality INTEGER,
    luck INTEGER,
    attribute_points INTEGER,
    critical_chance DECIMAL,
    critical_damage DECIMAL,
    sword_mastery INTEGER,
    axe_mastery INTEGER,
    blunt_mastery INTEGER,
    defense_mastery INTEGER,
    magic_mastery INTEGER,
    sword_mastery_xp INTEGER,
    axe_mastery_xp INTEGER,
    blunt_mastery_xp INTEGER,
    defense_mastery_xp INTEGER,
    magic_mastery_xp INTEGER
) AS $$
DECLARE
    v_character RECORD;
    v_stats RECORD;
BEGIN
    -- Buscar dados do personagem
    SELECT * INTO v_character
    FROM characters c
    WHERE c.id = p_character_id;
    
    -- Calcular stats derivados
    SELECT * INTO v_stats FROM calculate_derived_stats(
        v_character.level,
        v_character.strength,
        v_character.dexterity,
        v_character.intelligence,
        v_character.wisdom,
        v_character.vitality,
        v_character.luck
    );
    
    RETURN QUERY SELECT
        v_character.id,
        v_character.name,
        v_character.level,
        v_character.xp,
        v_character.xp_next_level,
        v_character.gold,
        v_character.hp,
        v_character.max_hp,
        v_character.mana,
        v_character.max_mana,
        v_character.atk,
        v_character.def,
        v_character.speed,
        v_character.strength,
        v_character.dexterity,
        v_character.intelligence,
        v_character.wisdom,
        v_character.vitality,
        v_character.luck,
        v_character.attribute_points,
        v_stats.derived_critical_chance,
        v_stats.derived_critical_damage,
        v_character.sword_mastery,
        v_character.axe_mastery,
        v_character.blunt_mastery,
        v_character.defense_mastery,
        v_character.magic_mastery,
        v_character.sword_mastery_xp,
        v_character.axe_mastery_xp,
        v_character.blunt_mastery_xp,
        v_character.defense_mastery_xp,
        v_character.magic_mastery_xp;
END;
$$ LANGUAGE plpgsql;

-- Função para dar pontos de atributo ao subir de nível
CREATE OR REPLACE FUNCTION grant_attribute_points_on_levelup(
    p_character_id UUID,
    p_new_level INTEGER
)
RETURNS INTEGER AS $$
DECLARE
    v_points_granted INTEGER;
BEGIN
    -- Calcular pontos baseado no nível (2 pontos por nível + 1 extra a cada 5 níveis)
    v_points_granted := 2;
    IF p_new_level % 5 = 0 THEN
        v_points_granted := v_points_granted + 1;
    END IF;
    
    -- Adicionar pontos ao personagem
    UPDATE characters
    SET attribute_points = attribute_points + v_points_granted
    WHERE id = p_character_id;
    
    RETURN v_points_granted;
END;
$$ LANGUAGE plpgsql;

-- Função para verificar limite de personagens dinâmico
CREATE OR REPLACE FUNCTION check_character_limit(p_user_id UUID)
RETURNS TABLE(
    can_create BOOLEAN,
    current_count INTEGER,
    available_slots INTEGER,
    total_level INTEGER,
    next_slot_required_level INTEGER
) AS $$
DECLARE
    v_current_count INTEGER;
    v_available_slots INTEGER;
    v_total_level INTEGER;
    v_next_required INTEGER;
BEGIN
    -- Contar personagens atuais
    SELECT COUNT(*)
    INTO v_current_count
    FROM characters
    WHERE user_id = p_user_id;
    
    -- Calcular slots disponíveis
    v_available_slots := calculate_available_character_slots(p_user_id);
    
    -- Calcular nível total atual
    SELECT COALESCE(SUM(level), 0)
    INTO v_total_level
    FROM characters
    WHERE user_id = p_user_id;
    
    -- Calcular nível necessário para o próximo slot
    v_next_required := calculate_required_total_level_for_slot(v_available_slots + 1);
    
    RETURN QUERY SELECT
        (v_current_count < v_available_slots) AS can_create,
        v_current_count,
        v_available_slots,
        v_total_level,
        v_next_required;
END;
$$ LANGUAGE plpgsql;

-- Função para buscar informações de progressão do usuário
CREATE OR REPLACE FUNCTION get_user_character_progression(p_user_id UUID)
RETURNS TABLE(
    total_character_level INTEGER,
    max_character_slots INTEGER,
    current_character_count INTEGER,
    next_slot_required_level INTEGER,
    progress_to_next_slot DECIMAL
) AS $$
DECLARE
    v_total_level INTEGER;
    v_max_slots INTEGER;
    v_current_count INTEGER;
    v_next_required INTEGER;
    v_progress DECIMAL;
BEGIN
    -- Buscar dados do usuário
    SELECT u.total_character_level, u.max_character_slots
    INTO v_total_level, v_max_slots
    FROM users u
    WHERE u.uid = p_user_id;
    
    -- Contar personagens atuais
    SELECT COUNT(*)
    INTO v_current_count
    FROM characters
    WHERE user_id = p_user_id;
    
    -- Calcular nível necessário para próximo slot
    v_next_required := calculate_required_total_level_for_slot(v_max_slots + 1);
    
    -- Calcular progresso (percentual)
    IF v_next_required > 0 THEN
        v_progress := LEAST(100.0, (v_total_level::DECIMAL / v_next_required::DECIMAL) * 100.0);
    ELSE
        v_progress := 100.0;
    END IF;
    
    RETURN QUERY SELECT
        v_total_level,
        v_max_slots,
        v_current_count,
        v_next_required,
        v_progress;
END;
$$ LANGUAGE plpgsql;

-- Função para buscar personagens do usuário
CREATE OR REPLACE FUNCTION get_user_characters(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    name VARCHAR(100),
    level INTEGER,
    xp INTEGER,
    xp_next_level INTEGER,
    gold INTEGER,
    hp INTEGER,
    max_hp INTEGER,
    mana INTEGER,
    max_mana INTEGER,
    atk INTEGER,
    def INTEGER,
    speed INTEGER,
    floor INTEGER,
    last_activity TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name,
        c.level,
        c.xp,
        c.xp_next_level,
        c.gold,
        c.hp,
        c.max_hp,
        c.mana,
        c.max_mana,
        c.atk,
        c.def,
        c.speed,
        c.floor,
        c.last_activity,
        c.created_at,
        c.updated_at
    FROM characters c
    WHERE c.user_id = p_user_id
    ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Função para buscar um personagem específico
CREATE OR REPLACE FUNCTION get_character(p_character_id UUID)
RETURNS characters AS $$
DECLARE
    v_character characters;
BEGIN
    SELECT c.* INTO v_character
    FROM characters c
    WHERE c.id = p_character_id;
    
    IF v_character IS NULL THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    RETURN v_character;
END;
$$ LANGUAGE plpgsql;

-- Função para deletar um personagem e todos os seus dados relacionados
CREATE OR REPLACE FUNCTION delete_character(p_character_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Verificar se o personagem existe (RLS cuidará da permissão)
    IF NOT EXISTS (
        SELECT 1 FROM characters c
        WHERE c.id = p_character_id
    ) THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;

    -- Deletar todos os dados relacionados
    -- As constraints ON DELETE CASCADE cuidarão de limpar as tabelas relacionadas
    DELETE FROM characters WHERE id = p_character_id;
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar o andar atual do personagem
CREATE OR REPLACE FUNCTION update_character_floor(
    p_character_id UUID,
    p_floor INTEGER
)
RETURNS VOID AS $$
BEGIN
    -- Validar se o andar é válido
    IF p_floor < 1 THEN
        RAISE EXCEPTION 'Andar deve ser pelo menos 1';
    END IF;
    
    -- Atualizar o andar do personagem
    UPDATE characters
    SET 
        floor = p_floor,
        updated_at = NOW()
    WHERE id = p_character_id;
    
    -- Verificar se o personagem foi encontrado
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Habilitar RLS
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes
DROP POLICY IF EXISTS "Usuários podem ver seus próprios personagens" ON characters;
DROP POLICY IF EXISTS "Usuários podem criar seus próprios personagens" ON characters;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios personagens" ON characters;
DROP POLICY IF EXISTS "Usuários podem deletar seus próprios personagens" ON characters;

-- Criar novas políticas
CREATE POLICY "Usuários podem ver seus próprios personagens" ON characters
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Usuários podem criar seus próprios personagens" ON characters
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Usuários podem atualizar seus próprios personagens" ON characters
    FOR UPDATE
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Usuários podem deletar seus próprios personagens" ON characters
    FOR DELETE
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Service role full access to characters" ON characters
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Funções com SECURITY DEFINER são executadas com privilégios do criador

-- =====================================================
-- SISTEMA DE CURA AUTOMÁTICA
-- =====================================================

-- Função para calcular cura automática baseada em tempo offline
-- Cura total em 2 horas (de 0.1% a 100% da vida e mana)
CREATE OR REPLACE FUNCTION calculate_auto_heal(
    p_character_id UUID,
    p_current_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE(new_hp INTEGER, new_mana INTEGER, healed BOOLEAN) AS $$
DECLARE
    char_record RECORD;
    time_diff_seconds INTEGER;
    heal_duration_seconds INTEGER := 7200; -- 2 horas = 7200 segundos
    min_percent DECIMAL := 0.1;
    max_percent DECIMAL := 100.0;
    
    -- Variáveis para HP
    adjusted_current_hp INTEGER;
    adjusted_current_hp_percent DECIMAL;
    heal_rate_per_second DECIMAL;
    hp_heal_percentage DECIMAL;
    hp_heal_amount INTEGER;
    calculated_new_hp INTEGER;
    
    -- Variáveis para Mana
    adjusted_current_mana INTEGER;
    adjusted_current_mana_percent DECIMAL;
    mana_heal_percentage DECIMAL;
    mana_heal_amount INTEGER;
    calculated_new_mana INTEGER;
BEGIN
    -- Buscar dados do personagem
    SELECT hp, max_hp, mana, max_mana, last_activity
    INTO char_record
    FROM characters
    WHERE id = p_character_id;
    
    -- Se não encontrou o personagem ou não tem last_activity
    IF NOT FOUND OR char_record.last_activity IS NULL THEN
        RETURN QUERY SELECT char_record.hp, char_record.mana, FALSE;
        RETURN;
    END IF;
    
    -- Se HP e Mana já estão no máximo, não curar
    IF char_record.hp >= char_record.max_hp AND char_record.mana >= char_record.max_mana THEN
        RETURN QUERY SELECT char_record.hp, char_record.mana, FALSE;
        RETURN;
    END IF;
    
    -- Calcular diferença de tempo em segundos
    time_diff_seconds := EXTRACT(EPOCH FROM (p_current_time - char_record.last_activity))::INTEGER;
    
    -- Se passou menos de 1 segundo, não curar
    IF time_diff_seconds < 1 THEN
        RETURN QUERY SELECT char_record.hp, char_record.mana, FALSE;
        RETURN;
    END IF;
    
    -- Calcular nova HP se necessário
    calculated_new_hp := char_record.hp;
    IF char_record.hp < char_record.max_hp THEN
        -- Ajustar HP atual se estiver abaixo de 0.1%
        adjusted_current_hp := GREATEST(char_record.hp, CEIL(char_record.max_hp * (min_percent / 100.0)));
        adjusted_current_hp_percent := (adjusted_current_hp::DECIMAL / char_record.max_hp::DECIMAL) * 100.0;
        
        -- Taxa de cura HP: (100% - 0.1%) / 2 horas = 99.9% / 7200s ≈ 0.01387% por segundo
        heal_rate_per_second := (max_percent - min_percent) / heal_duration_seconds;
        
        -- Calcular percentual de cura baseado no tempo
        hp_heal_percentage := LEAST(
            heal_rate_per_second * time_diff_seconds,
            max_percent - adjusted_current_hp_percent
        );
        
        -- Calcular quantidade de HP a ser curada
        hp_heal_amount := FLOOR((hp_heal_percentage / 100.0) * char_record.max_hp);
        calculated_new_hp := LEAST(char_record.max_hp, adjusted_current_hp + hp_heal_amount);
    END IF;
    
    -- Calcular nova Mana se necessário
    calculated_new_mana := char_record.mana;
    IF char_record.mana < char_record.max_mana THEN
        -- Ajustar Mana atual se estiver abaixo de 0.1%
        adjusted_current_mana := GREATEST(char_record.mana, CEIL(char_record.max_mana * (min_percent / 100.0)));
        adjusted_current_mana_percent := (adjusted_current_mana::DECIMAL / char_record.max_mana::DECIMAL) * 100.0;
        
        -- Taxa de cura Mana: (100% - 0.1%) / 2 horas = 99.9% / 7200s ≈ 0.01387% por segundo
        heal_rate_per_second := (max_percent - min_percent) / heal_duration_seconds;
        
        -- Calcular percentual de cura baseado no tempo
        mana_heal_percentage := LEAST(
            heal_rate_per_second * time_diff_seconds,
            max_percent - adjusted_current_mana_percent
        );
        
        -- Calcular quantidade de Mana a ser curada
        mana_heal_amount := FLOOR((mana_heal_percentage / 100.0) * char_record.max_mana);
        calculated_new_mana := LEAST(char_record.max_mana, adjusted_current_mana + mana_heal_amount);
    END IF;
    
    -- Retornar resultados
    RETURN QUERY SELECT 
        calculated_new_hp, 
        calculated_new_mana,
        (calculated_new_hp > char_record.hp OR calculated_new_mana > char_record.mana);
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar última atividade
CREATE OR REPLACE FUNCTION update_character_last_activity(
    p_character_id UUID,
    p_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS VOID AS $$
BEGIN
    UPDATE characters
    SET last_activity = p_timestamp
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Funções de cura automática com SECURITY DEFINER

-- Adicionar comentário explicativo ao campo last_activity
COMMENT ON COLUMN characters.last_activity IS 'Timestamp da última atividade do personagem, usado para cura automática baseada em tempo (6h para cura completa)'; 