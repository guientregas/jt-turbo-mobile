// J&T Turbo V13: legacy-cache cleanup worker. The app no longer registers a service worker.
self.addEventListener('install', e => e.waitUntil(self.skipWaiting()));
self.addEventListener('activate', e => e.waitUntil((async()=>{
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  } catch(e) {}
  await self.registration.unregister();
  const clients = await self.clients.matchAll({type:'window'});
  clients.forEach(c => { try { c.navigate(c.url); } catch(e) {} });
})()));
