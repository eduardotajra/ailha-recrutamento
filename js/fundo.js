/* Fundo da ficha: a ilha pronta, a câmera girando devagar em volta da fogueira. Ao enviar, o sinalizador acende. */
import { criarMundo } from './mundo.js';

const canvas = document.getElementById('mundo');
try {
  const mundo = criarMundo(canvas, { escala: 3 });
  mundo.completar();
  mundo.orbitar('livro', 20, 8, 0.025);
  document.addEventListener('ilha:enviada', () => { mundo.acender(); mundo.orbitar('sinal', 46, 6, 0.02); });
} catch (e) {
  document.body.classList.add('sem-webgl');
}
