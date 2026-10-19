/* Página do chamado: abertura de rádio, áreas montadas a partir do config, câmera presa à rolagem. */
import { criarMundo } from './mundo.js';
import { atlas, recorte } from './texturas.js';

const C = window.ILHA;
const calmo = window.IlhaCalmo;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const suave = t => t * t * (3 - 2 * t);

// ---------------------------------------------------------------- áreas
const areas = document.getElementById('areas');
areas.outerHTML = C.cargos.map((c, i) => `
  <section class="cap area ${i % 2 ? 'direita' : ''}" id="${c.id}" data-cena="${c.cena}" data-id="${c.id}">
    <div class="gruda">
      <article class="dica">
        <h2><img class="icone" data-bloco="${c.bloco}" alt="" width="32" height="32">${esc(c.nome)}</h2>
        <p class="chamada">${esc(c.chamada)}</p>
        <button class="mais" type="button" aria-expanded="false">o que você faria</button>
        <p class="quando">Na equipe:</p>
        <ul>${c.faz.map(f => `<li>+ ${esc(f)}</li>`).join('')}</ul>
        <p class="ajuda">Ajuda ter: ${esc(c.ajuda)}</p>
        <div class="xp" aria-hidden="true"><i></i><b>0</b></div>
        <div class="pe">
          <span class="conta"><b data-cargo="${c.id}">0</b><span data-plural>fichas</span></span>
          <a class="mc" href="candidatura.html?area=${c.id}">Quero esta</a>
        </div>
      </article>
    </div>
  </section>`).join('');

const contar = d => {
  document.querySelectorAll('[data-cargo]').forEach(b => {
    const n = d.cargos[b.dataset.cargo] || 0;
    IlhaContar(b, n);
    b.nextElementSibling.textContent = IlhaPlural(n, 'ficha', 'fichas');
  });
};
document.addEventListener('ilha:contagem', e => contar(e.detail));
// no celular a janela mostra o essencial; o resto abre num toque, para não cobrir a cena
document.querySelectorAll('.area .mais').forEach(b => b.addEventListener('click', () => {
  const aberta = b.closest('.dica').classList.toggle('aberta');
  b.setAttribute('aria-expanded', aberta);
  b.textContent = aberta ? 'fechar' : 'o que você faria';
}));
if (window.IlhaUltima) contar(window.IlhaUltima);

// ---------------------------------------------------------------- ícones: a face do bloco de cada área, desenhada pelo mesmo código da ilha
atlas();
document.querySelectorAll('img[data-bloco]').forEach(img => { img.src = recorte(img.dataset.bloco, 16, 16).toDataURL(); });

// aviso de conquista do jogo, na primeira vez que se chega a cada área
const toasts = document.createElement('div');
toasts.className = 'conquistas';
document.body.appendChild(toasts);
const vistas = new Set();
function conquista(c) {
  if (vistas.has(c.id)) return;
  vistas.add(c.id);
  const el = document.createElement('div');
  el.className = 'conquista';
  el.innerHTML = `<img src="${recorte(c.bloco, 16, 16).toDataURL()}" alt="" width="32" height="32"><span><b>Vaga encontrada!</b>${esc(c.nome)}</span>`;
  toasts.appendChild(el);
  setTimeout(() => el.classList.add('sai'), 3800);
  setTimeout(() => el.remove(), 4400);
}

// ---------------------------------------------------------------- mundo
const canvas = document.getElementById('mundo');
let mundo = null;
try { mundo = criarMundo(canvas); window.IlhaMundo = mundo; } catch (e) { document.body.classList.add('sem-webgl'); console.warn('sem WebGL', e); }
const caps = [...document.querySelectorAll('.cap')];
if (mundo) mundo.definirCaminho(caps.map(s => s.dataset.cena), { alto: true });

let ultimoY = -1, ultimaAltura = -1;
function quadro() {
  const vh = innerHeight, y = scrollY;
  if (y !== ultimoY || vh !== ultimaAltura) {
    ultimoY = y; ultimaAltura = vh;
    // câmera: parada enquanto se lê uma seção, viaja na passagem para a próxima
    const centros = caps.map(s => { const r = s.getBoundingClientRect(); return r.top + y + Math.min(r.height, vh * 1.6) / 2; });
    const meio = y + vh / 2;
    let k = 0;
    while (k < centros.length - 1 && meio > centros[k + 1]) k++;
    const f = k >= centros.length - 1 ? 0 : clamp((meio - centros[k]) / (centros[k + 1] - centros[k]));
    const viagem = suave(clamp((f - 0.55) / 0.4));
    if (mundo) mundo.progresso((k + viagem) / (caps.length - 1));
    // cada cena se monta conforme a sua seção passa
    caps.forEach(s => {
      const r = s.getBoundingClientRect();
      const p = clamp((vh * 0.7 - r.top) / Math.max(1, r.height - vh * 0.9));
      if (s.classList.contains('area')) {
        if (mundo) mundo.cena(s.dataset.cena, p);
        if (p > 0.08) conquista(C.cargos.find(c => c.id === s.dataset.id));
        const xp = s.querySelector('.xp');
        xp.firstElementChild.style.width = (p * 100).toFixed(1) + '%';
        xp.lastElementChild.textContent = Math.floor(p * 30); // nível de experiência, como no jogo
      } else if (s.classList.contains('final') && p > 0.3 && !s.classList.contains('aceso')) {
        s.classList.add('aceso');
        document.getElementById('fraco').textContent = 'Responda.';
        if (mundo) mundo.acender();
      }
    });
  }
  requestAnimationFrame(quadro);
}
requestAnimationFrame(quadro);

// ---------------------------------------------------------------- abertura: rádio sintonizando
const abertura = document.getElementById('abertura');
let jaViu = false;
try { jaViu = sessionStorage.getItem('ilha_abertura') === '1'; } catch (e) { /* sem armazenamento */ }
function encerrarAbertura() {
  abertura.classList.add('some');
  try { sessionStorage.setItem('ilha_abertura', '1'); } catch (e) { /* sem armazenamento */ }
  setTimeout(() => abertura.remove(), 1300);
  letrasGrandes();
}
if (jaViu || calmo || location.hash) { abertura.remove(); letrasGrandes(); } else {
  const est = document.getElementById('estatica'), g = est.getContext('2d'), img = g.createImageData(160, 90);
  let vivo = true;
  (function chiado() {
    if (!vivo) return;
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0);
    requestAnimationFrame(chiado);
  })();
  const linhas = ['› sintonizando 87,3 MHz', '› sinal fraco', '', '› aqui é a ilha.', '› alguém está ouvindo?'];
  const pre = document.getElementById('radio');
  let i = 0, j = 0, texto = '';
  (function digitar() {
    if (!vivo) return;
    if (i >= linhas.length) { setTimeout(() => { if (vivo) { vivo = false; encerrarAbertura(); } }, 900); pre.innerHTML = esc(texto) + '<span class="cur"></span>'; return; }
    if (j <= linhas[i].length) { pre.innerHTML = esc(texto + linhas[i].slice(0, j)) + '<span class="cur"></span>'; j++; setTimeout(digitar, 18 + Math.random() * 22); } else { texto += linhas[i] + '\n'; i++; j = 0; setTimeout(digitar, linhas[i - 1] ? 220 : 80); }
  })();
  const pular = () => { if (vivo) { vivo = false; encerrarAbertura(); } };
  document.getElementById('pular').addEventListener('click', pular);
  addEventListener('keydown', pular, { once: true });
  abertura.addEventListener('click', pular);
}

// título grande entra letra por letra, em degraus
function letrasGrandes() {
  if (calmo) return;
  const h1 = document.querySelector('.heroi .grande');
  let n = 0;
  h1.innerHTML = h1.innerHTML.split(/(<br>)/).map(parte => parte === '<br>' ? parte :
    [...parte].map(ch => ch === ' ' ? ' ' : `<span class="letra" style="animation-delay:${0.25 + (n++) * 0.045}s">${ch}</span>`).join('')).join('');
}

// ---------------------------------------------------------------- vídeo (quando houver)
if (C.trailer) {
  const botao = document.getElementById('verVideo'), cinema = document.getElementById('cinema'), tela = document.getElementById('telaCinema');
  botao.hidden = false;
  const yt = C.trailer.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  botao.addEventListener('click', () => {
    tela.innerHTML = yt
      ? `<iframe src="https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&rel=0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="Vídeo de A Ilha"></iframe>`
      : `<video src="${esc(C.trailer)}" controls autoplay playsinline></video>`;
    cinema.showModal();
  });
  cinema.querySelector('.fechar').addEventListener('click', () => cinema.close());
  cinema.addEventListener('click', e => { if (e.target === cinema) cinema.close(); });
  cinema.addEventListener('close', () => { tela.innerHTML = ''; });
}
