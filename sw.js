const CACHE='speed-anki-v5';
const FILES=['./','./index.html','./app.js','./library.js','./presets.js','./firebase-config.js','./manifest.webmanifest','./icon-180.png','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES.map(f=>new Request(f,{cache:'reload'})))));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const same=new URL(e.request.url).origin===location.origin;
  // Same-origin files: always ask the server first (bypassing the HTTP cache) so updates arrive at once; fall back to the offline copy.
  const net=same?fetch(e.request.url,{cache:'no-cache',credentials:'same-origin'}):fetch(e.request);
  e.respondWith(net.then(r=>{if(same&&r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp))}return r}).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('./index.html'))));
});
