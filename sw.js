/* 学習提出管理 Service Worker
   同じサイトのファイルと、外部のQR部品（unpkg / cdnjs）を端末に保存して、
   2回目以降はオフラインでも動くようにする。 */
const CACHE="lsm-v1";
const CORE=["./","./index.html","./manifest.webmanifest"];

self.addEventListener("install",e=>{
  e.waitUntil(
    caches.open(CACHE)
      .then(c=>Promise.all(CORE.map(u=>c.add(u).catch(()=>{}))))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate",e=>{
  e.waitUntil(
    caches.keys()
      .then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",e=>{
  const req=e.request;
  if(req.method!=="GET")return;
  e.respondWith(
    caches.match(req).then(hit=>{
      const net=fetch(req).then(res=>{
        if(res&&(res.ok||res.type==="opaque")){
          const copy=res.clone();
          caches.open(CACHE).then(c=>c.put(req,copy));
        }
        return res;
      }).catch(()=>hit||(req.mode==="navigate"?caches.match("./index.html"):undefined));
      return hit||net;
    })
  );
});
