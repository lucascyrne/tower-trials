#!/bin/bash

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Resetando banco de dados remoto...${NC}"
npx supabase@beta db reset --linked

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Reset do banco concluído com sucesso!${NC}"
    echo -e "${YELLOW}Todos os seeds foram aplicados automaticamente.${NC}"
    echo -e "${GREEN}Processo concluído com sucesso!${NC}"
else
    echo -e "${RED}Erro ao resetar o banco de dados${NC}"
    exit 1
fi 