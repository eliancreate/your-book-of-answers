// service-worker.js

// 定義快取名稱和要快取的資源列表
const CACHE_NAME = 'your-answer-book-cache-v7'; // 再次更新快取版本，確保強制更新

// 這裡快取應用程式的核心靜態檔案，包含 manifest 和 icons
const urlsToCache = [
  './', // 根目錄，即 index.html
  './index.html',
  './style.css',
  './script.js',
  './manifest.json', // 確保 manifest.json 也被快取
  './icons/icon-192x192.png', // 確保圖示檔案被快取
  './icons/icon-512x512.png'  // 確保圖示檔案被快取
];

// 安裝 Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Opened cache. Caching static assets.');
        return cache.addAll(urlsToCache).catch(error => {
            console.error('Service Worker: Failed to cache some URLs during install:', error);
            // 即使部分失敗，也允許 Service Worker 安裝
        });
      })
      .catch(error => {
        console.error('Service Worker: Cache open failed during install:', error);
      })
  );
});

// 攔截網路請求
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // 1. 重要：跳過所有 Firebase、Google API 和 CDN 相關的請求
  // 這些請求需要直接走網路，不應被快取或攔截，因為它們是動態的或需要特定認證。
  if (requestUrl.hostname.includes('googleapis.com') ||
      requestUrl.hostname.includes('gstatic.com') ||
      requestUrl.hostname.includes('cdn.tailwindcss.com') ||
      requestUrl.hostname.includes('unpkg.com')) {
    // console.log('Service Worker: Bypassing cache for external API/CDN:', event.request.url);
    return event.respondWith(fetch(event.request));
  }

  // 2. 對於您應用程式的內部靜態資源，採用「快取優先，網路備用」策略
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 如果快取中有，則返回快取內容
        if (response) {
          // console.log('Service Worker: Serving from cache for:', event.request.url);
          return response;
        }
        // 如果快取中沒有，則嘗試從網路獲取
        // console.log('Service Worker: Fetching from network for:', event.request.url);
        return fetch(event.request)
          .then(networkResponse => {
            // 可以選擇將新的網路響應添加到快取中，以便將來離線訪問。
            // 但請注意，對於非 `urlsToCache` 中的動態內容，這可能會導致快取過大。
            /*
            if (event.request.method === 'GET' && networkResponse.ok) {
              const clonedResponse = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, clonedResponse);
              });
            }
            */
            return networkResponse;
          })
          .catch(networkError => {
            console.error('Service Worker: Network fetch failed for:', event.request.url, networkError);
            // 在離線情況下，您可以返回一個預設的離線頁面
            // return caches.match('/offline.html');
            // 或簡單地拋出錯誤
            throw networkError;
          });
      })
      .catch(cacheMatchError => {
        console.error('Service Worker: Cache match failed for:', event.request.url, cacheMatchError);
        // 如果連快取匹配都失敗，直接從網路獲取（作為最後的嘗試）
        return fetch(event.request);
      })
  );
});

// 激活 Service Worker 並清理舊的快取
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  const cacheWhitelist = [CACHE_NAME]; // 只保留當前版本的快取

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // 如果不在白名單中，則刪除該快取
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
        console.log('Service Worker: Activation complete.');
        // 確保 Service Worker 立即控制所有客戶端
        return clients.claim();
    })
  );
});
