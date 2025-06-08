#!/bin/bash

# Script para resolver problemas de porta do Docker/Supabase
# Uso: ./fix-docker-ports.sh [--force]

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Verificar parâmetro force
FORCE=false
if [ "$1" = "--force" ]; then
    FORCE=true
fi

echo -e "${CYAN}🔧 Diagnóstico e Correção de Portas - Supabase Docker${NC}"
echo -e "${GRAY}==========================================================${NC}"

echo ""
echo -e "${YELLOW}📋 Verificando pré-requisitos...${NC}"

# Verificar Docker
echo -e "Verificando Docker..."
if ! docker --version > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker não encontrado!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker encontrado${NC}"

# Verificar Supabase CLI
echo -e "Verificando Supabase CLI..."
if ! supabase --version > /dev/null 2>&1; then
    echo -e "${RED}❌ Supabase CLI não encontrado!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Supabase CLI encontrado${NC}"

# Parar containers Supabase
echo ""
echo -e "${YELLOW}🛑 Parando containers Supabase...${NC}"
supabase stop > /dev/null 2>&1
echo -e "${GREEN}✅ Comando supabase stop executado${NC}"

# Limpar containers Docker
echo ""
echo -e "${YELLOW}🧹 Limpando containers Docker...${NC}"
echo -e "Listando containers Supabase:"
docker ps -a --filter "name=supabase" 2>/dev/null

echo -e "Parando containers..."
containers=$(docker ps -aq --filter "name=supabase" 2>/dev/null)
if [ -n "$containers" ]; then
    docker stop $containers > /dev/null 2>&1
    docker rm $containers > /dev/null 2>&1
    echo -e "${GREEN}✅ Containers removidos${NC}"
else
    echo -e "${GREEN}✅ Nenhum container encontrado${NC}"
fi

# Verificar portas específicas
echo ""
echo -e "${BLUE}🔍 Verificando portas Supabase...${NC}"

ports=("54321" "54322" "54323" "54324")
found_ports=()

for port in "${ports[@]}"; do
    # Verificar se a porta está ocupada (funciona no Git Bash)
    if netstat -an 2>/dev/null | grep ":$port " > /dev/null || \
       ss -tuln 2>/dev/null | grep ":$port " > /dev/null || \
       lsof -i :$port > /dev/null 2>&1; then
        echo -e "${RED}❌ Porta $port ocupada${NC}"
        found_ports+=("$port")
    else
        echo -e "${GREEN}✅ Porta $port disponível${NC}"
    fi
done

# Resolver portas ocupadas
if [ ${#found_ports[@]} -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Portas ocupadas: ${found_ports[*]}${NC}"
    
    if [ "$FORCE" = true ]; then
        echo -e "${RED}🔨 Liberando portas...${NC}"
        for port in "${found_ports[@]}"; do
            echo -e "${YELLOW}Liberando porta $port...${NC}"
            
            # Tentar diferentes métodos para finalizar processos na porta
            if command -v lsof > /dev/null; then
                # Usar lsof se disponível
                pids=$(lsof -ti :$port 2>/dev/null)
                for pid in $pids; do
                    echo -e "${CYAN}Finalizando PID: $pid${NC}"
                    kill -9 $pid 2>/dev/null
                done
            elif command -v netstat > /dev/null && command -v awk > /dev/null; then
                # Fallback para sistemas com netstat
                pids=$(netstat -tulpn 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d'/' -f1 | grep -v -)
                for pid in $pids; do
                    if [ -n "$pid" ] && [ "$pid" != "0" ]; then
                        echo -e "${CYAN}Finalizando PID: $pid${NC}"
                        kill -9 $pid 2>/dev/null
                    fi
                done
            fi
        done
    else
        echo ""
        echo -e "${MAGENTA}💡 Para resolver automaticamente:${NC}"
        echo -e "${CYAN}   npm run db:fix-force${NC}"
        echo ""
        echo -e "Ou finalize os processos manualmente e execute 'npm run db:start'"
        exit 0
    fi
fi

# Limpar volumes Docker
echo ""
echo -e "${YELLOW}🗂️  Limpando volumes Docker...${NC}"
docker volume prune -f > /dev/null 2>&1
echo -e "${GREEN}✅ Volumes limpos${NC}"

# Verificar Docker
echo ""
echo -e "${BLUE}🐳 Verificando Docker...${NC}"
if docker info > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Docker está rodando${NC}"
else
    echo -e "${RED}❌ Docker não está rodando!${NC}"
    echo -e "${YELLOW}Abra o Docker Desktop e aguarde inicializar${NC}"
    exit 1
fi

# Iniciar Supabase
echo ""
echo -e "${GREEN}🚀 Iniciando Supabase...${NC}"
if supabase start; then
    echo ""
    echo -e "${GREEN}🎉 SUCCESS! Supabase iniciado!${NC}"
    echo -e "${CYAN}Execute 'npm run db:config' para ver configurações${NC}"
else
    echo ""
    echo -e "${RED}❌ Problemas persistem. Tente:${NC}"
    echo -e "${YELLOW}1. Reiniciar Docker Desktop${NC}"
    echo -e "${YELLOW}2. Reiniciar o computador${NC}"
    echo -e "${YELLOW}3. supabase start --debug${NC}"
fi

echo ""
echo -e "${MAGENTA}🏁 Diagnóstico concluído!${NC}" 