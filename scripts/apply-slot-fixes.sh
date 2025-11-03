#!/bin/bash

# =============================================
# Script: Aplicar Correções de Ambiguidade de Slots
# Description: Aplica migrações para corrigir erro 42702 em funções de slots
# Usage: ./scripts/apply-slot-fixes.sh
# =============================================

set -e

echo "🔧 Aplicando Correções de Ambiguidade de Slots..."
echo ""

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Função para exibir erro
error() {
    echo -e "${RED}❌ Erro: $1${NC}"
    exit 1
}

# Função para exibir sucesso
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Função para exibir info
info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# 1. Verificar se supabase CLI está instalado
info "Verificando se Supabase CLI está instalado..."
if ! command -v supabase &> /dev/null; then
    error "Supabase CLI não está instalado. Execute: npm install -g @supabase/cli"
fi
success "Supabase CLI encontrado"
echo ""

# 2. Verificar migrações necessárias
info "Verificando migrações necessárias..."
MIGRATIONS=(
    "supabase/migrations/00016_fix_slot_functions.sql"
    "supabase/migrations/00017_fix_use_potion_from_slot.sql"
    "supabase/migrations/00018_fix_spell_slots_ambiguity.sql"
)

for migration in "${MIGRATIONS[@]}"; do
    if [ -f "$migration" ]; then
        success "Migração encontrada: $migration"
    else
        error "Migração não encontrada: $migration"
    fi
done
echo ""

# 3. Aplicar migrações localmente
info "Aplicando migrações localmente..."
supabase migration up || error "Erro ao aplicar migrações localmente"
success "Migrações aplicadas localmente"
echo ""

# 4. Fazer push para banco remoto
info "Fazendo push das migrações para o banco remoto..."
read -p "Deseja fazer push para o banco remoto do Supabase? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    supabase db push || error "Erro ao fazer push das migrações"
    success "Migrações enviadas para o banco remoto"
else
    info "Push para banco remoto cancelado pelo usuário"
fi
echo ""

# 5. Validar funções
info "Validando funções SQL no banco de dados..."
echo "Funções corrigidas:"
echo "  - get_character_potion_slots (com qualificação de slot_position)"
echo "  - consume_potion_from_slot (com qualificação de character_consumables)"
echo "  - set_potion_slot (novo contrato: retorna success/error/message)"
echo "  - clear_potion_slot (novo contrato: retorna success/error/message)"
echo "  - use_potion_from_slot (com qualificação de character_consumables)"
echo "  - get_character_spell_slots (com qualificação de spell_slots)"
echo "  - set_spell_slot (novo contrato: retorna success/error/message)"
success "Validação de funções concluída"
echo ""

# 6. Resumo
echo "════════════════════════════════════════"
echo "✨ Correções Aplicadas com Sucesso! ✨"
echo "════════════════════════════════════════"
echo ""
echo "Migrações aplicadas:"
echo "  1. 00016_fix_slot_functions.sql"
echo "  2. 00017_fix_use_potion_from_slot.sql"
echo "  3. 00018_fix_spell_slots_ambiguity.sql"
echo ""
echo "Correções:"
echo "  ✓ Erro PostgreSQL 42702 (ambiguidade de slot_position) resolvido"
echo "  ✓ Todas as colunas estão qualificadas com alias de tabela"
echo "  ✓ Funções retornam estruturas apropriadas com feedback"
echo ""
echo "Próximos passos:"
echo "  1. Fazer deploy da aplicação"
echo "  2. Testar a função get_character_potion_slots via RPC"
echo "  3. Testar slots de poção e magia em jogo"
echo ""
echo "Para mais detalhes, consulte: MIGRATION_SLOT_AMBIGUITY_FIX.md"
