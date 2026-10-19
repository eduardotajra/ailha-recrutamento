/* Fundo da ficha: a ilha pronta, a câmera girando devagar em volta da fogueira. Ao enviar, o sinalizador acende. */
import { criarMundo } from './mundo.js';
import { atlas, recorte } from './texturas.js';

// ícones das áreas e da barra de itens: as faces dos blocos, desenhadas pelo mesmo código da ilha
atlas();
const face = nome => recorte(nome, 16, 16).toDataURL();
document.querySelectorAll('img[data-bloco]').forEach(img => { img.src = face(img.dataset.bloco); });
['grama_lado', 'tronco', 'estante', 'la', 'sinalizador'].forEach((nome, i) => {
  const el = document.querySelector(`#etapas li:nth-child(${i + 1}) i`);
  if (el) el.style.backgroundImage = `url(${face(nome)})`;
});

const canvas = document.getElementById('mundo');
try {
  const mundo = criarMundo(canvas, { escala: 3 });
  mundo.completar();
  mundo.orbitar([0, 8, 0], 64, 24, 0.02);
  document.addEventListener('ilha:enviada', () => { mundo.acender(); mundo.orbitar('sinal', 60, 14, 0.02); });
} catch (e) {
  document.body.classList.add('sem-webgl');
}
