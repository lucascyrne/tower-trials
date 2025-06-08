# 🚀 Tower Trials - Guia PWA (Progressive Web App)

## 📱 O que é um PWA?

Progressive Web Apps (PWAs) são aplicações web que oferecem uma experiência similar a aplicativos nativos. O Tower Trials agora pode ser instalado em seu dispositivo e funcionar em tela cheia, sem as barras do navegador!

## ✨ Funcionalidades Implementadas

### 🔧 Recursos Técnicos
- **Manifest.json**: Configuração para instalação do app
- **Service Worker**: Cache inteligente e funcionalidade offline
- **Ícones**: Conjunto completo de ícones SVG responsivos
- **Meta Tags**: Configurações otimizadas para diferentes dispositivos

### 📦 Funcionalidades do Usuário
- **Instalação**: Botão "Instalar App" no header quando disponível
- **Tela Cheia**: Execução sem barras do navegador (modo `fullscreen`)
- **Offline**: Funcionalidade básica mesmo sem conexão
- **Notificações**: Suporte a push notifications (futuro)
- **Atalhos**: Atalhos rápidos no app instalado

## 🛠️ Como Instalar

### No Desktop (Chrome/Edge)
1. Acesse o jogo no navegador
2. Procure pelo botão "Instalar App" no header
3. Clique e confirme a instalação
4. O app aparecerá como um programa instalado

### No Mobile (Android/iOS)
1. Acesse o jogo no navegador
2. **Android**: Toque no menu do navegador → "Instalar app" ou "Adicionar à tela inicial"
3. **iOS**: Toque no botão compartilhar → "Adicionar à Tela Inicial"

## 🎯 Modo Tela Cheia

Quando instalado, o Tower Trials será executado em modo `fullscreen`:
- ✅ Sem barra de endereços
- ✅ Sem botões do navegador
- ✅ Experiência imersiva completa
- ✅ Mais espaço para o jogo

## 📂 Estrutura de Arquivos PWA

```
public/
├── manifest.json          # Configuração principal do PWA
├── sw.js                  # Service Worker para cache/offline
├── favicon.svg           # Ícone da aba do navegador
└── icons/                # Ícones para instalação
    ├── icon-72x72.svg
    ├── icon-96x96.svg
    ├── icon-128x128.svg
    ├── icon-144x144.svg
    ├── icon-152x152.svg
    ├── icon-192x192.svg
    ├── icon-384x384.svg
    └── icon-512x512.svg

src/
├── hooks/
│   └── usePWAInstall.ts   # Hook para gerenciar instalação
└── components/
    ├── PWAInstallButton.tsx # Botão de instalação
    └── PWAStatus.tsx        # Status do PWA para debug
```

## 🔄 Scripts Disponíveis

```bash
# Gerar ícones PWA
npm run pwa:icons

# Testar PWA em produção
npm run pwa:serve

# Build e servir (recomendado para testar PWA)
npm run build && npm run start
```

## ⚙️ Configurações Técnicas

### Manifest.json
- **Display**: `fullscreen` para experiência imersiva total
- **Orientação**: `any` para suportar portrait e landscape
- **Theme Color**: `#1a1a1a` (escuro)
- **Background Color**: `#000000` (preto)
- **Language**: `pt-BR`

### Service Worker
- **Cache Strategy**: Cache-first com fallback para rede
- **Recursos Cachados**: Páginas principais, ícones, manifest
- **Sincronização**: Background sync para dados do jogo
- **Notificações**: Push notifications preparadas

### Meta Tags
- **Viewport**: Otimizado para dispositivos móveis
- **Apple Web App**: Configurações específicas para iOS
- **Microsoft**: Configurações para Windows/Edge

## 🧪 Como Testar

### 1. Verificar Instalabilidade
```javascript
// Abra o DevTools Console e digite:
navigator.serviceWorker.getRegistrations().then(registrations => {
  console.log('Service Workers registrados:', registrations.length);
});
```

### 2. Testar Modo Offline
1. Instale o app
2. Abra o DevTools → Network → marque "Offline"
3. Recarregue a página
4. Verifique se funciona com recursos em cache

### 3. Verificar Manifest
1. DevTools → Application → Manifest
2. Verifique se todas as configurações estão corretas

## 🎨 Personalização

### Alterar Ícones
1. Edite o script `scripts/generate-pwa-icons.js`
2. Execute `npm run pwa:icons`
3. Os ícones serão atualizados automaticamente

### Alterar Cores do Tema
1. Edite `public/manifest.json`:
   ```json
   {
     "theme_color": "#sua-cor",
     "background_color": "#sua-cor-de-fundo"
   }
   ```

### Adicionar Funcionalidades Offline
1. Edite `public/sw.js`
2. Adicione URLs ao array `urlsToCache`
3. Implemente lógica customizada de cache

## 🚀 Benefícios do PWA

### Para os Usuários
- 📱 **Instalação fácil**: Sem app stores
- ⚡ **Carregamento rápido**: Cache inteligente
- 🌐 **Funciona offline**: Recursos básicos sempre disponíveis
- 🖥️ **Tela cheia**: Experiência imersiva
- 🔔 **Notificações**: Alertas do jogo (futuro)

### Para o Desenvolvimento
- 🔧 **Fácil deployment**: Mesmo processo do site
- 📊 **Analytics**: Mesmo sistema de tracking
- 🔄 **Atualizações**: Instantâneas sem app store
- 💾 **Menor banda**: Cache reduz uso de dados

## 🐛 Troubleshooting

### O botão "Instalar App" não aparece
- ✅ Certifique-se de estar em HTTPS (ou localhost)
- ✅ Verifique se o Service Worker está registrado
- ✅ Confirme que o manifest.json está válido
- ✅ Teste em um navegador compatível (Chrome, Edge, Firefox)

### Service Worker não funciona
- ✅ Verifique o console por erros
- ✅ Certifique-se de que `sw.js` está acessível
- ✅ Limpe o cache do navegador

### App não abre em tela cheia
- ✅ Verifique se `display: "fullscreen"` está no manifest
- ✅ Reinstale o app
- ✅ Teste em diferentes dispositivos

## 📚 Recursos Adicionais

- [MDN - Progressive Web Apps](https://developer.mozilla.org/pt-BR/docs/Web/Progressive_web_apps)
- [Web.dev - PWA Checklist](https://web.dev/pwa-checklist/)
- [Manifest Generator](https://app-manifest.firebaseapp.com/)

---

🎮 **Divirta-se jogando Tower Trials em tela cheia!** 