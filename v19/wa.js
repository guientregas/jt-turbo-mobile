(function(){
  let last=0;
  function api(){return (window.S&&S.settings&&S.settings.waApi||'').replace(/\/$/,'')}
  function match(phone){const p=String(phone||'').replace(/\D/g,'');return S.orders.find(o=>{let x=String(o.phone||'').replace(/\D/g,'');if(x.length===10||x.length===11)x='55'+x;return x===p||x.endsWith(p)||p.endsWith(x)})}
  async function sync(){const u=api();if(!u)return;try{await fetch(u+'/api/whatsapp/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:localStorage.getItem('jtTurboSession')||(function(){const x='jt-'+Date.now()+'-'+Math.random().toString(36).slice(2);localStorage.setItem('jtTurboSession',x);return x})(),orders:S.orders})})}catch(e){}}
  async function poll(){const u=api();if(!u)return;try{const r=await fetch(u+'/api/whatsapp/events?since='+last),j=await r.json();for(const ev of (j.events||[])){const t=Date.parse(ev.receivedAt||'')||0;if(t>last)last=t;const o=match(ev.phone);if(!o)continue;if(ev.type==='location'&&ev.location){o.lat=Number(ev.location.latitude);o.lng=Number(ev.location.longitude);o.locationSource='whatsapp';o.locationAt=Date.now();o.confidence=1;S.addressMemory[keyAddr(o)]={lat:o.lat,lng:o.lng,source:'whatsapp',display:addr(o),seenAt:Date.now()};save();toast('📍 WhatsApp: localização recebida de '+(o.name||'cliente'));}else if(ev.type==='text'&&ev.text&&!o.address){o.address=norm(ev.text);save();locate(o)}}}catch(e){}}
  async function send(text,o){const u=api();if(!u||!o||!phone(o.phone))return;try{await fetch(u+'/api/whatsapp/send-message',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:phone(o.phone),text})})}catch(e){}}
  const oldGo=window.goDelivery,oldArr=window.arrived,oldComplete=window.complete;
  window.goDelivery=function(id){const o=S.orders.find(x=>x.id===id)||currentNext();oldGo(id);send('🚚 Olá! Estou indo para sua entrega agora. Fique atento ao endereço informado.',o);sync()};
  window.arrived=function(){const o=currentNext();oldArr();if(o)send('🏠 Cheguei próximo ao endereço. Estou procurando o número informado.',o);sync()};
  window.complete=function(id){const o=S.orders.find(x=>x.id===id);oldComplete(id);if(o)send('✅ Entrega concluída. Obrigado!',o);sync()};
  window.startBusinessPolling=function(){sync();poll();setInterval(poll,8000);setInterval(sync,20000)};
  setTimeout(()=>{if(api())startBusinessPolling()},2500);
})();