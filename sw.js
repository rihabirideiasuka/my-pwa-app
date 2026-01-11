/* sw.js - 体力測定記録 PWA */
const VERSION = "v6";
const PRECACHE = `tairyoku-precache-${VERSION}`;
const RUNTIME  = `tairyoku-runtime-${VERSION}`;

// ※存在するファイルだけにしてください（btn.mp3 が無いなら削除）
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./btn.mp3"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PRECACHE);

    // addAll は 1つでも失敗すると落ちるので、個別で握り潰し
    await Promise.allSettled(
      PRECACHE_URLS.map((url) => cache.add(url))
    );

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((key) => {
        if (key !== PRECACHE && key !== RUNTIME) return caches.delete(key);
      })
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // フォーム送信などの非GETは触らない
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // ナビゲーション（ページ遷移）は index.html にフォールバック
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(PRECACHE);
      const cached = await cache.match("./index.html");
      try {
        const fresh = await fetch(req);
        return fresh;
      } catch (_) {
        return cached || Response.error();
      }
    })());
    return;
  }

  // それ以外は Stale-While-Revalidate（キャッシュ優先＋裏で更新）
  event.respondWith((async () => {
    const cache = await caches.open(RUNTIME);

    const cached = await caches.match(req);
    const fetchPromise = (async () => {
      try {
        const res = await fetch(req);
        // 成功レスポンスだけ保存（opaque も保存可）
        if (res && (res.status === 200 || res.type === "opaque")) {
          cache.put(req, res.clone());
        }
        return res;
      } catch (_) {
        return null;
      }
    })();

    // まずキャッシュがあれば返す、無ければネットを待つ
    if (cached) {
      // 背景更新
      fetchPromise;
      return cached;
    }

    const fresh = await fetchPromise;
    return fresh || Response.error();
  })());
});
