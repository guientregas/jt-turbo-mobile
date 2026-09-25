(function(){'use strict';
function E(id){return document.getElementById(id)}
function esc(s){return String(s==null?'':s).replace(/[&<>\"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]})}
function show(title,body){var m=E('modal'),t=E('mt'),b=E('mb');if(!m)return; t.textContent=title;b.innerHTML=body;m.className='modal on';m.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}
function close(){var m=E('modal');if(m){m.className='modal';m.setAttribute('aria-hidden','true');document.body.style.overflow=''}}
function parseCoords(s){s=String(s||'').replace(/,/g,' ').trim();var m=s.match(/(-?\d{1,3}(?:\.\d+)?)\s+(-?\d{1,3}(?:\.\d+)?)/);if(!m)return null;var a=+m[1],b=+m[2];if(Math.abs(a)<=90&&Math.abs(b)<=180)return{lat:a,lng:b};if(Math.abs(a)<=180&&Math.abs(b)<=90)return{lat:b,lng:a};return null}
function parsePhone(s){var m=String(s||'').match(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}[\s.-]?\d{4}/);return m?m[0]:''}
function saveLocation(){
 var name=E('pName').value.trim(),phone=E('pPhone').value.trim(),addr=E('pAddr').value.trim(),coords=parseCoords(E('pCoords').value),note=E('pNote').value.trim();
 if(!name&&!addr&&!coords)return alert('Informe pelo menos o nome, endereço ou latitude/longitude.');
 var A=window.__jtV23;if(!A||!A.data)return alert('Sistema de entregas ainda carregando.');
 var o={id:String(Date.now())+Math.random(),name:name||'Cliente',phone:phone,address:addr,number:E('pNumber').value.trim(),sector:E('pSector').value.trim(),cep:E('pCep').value.trim(),note:note,status:'pending'};
 if(coords){o.lat=coords.lat;o.lng=coords.lng;o.acc=5;o.confidence=100;o.locationSource='WhatsApp';}
 A.data().orders.push(o);
 try{localStorage.setItem('jtTurboV23',JSON.stringify(A.data()))}catch(e){}
 A.refresh&&A.refresh();
 if(!coords&&addr&&window.locate)try{locate(o,function(){})}catch(e){}
 close();A.toast&&A.toast('📍 Entrega salva com localização e dados');
}
function openPaste(){
 show('📍 NOVA ENTREGA',
 '<div class="small">Cole aqui a localização enviada pelo cliente no WhatsApp. Pode ser um link do Google Maps ou simplesmente latitude e longitude.</div>'+\
 '<label class="small">Latitude e longitude</label><input id="pCoords" class="field" inputmode="decimal" placeholder="Ex.: -15.873210, -48.045670">'+\
 '<div class="buttons"><button id="pPasteBtn">📋 COLAR DO WHATSAPP</button><button id="pMapBtn">📍 USAR MINHA LOCALIZAÇÃO</button></div>'+\
 '<hr style="border:0;border-top:1px solid #e4eaf2;margin:12px 0">'+\
 '<label class="small">Nome do cliente</label><input id="pName" class="field" placeholder="Ex.: João Silva">'+\
 '<label class="small">Celular / WhatsApp</label><input id="pPhone" class="field" type="tel" inputmode="tel" placeholder="(61) 99999-9999">'+\
 '<label class="small">Endereço</label><input id="pAddr" class="field" placeholder="Rua, avenida, condomínio...">'+\
 '<div class="buttons"><input id="pNumber" class="field" placeholder="Número / lote"><input id="pSector" class="field" placeholder="Quadra / setor / bairro"></div>'+\
 '<input id="pCep" class="field" inputmode="numeric" placeholder="CEP">'+\
 '<textarea id="pNote" class="field" rows="2" placeholder="Observação (opcional)"></textarea>'+\
 '<button id="pSave" class="green" style="width:100%;margin-top:5px;font-size:15px">✓ SALVAR ENTREGA</button>');
 E('pPasteBtn').onclick=async function(){try{var t=await navigator.clipboard.readText();if(t){E('pCoords').value=t;var c=parseCoords(t);if(c)E('pCoords').value=c.lat+', '+c.lng;else{var ph=parsePhone(t);if(ph)E('pPhone').value=ph;E('pNote').value=t}}}catch(e){E('pCoords').focus();A&&A.toast&&A.toast('Cole manualmente a localização neste campo')}};
 E('pMapBtn').onclick=function(){if(navigator.geolocation)navigator.geolocation.getCurrentPosition(function(p){E('pCoords').value=p.coords.latitude+', '+p.coords.longitude},function(){alert('Não foi possível obter sua localização.')},{enableHighAccuracy:true,timeout:10000})};
 E('pSave').onclick=saveLocation;
}
function simplify(){
 var cards=[].slice.call(document.querySelectorAll('.card'));var tools=cards.find(function(c){var b=c.querySelector('b');return b&&/Ferramentas/i.test(b.textContent)});
 if(tools&&!tools.dataset.v25){tools.dataset.v25='1';var b=tools.querySelector('b');var buttons=tools.querySelector('.buttons');b.innerHTML='⚙️ Mais ferramentas <span style="font-size:11px;color:#68778b">(toque para abrir)</span>';b.style.cursor='pointer';buttons.style.display='none';b.onclick=function(){buttons.style.display=buttons.style.display==='none'?'grid':'none'};}
 var hero=document.querySelector('.hero');if(hero){var sub=hero.querySelector('.heroSub');if(sub)sub.textContent='Escaneie, confira a localização e faça a rota.';var ey=hero.querySelector('.eyebrow');if(ey)ey.textContent='ENTREGAS';}
 var add=cards.find(function(c){var b=c.querySelector('b');return b&&/Adicionar entrega/i.test(b.textContent)});if(add){var sm=add.querySelector('.small');if(sm)sm.textContent='Cadastre manualmente ou cole a localização enviada pelo cliente.';var old=E('paste');if(old)old.textContent='📍 COLAR LOCALIZAÇÃO DO WHATSAPP';}
}
function boot(){var p=E('paste');if(p){p.onclick=openPaste;p.addEventListener('click',function(e){e.stopImmediatePropagation()},true)}simplify()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,700)});else setTimeout(boot,700);
setInterval(simplify,3000);
})();