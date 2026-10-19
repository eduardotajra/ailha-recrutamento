/* Painel ao vivo: uma torre de blocos por área na ilha, com plaquinha de nome em cima, e as últimas fichas no "chat". */
import { criarMundo } from './mundo.js';

const C = window.ILHA;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const nome = id => (C.cargos.find(c => c.id === id) || { nome: id }).nome;
const ids = C.cargos.map(c => c.id);
let anterior = null;

let mundo = null;
try {
  mundo = criarMundo(document.getElementById('mundo'));
  mundo.completar();
  mundo.acender();
  mundo.torres(ids);
  mundo.olhar('painel');
} catch (e) { document.body.classList.add('sem-webgl'); }

// plaquinhas de nome sobre as torres (como as dos jogadores no jogo)
const placas = document.getElementById('placas');
placas.innerHTML = ids.map(id => `<div class="placa" data-id="${id}"><b>0</b> ${esc(nome(id))}</div>`).join('');
if (mundo) {
  (function seguir() {
    mundo.rotuloTorres().forEach(r => {
      const el = placas.querySelector(`[data-id="${r.id}"]`);
      el.style.transform = `translate(${r.x.toFixed(1)}px, ${r.y.toFixed(1)}px) translate(-50%, -100%)`;
      el.style.visibility = r.atras ? 'hidden' : 'visible';
    });
    requestAnimationFrame(seguir);
  })();
} else {
  placas.classList.add('lista');
}

// tabela para leitores de tela e para quando não há 3D
const corpo = document.querySelector('#tabela tbody');

function ha(ms) {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return 'agora';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

function desenhar(d) {
  IlhaContar(document.getElementById('total'), d.total || 0);
  document.getElementById('totalTxt').textContent = IlhaPlural(d.total, 'ficha recebida', 'fichas recebidas');
  if (mundo) mundo.contagem(d.cargos);
  ids.forEach(id => {
    const n = d.cargos[id] || 0, el = placas.querySelector(`[data-id="${id}"]`);
    IlhaContar(el.firstElementChild, n);
    if (anterior && n > (anterior.cargos[id] || 0)) { el.classList.remove('nova'); void el.offsetWidth; el.classList.add('nova'); }
  });
  corpo.innerHTML = ids.map(id => `<tr><th>${esc(nome(id))}</th><td>${d.cargos[id] || 0}</td></tr>`).join('');
  if (d.recentes && d.recentes.length) {
    document.getElementById('recentes').innerHTML = d.recentes.slice(0, 8).reverse().map(r =>
      `<li><span class="quem">[Ilha]</span> Nova ficha para <b>${esc((r.cargos || []).map(nome).join(', '))}</b> <time>${ha(r.quando)}</time></li>`).join('');
  }
  anterior = d;
}

document.addEventListener('ilha:contagem', e => desenhar(e.detail));
if (window.IlhaUltima) desenhar(window.IlhaUltima);
