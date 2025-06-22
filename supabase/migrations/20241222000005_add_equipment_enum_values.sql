-- =====================================
-- MIGRAÇÃO: Adicionar Novos Valores ao Enum Equipment Type
-- Data: 2024-12-22
-- Descrição: Adiciona ring, necklace, amulet ao enum equipment_type
-- =====================================

-- Verificar se o tipo equipment_type existe e adicionar novos valores
DO $$
BEGIN
    -- Adicionar novos tipos de equipamento se não existirem
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ring' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'equipment_type')) THEN
        ALTER TYPE equipment_type ADD VALUE 'ring';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'necklace' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'equipment_type')) THEN
        ALTER TYPE equipment_type ADD VALUE 'necklace';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'amulet' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'equipment_type')) THEN
        ALTER TYPE equipment_type ADD VALUE 'amulet';
    END IF;
END
$$;

-- =====================================
-- LOG DE CONCLUSÃO
-- =====================================

DO $$
BEGIN
    RAISE NOTICE '====================================';
    RAISE NOTICE 'NOVOS VALORES DE ENUM ADICIONADOS';
    RAISE NOTICE 'Data: 2024-12-22';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Valores adicionados ao equipment_type:';
    RAISE NOTICE '[OK] ring - Para anéis';
    RAISE NOTICE '[OK] necklace - Para colares';
    RAISE NOTICE '[OK] amulet - Para amuletos';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'ENUM PREPARADO PARA PRÓXIMAS MIGRAÇÕES!';
    RAISE NOTICE '====================================';
END $$; 