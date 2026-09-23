(function(){
'use strict';
var DB='jtTurboV24Offline',VER=3;
function open(){
 return new Promise(function(ok,no){
  var r=indexedDB.open(DB,VER);
  r.onupgradeneeded=function(){
   var d=r.result;
   if(!d.objectStoreNames.contains('orders'))d.createObjectStore('orders',{keyPath:'id'});
   if(!d.objectStoreNames.contains('state'))d.createObjectStore('state',{keyPath:'id'});
   if(!d.objectStoreNames.contains('outbox'))d.createObjectStore('outbox',{keyPath:'id'});
   if(!d.objectStoreNames.contains('gps'))d.createObjectStore('gps',{keyPath:'id'});
   if(!d.objectStoreNames.contains('scans'))d.createObjectStore('scans',{keyPath:'id'});
  };
  r.onsuccess=function(){ok(r.result)};r.onerror=function(){no(r.error)};
 });
}
function run(store,mode,fn){
 return open().then(function(d){return new Promise(function(ok,no){
  var t=d.transaction(store,mode),s=t.objectStore(store),ret=fn(s);
  t.oncomplete=function(){ok(ret)};t.onerror=function(){no(t.error)};
 })});
}
function getAll(store){
 return open().then(function(d){return new Promise(function(ok,no){
  var r=d.transaction(store,'readonly').objectStore(store).getAll();
  r.onsuccess=function(){ok(r.result||[])};r.onerror=function(){no(r.error)};
 })});
}
window.JTOffline={
 putOrder:function(o){return run('orders','readwrite',function(s){return s.put(o)})},
 putOrders:function(os){return run('orders','readwrite',function(s){(os||[]).forEach(function(o){s.put(o)});return true})},
 getOrders:function(){return getAll('orders')},
 putState:function(state){return run('state','readwrite',function(s){return s.put({id:'current',state:state,updatedAt:Date.now()})})},
 getState:function(){return getAll('state').then(function(a){return a[0]&&a[0].state||null})},
 queue:function(payload){return run('outbox','readwrite',function(s){return s.put({id:String(Date.now())+'-'+Math.random(),payload:payload,createdAt:Date.now()})})},
 gps:function(p){return run('gps','readwrite',function(s){return s.put({id:String(Date.now())+'-'+Math.random(),...p})})},
 scan:function(v){return run('scans','readwrite',function(s){return s.put({id:String(Date.now())+'-'+Math.random(),value:v,createdAt:Date.now()})})},
 sync:function(state){
  var cfg=window.JT_CONFIG||{},base=cfg.API_BASE||'';
  if(!base||!navigator.onLine)return Promise.reject(new Error('offline/backend not configured'));
  return fetch(base+'/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
   sessionId:cfg.SESSION_ID||'default',orders:state.orders||[],history:state.history||[],
   clientVersion:cfg.APP_VERSION||'V24',syncedAt:new Date().toISOString()
  })}).then(function(r){if(!r.ok)throw Error('sync '+r.status);return r.json()}).then(function(x){
   return window.JTOffline.putState({orders:x.orders||state.orders||[],history:x.history||state.history||[]}).then(function(){return x});
  });
 }
};
window.JTOfflineSync=function(){
 if(!navigator.onLine||!window.__jtV23||!window.JTOffline)return;
 window.JTOffline.sync(window.__jtV23.data()).then(function(x){
  window.__jtLastSync=Date.now();
  if(window.toast)window.toast('☁️ Dados sincronizados');
 }).catch(function(){});
};
window.addEventListener('online',window.JTOfflineSync);
})();