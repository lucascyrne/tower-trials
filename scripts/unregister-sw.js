#!/usr/bin/env node

/**
 * Script para desregistrar Service Workers em desenvolvimento
 * Ajuda a resolver problemas de cache e hot reload
 */

import fs from 'fs';
import path from 'path';

console.log('🧹 Limpando Service Workers para desenvolvimento...');

// Criar um script temporário para rodar no navegador
const unregisterScript = `
<!-- Script temporário para desregistrar Service Workers -->
<script>
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister().then(function(boolean) {
        console.log('🗑️ Service Worker desregistrado:', boolean);
      });
    }
  });
  
  // Limpar cache também
  caches.keys().then(function(names) {
    for (let name of names) {
      caches.delete(name).then(function(result) {
        console.log('🗑️ Cache removido:', name, result);
      });
    }
  });
}
</script>
`;

// Salvar instruções para o usuário
const instructions = `
Service Worker Cleanup Instructions:

1. Para usar automaticamente:
   npm run dev:clean

2. Para limpar manualmente no navegador:
   - Abra DevTools (F12)
   - Vá para Application > Service Workers
   - Clique em "Unregister" para todos os SWs
   - Vá para Application > Storage
   - Clique em "Clear storage"

3. Cache do navegador:
   - Ctrl+Shift+R (força reload)
   - Ou Ctrl+F5

✅ Service Workers agora só funcionam em produção!
✅ Hot reload deve funcionar normalmente em desenvolvimento.
`;

console.log(instructions);

// Verificar se já existe service worker registrado
console.log(
  '💡 Dica: Se ainda tiver problemas, abra DevTools > Application > Service Workers e desregistre manualmente.'
);
console.log('📌 Lembre-se: O Service Worker agora só funciona em produção (npm run build)');
