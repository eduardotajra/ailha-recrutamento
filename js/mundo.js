/*
 * A ilha em blocos, feita inteira por código: nenhuma imagem do jogo, nada da história.
 * Todo bloco é um bloco que existe no jogo, com a textura dele (js/texturas.js), sempre do tamanho de um bloco:
 * nada estica. As cenas que se montam com a rolagem: casa (construção), mural de lã (arte), modelo de lobo
 * (modelagem), púlpito com livro e fogueira (lore), estante (organização), sinalizador (final) e os pilares do painel.
 */
import * as THREE from './vendor/three.module.min.js';
import { atlas, recorte, chamas, lua as texLua, B, LA, N, LINHAS } from './texturas.js';

// ---------------------------------------------------------------- acaso com semente (a ilha é sempre a mesma)
function mulberry(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const rnd = mulberry(1907);
const GRADE = 256, valores = Array.from({ length: GRADE * GRADE }, rnd);
function ruido(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const v = (i, j) => valores[((i & 255) * GRADE + (j & 255))];
  const s = t => t * t * (3 - 2 * t);
  const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
  return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf);
}
const fbm = (x, y) => (ruido(x, y) * 0.55 + ruido(x * 2.1, y * 2.1) * 0.3 + ruido(x * 4.3, y * 4.3) * 0.15);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const suave = t => t * t * (3 - 2 * t);
const saida = t => 1 - Math.pow(1 - t, 3);

// ---------------------------------------------------------------- terreno
const R = 42, AGUA = 4;
const LUGAR = { casa: [-24, 6], mural: [14, 18], lobo: [25, 5], livro: [-10, -20], ordem: [-6, 22], painel: [-22, -11], topo: [6, -4] };
function vistaDe(cx, cz, y, dist, alto, lado = 0) {
  const d = Math.hypot(cx, cz) || 1, ox = cx / d, oz = cz / d;
  return [cx + ox * dist - oz * lado, y + alto, cz + oz * dist + ox * lado];
}
const alt = new Map();
const k = (x, z) => x + ',' + z;
function alturaBruta(x, z) {
  const d = Math.hypot(x, z * 1.15) / R;
  const costa = 1 - d * 1.08 + (fbm(x * 0.07 + 10, z * 0.07 + 3) - 0.5) * 0.55;
  if (costa < 0) return -1;
  const morro = 13 * Math.exp(-((x - LUGAR.topo[0]) ** 2 + (z - LUGAR.topo[1]) ** 2) / 140);
  return AGUA + 1 + Math.floor(costa * 9 + fbm(x * 0.12, z * 0.12) * 6 * clamp(costa * 2) + morro);
}
for (let x = -R - 6; x <= R + 6; x++) for (let z = -R - 6; z <= R + 6; z++) alt.set(k(x, z), alturaBruta(x, z));
for (const [nome, [cx, cz]] of Object.entries(LUGAR)) {
  if (nome === 'topo') continue;
  const h0 = Math.max(AGUA + 2, alt.get(k(cx, cz))), raio = nome === 'painel' ? 12 : 7;
  for (let x = cx - raio; x <= cx + raio; x++) for (let z = cz - raio; z <= cz + raio; z++) {
    const d = Math.hypot(x - cx, z - cz);
    if (d > raio) continue;
    const h = alt.get(k(x, z));
    const t = d < raio - 2 ? 1 : 1 - (d - raio + 2) / 2;
    alt.set(k(x, z), Math.round(h0 * t + Math.max(h, AGUA) * (1 - t)));
  }
}
const H = (x, z) => { const v = alt.get(k(x, z)); return v === undefined ? -1 : v; };
const chao = (x, z) => H(x, z) + 1;
// praça de tijolo de pedra embaixo dos pilares do painel
const PRACA = new Set();
for (let x = LUGAR.painel[0] - 8; x <= LUGAR.painel[0] + 8; x++) for (let z = LUGAR.painel[1] - 2; z <= LUGAR.painel[1] + 2; z++) PRACA.add(k(x, z));

// ---------------------------------------------------------------- montagem
export function criarMundo(canvas, opcoes = {}) {
  const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const QUALIDADES = [1.5, 1, 0.75, 0.6];
  let qualidade = 0;
  const pr = () => Math.min(devicePixelRatio || 1, QUALIDADES[qualidade]);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const cena = new THREE.Scene();
  cena.background = new THREE.Color(0x080b12);
  cena.fog = new THREE.Fog(0x0b1019, 50, 180);
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 900);

  // ---- material de bloco: atlas + sombra de face (topo claro, lados mais escuros, como no jogo)
  const texAtlas = new THREE.CanvasTexture(atlas());
  texAtlas.magFilter = texAtlas.minFilter = THREE.NearestFilter;
  texAtlas.generateMipmaps = false;
  texAtlas.colorSpace = THREE.SRGBColorSpace;
  const matBloco = new THREE.MeshLambertMaterial({ map: texAtlas, vertexColors: true });
  matBloco.onBeforeCompile = s => {
    s.vertexShader = 'attribute vec3 aTile;\n' + s.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
      float tileId = normal.y > 0.5 ? aTile.x : (normal.y < -0.5 ? aTile.z : aTile.y);
      vec2 cel = vec2(mod(tileId, ${N}.0), floor(tileId / ${N}.0));
      vec2 q = uv * 0.996 + 0.002;
      vMapUv = vec2((cel.x + q.x) / ${N}.0, 1.0 - (cel.y + 1.0 - q.y) / ${LINHAS}.0);`);
  };
  const caixa = new THREE.BoxGeometry(1, 1, 1);
  {
    const sombras = [0.7, 0.7, 1.0, 0.5, 0.82, 0.82], cs = [];
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) cs.push(sombras[f], sombras[f], sombras[f]);
    caixa.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3));
  }
  const tmp = new THREE.Object3D(), cor = new THREE.Color();

  // uma malha instanciada de blocos: itens = [{p: [x, y, z], b: 'tipo', c: cor (só lã)}]
  function malha(itens, { mostrar = true } = {}) {
    const g = caixa.clone();
    const tiles = new Float32Array(itens.length * 3);
    itens.forEach((it, i) => tiles.set(B[it.b], i * 3));
    g.setAttribute('aTile', new THREE.InstancedBufferAttribute(tiles, 3));
    const m = new THREE.InstancedMesh(g, matBloco, itens.length);
    itens.forEach((it, i) => {
      m.setColorAt(i, cor.setHex(it.c ?? 0xffffff));
      tmp.position.set(...it.p); tmp.rotation.set(0, 0, 0); tmp.scale.setScalar(mostrar ? 1 : 0.0001); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix);
    });
    m.frustumCulled = false;
    cena.add(m);
    return m;
  }
  const por = (m, i, x, y, z, s = 1, rx = 0, ry = 0) => { tmp.position.set(x, y, z); tmp.rotation.set(rx, ry, 0); tmp.scale.setScalar(Math.max(0.0001, s)); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix); };
  const esconder = (m, i) => por(m, i, 0, -999, 0, 0.0001);

  // malha comum com textura recortada no tamanho de cada face (para peças menores que um bloco: nada estica)
  function peca(w, h, d, tex, extra = {}) {
    const faces = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]].map(([a, b], i) => {
      const nome = Array.isArray(tex) ? tex[i] : tex;
      const c = typeof nome === 'string' ? recorte(nome, a * 16, b * 16) : nome;
      const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshLambertMaterial({ map: t, ...extra });
    });
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), faces);
  }

  // ---- terreno e árvores
  const blocos = [];
  const r2 = mulberry(5);
  for (let x = -R - 6; x <= R + 6; x++) for (let z = -R - 6; z <= R + 6; z++) {
    const h = H(x, z);
    if (h < 0) continue;
    const viz = Math.min(...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => Math.max(AGUA - 1, H(x + a, z + b))));
    const topo = PRACA.has(k(x, z)) ? 'pedra_tijolo' : h <= AGUA + 1 ? 'areia' : h > AGUA + 15 ? 'pedra' : 'grama';
    blocos.push({ p: [x, h, z], b: topo });
    for (let y = Math.min(viz + 1, h - 1); y < h; y++) blocos.push({ p: [x, y, z], b: y < h - 3 || topo === 'pedra' ? 'pedra' : topo === 'areia' ? 'areia' : 'terra' });
  }
  const livre = (x, z) => !(x >= LUGAR.painel[0] - 13 && x <= LUGAR.painel[0] + 13 && z >= LUGAR.painel[1] - 28 && z <= LUGAR.painel[1] + 3);
  const longe = (x, z) => livre(x, z) && Object.values(LUGAR).every(([a, b]) => Math.hypot(x - a, z - b) > 10 && Math.hypot(x - (a + a / (Math.hypot(a, b) || 1) * 10), z - (b + b / (Math.hypot(a, b) || 1) * 10)) > 7);
  for (let i = 0; i < 900; i++) {
    const x = Math.floor((r2() * 2 - 1) * R), z = Math.floor((r2() * 2 - 1) * R), h = H(x, z);
    if (h <= AGUA + 2 || h > AGUA + 13 || !longe(x, z) || fbm(x * 0.09 + 40, z * 0.09) < 0.48) continue;
    // carvalho do jogo: tronco de 4 a 6, duas camadas 5×5 sem os cantos, uma 3×3, uma cruz no alto
    const alto = 4 + Math.floor(r2() * 3), topoY = h + alto;
    for (let y = 1; y <= alto; y++) blocos.push({ p: [x, h + y, z], b: 'tronco' });
    for (const [dy, raio] of [[-1, 2], [0, 2], [1, 1], [2, 1]]) {
      for (let a = -raio; a <= raio; a++) for (let b = -raio; b <= raio; b++) {
        const canto = Math.abs(a) === raio && Math.abs(b) === raio;
        if (canto && (dy === 2 || r2() < 0.6)) continue;
        if (a === 0 && b === 0 && dy <= 0) continue;
        blocos.push({ p: [x + a, topoY + dy, z + b], b: 'folha' });
      }
    }
  }
  malha(blocos);

  // ---- água: ondas em degrau
  const agua = new THREE.Mesh(new THREE.PlaneGeometry(600, 600, 150, 150), new THREE.MeshPhongMaterial({ color: 0x1d3a78, shininess: 70, specular: 0x5a6f99, transparent: true, opacity: 0.9, flatShading: true }));
  agua.rotation.x = -Math.PI / 2;
  agua.position.y = AGUA + 0.38;
  const tempoAgua = { value: 0 };
  agua.material.onBeforeCompile = s => {
    s.uniforms.uT = tempoAgua;
    s.vertexShader = 'uniform float uT;\n' + s.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvec2 q = floor(position.xy / 4.0) * 4.0;\ntransformed.z += (sin(q.x * 0.21 + uT * 0.9) + cos(q.y * 0.17 + uT * 0.7)) * 0.09;');
  };
  cena.add(agua);

  // ---- céu
  const ceu = new THREE.Mesh(new THREE.SphereGeometry(600, 24, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying float vy; void main(){ vy = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying float vy; void main(){ vec3 a = vec3(0.075,0.1,0.16); vec3 b = vec3(0.018,0.024,0.04); gl_FragColor = vec4(mix(a, b, smoothstep(-0.05, 0.5, vy)), 1.0); }',
  }));
  ceu.renderOrder = -1; cena.add(ceu);
  const estrelas = new THREE.BufferGeometry(), pe = [];
  for (let i = 0; i < 900; i++) {
    const t = rnd() * Math.PI * 2, f = Math.acos(rnd() * 0.85), r = 420;
    pe.push(Math.cos(t) * Math.sin(f) * r, Math.cos(f) * r, Math.sin(t) * Math.sin(f) * r);
  }
  estrelas.setAttribute('position', new THREE.Float32BufferAttribute(pe, 3));
  cena.add(new THREE.Points(estrelas, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })));
  {
    const t = new THREE.CanvasTexture(texLua()); t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
    const lua = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: false }));
    lua.position.set(-150, 150, -260); lua.lookAt(0, 0, 0); cena.add(lua);
  }
  const brilho = (cor1, tam) => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, cor1); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    s.scale.set(tam, tam, 1); return s;
  };
  { const h = brilho('rgba(170,190,230,0.3)', 130); h.position.set(-150, 150, -260); cena.add(h); }
  const nevoas = [];
  for (let i = 0; i < 18; i++) {
    const s = brilho('rgba(150,165,190,0.13)', 40 + rnd() * 40);
    s.material.fog = true;
    // só sobre o mar, longe da ilha: perto de um bloco, o plano da névoa corta o bloco numa linha reta
    const ang = rnd() * Math.PI * 2, dist = 62 + rnd() * 40;
    s.position.set(Math.cos(ang) * dist, AGUA + 2 + rnd() * 4, Math.sin(ang) * dist);
    s.userData.v = 0.02 + rnd() * 0.04; nevoas.push(s); cena.add(s);
  }
  cena.add(new THREE.HemisphereLight(0xa9b8da, 0x14171e, 1.05));
  const luar = new THREE.DirectionalLight(0xc4d2ee, 1.35);
  luar.position.set(-60, 90, -80); cena.add(luar);
  cena.add(new THREE.AmbientLight(0x2a3242, 0.55));

  // contorno de seleção do jogo (linhas pretas finas em volta do bloco que se olha)
  const contornoGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004));
  const novoContorno = () => { const l = new THREE.LineSegments(contornoGeo, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.7 })); l.visible = false; cena.add(l); return l; };

  const cenas = {};

  // 1. CONSTRUÇÃO: casa de pedregulho, tábua, tronco e vidro, posta bloco a bloco
  {
    const [cx, cz] = LUGAR.casa, y0 = chao(cx, cz);
    const L = [];
    for (let y = 0; y <= 6; y++) for (let x = -3; x <= 3; x++) for (let z = -2; z <= 2; z++) {
      const borda = Math.abs(x) === 3 || Math.abs(z) === 2, canto = Math.abs(x) === 3 && Math.abs(z) === 2;
      let b = null;
      if (y === 0) b = 'pedregulho';
      else if (y <= 3 && borda) {
        if (canto) b = 'tronco';
        else if (z === 2 && x === 0 && y <= 2) b = null;
        else if (y === 2 && (Math.abs(x) === 1 || (Math.abs(x) === 3 && z === 0))) b = 'vidro';
        else b = 'tabua';
      } else if (y === 4) b = Math.abs(z) === 2 || Math.abs(x) === 3 ? 'tronco' : 'tabua';
      else if (y === 5 && Math.abs(z) <= 1 && Math.abs(x) <= 3) b = 'tabua';
      else if (y === 6 && z === 0 && Math.abs(x) <= 3) b = 'tronco';
      if (b) L.push({ p: [cx + x, y0 + y, cz + z], b });
    }
    L.sort((a, b) => a.p[1] - b.p[1] || Math.atan2(a.p[2] - cz, a.p[0] - cx) - Math.atan2(b.p[2] - cz, b.p[0] - cx));
    const m = malha(L, { mostrar: false });
    const contorno = novoContorno();
    // tocha ao lado da porta, acesa quando a casa termina
    const tocha = new THREE.Group();
    const cabo = peca(2 / 16, 10 / 16, 2 / 16, 'tronco'); cabo.position.y = 5 / 16; tocha.add(cabo);
    const chama = new THREE.Mesh(new THREE.BoxGeometry(2.2 / 16, 2.2 / 16, 2.2 / 16), new THREE.MeshBasicMaterial({ color: 0xffd36b })); chama.position.y = 11 / 16; tocha.add(chama);
    tocha.position.set(cx + 1, y0 + 1.5 - 0.5, cz + 2.6); tocha.visible = false; cena.add(tocha);
    const luzTocha = new THREE.PointLight(0xffb45a, 0, 9, 1.6); luzTocha.position.set(cx + 1, y0 + 2.4, cz + 3); cena.add(luzTocha);
    cenas.casa = {
      alvo: [cx, y0 + 3, cz], camera: vistaDe(cx, cz, y0, 13, 7, -8),
      aplicar(p) {
        const n = L.length, f = p * n * 1.04;
        L.forEach((b, i) => {
          const t = clamp(f - i);
          if (t <= 0) return esconder(m, i);
          por(m, i, ...b.p, 0.86 + 0.14 * saida(clamp(t * 3)));
        });
        m.instanceMatrix.needsUpdate = true;
        const prox = L[Math.floor(f)];
        contorno.visible = p > 0.01 && !!prox;
        if (prox) contorno.position.set(...prox.p);
        tocha.visible = p > 0.98; luzTocha.intensity = p > 0.98 ? 8 : 0;
      },
    };
  }

  // 2. ARTE: parede de lã branca, pintada com as cores de lã do jogo
  {
    const [cx, cz] = LUGAR.mural, y0 = chao(cx, cz);
    const PIX = [
      'aaaaaaaaaaaaaa',
      'aaaawwaaaaayya',
      'aawwwwwaaaayya',
      'aaaaaaaaaaaaaa',
      'aaaaaagglaaaaa',
      'aaaaagllllgaaa',
      'cccggllmllggcc',
      'ccbbbbbbbbbbbc',
      'bbbbbbcbbbbbbb',
    ];
    const pal = { a: LA.azulClara, w: LA.branca, y: LA.amarela, g: LA.verde, l: LA.lima, m: LA.marrom, c: LA.ciano, b: LA.azul };
    const L = [];
    PIX.forEach((linha, j) => [...linha].forEach((ch, i) => L.push({ p: [cx - 7 + i, y0 + 8 - j, cz], b: 'la', c: LA.branca, alvo: pal[ch], ord: i + j * 0.8 })));
    for (let i = -1; i <= 14; i++) { L.push({ p: [cx - 7 + i, y0 - 1, cz], b: 'tronco', fixo: 1 }); L.push({ p: [cx - 7 + i, y0 + 9, cz], b: 'tronco', fixo: 1 }); }
    for (let j = 0; j <= 8; j++) { L.push({ p: [cx - 8, y0 + j, cz], b: 'tronco', fixo: 1 }); L.push({ p: [cx + 7, y0 + j, cz], b: 'tronco', fixo: 1 }); }
    const m = malha(L);
    const branco = new THREE.Color(LA.branca), final = new THREE.Color();
    const maxOrd = Math.max(...L.filter(b => !b.fixo).map(b => b.ord));
    cenas.mural = {
      alvo: [cx, y0 + 4.5, cz], camera: [cx + 2, y0 + 6, cz + 17],
      aplicar(p) {
        m.visible = p > 0.001;
        L.forEach((b, i) => {
          if (b.fixo) return;
          const t = clamp((p * 1.15 * (maxOrd + 3) - b.ord) / 2);
          final.setHex(b.alvo);
          m.setColorAt(i, t >= 0.5 ? final : branco);
          por(m, i, ...b.p, t > 0.5 && t < 1 ? 1 + 0.06 * Math.sin((t - 0.5) * 2 * Math.PI) : 1);
        });
        m.instanceColor.needsUpdate = true; m.instanceMatrix.needsUpdate = true;
      },
    };
  }

  // 3. MODELAGEM: o modelo do lobo, caixa por caixa como num editor de modelos: primeiro o contorno, depois o pelo, depois gira
  {
    const [cx, cz] = LUGAR.lobo, y0 = chao(cx, cz);
    const base = [];
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) base.push({ p: [cx + x, y0, cz + z], b: 'pedra_tijolo' });
    malha(base);
    const S = 0.2; // tamanho de um pixel do modelo, em blocos
    // [largura, altura, profundidade, centro x, y, z] em pixels; rotação x opcional (cauda)
    const CAIXAS = [
      [2, 7, 2, -1.5, 3.5, 3, 0, 'pelo_escuro'], [2, 7, 2, 1.5, 3.5, 3, 0, 'pelo_escuro'],
      [2, 7, 2, -1.5, 3.5, -5, 0, 'pelo_escuro'], [2, 7, 2, 1.5, 3.5, -5, 0, 'pelo_escuro'],
      [6, 6, 11, 0, 10, -1.5], [8, 7, 5, 0, 10.5, 3.5],
      [6, 6, 5, 0, 12.5, 8.5, 0, 'cabeca'], [3, 3, 3, 0, 11, 12.5, 0, 'focinho'],
      [2, 2, 1, -2, 16.5, 8, 0, 'pelo_escuro'], [2, 2, 1, 2, 16.5, 8, 0, 'pelo_escuro'],
      [2, 7, 2, 0, 9.5, -8.5, 0.9],
    ];
    const modelo = new THREE.Group();
    modelo.position.set(cx, y0 + 0.5, cz);
    modelo.rotation.y = -0.55; // de lado para a câmera, um pouco virado para ela
    cena.add(modelo);
    const pecas = CAIXAS.map(([w, h, d, x, y, z, rx = 0, tipo = 'pelo']) => {
      let tex = tipo === 'pelo_escuro' ? 'pelo_escuro' : 'pelo';
      if (tipo === 'cabeca' || tipo === 'focinho') {
        const frente = recorte('pelo', w * 16 * S, h * 16 * S);
        const g = frente.getContext('2d'), e = frente.width / w;
        g.fillStyle = '#1d1a17';
        if (tipo === 'cabeca') { g.fillRect(1 * e, 2 * e, e, e); g.fillRect(4 * e, 2 * e, e, e); } else g.fillRect(1 * e, 0, e, e);
        tex = ['pelo', 'pelo', 'pelo', 'pelo', frente, 'pelo'];
      }
      const m = peca(w * S, h * S, d * S, tex);
      m.position.set(x * S, y * S, z * S); m.rotation.x = rx;
      const arame = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0x9ff6ff }));
      arame.position.copy(m.position); arame.rotation.copy(m.rotation);
      m.visible = false; arame.visible = false;
      modelo.add(m, arame);
      return { m, arame };
    });
    let pGiro = 0;
    cenas.lobo = {
      alvo: [cx, y0 + 2.4, cz], camera: [cx + 7, y0 + 4, cz + 6],
      aplicar(p) {
        const n = pecas.length, a = clamp(p / 0.4) * n, s = clamp((p - 0.4) / 0.4) * n;
        pecas.forEach((pc, i) => {
          pc.arame.visible = i < a && p < 0.9;
          pc.m.visible = i < s;
          const t = clamp(s - i);
          pc.m.scale.setScalar(0.9 + 0.1 * saida(clamp(t * 3)));
        });
        pGiro = p;
      },
      quadro(t, dt) { if (pGiro > 0.85 && !calmo) modelo.rotation.y += dt * 0.5; },
    };
  }

  // 4. LORE: púlpito com livro aberto, fogueira, e as letras voando para o livro como numa mesa de encantamento
  {
    const [cx, cz] = LUGAR.livro, y0 = chao(cx, cz) - 0.5;
    const pulpito = new THREE.Group();
    const base = peca(1, 2 / 16, 1, 'tabua'); base.position.y = 1 / 16; pulpito.add(base);
    const coluna = peca(8 / 16, 13 / 16, 8 / 16, 'tronco'); coluna.position.y = 2 / 16 + 6.5 / 16; pulpito.add(coluna);
    const tampo = peca(1, 4 / 16, 13 / 16, 'tabua'); tampo.position.set(0, 15 / 16 + 2 / 16, 0); tampo.rotation.x = -0.39; pulpito.add(tampo);
    const pagE = peca(7 / 16, 1 / 16, 10 / 16, 'pagina'), pagD = peca(7 / 16, 1 / 16, 10 / 16, 'pagina');
    pagE.position.set(-3.6 / 16, 1.32, 0.02); pagE.rotation.set(-0.39, 0, 0.12);
    pagD.position.set(3.6 / 16, 1.32, 0.02); pagD.rotation.set(-0.39, 0, -0.12);
    pulpito.add(pagE, pagD);
    pulpito.position.set(cx, y0, cz); pulpito.rotation.y = Math.atan2(cx, cz); cena.add(pulpito);
    // fogueira: quatro troncos cruzados e a chama em dois planos
    const fx = cx + 2.6, fz = cz + 1.8;
    const fogueira = new THREE.Group();
    [[0, 4 / 16, 0, 0], [0, 4 / 16, 0, 0], [0, 7 / 16, 0, Math.PI / 2], [0, 7 / 16, 0, Math.PI / 2]].forEach(([x, y, z, ry], i) => {
      const t = peca(4 / 16, 4 / 16, 1, 'tronco'); t.position.set(i % 2 ? 0.3 : -0.3, y - 2 / 16, 0); const g = new THREE.Group(); g.rotation.y = ry; g.add(t); fogueira.add(g);
    });
    const quadros = chamas().map(c => { const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t; });
    const matFogo = new THREE.MeshBasicMaterial({ map: quadros[0], transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
    [0, Math.PI / 2].forEach(ry => { const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), matFogo); pl.position.y = 0.75; pl.rotation.y = ry + 0.78; fogueira.add(pl); });
    fogueira.position.set(fx, y0, fz); cena.add(fogueira);
    const fogo = new THREE.PointLight(0xff8a3a, 9, 9, 1.8); fogo.position.set(fx, y0 + 1.6, fz); cena.add(fogo);
    // letras: glifos de pixel feitos ao acaso (não são de nenhum alfabeto de verdade)
    const livroPos = new THREE.Vector3(cx, y0 + 1.4, cz);
    const glifos = [];
    for (let i = 0; i < 28; i++) {
      const c = document.createElement('canvas'); c.width = c.height = 8;
      const g = c.getContext('2d'), r = mulberry(300 + i);
      g.fillStyle = '#ffffff';
      for (let y = 1; y < 7; y++) for (let x = 1; x < 6; x++) if (r() < 0.42) g.fillRect(x, y, 1, 1);
      const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, color: 0xd9f4ff }));
      s.scale.set(0.16, 0.16, 1);
      s.userData = { a: rnd() * 6.28, r: 1.5 + rnd() * 1.5, h: 0.4 + rnd() * 1.8, fase: rnd() };
      glifos.push(s); cena.add(s);
    }
    let quadroFogo = 0;
    cenas.livro = {
      alvo: [cx + 1.2, y0 + 1.2, cz + 0.8], camera: vistaDe(cx, cz, y0, 6, 2.8, 2.5),
      p: 0,
      aplicar(p) { this.p = p; },
      quadro(t) {
        fogo.intensity = 8 + Math.sin(t * 13) * 1 + Math.sin(t * 7.3) * 1.2;
        const q = Math.floor(t * 7) % 2; if (q !== quadroFogo) { quadroFogo = q; matFogo.map = quadros[q]; }
        glifos.forEach((s, i) => {
          const u = s.userData, ciclo = (t * 0.35 + u.fase) % 1;
          const on = this.p > i / glifos.length * 0.9;
          const de = new THREE.Vector3(cx + Math.cos(u.a) * u.r, y0 + 1.2 + u.h, cz + Math.sin(u.a) * u.r);
          s.position.copy(de).lerp(livroPos, saida(ciclo));
          s.material.opacity = on ? Math.sin(ciclo * Math.PI) * 0.95 : 0;
        });
      },
    };
  }

  // 5. ORGANIZAÇÃO: estantes soltas no chão (girando, como item caído) vão uma a uma para a parede
  {
    const [cx, cz] = LUGAR.ordem, y0 = chao(cx, cz);
    const vagas = [];
    for (let y = 0; y < 3; y++) for (let x = -2; x <= 2; x++) vagas.push({ p: [cx + x, y0 + y, cz - 1], b: 'estante' });
    const parede = malha(vagas, { mostrar: false });
    const r = mulberry(42);
    const itens = vagas.map((v, i) => ({ p: [cx - 5 + r() * 10, y0 - 0.25, cz + 2.5 + r() * 5], b: 'estante', fase: r() * 6, ord: i }));
    const soltos = malha(itens);
    const contorno = novoContorno();
    let pOrdem = 0;
    cenas.ordem = {
      alvo: [cx, y0 + 1.4, cz + 1.8], camera: [cx + 2, y0 + 4, cz + 10.5],
      aplicar(p) { pOrdem = p; },
      quadro(t) {
        const f = pOrdem * vagas.length * 1.05;
        itens.forEach((it, i) => {
          const voo = clamp(f - i), v = vagas[i];
          if (voo >= 1) { esconder(soltos, i); por(parede, i, ...v.p, 0.88 + 0.12 * saida(clamp((f - i - 1) * 3 + 1))); return; }
          esconder(parede, i);
          const bob = Math.sin(t * 2 + it.fase) * 0.08;
          const x = it.p[0] + (v.p[0] - it.p[0]) * suave(voo), z = it.p[2] + (v.p[2] - it.p[2]) * suave(voo);
          const y = it.p[1] + bob + (v.p[1] - it.p[1]) * suave(voo) + Math.sin(voo * Math.PI) * 2;
          por(soltos, i, x, y, z, 0.38 + 0.62 * suave(voo), 0, t * 1.2 + it.fase);
        });
        soltos.instanceMatrix.needsUpdate = true; parede.instanceMatrix.needsUpdate = true;
        const prox = vagas[Math.floor(f)];
        contorno.visible = pOrdem > 0.01 && pOrdem < 0.99 && !!prox;
        if (prox) contorno.position.set(...prox.p);
      },
    };
  }

  // 6. SINALIZADOR no alto do morro, sobre a base de ferro
  const [tx, tz] = LUGAR.topo;
  let ty = 0;
  for (let x = tx - 3; x <= tx + 3; x++) for (let z = tz - 3; z <= tz + 3; z++) ty = Math.max(ty, H(x, z));
  {
    const L = [];
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) {
      for (let y = H(tx + x, tz + z) + 1; y <= ty; y++) L.push({ p: [tx + x, y, tz + z], b: 'pedra' });
      L.push({ p: [tx + x, ty + 1, tz + z], b: 'ferro' });
    }
    L.push({ p: [tx, ty + 2, tz], b: 'sinalizador' });
    malha(L);
  }
  const matFeixe = new THREE.MeshBasicMaterial({ color: 0xbff8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const feixe = new THREE.Mesh(new THREE.BoxGeometry(0.4, 400, 0.4), matFeixe);
  const feixe2 = new THREE.Mesh(new THREE.BoxGeometry(0.75, 400, 0.75), matFeixe.clone());
  feixe.position.set(tx, ty + 2.5 + 200, tz); feixe2.position.copy(feixe.position); cena.add(feixe, feixe2);
  const luzSinal = new THREE.PointLight(0x9ff6ff, 0, 30, 1.5); luzSinal.position.set(tx, ty + 4, tz); cena.add(luzSinal);
  let aceso = 0, acesoAlvo = 0;
  cenas.sinal = { alvo: [tx - 11, ty + 12, tz - 9.5], camera: [tx - 38, ty + 4, tz + 44], aplicar(p) { acesoAlvo = Math.max(acesoAlvo, p > 0.35 ? 1 : 0); } };

  // ---- pilares do painel: um por área, cada um de um bloco do jogo, na praça de tijolo de pedra
  const MAX = 24;
  const pilares = [];
  let pilarM = null, contagem = null;
  const [px, pz] = LUGAR.painel, ph = chao(px, pz);
  cenas.painel = { alvo: [px, ph + 3.5, pz], camera: [px - 1.5, ph + 5, pz - 13.5], aplicar() {} };
  function montarPilares(ids) {
    const tipos = ['tijolo', 'la', 'argila', 'estante', 'barril'];
    const arcoIris = [LA.vermelha, LA.laranja, LA.amarela, LA.lima, LA.azulClara, LA.azul, LA.roxa, LA.magenta];
    const L = [];
    ids.forEach((id, i) => {
      const x = px + 6 - i * 3, b = tipos[i % tipos.length];
      pilares.push({ id, x, z: pz, n: 0, mostra: 0, ini: L.length });
      for (let y = 0; y < MAX; y++) L.push({ p: [x, ph + y, pz], b, c: b === 'la' ? arcoIris[y % arcoIris.length] : 0xffffff });
    });
    pilarM = malha(L, { mostrar: false });
  }

  // ---------------------------------------------------------------- câmera
  const camPos = new THREE.Vector3(70, 40, 80), camAlvo = new THREE.Vector3(0, 10, 0);
  const destinoPos = camPos.clone(), destinoAlvo = camAlvo.clone();
  const mouse = { x: 0, y: 0 };
  addEventListener('pointermove', e => { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; }, { passive: true });
  const CAMINHO = { geral: { camera: [52, 24, 60], alvo: [0, 9, 0] } };
  let caminho = null;
  function definirCaminho(nomes, op = {}) {
    if (nomes.length === 1) nomes = [nomes[0], nomes[0]];
    let ps = nomes.map(n => new THREE.Vector3(...(CAMINHO[n] || cenas[n]).camera));
    let as = nomes.map(n => new THREE.Vector3(...(CAMINHO[n] || cenas[n]).alvo));
    if (op.alto) {
      const ps2 = [], as2 = [];
      ps.forEach((p, i) => {
        ps2.push(p); as2.push(as[i]);
        if (i < ps.length - 1) {
          const m = p.clone().lerp(ps[i + 1], 0.5); m.y = Math.max(p.y, ps[i + 1].y) + 16;
          ps2.push(m); as2.push(as[i].clone().lerp(as[i + 1], 0.5));
        }
      });
      ps = ps2; as = as2;
    }
    caminho = { nomes, pos: new THREE.CatmullRomCurve3(ps, false, 'centripetal'), alvo: new THREE.CatmullRomCurve3(as, false, 'centripetal') };
  }
  let progresso = 0, orbita = null;

  // ---------------------------------------------------------------- tamanho, qualidade automática e laço
  function medir() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setPixelRatio(pr());
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.fov = w / h < 1 ? 72 : 52; camera.updateProjectionMatrix();
  }
  medir();
  addEventListener('resize', medir);

  let somaQuadros = 0, nQuadros = 0, ultimoQuadro = 0;
  let rodando = true, t0 = performance.now(), tAnterior = 0;
  document.addEventListener('visibilitychange', () => { rodando = !document.hidden; ultimoQuadro = 0; if (rodando) requestAnimationFrame(laco); });
  function laco(agora) {
    if (!rodando) return;
    const t = (agora - t0) / 1000, dt = Math.min(0.1, t - tAnterior); tAnterior = t;
    tempoAgua.value = t;
    for (const c of Object.values(cenas)) if (c.quadro) c.quadro(t, dt);

    if (orbita) {
      const a = t * orbita.vel + orbita.fase;
      destinoPos.set(orbita.c[0] + Math.cos(a) * orbita.r, orbita.c[1] + orbita.h, orbita.c[2] + Math.sin(a) * orbita.r);
      destinoAlvo.set(...orbita.c);
    } else if (caminho) {
      const u = clamp(progresso);
      destinoPos.copy(caminho.pos.getPoint(u)); destinoAlvo.copy(caminho.alvo.getPoint(u));
    }
    const suavidade = calmo ? 1 : 0.06;
    camPos.lerp(destinoPos, suavidade); camAlvo.lerp(destinoAlvo, suavidade);
    camera.position.copy(camPos);
    if (!calmo) { camera.position.x += mouse.x * 1.2; camera.position.y -= mouse.y * 0.7; camera.position.y += Math.sin(t * 0.4) * 0.12; }
    camera.lookAt(camAlvo);

    aceso += (acesoAlvo - aceso) * 0.03;
    feixe.material.opacity = aceso * 0.85;
    feixe2.material.opacity = aceso * 0.25;
    feixe.rotation.y = feixe2.rotation.y = t * 0.6;
    const alto = Math.max(0.001, saida(clamp(aceso * 1.3)));
    feixe.scale.y = feixe2.scale.y = alto;
    feixe.position.y = feixe2.position.y = ty + 2.5 + 200 * alto;
    luzSinal.intensity = aceso * 40;

    if (pilarM && contagem) {
      const maior = Math.max(1, ...pilares.map(pl => contagem[pl.id] || 0));
      const porBloco = Math.max(1, Math.ceil(maior / MAX));
      pilares.forEach(pl => {
        pl.n = Math.min(MAX, Math.ceil((contagem[pl.id] || 0) / porBloco));
        pl.mostra = Math.min(pl.n, pl.mostra + dt * 6); // seis blocos por segundo, um de cada vez
        for (let y = 0; y < MAX; y++) {
          const t2 = clamp(pl.mostra - y);
          if (t2 <= 0) esconder(pilarM, pl.ini + y);
          else por(pilarM, pl.ini + y, pl.x, ph + y, pl.z, 0.86 + 0.14 * saida(t2));
        }
      });
      pilarM.instanceMatrix.needsUpdate = true;
    }

    renderer.render(cena, camera);
    if (ultimoQuadro) { somaQuadros += agora - ultimoQuadro; nQuadros++; }
    ultimoQuadro = agora;
    if (nQuadros >= 90) {
      if (somaQuadros / nQuadros > 25 && qualidade < QUALIDADES.length - 1) { qualidade++; medir(); }
      somaQuadros = 0; nQuadros = 0;
    }
    requestAnimationFrame(laco);
  }
  for (const c of Object.values(cenas)) c.aplicar(0);
  requestAnimationFrame(laco);

  const projetar = (x, y, z) => {
    const v = new THREE.Vector3(x, y, z).project(camera);
    return { x: (v.x + 1) / 2 * (canvas.clientWidth || innerWidth), y: (1 - v.y) / 2 * (canvas.clientHeight || innerHeight), atras: v.z > 1 };
  };

  return {
    definirCaminho,
    progresso(p) { progresso = p; },
    cena(nome, p) { if (cenas[nome]) cenas[nome].aplicar(clamp(p)); },
    acender() { acesoAlvo = 1; },
    orbitar(nome, r = 22, h = 9, vel = 0.03) { const c = cenas[nome] ? cenas[nome].alvo : nome; orbita = { c, r, h, vel, fase: 0.8 }; },
    olhar(nome) { orbita = null; caminho = null; destinoPos.set(...cenas[nome].camera); destinoAlvo.set(...cenas[nome].alvo); },
    torres(ids) { montarPilares(ids); },
    contagem(c) { contagem = c; },
    rotuloTorres() { return pilares.map(pl => ({ id: pl.id, ...projetar(pl.x, ph + Math.max(pl.mostra, 0) + 0.2, pl.z) })); },
    completar() { for (const [n, c] of Object.entries(cenas)) if (n !== 'sinal') c.aplicar(1); },
  };
}
