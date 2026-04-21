#!/bin/bash

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

MODE="${1:-local}"
CONFIRM="${2:-}"

if [ "$CONFIRM" != "--confirm" ]; then
  echo -e "${RED}Operação destrutiva bloqueada.${NC}"
  echo "Uso: ./scripts/reset-db.sh [local|linked] --confirm"
  exit 1
fi

if [ "$MODE" = "linked" ]; then
  echo -e "${YELLOW}Resetando banco LINKED (remoto)...${NC}"
  npx supabase db reset --linked
else
  echo -e "${YELLOW}Resetando banco LOCAL...${NC}"
  npx supabase db reset
fi

echo -e "${GREEN}Reset concluído.${NC}"
echo -e "${YELLOW}Seed automático aplicado: supabase/seed.sql (config.toml).${NC}"
echo -e "${YELLOW}Aplique manualmente no SQL Editor, nesta ordem:${NC}"
echo "  1) supabase/seed.sql"
echo "  2) supabase/seed_craftable_equipment.sql"
echo "  3) supabase/clean_spells.sql"
echo "  4) supabase/spells.sql"
echo -e "${GREEN}Próximo passo: execute checks em supabase/baseline/post_seed_integrity_checks.sql.${NC}"