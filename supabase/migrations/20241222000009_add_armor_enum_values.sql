-- =====================================
-- MIGRAÇÃO: Adicionar Novos Tipos de Armadura ao Enum
-- Data: 2024-12-22
-- Descrição: Adiciona chest, legs, boots, helmet ao enum equipment_type
-- =====================================

-- Verificar se o tipo equipment_type existe e adicionar novos valores
DO $$
BEGIN
    -- Adicionar novos tipos de armadura se não existirem
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'chest' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'equipment_type')) THEN
        ALTER TYPE equipment_type ADD VALUE 'chest';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'legs' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'equipment_type')) THEN
        ALTER TYPE equipment_type ADD VALUE 'legs';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'boots' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'equipment_type')) THEN
        ALTER TYPE equipment_type ADD VALUE 'boots';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'helmet' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'equipment_type')) THEN
        ALTER TYPE equipment_type ADD VALUE 'helmet';
    END IF;
END
$$;

-- =====================================
-- LOG DE CONCLUSÃO
-- =====================================

DO $$
BEGIN
    RAISE NOTICE '====================================';
    RAISE NOTICE 'NOVOS TIPOS DE ARMADURA ADICIONADOS';
    RAISE NOTICE 'Data: 2024-12-22';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Valores adicionados ao equipment_type:';
    RAISE NOTICE '[OK] chest - Para peitorais/armaduras';
    RAISE NOTICE '[OK] legs - Para perneiras/calças';
    RAISE NOTICE '[OK] boots - Para botas/calçados';
    RAISE NOTICE '[OK] helmet - Para capacetes/elmos';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'ENUM PREPARADO PARA SISTEMA EXPANDIDO!';
    RAISE NOTICE '====================================';
END $$; 