/*
 * Texturas de bloco 16×16 desenhadas por código, pixel a pixel (nenhuma imagem do jogo nem gerada por IA).
 * Ficam num atlas de 8 colunas; cada tipo de bloco diz qual textura vai em cima, nos lados e embaixo.
 */
export const N = 8, LINHAS = 5, PX = 16;

function semente(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// cada desenho recebe (px, r): px(x, y, cor) pinta um pixel; r() é o acaso daquela textura
const pega = (r, lista) => lista[Math.floor(r() * lista.length)];
const ruido = (px, r, lista) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, pega(r, lista)); };

const VERDES = ['#5b8a3a', '#507d32', '#679745', '#476f2c', '#5f903d'];
const TERRAS = ['#866043', '#79553a', '#966c4a', '#6b4a32', '#8b6446'];
const PEDRAS = ['#7f7f7f', '#767676', '#888888', '#6d6d6d', '#7a7a7a'];
const MADEIRA = ['#a2834f', '#9b7b48', '#ad8b54', '#977646'];

const DESENHOS = {
  grama_topo(px, r) { ruido(px, r, VERDES); },
  grama_lado(px, r) {
    ruido(px, r, TERRAS);
    for (let x = 0; x < 16; x++) {
      const fundo = 2 + Math.floor(r() * 3);
      for (let y = 0; y <= fundo; y++) px(x, y, pega(r, VERDES));
    }
  },
  terra(px, r) { ruido(px, r, TERRAS); },
  pedra(px, r) {
    ruido(px, r, PEDRAS);
    for (let i = 0; i < 9; i++) { const x = Math.floor(r() * 15), y = Math.floor(r() * 15); px(x, y, '#5f5f5f'); px(x + 1, y, '#646464'); }
  },
  areia(px, r) { ruido(px, r, ['#dbcf9f', '#d4c48f', '#e0d6a8', '#cdbd88', '#d8cb98']); },
  tronco(px, r) {
    for (let x = 0; x < 16; x++) {
      const base = pega(r, ['#6b5130', '#5d4528', '#735634', '#634b2c']);
      for (let y = 0; y < 16; y++) px(x, y, r() < 0.18 ? '#4a3720' : base);
    }
  },
  tronco_topo(px, r) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      px(x, y, d > 6.5 ? pega(r, ['#6b5130', '#5d4528']) : (Math.floor(d) % 2 ? '#a8834d' : '#9a7644'));
    }
  },
  folha(px, r) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, r() < 0.22 ? '#1d3a17' : pega(r, ['#3f7a2a', '#36692a', '#4a8a32', '#2f5e22']));
  },
  tabua(px, r) {
    for (let tabua = 0; tabua < 4; tabua++) {
      const emenda = Math.floor(r() * 12) + 2;
      for (let y = tabua * 4; y < tabua * 4 + 4; y++) for (let x = 0; x < 16; x++) {
        let c = pega(r, MADEIRA);
        if (y === tabua * 4 + 3) c = '#6e5530';
        if (x === (emenda + (tabua % 2) * 7) % 16 && y !== tabua * 4 + 3) c = '#7a5f36';
        px(x, y, c);
      }
    }
  },
  pedregulho(px, r) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, '#555555');
    for (let i = 0; i < 14; i++) {
      const cx = Math.floor(r() * 16), cy = Math.floor(r() * 16), w = 2 + Math.floor(r() * 3), h = 2 + Math.floor(r() * 2);
      const tom = pega(r, ['#8a8a8a', '#7b7b7b', '#949494', '#6f6f6f']);
      for (let y = cy; y < cy + h; y++) for (let x = cx; x < cx + w; x++) px(x % 16, y % 16, r() < 0.15 ? '#9d9d9d' : tom);
    }
  },
  vidro(px, r) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, '#20303a');
    for (let i = 0; i < 16; i++) { px(i, 0, '#cfe7ef'); px(i, 15, '#cfe7ef'); px(0, i, '#cfe7ef'); px(15, i, '#cfe7ef'); }
    [[3, 3], [4, 4], [5, 5], [4, 3], [10, 11], [11, 12]].forEach(([x, y]) => px(x, y, '#e8f6fa'));
  },
  la(px, r) { ruido(px, r, ['#e9ecec', '#dfe2e2', '#f2f4f4', '#d9dcdc']); },
  ferro(px, r) {
    ruido(px, r, ['#dcdcdc', '#d6d6d6', '#e0e0e0']);
    for (let i = 0; i < 16; i++) { px(i, 15, '#a9a9a9'); px(15, i, '#a9a9a9'); px(i, 0, '#f2f2f2'); px(0, i, '#f2f2f2'); }
    for (let i = 2; i < 14; i++) { px(i, 7, '#c4c4c4'); }
  },
  sinalizador(px, r) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, '#cfeef2');
    for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) px(x, y, '#3b5257');
    for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) px(x, y, (x + y) % 3 ? '#8ff3ff' : '#d8fdff');
  },
  obsidiana(px, r) { ruido(px, r, ['#100c1c', '#1b1530', '#14102a', '#2a2045', '#0c0a16']); },
  estante(px, r) {
    DESENHOS.tabua(px, r);
    const cores = ['#6e2a22', '#2c4a7a', '#3a6b2c', '#7a5a22', '#5a2c6b', '#8a3a2a', '#2c6b6b'];
    [[3, 7], [9, 13]].forEach(([y0, y1]) => {
      let x = 1;
      while (x < 15) {
        const w = 1 + Math.floor(r() * 2), c = pega(r, cores), alto = y0 + Math.floor(r() * 2);
        for (let xx = x; xx < Math.min(15, x + w); xx++) for (let y = y0; y <= y1; y++) px(xx, y, y < alto ? '#3a2a18' : c);
        x += w;
        if (r() < 0.2 && x < 15) { for (let y = y0; y <= y1; y++) px(x, y, '#3a2a18'); x++; }
      }
    });
  },
  tijolo(px, r) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const linha = Math.floor(y / 4), desloca = linha % 2 ? 4 : 0;
      const junta = y % 4 === 3 || (x + desloca) % 8 === 7;
      px(x, y, junta ? pega(r, ['#b5a99e', '#a89c91']) : pega(r, ['#965a46', '#a4614c', '#8a4f3e', '#9d5c48']));
    }
  },
  argila(px, r) { ruido(px, r, ['#a0a6b3', '#9aa0ad', '#a6acb9', '#949aa7']); },
  barril_lado(px, r) {
    for (let x = 0; x < 16; x++) {
      const base = pega(r, ['#7a5a32', '#6e5029', '#83613a']);
      for (let y = 0; y < 16; y++) px(x, y, x % 4 === 3 ? '#4f391f' : base);
    }
    for (let x = 0; x < 16; x++) { px(x, 2, '#4a4a4a'); px(x, 13, '#4a4a4a'); }
  },
  barril_topo(px, r) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, pega(r, ['#8a6a3c', '#7e6035']));
    for (let i = 0; i < 16; i++) { px(i, 0, '#4f391f'); px(i, 15, '#4f391f'); px(0, i, '#4f391f'); px(15, i, '#4f391f'); }
    for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) px(x, y, '#3a2a16');
  },
  pedra_tijolo(px, r) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const metade = y < 8, desloca = metade ? 0 : 8;
      const junta = y === 7 || y === 15 || (x + desloca) % 16 === 15;
      px(x, y, junta ? '#4e4e4e' : pega(r, ['#7a7a7a', '#727272', '#808080']));
    }
  },
  pelo(px, r) { ruido(px, r, ['#d9d6cf', '#cfccc5', '#e2dfd8', '#c7c4bd']); },
  pelo_escuro(px, r) { ruido(px, r, ['#a39f97', '#99958d', '#ada9a1']); },
  pagina(px, r) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, pega(r, ['#efe4c8', '#e8dcbe']));
    for (let y = 3; y < 14; y += 2) for (let x = 2; x < 14; x++) if (r() < 0.75) px(x, y, '#5e5240');
  },
  fogo(px, r) { /* desenhado à parte, com transparência */ },
};

const ORDEM = Object.keys(DESENHOS);
export const T = Object.fromEntries(ORDEM.map((n, i) => [n, i]));

// tipos de bloco: [cima, lados, baixo]
export const B = {
  grama: [T.grama_topo, T.grama_lado, T.terra], terra: [T.terra, T.terra, T.terra], pedra: [T.pedra, T.pedra, T.pedra],
  areia: [T.areia, T.areia, T.areia], tronco: [T.tronco_topo, T.tronco, T.tronco_topo], folha: [T.folha, T.folha, T.folha],
  tabua: [T.tabua, T.tabua, T.tabua], pedregulho: [T.pedregulho, T.pedregulho, T.pedregulho], vidro: [T.vidro, T.vidro, T.vidro],
  la: [T.la, T.la, T.la], ferro: [T.ferro, T.ferro, T.ferro], sinalizador: [T.sinalizador, T.sinalizador, T.obsidiana],
  obsidiana: [T.obsidiana, T.obsidiana, T.obsidiana], estante: [T.tabua, T.estante, T.tabua], tijolo: [T.tijolo, T.tijolo, T.tijolo],
  argila: [T.argila, T.argila, T.argila], barril: [T.barril_topo, T.barril_lado, T.barril_topo], pedra_tijolo: [T.pedra_tijolo, T.pedra_tijolo, T.pedra_tijolo],
};

// cores de lã do jogo
export const LA = {
  branca: 0xe9ecec, laranja: 0xf07613, magenta: 0xbd44b3, azulClara: 0x3aafd9, amarela: 0xf8c627, lima: 0x70b919, rosa: 0xed8dac,
  cinza: 0x3e4447, cinzaClara: 0x8e8e86, ciano: 0x158991, roxa: 0x792aac, azul: 0x35399d, marrom: 0x724728, verde: 0x546d1b, vermelha: 0xa12722, preta: 0x141519,
};

const canvasTile = {};
export function atlas() {
  const c = document.createElement('canvas');
  c.width = N * PX; c.height = LINHAS * PX;
  const g = c.getContext('2d');
  ORDEM.forEach((nome, i) => {
    const ox = (i % N) * PX, oy = Math.floor(i / N) * PX, r = semente(1000 + i * 77);
    const t = document.createElement('canvas'); t.width = t.height = PX;
    const tg = t.getContext('2d');
    DESENHOS[nome]((x, y, cor) => { tg.fillStyle = cor; tg.fillRect(x, y, 1, 1); }, r);
    canvasTile[nome] = t;
    g.drawImage(t, ox, oy);
  });
  return c;
}

// um recorte da textura no tamanho exato da face (em pixels de 1/16 de bloco), repetindo se precisar: nada estica
export function recorte(nome, w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  const g = c.getContext('2d');
  for (let y = 0; y < c.height; y += PX) for (let x = 0; x < c.width; x += PX) g.drawImage(canvasTile[nome], x, y);
  return c;
}

// chama em pixel, dois quadros, para a fogueira
export function chamas() {
  return [0, 1].map(q => {
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const g = c.getContext('2d'), r = semente(55 + q);
    for (let x = 2; x < 14; x++) {
      const alto = 6 + Math.floor(r() * 8) - Math.abs(x - 7.5) * 0.6;
      for (let y = 15; y > 15 - alto; y--) {
        const k = (15 - y) / alto;
        g.fillStyle = k > 0.75 ? '#ffe9a0' : k > 0.4 ? '#ffb02e' : '#f06a14';
        if (r() > 0.08) g.fillRect(x, y, 1, 1);
      }
    }
    return c;
  });
}

// lua quadrada com crateras
export function lua() {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const g = c.getContext('2d'), r = semente(9);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const borda = x < 2 || y < 2 || x > 13 || y > 13;
    g.fillStyle = borda ? 'rgba(0,0,0,0)' : pega(r, ['#e8ebf2', '#dfe3ec', '#eef0f5']);
    g.fillRect(x, y, 1, 1);
  }
  [[5, 5, 2], [9, 8, 3], [6, 10, 1], [10, 4, 1]].forEach(([x, y, s]) => { g.fillStyle = '#c4c9d6'; g.fillRect(x, y, s, s); });
  return c;
}
