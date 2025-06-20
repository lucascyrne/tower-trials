-- =====================================
-- CORRIGIR ACESSO A DADOS DE PERSONAGENS MORTOS
-- Data: 2024-12-21
-- Versão: 8 (Correção de morte e ranking)
-- =====================================

-- Este sistema resolve:
-- 1. Permite acesso aos dados de personagens mortos para salvar no ranking
-- 2. Cria função específica para buscar dados de personagem morto
-- 3. Corrige função delete_character para não marcar como morto antes de salvar ranking
-- 4. Garante que dados estejam disponíveis durante processo de morte

-- =====================================
-- 1. CRIAR FUNÇÃO PARA BUSCAR DADOS DE PERSONAGEM (VIVO OU MORTO)
-- =====================================

-- Função que busca dados completos independente do status is_alive
CREATE OR REPLACE FUNCTION get_character_full_stats_any_status(p_character_id UUID)
RETURNS TABLE(
    character_id UUID,
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
    strength INTEGER,
    dexterity INTEGER,
    intelligence INTEGER,
    wisdom INTEGER,
    vitality INTEGER,
    luck INTEGER,
    attribute_points INTEGER,
    critical_chance NUMERIC(5,2),
    critical_damage NUMERIC(5,2),
    sword_mastery INTEGER,
    axe_mastery INTEGER,
    blunt_mastery INTEGER,
    defense_mastery INTEGER,
    magic_mastery INTEGER,
    sword_mastery_xp INTEGER,
    axe_mastery_xp INTEGER,
    blunt_mastery_xp INTEGER,
    defense_mastery_xp INTEGER,
    magic_mastery_xp INTEGER,
    floor INTEGER,
    highest_floor INTEGER,
    is_alive BOOLEAN,
    user_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id as character_id,
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
        c.strength,
        c.dexterity,
        c.intelligence,
        c.wisdom,
        c.vitality,
        c.luck,
        c.attribute_points,
        c.critical_chance,
        c.critical_damage,
        c.sword_mastery,
        c.axe_mastery,
        c.blunt_mastery,
        c.defense_mastery,
        c.magic_mastery,
        c.sword_mastery_xp,
        c.axe_mastery_xp,
        c.blunt_mastery_xp,
        c.defense_mastery_xp,
        c.magic_mastery_xp,
        c.floor,
        COALESCE(c.highest_floor, c.floor) as highest_floor,
        COALESCE(c.is_alive, true) as is_alive,
        c.user_id
    FROM characters c
    WHERE c.id = p_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 2. FUNÇÃO PARA PROCESSAR MORTE COMPLETA DO PERSONAGEM
-- =====================================

-- Função que processa morte do personagem e salva no ranking
CREATE OR REPLACE FUNCTION process_character_death(
    p_character_id UUID,
    p_death_cause TEXT DEFAULT 'Battle defeat',
    p_killed_by_monster TEXT DEFAULT NULL
)
RETURNS TABLE(
    ranking_entry_id TEXT,
    character_name TEXT,
    character_level INTEGER,
    character_floor INTEGER
) AS $$
DECLARE
    v_character RECORD;
    v_ranking_result TEXT;
BEGIN
    -- Buscar dados completos do personagem ANTES de marcar como morto
    SELECT 
        c.id,
        c.user_id,
        c.name,
        c.level,
        c.floor,
        COALESCE(c.highest_floor, c.floor) as highest_floor,
        c.gold,
        COALESCE(c.is_alive, true) as is_alive
    INTO v_character
    FROM characters c
    WHERE c.id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado: %', p_character_id;
    END IF;
    
    -- Verificar se personagem já está morto
    IF NOT v_character.is_alive THEN
        RAISE EXCEPTION 'Personagem % já está morto', v_character.name;
    END IF;
    
    RAISE NOTICE '[DEATH_PROCESS] Processando morte de: % (ID: %, Nível: %, Andar: %)', 
                 v_character.name, v_character.id, v_character.level, v_character.highest_floor;
    
    -- 1. PRIMEIRO: Salvar no ranking histórico ANTES de marcar como morto
    SELECT save_ranking_entry(
        v_character.user_id,
        v_character.name,
        v_character.highest_floor,
        v_character.level,
        v_character.gold,
        false -- character_alive = false para ranking histórico
    ) INTO v_ranking_result;
    
    RAISE NOTICE '[DEATH_PROCESS] Entrada no ranking criada: %', v_ranking_result;
    
    -- 2. DEPOIS: Marcar personagem como morto
    UPDATE characters 
    SET 
        is_alive = false,
        hp = 0,
        updated_at = NOW()
    WHERE id = p_character_id;
    
    -- 3. OPCIONAL: Criar entrada no cemitério se a tabela existir
    -- (Esta parte é opcional e depende se vocês usam a tabela dead_characters)
    BEGIN
        INSERT INTO dead_characters (
            original_character_id,
            user_id,
            name,
            level,
            floor,
            highest_floor,
            gold,
            death_cause,
            killed_by_monster,
            survival_time_minutes,
            died_at
        )
        VALUES (
            v_character.id,
            v_character.user_id,
            v_character.name,
            v_character.level,
            v_character.floor,
            v_character.highest_floor,
            v_character.gold,
            p_death_cause,
            p_killed_by_monster,
            EXTRACT(EPOCH FROM (NOW() - (SELECT created_at FROM characters WHERE id = p_character_id))) / 60,
            NOW()
        );
        RAISE NOTICE '[DEATH_PROCESS] Entrada no cemitério criada para %', v_character.name;
    EXCEPTION
        WHEN undefined_table THEN
            RAISE NOTICE '[DEATH_PROCESS] Tabela dead_characters não existe, pulando cemitério';
        WHEN OTHERS THEN
            RAISE NOTICE '[DEATH_PROCESS] Erro ao criar entrada no cemitério: %', SQLERRM;
    END;
    
    -- Retornar informações do processo
    RETURN QUERY SELECT 
        v_ranking_result,
        v_character.name,
        v_character.level,
        v_character.highest_floor;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 3. ATUALIZAR FUNÇÃO delete_character PARA USAR NOVO PROCESSO
-- =====================================

-- Atualizar delete_character para usar o novo processo de morte
CREATE OR REPLACE FUNCTION delete_character(p_character_id UUID)
RETURNS VOID AS $$
DECLARE
    v_death_result RECORD;
BEGIN
    -- Verificar se o personagem existe
    IF NOT EXISTS (
        SELECT 1 FROM characters c
        WHERE c.id = p_character_id
    ) THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;

    -- Processar morte completa (ranking + marcar como morto)
    SELECT * INTO v_death_result 
    FROM process_character_death(p_character_id, 'Player deletion', NULL);
    
    RAISE NOTICE '[DELETE_CHARACTER] Personagem % processado: ranking=%, nível=%, andar=%', 
                 v_death_result.character_name, 
                 v_death_result.ranking_entry_id,
                 v_death_result.character_level,
                 v_death_result.character_floor;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 4. GARANTIR QUE HIGHEST_FLOOR EXISTE E ESTÁ ATUALIZADO
-- =====================================

-- Adicionar coluna highest_floor se não existir
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS highest_floor INTEGER DEFAULT 1;

-- Atualizar highest_floor para personagens existentes
UPDATE characters 
SET highest_floor = GREATEST(COALESCE(highest_floor, 1), floor)
WHERE highest_floor IS NULL OR highest_floor < floor;

-- Criar trigger para manter highest_floor atualizado (se não existir)
CREATE OR REPLACE FUNCTION update_highest_floor_on_floor_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Manter highest_floor como o maior valor já alcançado
    NEW.highest_floor = GREATEST(COALESCE(OLD.highest_floor, 1), NEW.floor);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger existente se houver
DROP TRIGGER IF EXISTS maintain_highest_floor_on_update ON characters;

-- Criar novo trigger
CREATE TRIGGER maintain_highest_floor_on_update
    BEFORE UPDATE OF floor ON characters
    FOR EACH ROW
    EXECUTE FUNCTION update_highest_floor_on_floor_change();

-- =====================================
-- 5. COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================

COMMENT ON FUNCTION get_character_full_stats_any_status IS 
'Busca dados completos do personagem independente do status is_alive. Usado para acessar dados de personagens mortos durante processo de ranking.';

COMMENT ON FUNCTION process_character_death IS 
'Processa morte completa do personagem: salva no ranking histórico, marca como morto e opcionalmente cria entrada no cemitério.';

-- =====================================
-- 6. TESTE BÁSICO DAS FUNÇÕES
-- =====================================

-- Verificar se as funções foram criadas corretamente
DO $$
DECLARE
    v_function_count INTEGER;
BEGIN
    -- Verificar get_character_full_stats_any_status
    SELECT COUNT(*) INTO v_function_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
      AND p.proname = 'get_character_full_stats_any_status';
    
    IF v_function_count = 1 THEN
        RAISE NOTICE '✓ Função get_character_full_stats_any_status criada';
    ELSE
        RAISE EXCEPTION '✗ Função get_character_full_stats_any_status não criada';
    END IF;
    
    -- Verificar process_character_death
    SELECT COUNT(*) INTO v_function_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
      AND p.proname = 'process_character_death';
    
    IF v_function_count = 1 THEN
        RAISE NOTICE '✓ Função process_character_death criada';
    ELSE
        RAISE EXCEPTION '✗ Função process_character_death não criada';
    END IF;
END $$;

-- =====================================
-- 7. LOG DE CONCLUSÃO
-- =====================================

DO $$
BEGIN
    RAISE NOTICE '====================================';
    RAISE NOTICE 'CORREÇÃO DE ACESSO A DADOS DE MORTOS';
    RAISE NOTICE 'Migração: 20241221000008';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Correções aplicadas:';
    RAISE NOTICE '✓ Função get_character_full_stats_any_status criada';
    RAISE NOTICE '✓ Função process_character_death criada';
    RAISE NOTICE '✓ Função delete_character atualizada';
    RAISE NOTICE '✓ Coluna highest_floor garantida e atualizada';
    RAISE NOTICE '✓ Trigger para highest_floor criado';
    RAISE NOTICE '✓ Fluxo de morte corrigido (ranking antes de marcar morto)';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'AGORA: Personagens podem ser acessados mesmo após morte';
    RAISE NOTICE 'AGORA: Ranking é salvo ANTES de marcar como morto';
    RAISE NOTICE 'AGORA: Processo de morte é atômico e consistente';
    RAISE NOTICE '====================================';
END $$; 