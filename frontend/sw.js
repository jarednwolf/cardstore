/**
 * DeckStack Service Worker - Phase 5
 * Advanced PWA capabilities with offline support
 */

const CACHE_NAME = 'deckstack-v5.0.0';
const OFFLINE_URL = '/offline.html';
const API_CACHE_NAME = 'deckstack-api-v5.0.0';
const IMAGES_CACHE_NAME = 'deckstack-images-v5.0.0';

// Resources to cache immediately
const ESSENTIAL_RESOURCES = [
  '/',
  '/mobile.html',
  '/dashboard.html',
  '/inventory.html',
  '/orders.html',
  '/js/app.js',
  '/js/mobile.js',
  '/js/scanner.js',
  '/js/api.js',
  '/styles/main.css',
  '/styles/mobile.css',
  '/styles/components.css',
  '/manifest.json',
  OFFLINE_URL
];

// API endpoints to cache
const CACHEABLE_API_PATTERNS = [
  /\/api\/v1\/products/,
  /\/api\/v1\/inventory/,
  /\/api\/v1\/orders/,
  /\/api\/v1\/analytics\/dashboard/,
  /\/api\/v1\/tenants\/current/
];

// Background sync tags
const SYNC_TAGS = {
  INVENTORY_UPDATES: 'inventory-updates',
  ORDER_UPDATES: 'order-updates',
  OFFLINE_SCANS: 'offline-scans',
  ANALYTICS_EVENTS: 'analytics-events'
};

// Install event - cache essential resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => {
        console.log('Caching essential resources');
        return cache.addAll(ESSENTIAL_RESOURCES);
      }),
      caches.open(API_CACHE_NAME),
      caches.open(IMAGES_CACHE_NAME)
    ]).then(() => {
      console.log('Service Worker installed successfully');
      // Skip waiting to activate immediately
      return self.skipWaiting();
    }).catch((error) => {
      console.error('Service Worker installation failed:', error);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== API_CACHE_NAME && 
                cacheName !== IMAGES_CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Claim all clients
      self.clients.claim()
    ]).then(() => {
      console.log('Service Worker activated successfully');
    })
  );
});

// Fetch event - handle all network requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests for caching
  if (request.method !== 'GET') {
    return;
  }
  
  // Handle different types of requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleAPIRequest(request));
  } else if (url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico)$/)) {
    event.respondWith(handleImageRequest(request));
  } else {
    event.respondWith(handleNavigationRequest(request));
  }
});

// Handle API requests with network-first strategy
async function handleAPIRequest(request) {
  const url = new URL(request.url);
  const isCacheable = CACHEABLE_API_PATTERNS.some(pattern => pattern.test(url.pathname));
  
  if (!isCacheable) {
    // For non-cacheable APIs, just try network
    try {
      return await fetch(request);
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: 'Network unavailable',
        offline: true 
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  try {
    // Try network first
    const response = await fetch(request);
    
    if (response.ok) {
      // Cache successful responses
      const cache = await caches.open(API_CACHE_NAME);
      const responseClone = response.clone();
      
      // Add timestamp to cached response
      const responseWithTimestamp = new Response(responseClone.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers.entries()),
          'sw-cached-at': new Date().toISOString(),
          'sw-cache-type': 'api'
        }
      });
      
      await cache.put(request, responseWithTimestamp);
    }
    
    return response;
  } catch (error) {
    // Network failed, try cache
    const cache = await caches.open(API_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // Add offline indicator to cached response
      const cachedData = await cachedResponse.json();
      return new Response(JSON.stringify({
        ...cachedData,
        _offline: true,
        _cachedAt: cachedResponse.headers.get('sw-cached-at')
      }), {
        status: cachedResponse.status,
        headers: {
          'Content-Type': 'application/json',
          'X-Served-From': 'cache',
          'X-Offline-Mode': 'true'
        }
      });
    }
    
    // No cache available
    return new Response(JSON.stringify({ 
      error: 'Data unavailable offline',
      offline: true 
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle image requests with cache-first strategy
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGES_CACHE_NAME);
  
  // Try cache first
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    // Fetch from network
    const response = await fetch(request);
    
    if (response.ok) {
      // Cache the image
      await cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Return placeholder image for offline
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f3f4f6"/><text x="100" y="100" text-anchor="middle" dy=".3em" fill="#9ca3af">Image Unavailable</text></svg>',
      {
        headers: { 'Content-Type': 'image/svg+xml' }
      }
    );
  }
}

// Handle navigation requests with stale-while-revalidate strategy
async function handleNavigationRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  
  try {
    // Try network first for navigation
    const response = await fetch(request);
    
    if (response.ok) {
      // Update cache in background
      await cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // For navigation requests, return offline page
    if (request.mode === 'navigate') {
      const offlineResponse = await cache.match(OFFLINE_URL);
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    
    // Fallback response
    return new Response('Offline - Content not available', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  switch (event.tag) {
    case SYNC_TAGS.INVENTORY_UPDATES:
      event.waitUntil(syncInventoryUpdates());
      break;
    case SYNC_TAGS.ORDER_UPDATES:
      event.waitUntil(syncOrderUpdates());
      break;
    case SYNC_TAGS.OFFLINE_SCANS:
      event.waitUntil(syncOfflineScans());
      break;
    case SYNC_TAGS.ANALYTICS_EVENTS:
      event.waitUntil(syncAnalyticsEvents());
      break;
    default:
      console.log('Unknown sync tag:', event.tag);
  }
});

// Sync inventory updates
async function syncInventoryUpdates() {
  try {
    const updates = await getStoredData('inventory_updates');
    
    for (const update of updates) {
      try {
        const response = await fetch('/api/v1/inventory/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await getAuthToken()}`,
            'X-Tenant-ID': await getTenantId()
          },
          body: JSON.stringify(update.data)
        });
        
        if (response.ok) {
          await removeStoredData('inventory_updates', update.id);
          console.log('Synced inventory update:', update.id);
        }
      } catch (error) {
        console.error('Failed to sync inventory update:', error);
      }
    }
  } catch (error) {
    console.error('Inventory sync failed:', error);
  }
}

// Sync order updates
async function syncOrderUpdates() {
  try {
    const updates = await getStoredData('order_updates');
    
    for (const update of updates) {
      try {
        const response = await fetch(`/api/v1/orders/${update.data.orderId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await getAuthToken()}`,
            'X-Tenant-ID': await getTenantId()
          },
          body: JSON.stringify(update.data.changes)
        });
        
        if (response.ok) {
          await removeStoredData('order_updates', update.id);
          console.log('Synced order update:', update.id);
        }
      } catch (error) {
        console.error('Failed to sync order update:', error);
      }
    }
  } catch (error) {
    console.error('Order sync failed:', error);
  }
}

// Sync offline scans
async function syncOfflineScans() {
  try {
    const scans = await getStoredData('offline_scans');
    
    for (const scan of scans) {
      try {
        const response = await fetch('/api/v1/products/lookup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await getAuthToken()}`,
            'X-Tenant-ID': await getTenantId()
          },
          body: JSON.stringify({ barcode: scan.data.barcode })
        });
        
        if (response.ok) {
          await removeStoredData('offline_scans', scan.id);
          console.log('Synced offline scan:', scan.id);
          
          // Notify client about successful sync
          await notifyClients('scan-synced', {
            scanId: scan.id,
            barcode: scan.data.barcode,
            result: await response.json()
          });
        }
      } catch (error) {
        console.error('Failed to sync offline scan:', error);
      }
    }
  } catch (error) {
    console.error('Scan sync failed:', error);
  }
}

// Sync analytics events
async function syncAnalyticsEvents() {
  try {
    const events = await getStoredData('analytics_events');
    
    for (const event of events) {
      try {
        const response = await fetch('/api/v1/analytics/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await getAuthToken()}`,
            'X-Tenant-ID': await getTenantId()
          },
          body: JSON.stringify(event.data)
        });
        
        if (response.ok) {
          await removeStoredData('analytics_events', event.id);
          console.log('Synced analytics event:', event.id);
        }
      } catch (error) {
        console.error('Failed to sync analytics event:', error);
      }
    }
  } catch (error) {
    console.error('Analytics sync failed:', error);
  }
}

// Message handling for communication with clients
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'QUEUE_OFFLINE_ACTION':
      queueOfflineAction(data);
      break;
    case 'GET_CACHE_STATUS':
      getCacheStatus().then(status => {
        event.ports[0].postMessage(status);
      });
      break;
    case 'CLEAR_CACHE':
      clearCache(data.cacheType).then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;
    default:
      console.log('Unknown message type:', type);
  }
});

// Queue offline actions for background sync
async function queueOfflineAction(action) {
  const actionId = generateId();
  const queueName = getQueueName(action.type);
  
  await storeData(queueName, {
    id: actionId,
    data: action.data,
    timestamp: new Date().toISOString()
  });
  
  // Register background sync
  try {
    await self.registration.sync.register(getSyncTag(action.type));
  } catch (error) {
    console.error('Failed to register background sync:', error);
  }
}

// Utility functions
function getQueueName(actionType) {
  const queueMap = {
    'inventory_update': 'inventory_updates',
    'order_update': 'order_updates',
    'scan_result': 'offline_scans',
    'analytics_event': 'analytics_events'
  };
  return queueMap[actionType] || 'unknown_actions';
}

function getSyncTag(actionType) {
  const tagMap = {
    'inventory_update': SYNC_TAGS.INVENTORY_UPDATES,
    'order_update': SYNC_TAGS.ORDER_UPDATES,
    'scan_result': SYNC_TAGS.OFFLINE_SCANS,
    'analytics_event': SYNC_TAGS.ANALYTICS_EVENTS
  };
  return tagMap[actionType] || 'unknown-sync';
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// IndexedDB operations for offline storage
async function storeData(storeName, data) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('DeckStackOffline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      store.add(data);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'id' });
      }
    };
  });
}

async function getStoredData(storeName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('DeckStackOffline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'id' });
      }
    };
  });
}

async function removeStoredData(storeName, id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('DeckStackOffline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      store.delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };
  });
}

async function getAuthToken() {
  // Get auth token from IndexedDB or return empty string
  try {
    const data = await getStoredData('auth_data');
    return data[0]?.token || '';
  } catch (error) {
    return '';
  }
}

async function getTenantId() {
  // Get tenant ID from IndexedDB or return empty string
  try {
    const data = await getStoredData('auth_data');
    return data[0]?.tenantId || '';
  } catch (error) {
    return '';
  }
}

async function notifyClients(type, data) {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type, data });
  });
}

async function getCacheStatus() {
  const caches = await Promise.all([
    caches.open(CACHE_NAME),
    caches.open(API_CACHE_NAME),
    caches.open(IMAGES_CACHE_NAME)
  ]);
  
  const sizes = await Promise.all(
    caches.map(async (cache) => {
      const keys = await cache.keys();
      return keys.length;
    })
  );
  
  return {
    static: sizes[0],
    api: sizes[1],
    images: sizes[2],
    total: sizes.reduce((sum, size) => sum + size, 0)
  };
}

async function clearCache(cacheType) {
  switch (cacheType) {
    case 'static':
      await caches.delete(CACHE_NAME);
      break;
    case 'api':
      await caches.delete(API_CACHE_NAME);
      break;
    case 'images':
      await caches.delete(IMAGES_CACHE_NAME);
      break;
    case 'all':
      await Promise.all([
        caches.delete(CACHE_NAME),
        caches.delete(API_CACHE_NAME),
        caches.delete(IMAGES_CACHE_NAME)
      ]);
      break;
  }
}

// Periodic cache cleanup
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'cache-cleanup') {
    event.waitUntil(cleanupOldCacheEntries());
  }
});

async function cleanupOldCacheEntries() {
  const cache = await caches.open(API_CACHE_NAME);
  const requests = await cache.keys();
  const now = new Date();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  for (const request of requests) {
    const response = await cache.match(request);
    const cachedAt = response.headers.get('sw-cached-at');
    
    if (cachedAt) {
      const cacheTime = new Date(cachedAt);
      if (now - cacheTime > maxAge) {
        await cache.delete(request);
        console.log('Cleaned up old cache entry:', request.url);
      }
    }
  }
}

console.log('DeckStack Service Worker loaded');