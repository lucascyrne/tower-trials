-- Migração: Integração do Sistema de Monstros com Iniciativa
-- Data: 2024-12-20
-- Versão: 20241220000002
-- Objetivo: Atualizar sistema de monstros para usar novo sistema de iniciativa e builds variadas

-- =====================================
-- ATUALIZAR TABELAS PARA NOVO SISTEMA
-- =====================================

-- Adicionar colunas necessárias na tabela de personagens para o novo sistema
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS current_initiative INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_turns_remaining INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS magic_damage_bonus NUMERIC(5,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS critical_chance NUMERIC(5,2) DEFAULT 5.0,
ADD COLUMN IF NOT EXISTS critical_damage NUMERIC(5,2) DEFAULT 150.0,
ADD COLUMN IF NOT EXISTS magic_attack INTEGER DEFAULT 0;

-- Adicionar colunas necessárias para o novo sistema de monstros
ALTER TABLE monsters 
ADD COLUMN IF NOT EXISTS current_initiative INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_turns_remaining INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS build_type TEXT DEFAULT 'balanced';

-- Atualizar função de geração de monstros para usar novo sistema
CREATE OR REPLACE FUNCTION get_monster_for_floor_with_initiative(p_floor INTEGER)
RETURNS TABLE(
    id VARCHAR,
    name VARCHAR,
    level INTEGER,
    hp INTEGER,
    atk INTEGER,
    def INTEGER,
    mana INTEGER,
    speed INTEGER,
    behavior VARCHAR,
    min_floor INTEGER,
    reward_xp INTEGER,
    reward_gold INTEGER,
    image VARCHAR,
    tier INTEGER,
    base_tier INTEGER,
    cycle_position INTEGER,
    is_boss BOOLEAN,
    strength INTEGER,
    dexterity INTEGER,
    intelligence INTEGER,
    wisdom INTEGER,
    vitality INTEGER,
    luck INTEGER,
    critical_chance NUMERIC(5,2),
    critical_damage NUMERIC(5,2),
    critical_resistance NUMERIC(5,2),
    physical_resistance NUMERIC(5,2),
    magical_resistance NUMERIC(5,2),
    debuff_resistance NUMERIC(5,2),
    physical_vulnerability NUMERIC(5,2),
    magical_vulnerability NUMERIC(5,2),
    primary_trait VARCHAR,
    secondary_trait VARCHAR,
    special_abilities TEXT[],
    current_initiative INTEGER,
    extra_turns_remaining INTEGER,
    build_type TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_cycle INTEGER;
    v_position_in_cycle INTEGER;
    v_tier INTEGER;
    v_is_boss BOOLEAN;
    v_boss_floors INTEGER[] := ARRAY[5, 10, 15, 20];
    v_monster monsters%ROWTYPE;
    v_total_monsters INTEGER;
    v_selected_index INTEGER;
    v_floor_multiplier NUMERIC;
    v_stats RECORD;
    v_build_types TEXT[] := ARRAY['swift', 'brutish', 'magical', 'armored', 'balanced'];
    v_selected_build TEXT;
    v_trait_primary TEXT;
    v_trait_secondary TEXT;
BEGIN
    -- Determinar se é andar de boss
    v_is_boss := p_floor = ANY(v_boss_floors) OR (p_floor > 20 AND p_floor % 10 = 0);
    
    -- Calcular ciclo e tier
    v_cycle := GREATEST(1, CEIL(p_floor::NUMERIC / 20));
    v_position_in_cycle := ((p_floor - 1) % 20) + 1;
    v_tier := v_cycle;
    
    -- Selecionar tipo de build baseado no andar
    v_selected_build := v_build_types[1 + (p_floor % array_length(v_build_types, 1))];
    
    -- Para bosses, garantir builds mais desafiadoras
    IF v_is_boss THEN
        v_selected_build := CASE (p_floor % 4)
            WHEN 0 THEN 'brutish'    -- Boss brutal
            WHEN 1 THEN 'swift'      -- Boss rápido 
            WHEN 2 THEN 'magical'    -- Boss mágico
            WHEN 3 THEN 'armored'    -- Boss defensivo
        END;
    END IF;
    
    -- Buscar monstro base
    SELECT COUNT(*) INTO v_total_monsters 
    FROM monsters m 
    WHERE m.min_floor <= p_floor 
    AND COALESCE(m.is_boss, (m.min_floor = ANY(v_boss_floors))) = v_is_boss;
    
    IF v_total_monsters = 0 THEN
        -- Fallback para qualquer monstro disponível
        SELECT COUNT(*) INTO v_total_monsters FROM monsters WHERE min_floor <= p_floor;
    END IF;
    
    IF v_total_monsters = 0 THEN
        RAISE EXCEPTION 'Nenhum monstro encontrado para o andar %', p_floor;
    END IF;
    
    -- Selecionar monstro aleatório
    v_selected_index := 1 + FLOOR(RANDOM() * v_total_monsters);
    
    SELECT m.* INTO v_monster
    FROM monsters m 
    WHERE m.min_floor <= p_floor 
    AND COALESCE(m.is_boss, (m.min_floor = ANY(v_boss_floors))) = v_is_boss
    ORDER BY m.id
    LIMIT 1 OFFSET (v_selected_index - 1);
    
    -- Se não encontrou, pegar qualquer um
    IF v_monster.id IS NULL THEN
        SELECT m.* INTO v_monster
        FROM monsters m 
        WHERE m.min_floor <= p_floor
        ORDER BY m.id
        LIMIT 1 OFFSET (v_selected_index - 1);
    END IF;
    
    -- Gerar stats balanceados usando nova função
    SELECT * INTO v_stats FROM generate_balanced_monster_stats(
        p_floor,
        v_selected_build,
        v_monster.hp,
        v_monster.atk,
        v_monster.def,
        v_monster.speed
    );
    
    -- Definir traits baseados no build
    CASE v_selected_build
        WHEN 'swift' THEN
            v_trait_primary := 'swift';
            v_trait_secondary := 'agile';
        WHEN 'brutish' THEN
            v_trait_primary := 'brutish';
            v_trait_secondary := 'berserker';
        WHEN 'magical' THEN
            v_trait_primary := 'magical';
            v_trait_secondary := 'ethereal';
        WHEN 'armored' THEN
            v_trait_primary := 'armored';
            v_trait_secondary := 'resilient';
        ELSE
            v_trait_primary := 'balanced';
            v_trait_secondary := 'adaptive';
    END CASE;
    
    -- Calcular iniciativa inicial
    RETURN QUERY SELECT
        v_monster.id,
        v_monster.name || CASE 
            WHEN v_selected_build != 'balanced' THEN ' ' || initcap(v_selected_build)
            ELSE ''
        END,
        GREATEST(1, p_floor - 2 + FLOOR(RANDOM() * 5))::INTEGER,
        v_stats.hp,
        v_stats.atk,
        v_stats.def,
        COALESCE(v_monster.mana, 20 + p_floor),
        v_stats.speed,
        v_monster.behavior,
        v_monster.min_floor,
        FLOOR(v_monster.reward_xp * (1.0 + (p_floor * 0.1)))::INTEGER,
        FLOOR(v_monster.reward_gold * (1.0 + (p_floor * 0.1)))::INTEGER,
        v_monster.image,
        v_tier,
        COALESCE(v_monster.base_tier, 1),
        v_position_in_cycle,
        v_is_boss,
        v_stats.strength,
        v_stats.dexterity,
        v_stats.intelligence,
        v_stats.wisdom,
        v_stats.vitality,
        v_stats.luck,
        v_stats.critical_chance,
        v_stats.critical_damage,
        CASE v_selected_build
            WHEN 'swift' THEN 15.0
            WHEN 'magical' THEN 25.0
            ELSE 10.0
        END::NUMERIC(5,2),
        CASE v_selected_build
            WHEN 'armored' THEN 20.0
            WHEN 'brutish' THEN 15.0
            ELSE 10.0
        END::NUMERIC(5,2),
        CASE v_selected_build
            WHEN 'magical' THEN 15.0
            WHEN 'armored' THEN 20.0
            ELSE 5.0
        END::NUMERIC(5,2),
        5.0::NUMERIC(5,2),
        CASE v_selected_build
            WHEN 'swift' THEN 15.0
            ELSE 0.0
        END::NUMERIC(5,2),
        CASE v_selected_build
            WHEN 'magical' THEN 20.0
            ELSE 0.0
        END::NUMERIC(5,2),
        v_trait_primary,
        v_trait_secondary,
        ARRAY[
            CASE v_selected_build
                WHEN 'swift' THEN 'Ataque Rápido'
                WHEN 'brutish' THEN 'Fúria Selvagem'
                WHEN 'magical' THEN 'Rajada Mágica'
                WHEN 'armored' THEN 'Muro de Ferro'
                ELSE 'Adaptação'
            END
        ],
        calculate_initiative(v_stats.speed, v_stats.dexterity),
        0,
        v_selected_build;
END;
$$;

-- =====================================
-- FUNÇÃO ATUALIZADA PARA RECALCULAR STATS DE PERSONAGENS
-- =====================================

-- Atualizar função para usar novo sistema balanceado
CREATE OR REPLACE FUNCTION recalculate_character_stats_with_balance(p_character_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_character RECORD;
    v_stats RECORD;
BEGIN
    -- Buscar dados atuais do personagem
    SELECT * INTO v_character
    FROM characters
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Calcular novos stats usando função balanceada
    SELECT * INTO v_stats FROM calculate_derived_stats_balanced(
        p_character_id,
        v_character.level,
        COALESCE(v_character.strength, 10),
        COALESCE(v_character.dexterity, 10),
        COALESCE(v_character.intelligence, 10),
        COALESCE(v_character.wisdom, 10),
        COALESCE(v_character.vitality, 10),
        COALESCE(v_character.luck, 10),
        COALESCE(v_character.sword_mastery, 1),
        COALESCE(v_character.axe_mastery, 1),
        COALESCE(v_character.blunt_mastery, 1),
        COALESCE(v_character.defense_mastery, 1),
        COALESCE(v_character.magic_mastery, 1)
    );
    
    -- Atualizar o personagem mantendo HP e mana atuais
    UPDATE characters SET
        max_hp = v_stats.max_hp,
        max_mana = v_stats.max_mana,
        atk = v_stats.atk,
        magic_attack = v_stats.magic_attack,
        def = v_stats.def,
        speed = v_stats.speed,
        critical_chance = v_stats.critical_chance,
        critical_damage = v_stats.critical_damage,
        magic_damage_bonus = v_stats.magic_damage_bonus,
        -- Manter HP atual, mas não deixar passar do máximo
        hp = LEAST(hp, v_stats.max_hp),
        -- Manter mana atual, mas não deixar passar do máximo  
        mana = LEAST(mana, v_stats.max_mana),
        updated_at = NOW()
    WHERE id = p_character_id;
    
    RETURN TRUE;
END;
$$;

-- =====================================
-- FUNÇÃO PARA RECALCULAR TODOS OS PERSONAGENS
-- =====================================

CREATE OR REPLACE FUNCTION recalculate_all_characters_with_balance()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INTEGER := 0;
    v_character_id UUID;
BEGIN
    -- Recalcular stats de todos os personagens
    FOR v_character_id IN 
        SELECT id FROM characters WHERE level > 0
    LOOP
        IF recalculate_character_stats_with_balance(v_character_id) THEN
            v_count := v_count + 1;
        END IF;
    END LOOP;
    
    RETURN v_count;
END;
$$;

-- =====================================
-- ATUALIZAR FUNÇÃO DE DISTRIBUIÇÃO DE ATRIBUTOS
-- =====================================

-- Função melhorada para distribuição de atributos com novo sistema
CREATE OR REPLACE FUNCTION distribute_attribute_points_balanced(
    p_character_id UUID,
    p_strength INTEGER,
    p_dexterity INTEGER,
    p_intelligence INTEGER,
    p_wisdom INTEGER,
    p_vitality INTEGER,
    p_luck INTEGER
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    new_stats RECORD
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_character RECORD;
    v_total_points INTEGER;
    v_stats RECORD;
    v_result_record RECORD;
BEGIN
    -- Buscar personagem
    SELECT * INTO v_character
    FROM characters 
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Personagem não encontrado'::TEXT, NULL::RECORD;
        RETURN;
    END IF;
    
    -- Calcular total de pontos sendo usados
    v_total_points := p_strength + p_dexterity + p_intelligence + p_wisdom + p_vitality + p_luck;
    
    -- Verificar se tem pontos suficientes
    IF v_total_points > COALESCE(v_character.attribute_points, 0) THEN
        RETURN QUERY SELECT FALSE, 'Pontos de atributo insuficientes'::TEXT, NULL::RECORD;
        RETURN;
    END IF;
    
    -- Verificar valores não negativos
    IF p_strength < 0 OR p_dexterity < 0 OR p_intelligence < 0 OR 
       p_wisdom < 0 OR p_vitality < 0 OR p_luck < 0 THEN
        RETURN QUERY SELECT FALSE, 'Valores de atributos não podem ser negativos'::TEXT, NULL::RECORD;
        RETURN;
    END IF;
    
    -- Atualizar atributos
    UPDATE characters SET
        strength = strength + p_strength,
        dexterity = dexterity + p_dexterity,
        intelligence = intelligence + p_intelligence,
        wisdom = wisdom + p_wisdom,
        vitality = vitality + p_vitality,
        luck = luck + p_luck,
        attribute_points = attribute_points - v_total_points,
        updated_at = NOW()
    WHERE id = p_character_id;
    
    -- Recalcular stats derivados com novo sistema
    IF NOT recalculate_character_stats_with_balance(p_character_id) THEN
        RETURN QUERY SELECT FALSE, 'Erro ao recalcular stats'::TEXT, NULL::RECORD;
        RETURN;
    END IF;
    
    -- Buscar stats atualizados
    SELECT * INTO v_character FROM characters WHERE id = p_character_id;
    
    -- Construir record de resposta
    SELECT v_character.level, v_character.hp, v_character.max_hp, v_character.mana, v_character.max_mana,
           v_character.atk, v_character.def, v_character.speed, v_character.critical_chance, 
           v_character.critical_damage, v_character.magic_damage_bonus
    INTO v_result_record;
    
    RETURN QUERY SELECT TRUE, 
        FORMAT('Atributos distribuídos com sucesso! Diversidade de build: %.1f%%', 
               (1.0 - ABS((v_character.strength + v_character.dexterity + v_character.intelligence + 
                          v_character.wisdom + v_character.vitality + v_character.luck)::NUMERIC / 6.0 - 
                         GREATEST(v_character.strength, v_character.dexterity, v_character.intelligence,
                                 v_character.wisdom, v_character.vitality, v_character.luck)::NUMERIC) / 
                        (v_character.strength + v_character.dexterity + v_character.intelligence + 
                         v_character.wisdom + v_character.vitality + v_character.luck)::NUMERIC) * 100)::TEXT,
        v_result_record;
END;
$$;

-- =====================================
-- EXECUTAR MIGRAÇÃO NOS DADOS EXISTENTES
-- =====================================

-- Aguardar um momento para garantir que as colunas foram criadas
DO $$ 
BEGIN 
    -- Verificar se todas as colunas necessárias existem antes de recalcular
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'characters' 
        AND column_name = 'magic_damage_bonus'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'characters' 
        AND column_name = 'critical_chance'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'characters' 
        AND column_name = 'magic_attack'
    ) THEN
        -- Recalcular todos os personagens existentes com novo sistema
        PERFORM recalculate_all_characters_with_balance();
        RAISE NOTICE 'Recalculação de stats dos personagens concluída com sucesso!';
    ELSE
        RAISE NOTICE 'Algumas colunas ainda não existem. Pulando recalculação automática.';
    END IF;
END $$;

-- Atualizar monstros existentes com builds
UPDATE monsters SET 
    build_type = CASE 
        WHEN primary_trait = 'swift' THEN 'swift'
        WHEN primary_trait = 'brutish' THEN 'brutish' 
        WHEN primary_trait = 'magical' THEN 'magical'
        WHEN primary_trait = 'armored' THEN 'armored'
        ELSE 'balanced'
    END
WHERE build_type IS NULL;

-- =====================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================

COMMENT ON FUNCTION get_monster_for_floor_with_initiative(INTEGER) IS 
'Versão atualizada que gera monstros com sistema de iniciativa e builds variadas';

COMMENT ON FUNCTION recalculate_character_stats_with_balance(UUID) IS 
'Recalcula stats de um personagem usando o novo sistema balanceado anti-mono-build';

COMMENT ON FUNCTION distribute_attribute_points_balanced IS 
'Versão melhorada da distribuição de atributos que mostra feedback sobre diversidade da build';

COMMENT ON COLUMN characters.current_initiative IS 
'Iniciativa atual do personagem para determinação da ordem dos turnos';

COMMENT ON COLUMN characters.extra_turns_remaining IS 
'Número de turnos extras restantes baseado na diferença de velocidade'; 