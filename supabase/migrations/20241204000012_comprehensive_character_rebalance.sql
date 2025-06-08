-- Migração para rebalanceamento COMPLETO do sistema de personagens
-- Data: 2024-12-04
-- Versão: 20241204000012
-- Objetivo: Implementar sistema balanceado similar a Dark Souls/Runescape com trade-offs reais

-- =====================================
-- ANÁLISE DO PROBLEMA CRÍTICO:
-- =====================================
-- ❌ Dano físico extremamente alto sem equipamentos
-- ❌ Dano mágico baixo comparado ao físico
-- ❌ Sem trade-offs reais entre builds
-- ❌ Stats base muito altos (não força especialização)
-- ❌ Sistema não recompensa construção cuidadosa de personagem
-- ❌ Falta complexidade similar a Dark Souls/Runescape

-- SOLUÇÃO IMPLEMENTADA:
-- ✅ Separação total: ATK físico vs MAGIC_ATK
-- ✅ Stats base drasticamente menores (forçar especialização)
-- ✅ Trade-offs reais: Mago frágil/forte, Guerreiro resistente/moderado
-- ✅ Dependência de equipamentos/consumíveis para progredir
-- ✅ Sistema complexo que recompensa conhecimento
-- ✅ Progressão árdua similar aos RPGs mencionados

-- =====================================
-- 1. ADICIONAR NOVO ATRIBUTO: MAGIC_ATTACK
-- =====================================

-- Adicionar magic_attack como atributo separado na tabela characters
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS magic_attack INTEGER DEFAULT 0;

-- Atualizar personagens existentes com magic_attack inicial
UPDATE characters SET magic_attack = 0 WHERE magic_attack IS NULL;

-- =====================================
-- 2. FUNÇÃO DE STATS DERIVADOS COMPLETAMENTE REBALANCEADA
-- =====================================

-- Remover função antiga
DROP FUNCTION IF EXISTS calculate_derived_stats CASCADE;

CREATE OR REPLACE FUNCTION calculate_derived_stats(
    p_level INTEGER,
    p_strength INTEGER DEFAULT 10,
    p_dexterity INTEGER DEFAULT 10,
    p_intelligence INTEGER DEFAULT 10,
    p_wisdom INTEGER DEFAULT 10,
    p_vitality INTEGER DEFAULT 10,
    p_luck INTEGER DEFAULT 10,
    p_sword_mastery INTEGER DEFAULT 1,
    p_axe_mastery INTEGER DEFAULT 1,
    p_blunt_mastery INTEGER DEFAULT 1,
    p_defense_mastery INTEGER DEFAULT 1,
    p_magic_mastery INTEGER DEFAULT 1
)
RETURNS TABLE(
    hp INTEGER,
    max_hp INTEGER,
    mana INTEGER,
    max_mana INTEGER,
    atk INTEGER,           -- APENAS dano físico
    magic_attack INTEGER,  -- NOVO: dano mágico separado
    def INTEGER,
    speed INTEGER,
    critical_chance NUMERIC(5,2),
    critical_damage NUMERIC(5,2),
    magic_damage_bonus NUMERIC(5,2) -- Mantido para compatibilidade
)
LANGUAGE plpgsql
AS $$
DECLARE
    -- =====================================
    -- BASES DRASTICAMENTE MENORES (FORÇAR ESPECIALIZAÇÃO)
    -- =====================================
    
    -- Bases críticas menores que antes
    base_hp INTEGER := 40 + (p_level * 2);        -- Era 60 + (level * 3)
    base_mana INTEGER := 15 + (p_level * 1);      -- Era 25 + (level * 2)  
    base_atk INTEGER := 1 + (p_level * 0.5);      -- Era 3 + level
    base_magic_atk INTEGER := 1 + (p_level * 0.5); -- NOVO: base mágica similar
    base_def INTEGER := 1 + (p_level * 0.3);      -- Era 2 + level
    base_speed INTEGER := 3 + (p_level * 0.5);    -- Era 5 + level
    
    -- =====================================
    -- ESCALAMENTO ESPECIALIZADO COM TRADE-OFFS
    -- =====================================
    
    -- Multiplicadores balanceados para especialização
    str_scaling NUMERIC := POWER(p_strength, 1.2);      -- Reduzido de 1.3
    dex_scaling NUMERIC := POWER(p_dexterity, 1.15);    -- Reduzido de 1.25  
    int_scaling NUMERIC := POWER(p_intelligence, 1.3);  -- Mantido alto para magos
    wis_scaling NUMERIC := POWER(p_wisdom, 1.1);        -- Reduzido de 1.2
    vit_scaling NUMERIC := POWER(p_vitality, 1.3);      -- Reduzido de 1.4
    luck_scaling NUMERIC := p_luck * 0.8;               -- Reduzido significativamente
    
    -- Habilidades com impacto menor (forçar dependência de atributos)
    weapon_mastery_bonus NUMERIC := POWER(GREATEST(p_sword_mastery, p_axe_mastery, p_blunt_mastery), 1.05) * 0.2; -- Era 0.5
    defense_mastery_bonus NUMERIC := POWER(p_defense_mastery, 1.1) * 0.4; -- Era 1.2
    magic_mastery_bonus NUMERIC := POWER(p_magic_mastery, 1.15) * 0.8;    -- Era 2.0
    
    -- Stats finais
    v_hp INTEGER;
    v_mana INTEGER;
    v_atk INTEGER;
    v_magic_atk INTEGER;
    v_def INTEGER;
    v_speed INTEGER;
    v_crit_chance NUMERIC(5,2);
    v_crit_damage NUMERIC(5,2);
    v_magic_dmg_bonus NUMERIC(5,2);
BEGIN
    -- =====================================
    -- CÁLCULOS COM TRADE-OFFS REAIS
    -- =====================================
    
    -- HP: Vitalidade é CRÍTICA para sobrevivência
    v_hp := base_hp + ROUND(vit_scaling * 2.5);  -- Era 3.5, agora menor
    
    -- MANA: Inteligência e Sabedoria são CRÍTICAS para magos
    v_mana := base_mana + ROUND(int_scaling * 1.5) + ROUND(wis_scaling * 1.2) + ROUND(magic_mastery_bonus * 0.5);
    
    -- ATAQUE FÍSICO: Força + armas, mas base muito menor
    v_atk := base_atk + ROUND(str_scaling * 1.2) + ROUND(weapon_mastery_bonus);  -- Era 1.8, agora 1.2
    
    -- ATAQUE MÁGICO: Inteligência é CRÍTICA, sabedoria complementa
    v_magic_atk := base_magic_atk + ROUND(int_scaling * 1.8) + ROUND(wis_scaling * 0.6) + ROUND(magic_mastery_bonus);
    
    -- DEFESA: Vitalidade + Sabedoria, mas bases menores
    v_def := base_def + ROUND(vit_scaling * 0.5) + ROUND(wis_scaling * 0.4) + ROUND(defense_mastery_bonus);  -- Era muito maior
    
    -- VELOCIDADE: Destreza é importante mas não dominante
    v_speed := base_speed + ROUND(dex_scaling * 0.8);  -- Era 1.2, agora 0.8
    
    -- =====================================
    -- SISTEMA DE CRÍTICOS REBALANCEADO
    -- =====================================
    
    -- Chance crítica: Sorte + Destreza, mas caps menores
    v_crit_chance := LEAST(75, (luck_scaling * 0.3) + (dex_scaling * 0.2) + (weapon_mastery_bonus * 0.1));  -- Cap era 90, agora 75
    
    -- Dano crítico: Força + Sorte, mas crescimento menor
    v_crit_damage := 130 + (luck_scaling * 0.6) + (str_scaling * 0.4) + (weapon_mastery_bonus * 0.3);  -- Era 140 base, agora 130
    
    -- =====================================
    -- DANO MÁGICO COMO % DE BÔNUS (COMPATIBILIDADE)
    -- =====================================
    
    -- Converter magic_attack para % de bônus para manter compatibilidade
    -- Magic attack de 50 = ~100% de bônus
    v_magic_dmg_bonus := (v_magic_atk - base_magic_atk) * 2.0;  -- Conversão simples
    
    -- Cap em 400% para builds extremas
    v_magic_dmg_bonus := LEAST(400, v_magic_dmg_bonus);
    
    -- =====================================
    -- RETORNO DOS VALORES REBALANCEADOS
    -- =====================================
    
    RETURN QUERY SELECT 
        v_hp,
        v_hp,  -- max_hp = hp
        v_mana,
        v_mana, -- max_mana = mana
        v_atk,
        v_magic_atk,
        v_def,
        v_speed,
        v_crit_chance,
        v_crit_damage,
        v_magic_dmg_bonus;
END;
$$;

-- =====================================
-- 3. ATUALIZAR TABELA DE PERSONAGENS EXISTENTES
-- =====================================

-- Recalcular magic_attack para personagens existentes baseado em INT/WIS
UPDATE characters SET 
  magic_attack = GREATEST(1, 
    1 + ROUND(POWER(COALESCE(intelligence, 10), 1.3) * 1.8) + 
    ROUND(POWER(COALESCE(wisdom, 10), 1.1) * 0.6) +
    ROUND(POWER(COALESCE(magic_mastery, 1), 1.15) * 0.8)
  );

-- =====================================
-- 4. SISTEMA DE DANO MÁGICO REBALANCEADO
-- =====================================

-- Função para calcular dano de spells usando magic_attack
CREATE OR REPLACE FUNCTION calculate_spell_damage_from_magic_attack(
    p_base_damage INTEGER,
    p_magic_attack INTEGER,
    p_intelligence INTEGER DEFAULT 10,
    p_wisdom INTEGER DEFAULT 10,
    p_magic_mastery INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    -- Sistema híbrido: base damage + magic_attack + pequeno bônus de atributos
    v_attribute_bonus NUMERIC;
    v_mastery_bonus NUMERIC;
    v_final_damage INTEGER;
BEGIN
    -- Pequeno bônus adicional dos atributos (não dominante)
    v_attribute_bonus := (POWER(p_intelligence, 1.1) * 0.1) + (POWER(p_wisdom, 1.05) * 0.05);
    
    -- Pequeno bônus da maestria (não dominante)
    v_mastery_bonus := POWER(p_magic_mastery, 1.1) * 0.1;
    
    -- Dano final: base + magic_attack (dominante) + pequenos bônus
    v_final_damage := p_base_damage + p_magic_attack + ROUND(v_attribute_bonus) + ROUND(v_mastery_bonus);
    
    RETURN GREATEST(1, v_final_damage);
END;
$$;

-- =====================================
-- 5. SISTEMA DE DANO FÍSICO REBALANCEADO  
-- =====================================

-- Função para calcular dano físico usando ATK
CREATE OR REPLACE FUNCTION calculate_physical_damage(
    p_base_damage INTEGER,
    p_atk INTEGER,
    p_strength INTEGER DEFAULT 10,
    p_weapon_mastery INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    -- Sistema similar: base + atk + pequenos bônus
    v_strength_bonus NUMERIC;
    v_mastery_bonus NUMERIC;
    v_final_damage INTEGER;
BEGIN
    -- Pequeno bônus adicional da força (não dominante)
    v_strength_bonus := POWER(p_strength, 1.05) * 0.1;
    
    -- Pequeno bônus da maestria (não dominante)
    v_mastery_bonus := POWER(p_weapon_mastery, 1.05) * 0.1;
    
    -- Dano final: base + atk (dominante) + pequenos bônus
    v_final_damage := p_base_damage + p_atk + ROUND(v_strength_bonus) + ROUND(v_mastery_bonus);
    
    RETURN GREATEST(1, v_final_damage);
END;
$$;

-- =====================================
-- 6. FUNÇÃO PARA RECALCULAR TODOS OS PERSONAGENS
-- =====================================

CREATE OR REPLACE FUNCTION recalculate_all_character_stats()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    char_record RECORD;
    derived_stats RECORD;
    updated_count INTEGER := 0;
BEGIN
    -- Iterar sobre todos os personagens
    FOR char_record IN 
        SELECT id, level, strength, dexterity, intelligence, wisdom, vitality, luck,
               sword_mastery, axe_mastery, blunt_mastery, defense_mastery, magic_mastery
        FROM characters 
        WHERE is_alive = true
    LOOP
        -- Calcular novos stats derivados
        SELECT * INTO derived_stats
        FROM calculate_derived_stats(
            char_record.level,
            char_record.strength,
            char_record.dexterity, 
            char_record.intelligence,
            char_record.wisdom,
            char_record.vitality,
            char_record.luck,
            char_record.sword_mastery,
            char_record.axe_mastery,
            char_record.blunt_mastery,
            char_record.defense_mastery,
            char_record.magic_mastery
        );
        
        -- Atualizar personagem com novos stats
        UPDATE characters SET
            max_hp = derived_stats.max_hp,
            hp = LEAST(hp, derived_stats.max_hp), -- Não exceder novo máximo
            max_mana = derived_stats.max_mana,
            mana = LEAST(mana, derived_stats.max_mana), -- Não exceder novo máximo
            atk = derived_stats.atk,
            magic_attack = derived_stats.magic_attack,
            def = derived_stats.def,
            speed = derived_stats.speed,
            critical_chance = derived_stats.critical_chance,
            critical_damage = derived_stats.critical_damage
        WHERE id = char_record.id;
        
        updated_count := updated_count + 1;
    END LOOP;
    
    RETURN updated_count;
END;
$$;

-- =====================================
-- 7. APLICAR REBALANCEAMENTO A TODOS OS PERSONAGENS
-- =====================================

-- Executar recálculo para todos os personagens existentes
SELECT recalculate_all_character_stats();

-- =====================================
-- 8. ÍNDICES PARA PERFORMANCE
-- =====================================

-- Criar índices para os novos campos
CREATE INDEX IF NOT EXISTS idx_characters_magic_attack ON characters(magic_attack);
CREATE INDEX IF NOT EXISTS idx_characters_atk ON characters(atk);

-- =====================================
-- COMENTÁRIOS DO REBALANCEAMENTO COMPLETO
-- =====================================

COMMENT ON FUNCTION calculate_derived_stats IS 
'REBALANCEAMENTO COMPLETO: Sistema similar a Dark Souls/Runescape.
- ATK e MAGIC_ATTACK separados para builds distintas
- Stats base MUITO menores (forçar especialização extrema)  
- Trade-offs reais: Mago frágil/forte vs Guerreiro resistente/moderado
- Dependência crítica de equipamentos para progressão
- Caps menores para evitar builds OP
- Complexidade que recompensa conhecimento do sistema';

COMMENT ON FUNCTION calculate_spell_damage_from_magic_attack IS
'Dano mágico usando MAGIC_ATTACK como stat principal.
- Base damage + magic_attack + pequenos bônus de INT/WIS/mastery
- Sistema dominado pelo magic_attack, não por atributos puros';

COMMENT ON FUNCTION calculate_physical_damage IS
'Dano físico usando ATK como stat principal.
- Base damage + atk + pequenos bônus de STR/mastery  
- Sistema dominado pelo atk, não por força pura';

-- Migração aplicada com sucesso
-- Sistema de personagens completamente rebalanceado 