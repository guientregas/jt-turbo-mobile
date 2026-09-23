(function(){
'use strict';
var A=window.__jtV23||{},KEY='jtTurboV23',OPS='jtTurboV24Ops',lastHash='',syncBusy=false;

function el(id){return document.getElementById(id)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function state(){return A.data?A.data():{orders:[],history:[]}}
function saveLocal(){try{localStorage.setItem(KEY,JSON.stringify(state()))}catch(e){}}
function hash(){try{return JSON.stringify(state())}catch(e){return ''}}

function syncNow(silent){
 if(syncBusy||!navigator.onLine)return;
 var cfg=window.JT_CONFIG||{}, base=cfg.API_BASE||'';
 if(!base)return;
 syncBusy=true;
 fetch(base+'/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
  sessionId:cfg.SESSION_ID||'default',orders:state().orders||[],history:state().history||[],
  clientVersion:cfg.APP_VERSION||'V24',syncedAt:new Date().toISOString()
 })}).then(function(r){if(!r.ok)throw Error('sync '+r.status);return r.json()}).then(function(x){
  localStorage.setItem(OPS,JSON.stringify({lastSync:new Date().toISOString(),server:x.syncedAt||'',ok:true}));
  updateOps(); if(!silent&&A.toast)A.toast('☁️ Sincronizado');
 }).catch(function(e){
  localStorage.setItem(OPS,JSON.stringify({lastSync:new Date().toISOString(),ok:false,error:e.message}));
  updateOps();
 }).then(function(){syncBusy=false});
}

function ensureIDB(){
 if(!window.JTOffline)return;
 var s=state();
 window.JTOffline.putOrders&&window.JTOffline.putOrders(s.orders||[]).catch(function(){});window.JTOffline.putState&&window.JTOffline.putState(s).catch(function(){});
}

function gpsWatch(){
 if(!navigator.geolocation)return;
 if(window.__jtGpsWatch)return;
 window.__jtGpsWatch=navigator.geolocation.watchPosition(function(p){
  var pos={lat:p.coords.latitude,lng:p.coords.longitude,acc:p.coords.accuracy,at:new Date().toISOString()};
  window.__jtLastPosition=pos;
  if(window.JTOffline&&JTOffline.gps)JTOffline.gps(pos).catch(function(){});
 },function(){},{enableHighAccuracy:true,maximumAge:5000,timeout:15000});
}

function routeCache(){
 try{
  var s=state(),p=A.position&&A.position(),orders=(s.orders||[]).filter(function(o){return o.status!=='done'&&isFinite(+o.lat)&&isFinite(+o.lng)});
  localStorage.setItem('jtTurboV24RouteCache',JSON.stringify({at:Date.now(),position:p,orders:orders}));
 }catch(e){}
}

function alerts(){
 var s=state(),a=[];
 (s.orders||[]).forEach(function(o){
  if(o.status==='done')return;
  if(!o.phone)a.push({type:'phone',id:o.id,text:o.name+': sem telefone'});
  if(!isFinite(+o.lat)||!isFinite(+o.lng))a.push({type:'gps',id:o.id,text:o.name+': sem localização confirmada'});
  if((o.attempts||0)>=2)a.push({type:'attempt',id:o.id,text:o.name+': '+o.attempts+' tentativas'});
  if(o.failReason)a.push({type:'fail',id:o.id,text:o.name+': '+o.failReason});
 });
 return a;
}

function openModal(title,body){var m=el('modal'),t=el('mt'),b=el('mb');if(!m||!t||!b)return; t.textContent=title;b.innerHTML=body;m.className='modal on';m.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}
function openOps(){
 var a=alerts(),s=state(),meta={};
 try{meta=JSON.parse(localStorage.getItem(OPS)||'{}')}catch(e){}
 var html='<div class="result"><b>📦 '+(s.orders||[]).length+'</b> pedidos • <b>'+((s.orders||[]).filter(function(o){return o.status==='done'}).length)+'</b> entregues • <b>'+a.length+'</b> alertas</div>';
 html+='<div class="result"><b>☁️ Sincronização</b><br>'+(navigator.onLine?'Online':'Offline')+'<br>'+(meta.lastSync?('Última tentativa: '+new Date(meta.lastSync).toLocaleString('pt-BR')):'Ainda não sincronizado')+'</div>';
 if(a.length)html+='<div class="result"><b>🚨 Alertas</b><br>'+a.slice(0,30).map(function(x){return '• '+esc(x.text)}).join('<br>')+'</div>';
 else html+='<div class="result">✓ Nenhum alerta operacional.</div>';
 html+='<div class="buttons"><button id="opsSync">☁️ SINCRONIZAR</button><button id="opsCache">📍 SALVAR ROTA OFFLINE</button><button id="opsDiag">🩺 DIAGNÓSTICO</button></div>';
 if(!el('modal')){A.toast&&A.toast('Central de operação indisponível');return}
 openModal('🛰️ CENTRAL DE OPERAÇÃO',html);
 el('opsSync').onclick=function(){syncNow(false)};
 el('opsCache').onclick=function(){routeCache();A.toast&&A.toast('✓ Rota salva para uso offline')};
 el('opsDiag').onclick=diagnostic;
}

function diagnostic(){
 var cfg=window.JT_CONFIG||{}, checks=[
  ['GPS','geolocation' in navigator],
  ['Internet',navigator.onLine],
  ['Banco local','indexedDB' in window],
  ['PWA','serviceWorker' in navigator],
  ['Scanner','BarcodeDetector' in window],
  ['Backend configurado',!!cfg.API_BASE]
 ];
 var html=checks.map(function(x){return '<div class="result">'+(x[1]?'✅':'⚠️')+' <b>'+x[0]+'</b></div>'}).join('');
 openModal('🩺 DIAGNÓSTICO DO APP',html);
}

function proof(id,doneFn){
 var o=(A.data().orders||[]).find(function(x){return String(x.id)===String(id)});
 if(!o)return;
 var html='<div class="small">Registre quem recebeu. Foto é opcional.</div>'+
 '<input id="proofName" class="field" placeholder="Nome de quem recebeu" value="'+esc(o.receivedBy||'')+'">'+
 '<input id="proofDoc" class="field" placeholder="Documento (opcional)" value="'+esc(o.receivedDoc||'')+'">'+
 '<input id="proofPhoto" type="file" accept="image/*" capture="environment" class="field">'+
 '<div class="small">Assinatura</div><canvas id="proofCanvas" style="width:100%;height:150px;border:1px solid #dbe3ed;border-radius:10px;touch-action:none"></canvas>'+
 '<button id="proofClear" style="width:100%;margin-top:6px">LIMPAR ASSINATURA</button>'+
 '<button id="proofSave" class="green" style="width:100%;margin-top:6px">✓ CONFIRMAR ENTREGA</button>';
 openModal('🧾 COMPROVANTE DE ENTREGA',html);
 var c=el('proofCanvas'),ctx=c.getContext('2d'),drawing=false;
 function resize(){c.width=c.clientWidth*devicePixelRatio;c.height=150*devicePixelRatio;ctx.scale(devicePixelRatio,devicePixelRatio);ctx.lineWidth=2;ctx.lineCap='round'}
 setTimeout(function(){resize()},20);
 function pt(e){var r=c.getBoundingClientRect(),t=e.touches?e.touches[0]:e;return{x:t.clientX-r.left,y:t.clientY-r.top}}
 function down(e){drawing=true;var p=pt(e);ctx.beginPath();ctx.moveTo(p.x,p.y);e.preventDefault()}
 function move(e){if(!drawing)return;var p=pt(e);ctx.lineTo(p.x,p.y);ctx.stroke();e.preventDefault()}
 function up(){drawing=false}
 c.addEventListener('pointerdown',down);c.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:false});
 el('proofClear').onclick=function(){ctx.clearRect(0,0,c.width,c.height)};
 el('proofSave').onclick=function(){
  o.receivedBy=el('proofName').value.trim();o.receivedDoc=el('proofDoc').value.trim();
  o.signature=c.toDataURL('image/png');
  var f=el('proofPhoto').files[0];
  if(f){o.proofName=f.name;o.proofType=f.type;o.proofSize=f.size}
  o.proofAt=new Date().toISOString();
  saveLocal(); var cm=el('modal');if(cm){cm.className='modal';cm.setAttribute('aria-hidden','true');document.body.style.overflow=''}
  if(doneFn)doneFn(o); A.refresh&&A.refresh(); ensureIDB(); syncNow(true);
  A.toast&&A.toast('✓ Entrega confirmada com comprovante');
 };
}

function wrapDone(){
 if(!A.finish||A.__proofWrapped)return;
 var original=A.finish;
 A.finish=function(ok){
  var o=A.current&&A.current();
  if(!o)return;
  if(!ok)return original(false);
  proof(o.id,function(){original(true)});
 };
 A.__proofWrapped=true;
}

function routeBusy(){return !!window.__jtActionBusy}
function setRouteBusy(v){
 window.__jtActionBusy=!!v;
 ['routeGo','routeCall','routeWa','routeArrive','routeDone','routeFail','routeFinish','smGo','smCall','smWa','smArr','smDone','smFail'].forEach(function(id){var b=el(id);if(b)b.disabled=!!v;});
}
function bindFastRouteActions(){
 var ids=['routeGo','routeCall','routeWa','routeArrive','routeDone','routeFail','routeFinish'];
 ids.forEach(function(id){var b=el(id);if(!b||b.__fastBound)return;b.__fastBound=true;b.addEventListener('click',function(){if(routeBusy())return; if(id==='routeGo'){var o=A.current&&A.current();if(o){setRouteBusy(true);try{A.navigate(o.id)}finally{setTimeout(function(){setRouteBusy(false)},350)}}}else if(id==='routeCall'){var o=A.current&&A.current();if(o){setRouteBusy(true);try{A.call(o)}finally{setTimeout(function(){setRouteBusy(false)},350)}}else if(id==='routeWa'){var o=A.current&&A.current();if(o){setRouteBusy(true);try{A.whats(o)}finally{setTimeout(function(){setRouteBusy(false)},900)}}else if(id==='routeArrive'){setRouteBusy(true);try{A.arrive()}finally{setTimeout(function(){setRouteBusy(false)},180)}}else if(id==='routeDone'){setRouteBusy(true);try{A.finish(true)}finally{setTimeout(function(){setRouteBusy(false)},500)}}else if(id==='routeFail'){setRouteBusy(true);try{A.finish(false)}finally{setTimeout(function(){setRouteBusy(false)},350)}}else if(id==='routeFinish'){setRouteBusy(true);try{window.__jtFinishRoute&&window.__jtFinishRoute()}finally{setTimeout(function(){setRouteBusy(false)},350)}}});});
}



function matrixOptimize(){
 var s=state(),p=(s.orders||[]).filter(function(o){return o.status!=='done'});
 if(!p.length)return A.toast&&A.toast('Cadastre entregas primeiro');
 var missing=p.find(function(o){return !isFinite(+o.lat)||!isFinite(+o.lng)});
 if(missing)return A.toast&&A.toast('Confirme a localização de '+missing.name);
 var start=A.position&&A.position(),points=start?[start].concat(p):p.slice();
 if(points.length<2)return;
 var coords=points.map(function(o){return (+o.lng).toFixed(6)+','+(+o.lat).toFixed(6)}).join(';');
 var url=((window.JT_CONFIG&&window.JT_CONFIG.API_BASE)||'')+'/api/route/matrix?points='+encodeURIComponent(coords);
 function fallback(){var left=p.slice(),out=[],cur=start||{lat:+left[0].lat,lng:+left[0].lng};while(left.length){left.sort(function(a,b){return A.distance(cur,a)-A.distance(cur,b)});var o=left.shift();out.push(o);cur={lat:+o.lat,lng:+o.lng}}A.setRoute&&A.setRoute(out);routeCache();A.toast&&A.toast('🚚 Rota calculada em modo offline');}
 fetch(url).then(function(r){if(!r.ok)throw Error('matrix');return r.json()}).then(function(m){
  if(!m||!m.durations)throw Error('matrix');
  var used={},out=[],cur=0;
  while(out.length<p.length){
   var best=-1,bestT=Infinity;
   for(var j=0;j<p.length;j++){if(used[j])continue;var t=(m.durations[cur]||[])[start?j+1:j];if(t!=null&&t<bestT){bestT=t;best=j}}
   if(best<0)break;used[best]=1;out.push(p[best]);cur=start?best+1:best;
  }
  if(out.length!==p.length)throw Error('incomplete');
  A.setRoute&&A.setRoute(out);routeCache();A.toast&&A.toast('🧠 Rota otimizada por tempo de deslocamento');
 }).catch(fallback);
}

function addButton(){
 if(el('opsBtn'))return;
 var box=document.querySelector('.top .wrap');if(!box)return;
 var b=document.createElement('button');b.id='opsBtn';b.textContent='⚙️';b.title='Central de operação';
 b.style.cssText='float:right;margin:-5px 0 0 8px;min-height:34px;padding:6px 10px;background:#fff;color:#087cff';
 b.onclick=openOps;box.appendChild(b);
}

function tick(){
 var h=hash();
 if(h!==lastHash){lastHash=h;saveLocal();ensureIDB();if(navigator.onLine)syncNow(true)}
 updateOps();
}
function updateOps(){
 var b=el('opsBtn');if(!b)return;
 var a=alerts();b.title=a.length?'⚠️ '+a.length+' alerta(s)':'Central de operação';
}

addButton();gpsWatch();wrapDone();bindFastRouteActions();tick();
setTimeout(function(){var st=el('start');if(st)st.onclick=function(){if(routeBusy())return;matrixOptimize()},50);
setInterval(function(){addButton();wrapDone();bindFastRouteActions();tick()},4000);
window.addEventListener('online',function(){syncNow(false);routeCache()});
window.addEventListener('offline',function(){A.toast&&A.toast('⚠️ OFFLINE — operação local ativa')});
window.JT_V24={sync:syncNow,alerts:alerts,diagnostic:diagnostic,proof:proof,routeCache:routeCache};
})();