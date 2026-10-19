/*
 * A ilha em blocos, feita inteira por código (nenhuma imagem do jogo, nada da história).
 * Uma InstancedMesh para o terreno, e uma para cada cena que se monta com a rolagem:
 * casa (construção), mural (arte), lobo (modelagem), livro e fogueira (lore), estante (organização),
 * sinalizador (final) e as torres do painel ao vivo.
 */
import * as THREE from './vendor/three.module.min.js';

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

// ---------------------------------------------------------------- cores dos blocos (noite: tudo um pouco apagado)
const COR = {
  grama: 0x4d6e3c, terra: 0x5e4532, pedra: 0x6d7177, areia: 0xb3a479, tronco: 0x4a3622, folha: 0x27452b,
  tabua: 0x8b6b44, pedregulho: 0x74777b, vidro: 0xa8d4e6, la: 0xd9d6cf, ferro: 0xc9ccd1, sinal: 0x9ff6ff,
  livro: 0xe9dcc0, capa: 0x5a2b1e, brasa: 0xff8a3a, lobo: 0x9c9b97, lobo2: 0x6f6d69, loboClaro: 0xd8d4cb, cinza: 0x3a3a3a,
};

// textura de bloco: 16×16 de ruído, multiplicada pela cor de cada bloco
function texturaBloco() {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const g = c.getContext('2d'), r = mulberry(77);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = 150 + Math.floor(r() * 105);
    g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------- terreno
const R = 42, AGUA = 4;
const LUGAR = { casa: [-24, 6], mural: [14, 18], lobo: [25, 5], livro: [-10, -20], ordem: [-6, 22], painel: [-22, -11], topo: [6, -4] };
// câmera de cada cena: de fora da ilha para dentro, um pouco de lado
function vistaDe(cx, cz, y, dist, alto, lado = 0) {
  const d = Math.hypot(cx, cz) || 1, ox = cx / d, oz = cz / d;
  return [cx + ox * dist - oz * lado, y + alto, cz + oz * dist + ox * lado];
}
const alt = new Map();
const k = (x, z) => x + ',' + z;
function alturaBruta(x, z) {
  const d = Math.hypot(x * 1.0, z * 1.15) / R;
  const costa = 1 - d * 1.08 + (fbm(x * 0.07 + 10, z * 0.07 + 3) - 0.5) * 0.55;
  if (costa < 0) return -1;
  const morro = 13 * Math.exp(-((x - LUGAR.topo[0]) ** 2 + (z - LUGAR.topo[1]) ** 2) / 140);
  return AGUA + 1 + Math.floor(costa * 9 + fbm(x * 0.12, z * 0.12) * 6 * clamp(costa * 2) + morro);
}
for (let x = -R - 6; x <= R + 6; x++) for (let z = -R - 6; z <= R + 6; z++) alt.set(k(x, z), alturaBruta(x, z));
// achata em volta de cada cena, para a construção não flutuar
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
const chao = (x, z) => H(x, z) + 1; // primeiro bloco livre em cima

// ---------------------------------------------------------------- montagem
export function criarMundo(canvas, opcoes = {}) {
  const movel = matchMedia('(max-width: 860px)').matches;
  const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // pixels grandes: renderiza pequeno e amplia sem suavizar. Se a máquina não aguentar, os pixels crescem sozinhos.
  let ESCALA = opcoes.escala || (movel ? 2.4 : 2.6);
  const ESCALA_MAX = 5;
  let somaQuadros = 0, nQuadros = 0, ultimoQuadro = 0;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const cena = new THREE.Scene();
  const CEU = new THREE.Color(0x080b12);
  cena.background = CEU;
  cena.fog = new THREE.Fog(0x0b1019, 45, 175);
  const camera = new THREE.PerspectiveCamera(52, 1, 0.5, 900);

  const tex = texturaBloco();
  // sombra de face assada, como no jogo: topo claro, laterais mais escuras, fundo escuro
  const caixa = new THREE.BoxGeometry(1, 1, 1);
  {
    const sombras = [0.62, 0.62, 1.0, 0.45, 0.8, 0.8], cs = [];
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) cs.push(sombras[f], sombras[f], sombras[f]);
    caixa.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3));
  }
  const material = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true });
  const tmp = new THREE.Object3D(), cor = new THREE.Color();

  // ---- terreno e árvores, numa malha só
  const blocos = [];
  const variar = (hex, r) => cor.setHex(hex).multiplyScalar(0.86 + r * 0.2).clone();
  const r2 = mulberry(5);
  for (let x = -R - 6; x <= R + 6; x++) for (let z = -R - 6; z <= R + 6; z++) {
    const h = H(x, z);
    if (h < 0) continue;
    const viz = Math.min(...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => Math.max(AGUA - 1, H(x + a, z + b))));
    const topo = h <= AGUA + 1 ? COR.areia : h > AGUA + 15 ? COR.pedra : COR.grama;
    blocos.push([x, h, z, variar(topo, r2())]);
    for (let y = Math.min(viz + 1, h - 1); y < h; y++) blocos.push([x, y, z, variar(y < h - 3 || topo === COR.pedra ? COR.pedra : topo === COR.areia ? COR.areia : COR.terra, r2())]);
  }
  // nada de árvore entre a câmera do painel e as torres
  const livre = (x, z) => !(x >= LUGAR.painel[0] - 13 && x <= LUGAR.painel[0] + 13 && z >= LUGAR.painel[1] - 28 && z <= LUGAR.painel[1] + 3);
  const longe = (x, z) => livre(x, z) && Object.values(LUGAR).every(([a, b]) => Math.hypot(x - a, z - b) > 10 && Math.hypot(x - (a + a / (Math.hypot(a, b) || 1) * 10), z - (b + b / (Math.hypot(a, b) || 1) * 10)) > 7);
  for (let i = 0; i < 900; i++) {
    const x = Math.floor((r2() * 2 - 1) * R), z = Math.floor((r2() * 2 - 1) * R), h = H(x, z);
    if (h <= AGUA + 2 || h > AGUA + 13 || !longe(x, z) || fbm(x * 0.09 + 40, z * 0.09) < 0.48) continue;
    const alto = 4 + Math.floor(r2() * 4);
    for (let y = 1; y <= alto; y++) blocos.push([x, h + y, z, variar(COR.tronco, r2())]);
    for (let y = 2; y <= alto + 1; y++) {
      const raio = y > alto ? 0 : Math.max(0, Math.round((alto + 1 - y) * 0.45));
      for (let a = -raio; a <= raio; a++) for (let b = -raio; b <= raio; b++) {
        if ((a || b) && Math.abs(a) + Math.abs(b) <= raio + (y % 2) && !(a === 0 && b === 0 && y <= alto)) blocos.push([x + a, h + y, z + b, variar(COR.folha, r2())]);
      }
      if (y > alto) blocos.push([x, h + y, z, variar(COR.folha, r2())]);
    }
  }
  const terreno = new THREE.InstancedMesh(caixa, material, blocos.length);
  blocos.forEach(([x, y, z, c], i) => { tmp.position.set(x, y, z); tmp.updateMatrix(); terreno.setMatrixAt(i, tmp.matrix); terreno.setColorAt(i, c); });
  cena.add(terreno);

  // ---- água: ondas em degrau, para combinar com os blocos
  const agua = new THREE.Mesh(new THREE.PlaneGeometry(600, 600, 150, 150), new THREE.MeshPhongMaterial({ color: 0x0c2133, shininess: 60, specular: 0x6688aa, transparent: true, opacity: 0.94, flatShading: true }));
  agua.rotation.x = -Math.PI / 2;
  agua.position.y = AGUA + 0.35;
  const tempoAgua = { value: 0 };
  agua.material.onBeforeCompile = s => {
    s.uniforms.uT = tempoAgua;
    s.vertexShader = 'uniform float uT;\n' + s.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvec2 q = floor(position.xy / 4.0) * 4.0;\ntransformed.z += (sin(q.x * 0.21 + uT * 0.9) + cos(q.y * 0.17 + uT * 0.7)) * 0.16;');
  };
  cena.add(agua);

  // ---- céu: estrelas, lua quadrada, nuvens em placas
  const estrelas = new THREE.BufferGeometry(), pe = [];
  for (let i = 0; i < 900; i++) {
    const t = rnd() * Math.PI * 2, f = Math.acos(rnd() * 0.85), r = 420;
    pe.push(Math.cos(t) * Math.sin(f) * r, Math.cos(f) * r, Math.sin(t) * Math.sin(f) * r);
  }
  estrelas.setAttribute('position', new THREE.Float32BufferAttribute(pe, 3));
  cena.add(new THREE.Points(estrelas, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })));
  const lua = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshBasicMaterial({ color: 0xe9eef5, fog: false }));
  lua.position.set(-150, 150, -260); lua.lookAt(0, 0, 0); cena.add(lua);
  const brilho = (cor1, tam) => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, cor1); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    s.scale.set(tam, tam, 1); return s;
  };
  const halo = brilho('rgba(170,190,230,0.35)', 140); halo.position.copy(lua.position); cena.add(halo);
  const nuvens = new THREE.Group();
  const matNuvem = new THREE.MeshBasicMaterial({ color: 0x1b2232, transparent: true, opacity: 0.55, fog: true, depthWrite: false });
  for (let i = 0; i < 26; i++) {
    const n = new THREE.Mesh(new THREE.BoxGeometry(12 + rnd() * 30, 3, 8 + rnd() * 18), matNuvem);
    n.position.set((rnd() * 2 - 1) * 220, 62 + rnd() * 10, (rnd() * 2 - 1) * 220); nuvens.add(n);
  }
  cena.add(nuvens);

  // ---- névoa rente ao mar
  const nevoas = [];
  for (let i = 0; i < 22; i++) {
    const s = brilho('rgba(150,165,190,0.16)', 40 + rnd() * 40);
    s.material.fog = true;
    s.position.set((rnd() * 2 - 1) * 70, AGUA + 2 + rnd() * 4, (rnd() * 2 - 1) * 70);
    s.userData.v = 0.02 + rnd() * 0.04; nevoas.push(s); cena.add(s);
  }

  // ---- luz
  // céu em degradê: horizonte azulado, alto quase preto
  const ceu = new THREE.Mesh(new THREE.SphereGeometry(600, 24, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying float vy; void main(){ vy = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying float vy; void main(){ vec3 a = vec3(0.075,0.1,0.16); vec3 b = vec3(0.018,0.024,0.04); gl_FragColor = vec4(mix(a, b, smoothstep(-0.05, 0.5, vy)), 1.0); }',
  }));
  ceu.renderOrder = -1; cena.add(ceu);
  cena.add(new THREE.HemisphereLight(0x9fb0d4, 0x10131a, 1.1));
  const luar = new THREE.DirectionalLight(0xc4d2ee, 1.5);
  luar.position.set(-60, 90, -80); cena.add(luar);
  cena.add(new THREE.AmbientLight(0x202838, 0.6));

  // ---------------------------------------------------------------- cenas que se montam
  const cenas = {};
  function montavel(lista, mat = material) {
    const m = new THREE.InstancedMesh(caixa, mat, lista.length);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // tábuas em faixas alternadas, para se ler como madeira e não como uma caixa lisa
    lista.forEach((b, i) => { m.setColorAt(i, cor.setHex(b.c).multiplyScalar((0.9 + rnd() * 0.15) * (b.c === COR.tabua && b.p && b.p[1] % 2 ? 0.82 : 1))); });
    m.frustumCulled = false;
    cena.add(m);
    return m;
  }
  const esconder = (m, i) => { tmp.position.set(0, -999, 0); tmp.scale.setScalar(0.0001); tmp.rotation.set(0, 0, 0); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix); };

  // 1. CONSTRUÇÃO: casa de 7×5 subindo bloco a bloco, com o contorno de seleção no próximo
  {
    const [cx, cz] = LUGAR.casa, y0 = chao(cx, cz);
    const L = [];
    for (let y = 0; y <= 6; y++) for (let x = -3; x <= 3; x++) for (let z = -2; z <= 2; z++) {
      const borda = Math.abs(x) === 3 || Math.abs(z) === 2, canto = Math.abs(x) === 3 && Math.abs(z) === 2;
      let c = null;
      if (y === 0) c = COR.pedregulho;
      else if (y <= 3 && borda) {
        if (canto) c = COR.tronco;
        else if (z === 2 && x === 0 && y <= 2) c = null; // porta
        else if (y === 2 && (x === -2 || x === 2) && Math.abs(z) === 2) c = COR.vidro;
        else c = COR.tabua;
      } else if (y === 4 && (Math.abs(x) <= 3 && Math.abs(z) <= 2)) c = Math.abs(z) === 2 ? COR.tronco : COR.tabua;
      else if (y === 5 && Math.abs(z) <= 1) c = COR.tabua;
      else if (y === 6 && z === 0) c = COR.tronco;
      if (c !== null) L.push({ p: [cx + x, y0 + y, cz + z], c });
    }
    L.sort((a, b) => a.p[1] - b.p[1] || Math.atan2(a.p[2] - cz, a.p[0] - cx) - Math.atan2(b.p[2] - cz, b.p[0] - cx));
    const m = montavel(L);
    const contorno = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)), new THREE.LineBasicMaterial({ color: 0x000000 }));
    cena.add(contorno);
    cenas.casa = {
      alvo: [cx, y0 + 3, cz], camera: vistaDe(cx, cz, y0, 13, 7, -8),
      p: -1,
      aplicar(p) {
        const n = L.length, f = p * n;
        L.forEach((b, i) => {
          const t = clamp(f - i);
          if (t <= 0) return esconder(m, i);
          const e = saida(t);
          tmp.position.set(b.p[0], b.p[1] + (1 - e) * 3, b.p[2]); tmp.scale.setScalar(0.4 + 0.6 * e); tmp.rotation.set(0, 0, 0); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix);
        });
        m.instanceMatrix.needsUpdate = true;
        const prox = L[Math.min(n - 1, Math.ceil(f))];
        contorno.visible = p > 0.01 && p < 0.995;
        if (prox) contorno.position.set(...prox.p);
      },
    };
  }

  // 2. ARTE: mural 14×9 de lã branca, pintado em diagonal (a pintura é uma ilha sob a lua; nada da história)
  {
    const [cx, cz] = LUGAR.mural, y0 = chao(cx, cz);
    const PIX = [
      '..............',
      '.........ww...',
      '...s.....ww...',
      '..............',
      '.s......s.....',
      '......gg......',
      '....ggggg.....',
      'bbbgggggggbbbb',
      'bBbbbbbbbbbBbb',
    ];
    const pal = { '.': 0x3f8fd6, s: 0xffffff, w: 0xffd23f, g: 0x4fae3a, b: 0x1f5fb0, B: 0x6fb4ff };
    const L = [];
    PIX.forEach((linha, j) => [...linha].forEach((ch, i) => L.push({ p: [cx - 7 + i, y0 + 8 - j, cz], c: pal[ch], ord: i + j * 0.8 })));
    // moldura de tronco
    for (let i = -1; i <= 14; i++) { L.push({ p: [cx - 7 + i, y0 - 1 + 0, cz], c: COR.tronco, fixo: 1 }); L.push({ p: [cx - 7 + i, y0 + 9, cz], c: COR.tronco, fixo: 1 }); }
    for (let j = 0; j <= 8; j++) { L.push({ p: [cx - 8, y0 + j, cz], c: COR.tronco, fixo: 1 }); L.push({ p: [cx + 7, y0 + j, cz], c: COR.tronco, fixo: 1 }); }
    const m = montavel(L);
    const branco = new THREE.Color(COR.la), final = new THREE.Color();
    L.forEach((b, i) => { tmp.position.set(...b.p); tmp.scale.setScalar(1); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix); });
    const maxOrd = Math.max(...L.filter(b => !b.fixo).map(b => b.ord));
    cenas.mural = {
      alvo: [cx, y0 + 4.5, cz], camera: [cx + 2, y0 + 6, cz + 17],
      aplicar(p) {
        m.visible = p > 0.001; // a tela em branco só aparece quando a seção chega
        L.forEach((b, i) => {
          if (b.fixo) return;
          const t = clamp((p * 1.15 * (maxOrd + 3) - b.ord) / 3);
          final.setHex(b.c);
          cor.copy(branco).lerp(final, suave(t));
          m.setColorAt(i, cor);
          const pulo = Math.sin(t * Math.PI) * 0.35;
          tmp.position.set(b.p[0], b.p[1], b.p[2] + pulo); tmp.scale.setScalar(1); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix);
        });
        m.instanceColor.needsUpdate = true; m.instanceMatrix.needsUpdate = true;
      },
    };
  }

  // 3. MODELAGEM: um lobo sentado uivando, primeiro em arame, depois sólido
  {
    const [cx, cz] = LUGAR.lobo, y0 = chao(cx, cz);
    const cubos = [];
    const caixaV = (x0, y0_, z0, w, h, d, c) => { for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) for (let z = 0; z < d; z++) cubos.push({ p: [x0 + x, y0_ + y, z0 + z], c }); };
    caixaV(-1, 0, -1, 2, 1, 1, COR.lobo2); caixaV(-1, 0, 2, 2, 1, 1, COR.lobo2);      // patas
    caixaV(-1, 1, -1, 3, 3, 4, COR.lobo);                                            // corpo
    caixaV(-1, 4, 1, 3, 2, 2, COR.loboClaro);                                        // peito
    caixaV(-1, 6, 1, 3, 3, 3, COR.lobo);                                             // cabeça
    caixaV(0, 8, 3, 1, 1, 2, COR.loboClaro); caixaV(0, 9, 3, 1, 1, 1, COR.cinza);    // focinho erguido, ponta escura
    caixaV(-1, 9, 1, 1, 1, 1, COR.lobo2); caixaV(1, 9, 1, 1, 1, 1, COR.lobo2);       // orelhas
    caixaV(0, 1, -2, 1, 1, 1, COR.lobo); caixaV(0, 2, -3, 1, 1, 1, COR.lobo); caixaV(0, 3, -4, 1, 1, 1, COR.lobo2); // cauda erguida
    caixaV(-1, 1, 2, 1, 3, 1, COR.lobo2); caixaV(1, 1, 2, 1, 3, 1, COR.lobo2);       // patas da frente
    cubos.forEach(c => { c.p[0] += cx; c.p[1] += y0; c.p[2] += cz; });
    cubos.sort((a, b) => a.p[1] - b.p[1]);
    const m = montavel(cubos);
    // arame: todas as arestas numa geometria só; revela-se com drawRange
    const arestas = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)).attributes.position.array;
    const pos = new Float32Array(cubos.length * arestas.length);
    cubos.forEach((c, i) => { for (let j = 0; j < arestas.length; j += 3) { pos[i * arestas.length + j] = arestas[j] + c.p[0]; pos[i * arestas.length + j + 1] = arestas[j + 1] + c.p[1]; pos[i * arestas.length + j + 2] = arestas[j + 2] + c.p[2]; } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const arame = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9ff6ff, transparent: true, opacity: 0.85, fog: false }));
    cena.add(arame);
    const porCubo = arestas.length / 3;
    cenas.lobo = {
      alvo: [cx, y0 + 5, cz + 1], camera: [cx + 13, y0 + 6, cz + 8],
      aplicar(p) {
        const a = clamp(p / 0.5), s = clamp((p - 0.45) / 0.5);
        g.setDrawRange(0, Math.floor(a * cubos.length) * porCubo);
        arame.material.opacity = 0.85 * (1 - s * 0.85);
        cubos.forEach((c, i) => {
          const t = clamp(s * cubos.length * 1.2 - i * 1.0, 0, 1);
          if (t <= 0) return esconder(m, i);
          tmp.position.set(...c.p); tmp.scale.setScalar(saida(t)); tmp.rotation.set(0, 0, 0); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix);
        });
        m.instanceMatrix.needsUpdate = true;
      },
    };
  }

  // 4. LORE: púlpito com um livro aberto, fogueira e letras subindo
  {
    const [cx, cz] = LUGAR.livro, y0 = chao(cx, cz);
    const fixos = [
      { p: [cx, y0, cz], c: COR.tabua }, { p: [cx, y0 + 1, cz], c: COR.tabua },
      { p: [cx + 3, y0, cz + 2], c: COR.tronco }, { p: [cx + 4, y0, cz + 2], c: COR.tronco },
    ];
    const m = montavel(fixos);
    fixos.forEach((b, i) => { tmp.position.set(...b.p); tmp.scale.setScalar(1); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix); });
    const folha = new THREE.MeshLambertMaterial({ color: COR.livro, emissive: 0x2a2010 });
    const pagE = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.8), folha), pagD = pagE.clone();
    pagE.position.set(cx - 0.3, y0 + 1.58, cz); pagE.rotation.z = 0.18;
    pagD.position.set(cx + 0.3, y0 + 1.58, cz); pagD.rotation.z = -0.18;
    cena.add(pagE, pagD);
    const brasa = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.9), new THREE.MeshBasicMaterial({ color: COR.brasa }));
    brasa.position.set(cx + 3.5, y0 + 0.6, cz + 2); cena.add(brasa);
    const fogo = new THREE.PointLight(0xff8a3a, 30, 18, 1.6); fogo.position.set(cx + 3.5, y0 + 2, cz + 2); cena.add(fogo);
    const halo2 = brilho('rgba(255,140,60,0.5)', 9); halo2.position.copy(fogo.position); halo2.material.fog = true; cena.add(halo2);
    // letras: glifos de pixel feitos ao acaso (não são de nenhum alfabeto)
    const glifos = [];
    for (let i = 0; i < 26; i++) {
      const c = document.createElement('canvas'); c.width = c.height = 8;
      const g = c.getContext('2d'); g.fillStyle = '#e8f6ff';
      const r = mulberry(300 + i);
      for (let y = 1; y < 7; y++) for (let x = 1; x < 6; x++) if (r() < 0.42) g.fillRect(x, y, 1, 1);
      const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, color: 0xbfefff }));
      s.scale.set(0.42, 0.42, 1); s.userData = { a: rnd() * 6.28, r: 1 + rnd() * 1.6, v: 0.4 + rnd() * 0.6, h: rnd() };
      glifos.push(s); cena.add(s);
    }
    cenas.livro = {
      alvo: [cx + 1.5, y0 + 1.6, cz + 0.8], camera: vistaDe(cx, cz, y0, 8, 4, 3),
      p: 0,
      aplicar(p) { this.p = p; },
      quadro(t) {
        fogo.intensity = 26 + Math.sin(t * 13) * 3 + Math.sin(t * 7.3) * 4;
        halo2.scale.setScalar(8 + Math.sin(t * 11) * 0.6);
        glifos.forEach((s, i) => {
          const u = s.userData, ciclo = (t * 0.18 * u.v + u.h) % 1;
          const on = this.p > i / glifos.length * 0.9;
          s.material.opacity = on ? Math.sin(ciclo * Math.PI) * 0.95 : 0;
          s.position.set(cx + Math.cos(u.a + t * 0.5 * u.v) * u.r * (0.4 + ciclo), y0 + 1.8 + ciclo * 4.5, cz + Math.sin(u.a + t * 0.5 * u.v) * u.r * (0.4 + ciclo));
        });
      },
    };
  }

  // 5. ORGANIZAÇÃO: blocos jogados no chão vão para uma estante
  {
    const [cx, cz] = LUGAR.ordem, y0 = chao(cx, cz);
    const cores = [0x7a3b2e, 0x2e4a7a, 0x3a6b3a, 0x8a6a2e, 0x5a2e6b, 0x6b6b6b, 0x2e6b6b, 0x8a3a3a];
    const L = [], r = mulberry(42);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 7; x++) {
      L.push({
        a: [cx - 7 + r() * 14, y0 + r() * 0.2, cz + 3 + r() * 6], ra: [r() * 6, r() * 6, r() * 6],
        b: [cx - 3 + x, y0 + 0.5 + y * 1.0, cz - 1], c: cores[(x * 3 + y * 5) % cores.length], ord: y * 7 + x,
      });
    }
    const moldura = [];
    for (let x = -4; x <= 4; x++) { moldura.push({ p: [cx + x, y0 - 0.5 + 0, cz - 1.0], c: COR.tabua }); moldura.push({ p: [cx + x, y0 + 4.5, cz - 1], c: COR.tabua }); }
    for (let y = 0; y < 4; y++) { moldura.push({ p: [cx - 4, y0 + 0.5 + y, cz - 1], c: COR.tronco }); moldura.push({ p: [cx + 4, y0 + 0.5 + y, cz - 1], c: COR.tronco }); }
    const mm = montavel(moldura);
    moldura.forEach((b, i) => { tmp.position.set(...b.p); tmp.scale.setScalar(1); tmp.rotation.set(0, 0, 0); tmp.updateMatrix(); mm.setMatrixAt(i, tmp.matrix); });
    const m = montavel(L);
    cenas.ordem = {
      alvo: [cx, y0 + 2.2, cz + 1.5], camera: [cx + 2, y0 + 6, cz + 15],
      aplicar(p) {
        L.forEach((b, i) => {
          const t = suave(clamp(p * 1.6 - b.ord / L.length * 0.6));
          const arco = Math.sin(t * Math.PI) * 2.5;
          tmp.position.set(b.a[0] + (b.b[0] - b.a[0]) * t, b.a[1] + (b.b[1] - b.a[1]) * t + arco, b.a[2] + (b.b[2] - b.a[2]) * t);
          tmp.rotation.set(b.ra[0] * (1 - t), b.ra[1] * (1 - t), b.ra[2] * (1 - t));
          tmp.scale.set(0.92, 0.8, 0.92); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix);
        });
        m.instanceMatrix.needsUpdate = true;
      },
    };
  }

  // 6. SINALIZADOR no alto do morro
  const [tx, tz] = LUGAR.topo;
  let ty = 0;
  for (let x = tx - 3; x <= tx + 3; x++) for (let z = tz - 3; z <= tz + 3; z++) ty = Math.max(ty, H(x, z));
  {
    const base = [];
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) base.push({ p: [tx + x, ty + 1, tz + z], c: COR.ferro });
    const mb = montavel(base);
    base.forEach((b, i) => { tmp.position.set(...b.p); tmp.scale.setScalar(1); tmp.rotation.set(0, 0, 0); tmp.updateMatrix(); mb.setMatrixAt(i, tmp.matrix); });
    // coluna de terra até o chão, para a base não flutuar
    const coluna = [];
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) for (let y = H(tx + x, tz + z) + 1; y <= ty; y++) coluna.push({ p: [tx + x, y, tz + z], c: COR.pedra });
    if (coluna.length) { const mc = montavel(coluna); coluna.forEach((b, i) => { tmp.position.set(...b.p); tmp.updateMatrix(); mc.setMatrixAt(i, tmp.matrix); }); }
  }
  const nucleo = new THREE.Mesh(caixa, new THREE.MeshBasicMaterial({ color: 0x9ff6ff }));
  nucleo.position.set(tx, ty + 2, tz); cena.add(nucleo);
  const feixe = new THREE.Mesh(new THREE.BoxGeometry(0.7, 400, 0.7), new THREE.MeshBasicMaterial({ color: 0x9ff6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  feixe.position.set(tx, ty + 2.5 + 200, tz); cena.add(feixe);
  const feixe2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 400, 1.6), feixe.material.clone()); feixe2.position.copy(feixe.position); cena.add(feixe2);
  const luzSinal = new THREE.PointLight(0x9ff6ff, 0, 30, 1.5); luzSinal.position.set(tx, ty + 4, tz); cena.add(luzSinal);
  let aceso = 0, acesoAlvo = 0;
  // o alvo fica à esquerda do sinalizador: o feixe aparece no terço direito da tela, longe do texto
  cenas.sinal = { alvo: [tx - 11, ty + 12, tz - 9.5], camera: [tx - 38, ty + 4, tz + 44], aplicar(p) { acesoAlvo = Math.max(acesoAlvo, p > 0.35 ? 1 : 0); } };

  // ---- torres do painel: uma por área, perto do sinalizador
  const torres = [];
  let torresM = null, contagem = null;
  function montarTorres(cargos) {
    const cs = [0x74777b, 0xd9d6cf, 0x9ff6ff, 0xe9dcc0, 0x8b6b44];
    const lista = [];
    cargos.forEach((id, i) => {
      const [px, pz] = LUGAR.painel, x = px + 10 - i * 5, z = pz, h = chao(px, pz) - 1;
      torres.push({ id, x, z, h, cor: cs[i % cs.length], n: 0, mostra: 0 });
      for (let y = 0; y < 40; y++) lista.push({ c: cs[i % cs.length] });
    });
    torresM = montavel(lista);
    const [px, pz] = LUGAR.painel;
    cenas.painel = { alvo: [px, chao(px, pz) + 5, pz], camera: [px - 4, chao(px, pz) + 9, pz - 24], aplicar() {} };
  }

  // ---------------------------------------------------------------- câmera
  const camPos = new THREE.Vector3(70, 40, 80), camAlvo = new THREE.Vector3(0, 10, 0);
  const destinoPos = camPos.clone(), destinoAlvo = camAlvo.clone();
  const mouse = { x: 0, y: 0 };
  addEventListener('pointermove', e => { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; }, { passive: true });
  const CAMINHO = { geral: { camera: [52, 24, 60], alvo: [0, 9, 0] }, alto: { camera: [-30, 60, 40], alvo: [0, 6, 0] } };
  let caminho = null;
  // com {alto: true}, entre uma cena e a outra a câmera sobe por cima da ilha (não atravessa morro nem árvore);
  // o ponto alto fica no meio, então a cena k continua em k / (n - 1) do caminho
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

  // ---------------------------------------------------------------- tamanho e laço
  function medir() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(Math.ceil(w / ESCALA), Math.ceil(h / ESCALA), false);
    camera.aspect = w / h; camera.fov = w / h < 1 ? 72 : 52; camera.updateProjectionMatrix(); // em pé (celular), mais aberto
  }
  medir();
  addEventListener('resize', medir);

  let rodando = true, t0 = performance.now();
  document.addEventListener('visibilitychange', () => { rodando = !document.hidden; ultimoQuadro = 0; if (rodando) requestAnimationFrame(laco); });
  function laco(agora) {
    if (!rodando) return;
    const t = (agora - t0) / 1000;
    tempoAgua.value = t;
    nuvens.position.x = (t * 0.6) % 60;
    nevoas.forEach(s => { s.position.x += s.userData.v; if (s.position.x > 80) s.position.x = -80; });
    cenas.livro.quadro(t);

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
    if (!calmo) { camera.position.x += mouse.x * 1.6; camera.position.y -= mouse.y * 0.9; camera.position.y += Math.sin(t * 0.4) * 0.15; }
    camera.lookAt(camAlvo);

    // sinalizador
    aceso += (acesoAlvo - aceso) * 0.03;
    feixe.material.opacity = aceso * (0.75 + Math.sin(t * 3) * 0.05);
    feixe2.material.opacity = aceso * 0.22;
    feixe.scale.y = feixe2.scale.y = Math.max(0.001, saida(clamp(aceso * 1.3)));
    feixe.position.y = feixe2.position.y = ty + 2.5 + 200 * feixe.scale.y;
    luzSinal.intensity = aceso * 40;
    nucleo.material.color.setHex(aceso > 0.05 ? 0x9ff6ff : 0x3d5a60);

    // torres
    if (torresM && contagem) {
      let i = 0;
      const maior = Math.max(1, ...torres.map(tw => contagem[tw.id] || 0));
      const por = Math.max(1, Math.ceil(maior / 30));
      torres.forEach(tw => {
        tw.n = Math.ceil((contagem[tw.id] || 0) / por);
        tw.mostra += (tw.n - tw.mostra) * 0.05;
        for (let y = 0; y < 40; y++, i++) {
          const t2 = clamp(tw.mostra - y);
          if (t2 <= 0) { esconder(torresM, i); continue; }
          tmp.position.set(tw.x + 0.5, tw.h + 1 + y + (1 - saida(t2)) * 2, tw.z + 0.5); tmp.scale.set(1.96 * saida(t2), 0.98 * saida(t2), 1.96 * saida(t2)); tmp.rotation.set(0, 0, 0); tmp.updateMatrix(); torresM.setMatrixAt(i, tmp.matrix);
        }
      });
      torresM.instanceMatrix.needsUpdate = true;
    }

    renderer.render(cena, camera);
    // qualidade automática: média de 90 quadros acima de ~40 fps? aumenta o pixel (menos trabalho para a placa)
    if (ultimoQuadro) { somaQuadros += agora - ultimoQuadro; nQuadros++; }
    ultimoQuadro = agora;
    if (nQuadros >= 90) {
      if (somaQuadros / nQuadros > 25 && ESCALA < ESCALA_MAX) { ESCALA = Math.min(ESCALA_MAX, ESCALA + 0.6); medir(); }
      somaQuadros = 0; nQuadros = 0;
    }
    requestAnimationFrame(laco);
  }
  // estado inicial das cenas
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
    torres(ids) { montarTorres(ids); },
    contagem(c) { contagem = c; },
    rotuloTorres() { return torres.map(tw => ({ id: tw.id, ...projetar(tw.x + 0.5, tw.h + 2.4 + tw.mostra, tw.z + 0.5) })); },
    completar() { for (const [n, c] of Object.entries(cenas)) if (n !== 'sinal') c.aplicar(1); },
  };
}
