const CACHE_NAME = 'tower-trials-v2';
const STATIC_CACHE_NAME = 'tower-trials-static-v2';
const DYNAMIC_CACHE_NAME = 'tower-trials-dynamic-v2';

// Recursos essenciais que devem sempre ser cacheados
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.svg',
  '/icons/icon-512x512.svg',
  '/favicon.svg',
];

// Recursos que devem ser sempre atualizados (Network First)
const networkFirstUrls = ['/api/', '/auth/', '.json', '.js', '.css'];

// Install - Cache resources
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then(cache => {
      console.log('[SW] Caching static resources');
      return cache.addAll(urlsToCache);
    })
  );
  // Força ativação imediata para aplicar atualizações
  self.skipWaiting();
});

// Activate - Clean up old caches and update clients
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    Promise.all([
      // Limpar caches antigos
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (
              cacheName !== STATIC_CACHE_NAME &&
              cacheName !== DYNAMIC_CACHE_NAME &&
              cacheName !== CACHE_NAME
            ) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Tomar controle de todas as abas imediatamente
      self.clients.claim(),
    ])
  );
});

// Fetch - Estratégias inteligentes de cache
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests e requests que não são GET
  if (!request.url.startsWith(self.location.origin) || request.method !== 'GET') {
    return;
  }

  // Estratégia Network First para recursos dinâmicos
  if (networkFirstUrls.some(pattern => request.url.includes(pattern))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Estratégia Cache First para recursos estáticos
  if (urlsToCache.some(url => request.url.endsWith(url))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Estratégia Stale While Revalidate para tudo mais
  event.respondWith(staleWhileRevalidate(request));
});

// Network First - Tenta rede primeiro, fallback para cache
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // Verificar se o MIME type é válido para o tipo de requisição
      const contentType = networkResponse.headers.get('content-type') || '';

      // Se for um JS/CSS e recebeu HTML, algo errou (rota reescrita incorretamente)
      const isJsRequest = request.url.includes('.js');
      const isCssRequest = request.url.includes('.css');

      if ((isJsRequest || isCssRequest) && contentType.includes('text/html')) {
        console.warn('[SW] ⚠️ Recebido HTML para requisição de asset:', request.url);
        // Tenta cache ou retorna erro
        const cachedResponse = await caches.match(request);
        return cachedResponse || new Response('Asset not available', { status: 404 });
      }

      // Cache a resposta válida
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }

    throw new Error('Network response not ok');
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);
    return (
      cachedResponse ||
      new Response('Offline - Content not available', {
        status: 503,
        statusText: 'Service Unavailable',
      })
    );
  }
}

// Cache First - Verifica cache primeiro, fallback para rede
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Cache and network failed for:', request.url);
    return new Response('Resource not available', {
      status: 404,
      statusText: 'Not Found',
    });
  }
}

// Stale While Revalidate - Retorna cache e atualiza em background
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);

  // Buscar versão atualizada em background
  const fetchPromise = fetch(request).then(response => {
    // Validar MIME type para assets
    const contentType = response.headers.get('content-type') || '';
    const url = new URL(request.url).pathname;

    if ((url.includes('.js') || url.includes('.css')) && contentType.includes('text/html')) {
      console.warn('[SW] ⚠️ MIME type inválido em background sync:', url);
      return response;
    }

    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  });

  // Retornar cache imediatamente se disponível, senão aguardar rede
  return cachedResponse || fetchPromise;
}

// Handle background sync for game data
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  try {
    console.log('[SW] Background sync completed');
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// Push notifications para eventos do jogo
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'Nova atualização disponível!',
    icon: '/icons/icon-192x192.svg',
    badge: '/icons/icon-72x72.svg',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: 'explore',
        title: 'Jogar Agora',
        icon: '/icons/icon-192x192.svg',
      },
      {
        action: 'close',
        title: 'Fechar',
        icon: '/icons/icon-192x192.svg',
      },
    ],
  };

  event.waitUntil(self.registration.showNotification('Tower Trials', options));
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(clients.openWindow('/game'));
  }
});

// Mensagens do cliente para controle do SW
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
      })
    );
  }
});
