// J&T Turbo V14 hotfix: expose the agreed tools immediately on the home screen.
window.addEventListener('DOMContentLoaded',()=>{
  const home=document.getElementById('home');
  if(!home || document.getElementById('quickTools')) return;
  const box=document.createElement('div'); box.id='quickTools'; box.className='card';
  box.innerHTML='<h2>🚚 Ferramentas do Turbo</h2><p class="tiny">Tudo que combinamos, sem precisar entrar em outra tela.</p><div class="grid2"><button id="homeCamera" class="camera big">📷 Câmera do Turbo</button><button id="homeMap" class="big">🗺️ Mapa de Valparaíso</button><button id="homeNew" class="primary big">📦 Nova rota / clientes</button><button id="homeHistory" class="big">📊 Histórico</button></div>';
  home.appendChild(box);
  document.getElementById('homeCamera').onclick=()=>window.openCamera&&window.openCamera();
  document.getElementById('homeMap').onclick=()=>document.getElementById('municipalBtn')?.click();
  document.getElementById('homeNew').onclick=()=>document.getElementById('newRouteBtn')?.click();
  document.getElementById('homeHistory').onclick=()=>document.getElementById('historyBtn')?.click();
});