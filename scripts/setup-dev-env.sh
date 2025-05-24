#!/bin/bash

# Script para configurar ambiente DEV (remoto)
echo "🌐 Configurando ambiente DEV (remoto)..."

# Criar .env para ambiente DEV
cat > .env << 'EOF'
# Ambiente DEV - Supabase remoto para desenvolvimento

NEXT_PUBLIC_ENV="DEV"
NEXT_PUBLIC_BASE_URL="http://tower-trials.vercel.app"

# URLs do Supabase Remoto (DEV)
NEXT_PUBLIC_SUPABASE_URL=https://rpagdztnwtyjatslrjay.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwYWdkenRud3R5amF0c2xyamF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcyODUxNjEsImV4cCI6MjA2Mjg2MTE2MX0.DIB6tYhoJ_Rb5pGr8Vu236MFhFUaMIq0x7PrUTR0ztI
NEXT_PUBLIC_SERVICE_ROLE=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwYWdkenRud3R5amF0c2xyamF5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzI4NTE2MSwiZXhwIjoyMDYyODYxMTYxfQ.kylyn4vQcXVEMJuZ_baF9Mt4Ka5d1RFraocaIx3lrB4

NEXT_PUBLIC_LOGIN_URL="http://tower-trials.vercel.app/login"
EOF

echo "✅ Ambiente DEV configurado!"
echo "🌐 Conectado ao Supabase remoto"
echo "🚀 Execute 'npm run dev' para iniciar a aplicação" 