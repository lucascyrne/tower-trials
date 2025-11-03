-- =============================================
-- MIGRATION: Extensions and Helper Functions
-- Version: 2.0
-- Description: Configura extensões PostgreSQL e funções auxiliares reutilizáveis
-- Dependencies: Nenhuma (primeira migração)
-- =============================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Função helper para atualizar timestamps automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

