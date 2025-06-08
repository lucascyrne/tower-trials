#!/bin/bash

# Script para configurar ambiente LOCAL
echo "🏗️ Configurando ambiente LOCAL (Docker)..."

# Criar .env para ambiente LOCAL
cat > .env << 'EOF'
# Ambiente LOCAL - Supabase via Docker
# Use este arquivo quando rodar `supabase start` e quiser usar o banco local

NEXT_PUBLIC_ENV="LOCAL"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"

# URLs do Supabase Local (Docker)
NEXT_PUBLIC_SUPABASE_LOCAL_URL="http://127.0.0.1:54321"
NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

# URLs de fallback (não usadas em LOCAL, mas necessárias para validação)
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
NEXT_PUBLIC_SERVICE_ROLE="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

NEXT_PUBLIC_LOGIN_URL="http://localhost:3000/login"
EOF

echo "✅ Ambiente LOCAL configurado!"
echo "🐳 Execute 'supabase start' para iniciar o banco local"
echo "🚀 Execute 'npm run dev' para iniciar a aplicação" 