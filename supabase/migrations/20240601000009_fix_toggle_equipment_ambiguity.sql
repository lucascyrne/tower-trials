-- Migração para resolver ambiguidade na função toggle_equipment

-- Remover a função toggle_equipment com 3 parâmetros para evitar ambiguidade
DROP FUNCTION IF EXISTS toggle_equipment(UUID, UUID, BOOLEAN);

-- Garantir que apenas a versão com 4 parâmetros existe
-- (A função com 4 parâmetros já foi criada na migração anterior) 