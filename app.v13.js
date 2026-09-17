
// V13: remove any legacy PWA/service-worker cache left by previous versions.
(async()=>{
  try{
    if('serviceWorker' in navigator){
      const regs=await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r=>r.unregister()));
    }
    if('caches' in window){
      const keys=await caches.keys();
      await Promise.all(keys.map(k=>caches.delete(k)));
    }
  }catch(e){}
})();
const SID='mobile';
let session={id:SID,orders:[]},map=null,me=null,watchId=null,markers=[],routeLine=null,filter='all',lastDriverSync=0;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const STORE='jt_turbo_local_v5';
function localDB(){try{return JSON.parse(localStorage.getItem(STORE)||'{"session":{"id":"mobile","orders":[]},"history":[]}')}catch(e){return {session:{id:'mobile',orders:[]},history:[]}}}
function saveDB(db){localStorage.setItem(STORE,JSON.stringify(db));}
async function api(url,opt={}){
  const db=localDB(), method=(opt.method||'GET').toUpperCase();
  if(url.startsWith('/api/session?id=')) return db.session;
  if(url==='/api/history') return db.history||[];
  if(url==='/api/session/import'&&method==='POST'){const body=JSON.parse(opt.body||'{}');db.session={id:body.sessionId||SID,orders:body.orders||[]};saveDB(db);return db.session;}
  if(url.startsWith('/api/order/')&&method==='PATCH'){const body=JSON.parse(opt.body||'{}'),id=decodeURIComponent(url.split('/api/order/')[1]),o=(db.session.orders||[]).find(x=>x.id===id);if(o&&body.patch)Object.assign(o,body.patch);saveDB(db);return {ok:true};}
  if(url==='/api/session/finish'&&method==='POST'){const snapshot=JSON.parse(JSON.stringify(db.session));db.history=db.history||[];db.history.unshift({finishedAt:new Date().toISOString(),orders:snapshot.orders,stats:{packages:snapshot.orders.length,delivered:snapshot.orders.filter(x=>x.status==='done').length,gps:snapshot.orders.filter(x=>x.lat!=null).length}});db.session={id:SID,orders:[]};saveDB(db);return {ok:true,session:{stats:db.history[0].stats}};}
  if(url==='/api/driver/location'&&method==='POST'){const body=JSON.parse(opt.body||'{}');localStorage.setItem('jt_driver_location',JSON.stringify(body));return {ok:true};}
  if(url.startsWith('/api/notify/')) return {ok:false,sent:0,localOnly:true};
  throw Error('API local não encontrada');
}
function toast(t){const x=$('toast');x.textContent=t;x.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>x.classList.remove('show'),2800)}
function show(id){['home','setup','route','history'].forEach(x=>$(x).hidden=x!==id)}
async function load(){session=await api('/api/session?id='+SID);if(session.orders?.length){show('route');if(!map)initMap();render();drawMap();}else show('home')}
function initMap(){map=L.map('map',{zoomControl:false}).setView([-15.78,-47.93],11);L.control.zoom({position:'bottomright'}).addTo(map);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map)}
function newRoute(){session={id:SID,orders:[]};show('setup');$('bulk').value='';$('fAddress').value='';}
function demo(){$('bulk').value='001;João;5561999999999;Rua Exemplo;12;QD 12 LT 4;Brasília\n002;Maria;5561988888888;Rua Central;100;Bloco B ap 12;Valparaíso\n003;Carlos;5561997777777;Av. Principal;45;QD 4 LT 8;Brasília'}
function normalizePhone(v){let d=String(v||'').replace(/\D/g,'');if((d.length===10||d.length===11)&&!d.startsWith('55'))d='55'+d;return d}
function nextId(){const nums=session.orders.map(o=>parseInt(String(o.id).replace(/\D/g,''),10)).filter(Number.isFinite);return String((Math.max(0,...nums)+1)).padStart(3,'0')}
function parseLine(line,i){const p=line.split(';').map(x=>x.trim());return{id:p[0]||String(i+1),client:p[1]||'',phone:normalizePhone(p[2]||''),address:p[3]||'',number:p[4]||'',complement:p[5]||'',city:p[6]||'',notes:'',lat:null,lng:null,status:'pending',priority:0}}
async function importBulk(){const lines=$('bulk').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);const orders=lines.map(parseLine);if(!orders.length)return toast('Coloque pelo menos um pacote.');const existingIds=new Set(session.orders.map(o=>o.id));for(const o of orders){if(existingIds.has(o.id))o.id=nextId();existingIds.add(o.id)}await persistOrders([...session.orders,...orders]);await load();toast(`${orders.length} pacotes adicionados`)}
function addOne(){$('fId').value='';$('fName').value='';$('fPhone').value='';$('fAddress').value='';$('fNumber').value='';$('fComplement').value='';$('fCity').value='';$('fNotes').value='';$('addDialog').showModal()}
async function saveOne(e){e.preventDefault();const o={id:$('fId').value.trim()||nextId(),client:$('fName').value.trim(),phone:normalizePhone($('fPhone').value),address:$('fAddress').value.trim(),number:$('fNumber').value.trim(),complement:$('fComplement').value.trim(),city:$('fCity').value.trim(),notes:$('fNotes').value.trim(),lat:null,lng:null,status:'pending',priority:0};if(!o.client)return toast('Informe o nome do cliente.');if(session.orders.some(x=>x.id===o.id))return toast('Esse número de pedido já existe.');await persistOrders([...session.orders,o]);$('addDialog').close();await load();toast('Entrega adicionada sem apagar as anteriores')}
async function persistOrders(orders){await api('/api/session/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:SID,orders})})}
function fullAddress(o){return [o.address,o.number,o.complement,o.city].filter(Boolean).join(', ')}
function msg(o){return `Olá, ${o.client||'tudo bem'}! 🚚 Sou o entregador da J&T. Para agilizar sua entrega, poderia me enviar sua localização atual pelo WhatsApp? 📍\n\nNo WhatsApp: 📎 > Localização > Enviar sua localização atual.\n\nAssim que enviar, não precisa copiar nada. Se a automação estiver ativa, o Turbo recebe a localização automaticamente. Se não estiver, você pode usar o botão “Colar localização” no pedido.\n\nObrigado!`}
async function requestWA(o){if(!o?.phone)return toast('Este pacote não tem WhatsApp.');if(remoteBase){try{await remoteJSON('/api/whatsapp/send-flow',{method:'POST',body:JSON.stringify({phone:o.phone,order:o})});toast(`📍 Pedido de localização enviado para ${o.client||o.phone}`);return}catch(e){toast('Automação indisponível; abrindo WhatsApp manual.')}}location.href='https://wa.me/'+o.phone+'?text='+encodeURIComponent(msg(o))}
async function requestAll(){const p=session.orders.filter(o=>o.status!=='done'&&o.lat==null&&o.phone);if(!p.length)return toast('Não há pendentes com WhatsApp.');for(let i=0;i<p.length;i++){await requestWA(p[i]);if(i<p.length-1 && !confirm(`Pedido ${i+1}/${p.length} enviado. Continuar para o próximo?`))break;await new Promise(r=>setTimeout(r,700))}}
function nav(o){if(o.lat==null)return toast('Ainda sem GPS.');location.href=`https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lng}&travelmode=driving`}
function dist(a,b,c,d){const R=6371,A=(c-a)*Math.PI/180,B=(d-b)*Math.PI/180;return 2*R*Math.asin(Math.sqrt(Math.sin(A/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(B/2)**2))}
function greedy(points,start){let left=[...points],out=[],cur=start;while(left.length){let bi=0,bd=Infinity;left.forEach((o,i)=>{const d=dist(cur[0],cur[1],o.lat,o.lng)-o.priority*.3;if(d<bd){bd=d;bi=i}});const o=left.splice(bi,1)[0];out.push(o);cur=[o.lat,o.lng]}return out}
function twoOpt(route,start){if(route.length<4)return route;let best=route.slice(),changed=true;const cost=a=>{let cur=start,s=0;for(const o of a){s+=dist(cur[0],cur[1],o.lat,o.lng);cur=[o.lat,o.lng]}return s};let bc=cost(best),loops=0;while(changed&&loops++<80){changed=false;for(let i=0;i<best.length-2;i++)for(let j=i+1;j<best.length;j++){const cand=best.slice(0,i).concat(best.slice(i,j+1).reverse(),best.slice(j+1));const c=cost(cand);if(c+0.01<bc){best=cand;bc=c;changed=true}}}return best}
async function optimize(){const pts=session.orders.filter(o=>o.status!=='done'&&o.lat!=null);if(!pts.length)return toast('Aguardando localizações.');const start=me||[pts[0].lat,pts[0].lng],ordered=twoOpt(greedy(pts,start),start),ids=new Set(ordered.map(x=>x.id)),pending=session.orders.filter(o=>o.status!=='done'&&!ids.has(o.id)),done=session.orders.filter(o=>o.status==='done');await persistOrders([...ordered,...pending,...done]);await load();toast(`Rota otimizada • ${ordered.length} GPS`)}
function syncDriver(p){if(Date.now()-lastDriverSync<15000)return;lastDriverSync=Date.now();api('/api/driver/location',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:SID,lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy})}).catch(()=>{})}
function locate(){if(!navigator.geolocation)return toast('GPS não disponível.');navigator.geolocation.getCurrentPosition(p=>{me=[p.coords.latitude,p.coords.longitude];$('gpsState').textContent=`GPS ativo • ±${Math.round(p.coords.accuracy)} m`;syncDriver(p);drawMap();map.setView(me,16)},()=>toast('Permita localização no navegador.'),{enableHighAccuracy:true,timeout:15000,maximumAge:5000});if(!watchId)watchId=navigator.geolocation.watchPosition(p=>{me=[p.coords.latitude,p.coords.longitude];$('gpsState').textContent=`GPS ativo • ±${Math.round(p.coords.accuracy)} m`;syncDriver(p);drawMap()},()=>{}, {enableHighAccuracy:true,maximumAge:5000,timeout:15000})}
function drawMap(){if(!map)return;markers.forEach(m=>m.remove());markers=[];if(routeLine)routeLine.remove();const visible=session.orders.filter(o=>o.lat!=null&&o.status!=='done');visible.forEach(o=>{const n=L.marker([o.lat,o.lng]).addTo(map).bindPopup(`<b>${esc(o.id)} • ${esc(o.client)}</b><br>${esc(fullAddress(o))}<br><br><button onclick="navById('${esc(o.id)}')">🧭 Navegar</button>`);markers.push(n)});if(me)L.circleMarker(me,{radius:8}).addTo(map).bindPopup('📍 Você');const pts=visible.map(o=>[o.lat,o.lng]);if(pts.length>1)routeLine=L.polyline((me?[me]:[]).concat(pts),{weight:5,opacity:.65}).addTo(map);if(pts.length&&!me)map.fitBounds(pts,{padding:[25,25]})}
window.navById=id=>{const o=session.orders.find(x=>x.id===id);if(o)nav(o)};
window.openLocation=id=>{const o=session.orders.find(x=>x.id===id);if(o){$('locOrderId').value=o.id;$('locOrderLabel').textContent=`#${o.id} • ${o.client}`;$('locationText').value='';$('locationDialog').showModal()}};
window.editOrder=id=>{const o=session.orders.find(x=>x.id===id);if(!o)return;$('editId').value=o.id;$('editName').value=o.client||'';$('editPhone').value=o.phone||'';$('editAddress').value=o.address||'';$('editNumber').value=o.number||'';$('editComplement').value=o.complement||'';$('editCity').value=o.city||'';$('editNotes').value=o.notes||'';$('editDialog').showModal()};
function extractCoords(text){const s=String(text||'').trim();let m=s.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?)[,%20]+(-?\d+(?:\.\d+)?)/i);if(m)return [Number(m[1]),Number(m[2])];m=s.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);if(m)return [Number(m[1]),Number(m[2])];m=s.match(/(-?\d{1,3}\.\d{4,})\s*[,; ]\s*(-?\d{1,3}\.\d{4,})/);if(m)return [Number(m[1]),Number(m[2])];return null}
async function pasteLocation(){try{const t=await navigator.clipboard.readText();if(!t)return toast('A área de transferência está vazia.');$('locationText').value=t;toast('Localização colada. Agora toque em Salvar localização.')}catch(e){toast('Cole o link da localização no campo abaixo.')}}
async function saveLocation(e){e.preventDefault();const id=$('locOrderId').value,o=session.orders.find(x=>x.id===id),coords=extractCoords($('locationText').value);if(!o)return;if(!coords)return toast('Não encontrei latitude/longitude. Cole o link do Google Maps ou as coordenadas.');const [lat,lng]=coords;if(Math.abs(lat)>90||Math.abs(lng)>180)return toast('Coordenadas inválidas.');o.lat=lat;o.lng=lng;o.locationSource='whatsapp/manual';o.locationAt=new Date().toISOString();await persistOrders(session.orders);$('locationDialog').close();await load();toast(`📍 GPS salvo para #${o.id}`)}
async function saveEdit(e){e.preventDefault();const id=$('editId').value,o=session.orders.find(x=>x.id===id);if(!o)return;o.client=$('editName').value.trim();o.phone=normalizePhone($('editPhone').value);o.address=$('editAddress').value.trim();o.number=$('editNumber').value.trim();o.complement=$('editComplement').value.trim();o.city=$('editCity').value.trim();o.notes=$('editNotes').value.trim();await persistOrders(session.orders);$('editDialog').close();await load();toast('Entrega atualizada')}
async function geocodeOrder(id){const o=session.orders.find(x=>x.id===id);if(!o)return;const q=fullAddress(o);if(!q)return toast('Informe o endereço primeiro.');toast('Procurando endereço no mapa…');try{const url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q='+encodeURIComponent(q);const r=await fetch(url,{headers:{Accept:'application/json'}});if(!r.ok)throw Error();const a=await r.json();if(!a.length)return toast('Endereço não encontrado. Confira rua, número, cidade e CEP.');o.lat=Number(a[0].lat);o.lng=Number(a[0].lon);o.locationSource='address';await persistOrders(session.orders);await load();toast(`📍 Endereço localizado para #${o.id}`)}catch(e){toast('Não consegui localizar agora. Use “Colar localização”.')}}
async function done(id){const o=session.orders.find(x=>x.id===id);if(!o)return;await api('/api/order/'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:SID,patch:{status:o.status==='done'?'pending':'done'}})});await load();toast(o.status==='done'?'Entrega reaberta':'Entrega concluída')}
function nextStop(){const o=session.orders.find(x=>x.status!=='done'&&x.lat!=null);if(!o)return $('nextCard').innerHTML='<b>🎉 Nenhuma entrega com GPS pendente.</b>'; $('nextCard').innerHTML=`<small>PRÓXIMA PARADA</small><h2>#${esc(o.id)} • ${esc(o.client)}</h2><p>📍 ${esc(fullAddress(o)||'Localização recebida pelo WhatsApp')}</p><div class="eta">${o.locationSource==='whatsapp/manual'?'📲 GPS recebido do WhatsApp':'📍 GPS do endereço'}</div><div class="row"><button class="primary" onclick="navById('${esc(o.id)}')">🧭 Navegar agora</button><button onclick="notifyOne('${esc(o.id)}','arrival')">📲 Avisar chegada</button><button onclick="done('${esc(o.id)}')">✓ Entreguei</button></div>`}
function render(){const o=session.orders,d=o.filter(x=>x.status==='done').length,g=o.filter(x=>x.lat!=null&&x.status!=='done').length,p=o.filter(x=>x.lat==null&&x.status!=='done').length;$('stats').innerHTML=`<div class="stat"><b>${o.length}</b><span>pacotes</span></div><div class="stat"><b>${o.length-d}</b><span>pendentes</span></div><div class="stat good"><b>${g}</b><span>GPS</span></div><div class="stat"><b>${d}</b><span>entregues</span></div>`;$('filterInfo').textContent=`${p} aguardando localização`;nextStop();let list=o.filter(x=>filter==='all'||(filter==='done'&&x.status==='done')||(filter==='gps'&&x.lat!=null&&x.status!=='done')||(filter==='pending'&&x.status!=='done'));$('orders').innerHTML=list.map(x=>{const i=o.indexOf(x),addr=fullAddress(x);return `<article class="order ${x.status==='done'?'done':''}"><div class="top"><b>#${esc(x.id)} — ${esc(x.client)}</b><span class="badge ${x.status==='done'?'done':''}">${x.status==='done'?'ENTREGUE':x.lat!=null?'GPS OK':'AGUARDANDO'}</span></div><small>📍 ${esc(addr||'Endereço não informado')}</small>${x.notes?`<div class="note">📝 ${esc(x.notes)}</div>`:''}<div class="row orderActions">${x.lat!=null&&x.status!=='done'?`<button class="mapbtn" onclick="navById('${esc(x.id)}')">🧭 Navegar</button>`:''}${x.status!=='done'&&x.lat==null?`<button class="wa" onclick="requestWA(session.orders[${i}])">💬 Pedir GPS</button>`:''}<button onclick="openLocation('${esc(x.id)}')">📍 Colar localização</button>${addr?`<button onclick="geocodeOrder('${esc(x.id)}')">🗺️ Localizar endereço</button>`:''}<button onclick="editOrder('${esc(x.id)}')">✏️ Editar</button><button class="donebtn" onclick="done('${esc(x.id)}')">${x.status==='done'?'↩ Reabrir':'✓ Entregue'}</button></div></article>`}).join('')||'<p class="muted">Nada nesta categoria.</p>'}
async function history(){show('history');const hs=await api('/api/history');$('historyList').innerHTML=hs.length?hs.map(r=>`<article class="historyItem"><b>🚚 ${new Date(r.finishedAt).toLocaleString('pt-BR')}</b><div>${r.stats?.packages||r.orders.length} pacotes • ${r.stats?.delivered||0} entregues • ${r.stats?.gps||0} com GPS</div></article>`).join(''):'<p class="muted">Nenhuma rota finalizada ainda.</p>'}
async function notifyOne(id,kind){try{const r=await api('/api/notify/'+encodeURIComponent(id),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:SID,kind})});toast(r.ok?'WhatsApp enviado':'Abra o WhatsApp pelo botão “Pedir GPS” para enviar a mensagem.');}catch(e){toast('Falha ao enviar WhatsApp')}}
async function routeStartNotify(){const p=session.orders.filter(o=>o.status!=='done'&&o.phone);if(!p.length)return toast('Nenhum cliente pendente com WhatsApp.');requestAll()}
async function finish(){if(!confirm('Finalizar e salvar esta rota?'))return;const r=await api('/api/session/finish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:SID})});toast(`Rota salva • ${r.session.stats.packages} pacotes`);setTimeout(()=>load(),800)}
async function share(){const text=`J&T Turbo • ${session.orders.length} pacotes • ${session.orders.filter(o=>o.status==='done').length} entregues`;if(navigator.share)navigator.share({title:'J&T Turbo',text});else if(navigator.clipboard){await navigator.clipboard.writeText(text);toast('Resumo copiado')}}
$('newRouteBtn').onclick=newRoute;$('startBtn').onclick=newRoute;$('resumeBtn').onclick=load;$('historyBtn').onclick=history;$('closeHistory').onclick=()=>show('home');$('backHome').onclick=()=>show('home');$('importBtn').onclick=importBulk;$('addBtn').onclick=addOne;$('demoBtn').onclick=demo;$('clearSetup').onclick=()=>$('bulk').value='';$('addForm').onsubmit=saveOne;$('editForm').onsubmit=saveEdit;$('locationForm').onsubmit=saveLocation;$('pasteLocationBtn').onclick=pasteLocation;$('locateBtn').onclick=locate;$('notifyStartBtn').onclick=routeStartNotify;$('sortBtn').onclick=optimize;$('waAllBtn').onclick=requestAll;$('followBtn').onclick=locate;$('shareBtn').onclick=share;$('finishBtn').onclick=finish;$('filter').onchange=e=>{filter=e.target.value;render()};

load().catch(()=>show('home'));



// ===== J&T Turbo: rota + WhatsApp =====
let remoteBase=localStorage.getItem('jt_remote_api')||'';
let waPollTimer=null, waSince=Date.now()-60000;
const remoteUrl=p=>remoteBase.replace(/\/$/,'')+p;
async function remoteJSON(path,opt={}){if(!remoteBase)throw new Error('Servidor WhatsApp não configurado');const r=await fetch(remoteUrl(path),{...opt,headers:{'Content-Type':'application/json',...(opt.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);return d}
async function syncRemoteOrders(orders){if(!remoteBase)return;try{await remoteJSON('/api/whatsapp/session',{method:'POST',body:JSON.stringify({sessionId:SID,orders})})}catch(e){console.warn('WhatsApp sync:',e.message)}}
const oldPersistOrders=persistOrders;
persistOrders=async function(orders){await oldPersistOrders(orders);syncRemoteOrders(orders)};
async function openWa(){ $('waApiBase').value=remoteBase; $('waDialog').showModal(); if(remoteBase){try{const r=await remoteJSON('/health');$('waStatus').textContent=r.whatsappConfigured?'✅ Servidor online e WhatsApp configurado.':'⚠️ Servidor online; Cloud API ainda não configurada. O botão WhatsApp manual continua funcionando.'}catch(e){$('waStatus').textContent='❌ Não conectou: '+e.message}}else $('waStatus').textContent='WhatsApp manual está disponível mesmo sem servidor.'}
function saveWa(){remoteBase=$('waApiBase').value.trim().replace(/\/$/,'');localStorage.setItem('jt_remote_api',remoteBase);toast(remoteBase?'Servidor WhatsApp salvo':'WhatsApp automático desativado');if(remoteBase)syncRemoteOrders(session.orders)}
async function testWa(){try{const r=await remoteJSON('/health');$('waStatus').textContent=r.whatsappConfigured?'✅ Conectado e pronto para receber localização.':'⚠️ Servidor respondeu, mas faltam credenciais da Cloud API.'}catch(e){$('waStatus').textContent='❌ '+e.message}}
async function pollWhatsApp(){if(!remoteBase)return;try{const r=await remoteJSON('/api/whatsapp/events?since='+encodeURIComponent(waSince));let changed=false;for(const e of (r.events||[])){const t=Date.parse(e.receivedAt)||0;if(t>waSince)waSince=t;const phone=normalizePhone(e.phone);const o=session.orders.find(x=>normalizePhone(x.phone)===phone&&x.status!=='done');if(!o)continue;if(e.type==='location'&&e.location){o.lat=Number(e.location.latitude);o.lng=Number(e.location.longitude);o.locationSource='whatsapp';o.locationAt=e.receivedAt;changed=true}else if(e.type==='text'&&e.text&&(!o.address||!o.addressSource)){o.address=e.text.trim();o.addressSource='whatsapp';changed=true}}if(changed){await oldPersistOrders(session.orders);render();drawMap();nextStop();toast('📍 WhatsApp: localização/dado recebido e vinculado pelo telefone.')}}catch(e){console.warn('WA poll:',e.message)}}
function startWAPoll(){clearInterval(waPollTimer);if(remoteBase){pollWhatsApp();waPollTimer=setInterval(pollWhatsApp,5000)}}
if($('addQuickBtn'))$('addQuickBtn').onclick=addOne;
if($('waAutoBtn'))$('waAutoBtn').onclick=openWa;
if($('closeWa'))$('closeWa').onclick=()=>$('waDialog').close();
if($('saveWaBase'))$('saveWaBase').onclick=saveWa;
if($('waTest'))$('waTest').onclick=testWa;
startWAPoll();

// ===== J&T Turbo V10: câmera opcional no celular principal =====
let cameraStream=null, cameraBusy=false;
function openCamera(){
  $('cameraDialog').showModal();
  startCamera();
}
async function startCamera(){
  if(!navigator.mediaDevices?.getUserMedia){
    $('cameraStatus').textContent='❌ Este navegador não disponibiliza câmera. Use HTTPS e um navegador atualizado.';
    return;
  }
  try{
    cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
    $('cameraVideo').srcObject=cameraStream;
    $('cameraStatus').textContent='✅ Câmera ativa. Aponte para o nome e/ou telefone e toque em um botão de leitura.';
  }catch(e){
    $('cameraStatus').textContent='❌ Não consegui abrir a câmera. Permita a câmera nas configurações do navegador.';
  }
}
function stopCamera(){
  if(cameraStream){cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null}
  const v=$('cameraVideo'); if(v)v.srcObject=null;
}
function closeCamera(){stopCamera();$('cameraDialog').close()}
function cameraFrame(){
  const v=$('cameraVideo'), c=$('cameraCanvas');
  if(!v||!c||v.readyState<2||!v.videoWidth)return null;
  const maxW=1200, scale=Math.min(1,maxW/v.videoWidth), w=Math.round(v.videoWidth*scale), h=Math.round(v.videoHeight*scale);
  c.width=w;c.height=h;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(v,0,0,w,h);return c;
}
async function ocrCamera(){
  if(cameraBusy)return null;
  const canvas=cameraFrame(); if(!canvas){toast('A câmera ainda não está pronta.');return null}
  if(!window.Tesseract){toast('Leitor de texto ainda carregando. Tente novamente.');return null}
  cameraBusy=true;$('cameraStatus').textContent='⏳ Lendo a imagem…';
  try{
    const r=await Tesseract.recognize(canvas,'por+eng',{logger:m=>{
      if(m.status==='recognizing text'&&m.progress) $('cameraStatus').textContent=`⏳ Lendo… ${Math.round(m.progress*100)}%`;
    }});
    return (r.data?.text||'').replace(/\r/g,'').trim();
  }catch(e){
    $('cameraStatus').textContent='❌ Não consegui ler esta imagem.';
    return null;
  }finally{cameraBusy=false}
}
function extractPhoneFromOCR(text){
  const lines=String(text||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const candidates=[];
  for(const line of lines){
    const ms=line.match(/(?:\+?55[\s.-]*)?(?:\(?\d{2}\)?[\s.-]*)?(?:9[\s.-]*)?\d{4}[\s.-]*\d{4}/g)||[];
    candidates.push(...ms);
  }
  const m=candidates.find(x=>normalizePhone(x).replace(/\D/g,'').length>=12)||candidates[0];
  return m?normalizePhone(m):'';
}
function extractNameFromOCR(text){
  const lines=String(text||'').split(/\n+/).map(x=>x.replace(/[|_]+/g,' ').trim()).filter(Boolean);
  const bad=/^(tel|telefone|cel|celular|whatsapp|fone|pedido|c[oó]digo|cpf|cnpj|rua|avenida|av\.|cep|bairro|cidade|end|endere[cç]o)\b/i;
  const phoneRe=/\d{5,}/;
  const names=lines.filter(x=>!bad.test(x)&&!phoneRe.test(x)&&/[A-Za-zÀ-ÿ]{2,}/.test(x)&&x.length>=3&&x.length<=80);
  if(!names.length)return '';
  return names.sort((a,b)=>b.replace(/[^A-Za-zÀ-ÿ ]/g,'').length-a.replace(/[^A-Za-zÀ-ÿ ]/g,'').length)[0].replace(/\s+/g,' ').trim();
}
async function scanName(){
  const text=await ocrCamera(); if(!text)return;
  const name=extractNameFromOCR(text);
  $('cameraName').value=name;
  $('cameraStatus').textContent=name?`✅ Nome encontrado: ${name}`:'⚠️ Não identifiquei o nome. Aproxime a câmera e tente novamente.';
}
async function scanPhone(){
  const text=await ocrCamera(); if(!text)return;
  const phone=extractPhoneFromOCR(text);
  $('cameraPhone').value=phone;
  $('cameraStatus').textContent=phone?`✅ Telefone encontrado: ${phone}`:'⚠️ Não identifiquei o telefone. Aproxime a câmera e tente novamente.';
}
async function scanBoth(){
  const text=await ocrCamera(); if(!text)return;
  const name=extractNameFromOCR(text), phone=extractPhoneFromOCR(text);
  if(name)$('cameraName').value=name;
  if(phone)$('cameraPhone').value=phone;
  $('cameraStatus').textContent=(name||phone)?`✅ Leitura concluída${name?' • nome OK':''}${phone?' • telefone OK':''}. Confira antes de salvar.`:'⚠️ Não encontrei nome/telefone. Tente aproximar e melhorar a iluminação.';
}
async function saveCameraClient(){
  const client=$('cameraName').value.trim(), phone=normalizePhone($('cameraPhone').value);
  if(!client)return toast('Informe ou leia o nome do cliente.');
  if(!phone)return toast('Informe ou leia o telefone do cliente.');
  const o={id:nextId(),client,phone,address:'',number:'',complement:'',city:'',notes:'',lat:null,lng:null,status:'pending',priority:0};
  await persistOrders([...session.orders,o]);
  $('cameraName').value='';$('cameraPhone').value='';
  $('cameraStatus').textContent='✅ Cliente salvo. Você pode apontar para o próximo e continuar.';
  await load();
  if(!$('cameraDialog').open)$('cameraDialog').showModal();
  toast(`Cliente ${client} adicionado`);
}
if($('cameraBtn'))$('cameraBtn').onclick=openCamera;
if($('closeCamera'))$('closeCamera').onclick=closeCamera;
if($('scanNameBtn'))$('scanNameBtn').onclick=scanName;
if($('scanPhoneBtn'))$('scanPhoneBtn').onclick=scanPhone;
if($('scanBothBtn'))$('scanBothBtn').onclick=scanBoth;
if($('saveCameraBtn'))$('saveCameraBtn').onclick=saveCameraClient;
if($('cameraDialog'))$('cameraDialog').addEventListener('close',stopCamera);

// ===== V11: localização inteligente + fachada + mapa municipal =====
const MUNICIPAL_CITY='Valparaíso de Goiás, GO, Brasil';
const MUNICIPAL_HINTS={
  streets:['RUA 01','RUA 02','RUA 03','RUA 04','RUA 05','RUA 06','RUA 07','RUA 08','RUA 09','RUA 10','RUA 11','RUA 12','RUA 13','RUA 14','RUA 15','RUA 16','RUA 17','RUA 18','RUA 19','RUA 20','RUA 21','RUA 22','RUA 23','RUA 24','RUA 25','RUA 26','RUA 27','RUA 28','RUA 29','RUA 30','RUA 31','RUA 32','RUA 33','RUA 34','RUA 35','RUA 36','RUA 37','RUA 38','RUA 39','RUA 40','RUA 41','RUA 42','RUA 43','RUA 44','RUA 45','RUA 46','RUA 47','RUA 48','RUA 49','RUA 50','RUA 51','RUA 52','RUA 53','RUA 54','RUA 59','RUA 60','RUA 61','RUA 62','RUA 63','RUA 64','RUA 65','RUA 66','RUA 67','RUA 68','RUA 69','RUA 70','RUA 71','RUA 72','RUA 73','RUA 74','RUA 75','RUA 76','RUA 77','RUA 78','RUA 79','RUA 80','RUA 81','RUA 82','RUA 83','RUA 84','RUA 85','RUA 86','RUA 87','RUA 88','RUA 89','RUA 90','RUA 91','RUA 92','RUA 93','RUA 94','RUA 95','RUA 96','RUA 97','RUA 98','RUA 99','RUA 100','RUA 101','RUA 102','RUA 103','RUA 104','RUA 105','RUA 106','RUA 107','RUA 108','RUA 109','RUA 110','RUA 111','RUA 112','RUA 113'],
  named:['AVENIDA CENTRAL','AVENIDA RIO BRANCO','AVENIDA WALTER SABINO DOS SANTOS','AVENIDA BRASIL','AVENIDA JK','AVENIDA PEQUI','AVENIDA PORTO','AVENIDA DAS MANGUEIRAS','AVENIDA MARGINAL','AVENIDA 02','AVENIDA 03']
};
function cleanMunicipalText(s){
  return String(s||'').replace(/\bQ\s*D\b/ig,'QD').replace(/\bQUADRA\b/ig,'QD').replace(/\bLOTE\b/ig,'LT').replace(/\bN[ÚU]MERO\b/ig,'N').replace(/\s+/g,' ').trim();
}
function smartQueries(o){
  const a=cleanMunicipalText(fullAddress(o));
  const city=o.city||MUNICIPAL_CITY;
  const q=[];
  if(a)q.push(`${a}, ${city}`);
  if(o.address&&o.number)q.push(`${o.address} ${o.number}, ${city}`);
  if(o.address&&o.complement)q.push(`${o.address}, ${o.complement}, ${city}`);
  if(o.address)q.push(`${o.address}, ${city}`);
  return [...new Set(q.filter(Boolean))];
}
function googleSearchUrl(o){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(fullAddress(o)+', '+(o.city||MUNICIPAL_CITY));}
function streetViewUrl(o){
  if(o.lat!=null&&o.lng!=null)return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${o.lat},${o.lng}`;
  return googleSearchUrl(o);
}
function openGoogleAddress(id){
  const o=session.orders.find(x=>x.id===id); if(!o)return;
  window.open(googleSearchUrl(o),'_blank');
}
function openStreetView(id){
  const o=session.orders.find(x=>x.id===id); if(!o)return;
  window.open(streetViewUrl(o),'_blank');
}
window.openGoogleAddress=openGoogleAddress;
window.openStreetView=openStreetView;

async function smartGeocodeOrder(id, silent=false){
  const o=session.orders.find(x=>x.id===id); if(!o)return;
  const qs=smartQueries(o);
  if(!qs.length){toast('Preencha rua/setor e número/quadra.');return}
  if(!silent)toast('🔎 Procurando o endereço por várias formas…');
  const results=[];
  for(const q of qs){
    try{
      const url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=br&addressdetails=1&q='+encodeURIComponent(q);
      const r=await fetch(url,{headers:{Accept:'application/json'}});
      if(!r.ok)continue;
      const arr=await r.json();
      for(const a of arr){
        const lat=Number(a.lat),lng=Number(a.lon);
        if(Number.isFinite(lat)&&Number.isFinite(lng))results.push({...a,lat,lng,q});
      }
    }catch(e){}
  }
  const uniq=[];const seen=new Set();
  for(const r of results){const k=r.lat.toFixed(5)+','+r.lng.toFixed(5);if(!seen.has(k)){seen.add(k);uniq.push(r)}}
  if(!uniq.length){
    o.addressSearchStatus='not_found';
    await persistOrders(session.orders);render();
    if(!silent)toast('Não achei uma posição confiável. Use Google Maps ou a câmera na placa.');
    return;
  }
  // Prefer results that look like Valparaíso and that contain the requested number.
  const cityNorm=(o.city||'valparaiso').toLowerCase().replace(/á/g,'a');
  uniq.sort((a,b)=>{
    const sa=((a.display_name||'').toLowerCase().includes(cityNorm)?5:0)+(String(a.address?.house_number||'')===String(o.number||'')?8:0);
    const sb=((b.display_name||'').toLowerCase().includes(cityNorm)?5:0)+(String(b.address?.house_number||'')===String(o.number||'')?8:0);
    return sb-sa;
  });
  const best=uniq[0];
  o.lat=best.lat;o.lng=best.lng;o.locationSource='smart-address';o.addressSearchStatus='found';o.addressSearchDisplay=best.display_name||best.q;o.addressSearchAt=new Date().toISOString();
  await persistOrders(session.orders);await load();
  if(!silent)toast(`📍 Endereço localizado: ${best.display_name||best.q}`);
}
window.smartGeocodeOrder=smartGeocodeOrder;

async function smartSearchPending(){
  const pending=session.orders.filter(o=>o.status!=='done'&&o.lat==null&&fullAddress(o));
  if(!pending.length)return toast('Não há entregas com endereço pendente.');
  let ok=0;
  for(const o of pending){await smartGeocodeOrder(o.id,true);if(o.lat!=null)ok++}
  await load();
  toast(`🔎 Busca concluída: ${ok}/${pending.length} endereços localizados`);
}
function openMunicipal(){ $('municipalDialog').showModal(); }
if($('municipalBtn'))$('municipalBtn').onclick=openMunicipal;
if($('closeMunicipal'))$('closeMunicipal').onclick=()=>$('municipalDialog').close();
if($('municipalSearch'))$('municipalSearch').onclick=()=>{
  $('municipalDialog').close();
  const pending=session.orders.find(o=>o.status!=='done'&&o.lat==null);
  if(pending)openGoogleAddress(pending.id); else toast('Não há endereço pendente.');
};
if($('smartBtn'))$('smartBtn').onclick=smartSearchPending;

// Camera V11: client data OR facade photo
let cameraMode='client', cameraTargetOrderId=null;
function setCameraMode(mode,id=null){
  cameraMode=mode;cameraTargetOrderId=id;
  const client=mode==='client';
  $('cameraTitle').textContent=client?'📷 Câmera do J&T Turbo':'🏠 Foto da fachada';
  $('cameraModeHint').textContent=client?'Aponte para nome, telefone ou endereço. O Turbo tenta reconhecer o texto e você confirma antes de salvar.':'Aponte para a frente da casa/loja. Tire uma foto de referência para esta entrega.';
  $('clientScanFields').hidden=!client;$('scanButtons').hidden=!client;$('scanBothBtn').hidden=!client;
  $('saveCameraBtn').hidden=!client;$('facadeFields').hidden=client;$('captureFacadeBtn').hidden=client;
  if(!client){
    const o=session.orders.find(x=>x.id===id);
    $('facadeOrderLabel').textContent=o?`Entrega #${o.id} • ${o.client} • ${fullAddress(o)}`:'';
    if(o?.facadePhoto){$('facadePreview').src=o.facadePhoto;$('facadePreview').hidden=false}else $('facadePreview').hidden=true;
  }
}
const oldOpenCamera=openCamera;
openCamera=function(){setCameraMode('client');$('cameraDialog').showModal();startCamera();};
window.openFacade=function(id){setCameraMode('facade',id);$('cameraDialog').showModal();startCamera();};
function parseAddressOCR(text){
  const lines=String(text||'').split(/\n+/).map(x=>cleanMunicipalText(x)).filter(Boolean);
  let address='',number='',city='';
  const phone=/\d{5,}/;
  const num=/^(?:N[ºO.]?\s*)?(\d+[A-Za-z]?)$/i;
  for(const line of lines){
    if(!address && /^(rua|r\.|avenida|av\.|alameda|travessa|tv\.|rodovia|estrada)\b/i.test(line))address=line;
    if(!number){const m=line.match(num);if(m)number=m[1]}
    if(/valpara[ií]so/i.test(line))city='Valparaíso de Goiás';
  }
  if(!address){
    const cand=lines.find(x=>/(rua|avenida|av\.|alameda|travessa|setor|quadra|qd\.?)/i.test(x)&&!phone.test(x));
    if(cand)address=cand;
  }
  return {address,number,city};
}
async function scanBothV11(){
  const text=await ocrCamera();if(!text)return;
  const name=extractNameFromOCR(text),phone=extractPhoneFromOCR(text),ad=parseAddressOCR(text);
  if(name)$('cameraName').value=name;
  if(phone)$('cameraPhone').value=phone;
  if(ad.address)$('cameraAddress').value=ad.address;
  if(ad.number)$('cameraNumber').value=ad.number;
  if(ad.city)$('cameraCity').value=ad.city;
  const found=[name&&'nome',phone&&'telefone',ad.address&&'endereço'].filter(Boolean);
  $('cameraStatus').textContent=found.length?`✅ Encontrado: ${found.join(', ')}. Confira antes de salvar.`:'⚠️ Texto insuficiente. Aproxime a placa e tente novamente.';
}
async function saveCameraClientV11(){
  const client=$('cameraName').value.trim(),phone=normalizePhone($('cameraPhone').value);
  if(!client)return toast('Informe ou leia o nome.');
  const o={id:nextId(),client,phone,address:$('cameraAddress').value.trim(),number:$('cameraNumber').value.trim(),complement:'',city:$('cameraCity').value.trim()||MUNICIPAL_CITY,notes:'',lat:null,lng:null,status:'pending',priority:0};
  await persistOrders([...session.orders,o]);
  $('cameraName').value='';$('cameraPhone').value='';$('cameraAddress').value='';$('cameraNumber').value='';$('cameraCity').value='';
  $('cameraStatus').textContent='✅ Salvo. Aponte para o próximo cliente.';
  await load();
  if(!$('cameraDialog').open)$('cameraDialog').showModal();
}
async function captureFacade(){
  const canvas=cameraFrame();if(!canvas)return toast('A câmera ainda não está pronta.');
  const o=session.orders.find(x=>x.id===cameraTargetOrderId);if(!o)return toast('Entrega não encontrada.');
  const maxW=800,scale=Math.min(1,maxW/canvas.width),w=Math.round(canvas.width*scale),h=Math.round(canvas.height*scale);
  const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(canvas,0,0,w,h);
  o.facadePhoto=c.toDataURL('image/jpeg',0.68);o.facadePhotoAt=new Date().toISOString();o.facadePhotoSource='camera';
  await persistOrders(session.orders);
  $('facadePreview').src=o.facadePhoto;$('facadePreview').hidden=false;
  $('cameraStatus').textContent='✅ Foto da fachada salva nesta entrega.';
  render();
}
async function saveClientAndSearch(){
  await saveCameraClientV11();
}
openCamera=window.openCamera=openCamera;
$('cameraBtn').onclick=openCamera;
$('closeCamera').onclick=closeCamera;
$('scanNameBtn').onclick=scanName;
$('scanPhoneBtn').onclick=scanPhone;
$('scanBothBtn').onclick=scanBothV11;
$('saveCameraBtn').onclick=saveCameraClientV11;
$('captureFacadeBtn').onclick=captureFacade;
$('cameraDialog').addEventListener('close',stopCamera);

// Enhanced order rendering with facade/address actions
const baseRender=render;
render=function(){
  const o=session.orders,d=o.filter(x=>x.status==='done').length,g=o.filter(x=>x.lat!=null&&x.status!=='done').length,p=o.filter(x=>x.lat==null&&x.status!=='done').length;
  $('stats').innerHTML=`<div class="stat"><b>${o.length}</b><span>pacotes</span></div><div class="stat"><b>${o.length-d}</b><span>pendentes</span></div><div class="stat good"><b>${g}</b><span>GPS</span></div><div class="stat"><b>${d}</b><span>entregues</span></div>`;
  $('filterInfo').textContent=`${p} aguardando localização`;nextStop();
  let list=o.filter(x=>filter==='all'||(filter==='done'&&x.status==='done')||(filter==='gps'&&x.lat!=null&&x.status!=='done')||(filter==='pending'&&x.status!=='done'));
  $('orders').innerHTML=list.map(x=>{
    const i=o.indexOf(x),addr=fullAddress(x),photo=x.facadePhoto?`<img class="facadeThumb" src="${x.facadePhoto}" alt="Fachada de ${esc(x.client)}">`:'';
    const locationBadge=x.lat!=null?'GPS OK':x.addressSearchStatus==='not_found'?'ENDEREÇO NÃO LOCALIZADO':'AGUARDANDO';
    return `<article class="order ${x.status==='done'?'done':''}"><div class="top"><b>#${esc(x.id)} — ${esc(x.client)}</b><span class="badge ${x.status==='done'?'done':''}">${x.status==='done'?'ENTREGUE':locationBadge}</span></div>${photo}<small>📍 ${esc(addr||'Endereço não informado')}</small>${x.addressSearchDisplay?`<div class="note">🔎 ${esc(x.addressSearchDisplay)}</div>`:''}${x.notes?`<div class="note">📝 ${esc(x.notes)}</div>`:''}<div class="row orderActions">${x.lat!=null&&x.status!=='done'?`<button class="mapbtn" onclick="navById('${esc(x.id)}')">🧭 Navegar</button>`:''}${x.status!=='done'&&x.lat==null&&x.phone?`<button class="wa" onclick="requestWA(session.orders[${i}])">💬 Pedir GPS</button>`:''}<button onclick="openLocation('${esc(x.id)}')">📍 Colar localização</button>${addr?`<button onclick="smartGeocodeOrder('${esc(x.id)}')">🧠 Localizar preciso</button>`:''}<button onclick="openGoogleAddress('${esc(x.id)}')">🌐 Google Maps</button><button onclick="openStreetView('${esc(x.id)}')">🏠 Fachada / Street View</button><button onclick="openFacade('${esc(x.id)}')">📷 Foto fachada</button><button onclick="editOrder('${esc(x.id)}')">✏️ Editar</button><button class="donebtn" onclick="done('${esc(x.id)}')">${x.status==='done'?'↩ Reabrir':'✓ Entregue'}</button></div></article>`
  }).join('')||'<p class="muted">Nada nesta categoria.</p>';
};
