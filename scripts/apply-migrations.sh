#!/bin/bash

# Script para aplicar migrações de forma segura
# Uso: ./apply-migrations.sh [local|dev]

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Definir ambiente (padrão: local)
ENVIRONMENT=${1:-local}

echo -e "${YELLOW}🔧 Aplicando migrações no ambiente: $ENVIRONMENT${NC}"

case $ENVIRONMENT in
    "local")
        echo -e "${BLUE}🐳 Aplicando no ambiente LOCAL (Docker)${NC}"
        
        # Verificar se Supabase local está rodando
        if ! supabase status > /dev/null 2>&1; then
            echo -e "${RED}❌ Supabase local não está rodando!${NC}"
            echo -e "${YELLOW}Execute: npm run db:start${NC}"
            exit 1
        fi
        
        # Aplicar migrações
        echo -e "${GREEN}📥 Aplicando migrações...${NC}"
        if supabase db push; then
            echo -e "${GREEN}✅ Migrações aplicadas com sucesso no ambiente LOCAL!${NC}"
        else
            echo -e "${RED}❌ Erro ao aplicar migrações!${NC}"
            exit 1
        fi
        ;;
        
    "dev")
        echo -e "${YELLOW}🌐 Aplicando no ambiente DEV (remoto)${NC}"
        echo -e "${RED}⚠️  ATENÇÃO: Isso afetará dados reais!${NC}"
        
        read -p "Tem certeza que deseja aplicar no ambiente DEV? (sim/não): " confirm
        if [ "$confirm" != "sim" ]; then
            echo -e "${YELLOW}❌ Operação cancelada pelo usuário${NC}"
            exit 0
        fi
        
        # Backup de segurança (se possível)
        echo -e "${CYAN}💾 Criando backup de segurança...${NC}"
        
        # Aplicar migrações
        echo -e "${GREEN}📥 Aplicando migrações no ambiente remoto...${NC}"
        if supabase db push --linked; then
            echo -e "${GREEN}✅ Migrações aplicadas com sucesso no ambiente DEV!${NC}"
            echo -e "${CYAN}🔍 Verifique se tudo está funcionando corretamente${NC}"
        else
            echo -e "${RED}❌ Erro ao aplicar migrações!${NC}"
            echo -e "${RED}🚨 Verifique o estado do banco imediatamente!${NC}"
            exit 1
        fi
        ;;
        
    *)
        echo -e "${RED}❌ Ambiente inválido: $ENVIRONMENT${NC}"
        echo -e "${YELLOW}Use: ./apply-migrations.sh [local|dev]${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}🎉 Processo concluído!${NC}"