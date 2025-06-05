-- Migração para corrigir problemas de constraint NOT NULL nas colunas de XP de habilidades
-- Data: 2024-12-03
-- Versão: 20241203000006

-- =====================================
-- 1. GARANTIR QUE TODAS AS COLUNAS DE XP TENHAM VALORES PADRÃO
-- =====================================

-- Atualizar registros que possam ter valores NULL
UPDATE characters 
SET 
    sword_mastery_xp = COALESCE(sword_mastery_xp, 0),
    axe_mastery_xp = COALESCE(axe_mastery_xp, 0),
    blunt_mastery_xp = COALESCE(blunt_mastery_xp, 0),
    defense_mastery_xp = COALESCE(defense_mastery_xp, 0),
    magic_mastery_xp = COALESCE(magic_mastery_xp, 0)
WHERE 
    sword_mastery_xp IS NULL OR
    axe_mastery_xp IS NULL OR
    blunt_mastery_xp IS NULL OR
    defense_mastery_xp IS NULL OR
    magic_mastery_xp IS NULL;

-- =====================================
-- 2. CORRIGIR FUNÇÃO add_skill_xp PARA LIDAR COM VALORES NULL
-- =====================================

-- Remover função existente
DROP FUNCTION IF EXISTS add_skill_xp(UUID, VARCHAR, INTEGER);

-- Recriar função com validações melhoradas
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
    -- Validar entrada
    IF p_character_id IS NULL THEN
        RAISE EXCEPTION 'ID do personagem não pode ser NULL';
    END IF;
    
    IF p_skill_type IS NULL OR p_skill_type = '' THEN
        RAISE EXCEPTION 'Tipo de habilidade não pode ser NULL ou vazio';
    END IF;
    
    IF p_xp_amount IS NULL OR p_xp_amount <= 0 THEN
        RAISE EXCEPTION 'Quantidade de XP deve ser maior que zero';
    END IF;

    -- Buscar nível e XP atuais da habilidade com COALESCE para garantir valores não-null
    CASE p_skill_type
        WHEN 'sword' THEN
            SELECT COALESCE(sword_mastery, 1), COALESCE(sword_mastery_xp, 0) 
            INTO current_level, current_xp
            FROM characters WHERE id = p_character_id;
        WHEN 'axe' THEN
            SELECT COALESCE(axe_mastery, 1), COALESCE(axe_mastery_xp, 0) 
            INTO current_level, current_xp
            FROM characters WHERE id = p_character_id;
        WHEN 'blunt' THEN
            SELECT COALESCE(blunt_mastery, 1), COALESCE(blunt_mastery_xp, 0) 
            INTO current_level, current_xp
            FROM characters WHERE id = p_character_id;
        WHEN 'defense' THEN
            SELECT COALESCE(defense_mastery, 1), COALESCE(defense_mastery_xp, 0) 
            INTO current_level, current_xp
            FROM characters WHERE id = p_character_id;
        WHEN 'magic' THEN
            SELECT COALESCE(magic_mastery, 1), COALESCE(magic_mastery_xp, 0) 
            INTO current_level, current_xp
            FROM characters WHERE id = p_character_id;
        ELSE
            RAISE EXCEPTION 'Tipo de habilidade inválida: %', p_skill_type;
    END CASE;
    
    -- Verificar se o personagem foi encontrado
    IF current_level IS NULL THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    -- Garantir valores padrão
    current_level := COALESCE(current_level, 1);
    current_xp := COALESCE(current_xp, 0);
    
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
    
    -- Atualizar no banco com COALESCE para garantir que não seja NULL
    CASE p_skill_type
        WHEN 'sword' THEN
            UPDATE characters SET 
                sword_mastery = COALESCE(new_level, 1), 
                sword_mastery_xp = COALESCE(new_xp, 0) 
            WHERE id = p_character_id;
        WHEN 'axe' THEN
            UPDATE characters SET 
                axe_mastery = COALESCE(new_level, 1), 
                axe_mastery_xp = COALESCE(new_xp, 0) 
            WHERE id = p_character_id;
        WHEN 'blunt' THEN
            UPDATE characters SET 
                blunt_mastery = COALESCE(new_level, 1), 
                blunt_mastery_xp = COALESCE(new_xp, 0) 
            WHERE id = p_character_id;
        WHEN 'defense' THEN
            UPDATE characters SET 
                defense_mastery = COALESCE(new_level, 1), 
                defense_mastery_xp = COALESCE(new_xp, 0) 
            WHERE id = p_character_id;
        WHEN 'magic' THEN
            UPDATE characters SET 
                magic_mastery = COALESCE(new_level, 1), 
                magic_mastery_xp = COALESCE(new_xp, 0) 
            WHERE id = p_character_id;
    END CASE;
    
    RETURN QUERY SELECT leveled_up, COALESCE(new_level, 1), COALESCE(new_xp, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 3. GARANTIR INTEGRIDADE DOS DADOS
-- =====================================

-- Verificar e corrigir valores NULL em personagens existentes
UPDATE characters 
SET 
    sword_mastery = COALESCE(sword_mastery, 1),
    axe_mastery = COALESCE(axe_mastery, 1),
    blunt_mastery = COALESCE(blunt_mastery, 1),
    defense_mastery = COALESCE(defense_mastery, 1),
    magic_mastery = COALESCE(magic_mastery, 1),
    sword_mastery_xp = COALESCE(sword_mastery_xp, 0),
    axe_mastery_xp = COALESCE(axe_mastery_xp, 0),
    blunt_mastery_xp = COALESCE(blunt_mastery_xp, 0),
    defense_mastery_xp = COALESCE(defense_mastery_xp, 0),
    magic_mastery_xp = COALESCE(magic_mastery_xp, 0);

-- Script concluído com sucesso!
-- Problemas de constraint NOT NULL corrigidos 