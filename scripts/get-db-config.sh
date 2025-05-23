#!/bin/bash

# Script para mostrar configurações de conexão do banco local

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
MAGENTA='\033[0;35m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

echo -e "${CYAN}🗃️ Configurações de Conexão - Supabase Local${NC}"
echo -e "${GRAY}$(printf '=%.0s' {1..50})${NC}"

# Verificar se Supabase está rodando
if ! supabase status > /dev/null 2>&1; then
    echo -e "${RED}❌ Supabase local não está rodando!${NC}"
    echo -e "${YELLOW}Execute: npm run db:start${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}📊 CONFIGURAÇÕES PARA DBEAVER:${NC}"
echo -e "${GRAY}─────────────────────────────────${NC}"
echo -e "${WHITE}Host:     127.0.0.1${NC}"
echo -e "${WHITE}Port:     54322${NC}"  
echo -e "${WHITE}Database: postgres${NC}"
echo -e "${WHITE}Username: postgres${NC}"
echo -e "${WHITE}Password: postgres${NC}"
echo ""

echo -e "${YELLOW}🔧 CONFIGURAÇÕES SSL:${NC}"
echo -e "${WHITE}ssl:      false${NC}"
echo -e "${WHITE}sslmode:  disable${NC}"
echo ""

echo -e "${BLUE}🌐 OUTRAS URLS ÚTEIS:${NC}"
echo -e "${GRAY}─────────────────────${NC}"

# Executar supabase status e capturar saída
status_output=$(supabase status 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "$status_output" | while IFS= read -r line; do
        if echo "$line" | grep -q "API URL:"; then
            api_url=$(echo "$line" | sed 's/.*API URL:[[:space:]]*//')
            echo -e "${WHITE}API:      ${CYAN}$api_url${NC}"
        elif echo "$line" | grep -q "Studio URL:"; then
            studio_url=$(echo "$line" | sed 's/.*Studio URL:[[:space:]]*//')
            echo -e "${WHITE}Studio:   ${CYAN}$studio_url${NC}"
        elif echo "$line" | grep -q "DB URL:"; then
            db_url=$(echo "$line" | sed 's/.*DB URL:[[:space:]]*//')
            echo -e "${WHITE}Full URL: ${CYAN}$db_url${NC}"
        fi
    done
fi

echo ""
echo -e "${MAGENTA}📋 COPY-PASTE PARA DBEAVER:${NC}"
echo -e "${GRAY}──────────────────────────────${NC}"
echo -e "${YELLOW}jdbc:postgresql://127.0.0.1:54322/postgres${NC}"

echo ""
echo -e "${GREEN}✅ Pronto para conectar no DBeaver!${NC}" 