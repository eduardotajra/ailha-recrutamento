/*
 * A ilha em blocos, feita inteira por código: nenhuma imagem do jogo, nada da história.
 * Todo bloco é um bloco que existe no jogo, com a textura dele (js/texturas.js), sempre do tamanho de um bloco:
 * nada estica. As cenas que se montam com a rolagem: casa (construção), mural de lã (arte), modelo de lobo
 * (modelagem), púlpito com livro e fogueira (lore), estante (organização), sinalizador (final) e os pilares do painel.
 */
import * as THREE from './vendor/three.module.min.js';
import { atlas, recorte, chamas, lua as texLua, planta, B, LA, N, LINHAS } from './texturas.js';

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
  cena.fog = new THREE.Fog(0x0d131c, 30, 150);
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 900);

  // ---- material de bloco: atlas + sombra de face (topo claro, lados mais escuros, como no jogo)
  // névoa rasteira: mais grossa perto do mar, rarefeita no alto, se mexendo devagar; mais fraca bem perto da câmera
  const uNT = { value: 0 };
  function comNevoa(s) {
    s.uniforms.uNT = uNT;
    s.vertexShader = 'varying vec3 vMundo;\n' + s.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec4 nvMundo = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        nvMundo = instanceMatrix * nvMundo;
      #endif
      vMundo = (modelMatrix * nvMundo).xyz;`);
    s.fragmentShader = 'varying vec3 vMundo;\nuniform float uNT;\n' + s.fragmentShader.replace('#include <fog_fragment>', `#include <fog_fragment>
      float nAlt = 1.0 - smoothstep(${AGUA}.0 + 0.5, ${AGUA}.0 + 12.0, vMundo.y);
      float nOnda = 0.5 + 0.5 * sin(vMundo.x * 0.11 + uNT * 0.22) * sin(vMundo.z * 0.09 - uNT * 0.17);
      float nDist = smoothstep(2.0, 36.0, length(vMundo - cameraPosition));
      gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.16, 0.19, 0.25), clamp(nAlt * (0.4 + 0.5 * nOnda) * nDist, 0.0, 0.82));`);
  }
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
    comNevoa(s);
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
      const m = new THREE.MeshLambertMaterial({ map: t, ...extra });
      m.onBeforeCompile = comNevoa;
      return m;
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
  const ocupado = new Set();
  const marcar = (x, y, z) => ocupado.add(x + ',' + y + ',' + z);
  const vago = (x, y, z) => !ocupado.has(x + ',' + y + ',' + z);
  const pertoDeCena = (x, z, d) => !livre(x, z) || Object.entries(LUGAR).some(([n, [a, b]]) => n !== 'topo' && Math.hypot(x - a, z - b) < d);
  const arvore = (x, z, h, tipo) => {
    const alto = (tipo === 'pinheiro' ? 6 : 4) + Math.floor(r2() * 3), topoY = h + alto;
    for (let y = 1; y <= alto; y++) { blocos.push({ p: [x, h + y, z], b: 'tronco' }); marcar(x, h + y, z); }
    // carvalho: duas camadas 5×5 sem os cantos, uma 3×3, uma cruz no alto. Pinheiro: camadas que afinam até a ponta
    const camadas = tipo === 'pinheiro'
      ? [[-4, 2], [-3, 1], [-2, 2], [-1, 1], [0, 1], [1, 0]]
      : [[-1, 2], [0, 2], [1, 1], [2, 1]];
    for (const [dy, raio] of camadas) {
      for (let a = -raio; a <= raio; a++) for (let b = -raio; b <= raio; b++) {
        const canto = Math.abs(a) === raio && Math.abs(b) === raio && raio > 0;
        if (canto && (tipo === 'pinheiro' || dy === 2 || r2() < 0.6)) continue;
        if (a === 0 && b === 0 && dy <= 0) continue;
        blocos.push({ p: [x + a, topoY + dy, z + b], b: 'folha' }); marcar(x + a, topoY + dy, z + b);
      }
    }
  };
  for (let i = 0; i < 1300; i++) {
    const x = Math.floor((r2() * 2 - 1) * R), z = Math.floor((r2() * 2 - 1) * R), h = H(x, z);
    if (h <= AGUA + 2 || h > AGUA + 14 || !longe(x, z) || fbm(x * 0.09 + 40, z * 0.09) < 0.46 || !vago(x, h + 1, z)) continue;
    arvore(x, z, h, h > AGUA + 9 || r2() < 0.25 ? 'pinheiro' : 'carvalho');
  }
  // arbustos (um bloco de folha) e pedras com musgo
  for (let i = 0; i < 260; i++) {
    const x = Math.floor((r2() * 2 - 1) * R), z = Math.floor((r2() * 2 - 1) * R), h = H(x, z);
    if (h <= AGUA + 1 || pertoDeCena(x, z, 8) || !vago(x, h + 1, z)) continue;
    if (r2() < 0.6) { blocos.push({ p: [x, h + 1, z], b: 'folha' }); marcar(x, h + 1, z); }
    else {
      const n = 1 + Math.floor(r2() * 3);
      for (let q = 0; q < n; q++) {
        const xx = x + (q % 2), zz = z + (q > 1 ? 1 : 0), hh = H(xx, zz);
        if (hh > AGUA && vago(xx, hh + 1, zz)) { blocos.push({ p: [xx, hh + 1, zz], b: r2() < 0.6 ? 'musgo' : 'pedregulho' }); marcar(xx, hh + 1, zz); }
      }
    }
  }

  // píer de tábua saindo da praia, na direção da câmera do começo, com uma tocha acesa na ponta
  const pier = [];
  {
    const dx = 0.66, dz = 0.75;
    let ux = 0, uz = 0;
    for (let d = 0; d < 80; d++) { const x = Math.round(dx * d), z = Math.round(dz * d); if (H(x, z) < 0) break; ux = x; uz = z; }
    for (let d = 0; d < 9; d++) {
      const x = Math.round(ux + dx * d), z = Math.round(uz + dz * d);
      if (H(x, z) >= AGUA + 1 && d < 2) continue;
      pier.push({ p: [x, AGUA + 1, z], b: 'tabua' }); marcar(x, AGUA + 1, z);
      if (d % 3 === 2) pier.push({ p: [x, AGUA, z], b: 'tronco' });
    }
    const fim = pier.filter(b => b.b === 'tabua').pop();
    if (fim) {
      const tocha = peca(2 / 16, 10 / 16, 2 / 16, 'tronco');
      tocha.position.set(fim.p[0], AGUA + 1.5 + 5 / 16, fim.p[2]); cena.add(tocha);
      const chama = new THREE.Mesh(new THREE.BoxGeometry(2.2 / 16, 2.2 / 16, 2.2 / 16), new THREE.MeshBasicMaterial({ color: 0xffd36b }));
      chama.position.set(fim.p[0], AGUA + 1.5 + 11 / 16, fim.p[2]); cena.add(chama);
      const luz = new THREE.PointLight(0xffb45a, 6, 10, 1.6); luz.position.set(fim.p[0], AGUA + 2.6, fim.p[2]); cena.add(luz);
    }
  }
  malha([...blocos, ...pier]);

  // ilhotas ao longe, para o mar não ficar vazio
  {
    const ilhotas = [];
    [[-120, -60, 9], [130, -90, 7], [-90, 140, 6], [160, 70, 8], [20, -170, 10]].forEach(([cx, cz, r], n) => {
      const rr = mulberry(70 + n);
      for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) {
        const d = Math.hypot(x, z) / r + (fbm(x * 0.3 + n * 10, z * 0.3) - 0.5) * 0.5;
        if (d > 1) continue;
        const h = AGUA + Math.round((1 - d) * (r * 0.7) * (0.6 + rr() * 0.4));
        for (let y = AGUA; y <= h; y++) ilhotas.push({ p: [cx + x, y, cz + z], b: y === h ? (h <= AGUA + 1 ? 'areia' : 'grama') : 'pedra' });
        if (h > AGUA + 2 && rr() < 0.08) for (let y = 1; y <= 4; y++) ilhotas.push({ p: [cx + x, h + y, cz + z], b: y === 4 ? 'folha' : 'tronco' });
      }
    });
    malha(ilhotas);
  }

  // plantas: dois planos cruzados com a textura transparente, como no jogo
  function geoCruz() {
    const g = new THREE.BufferGeometry(), pos = [], uv = [], nor = [], idx = [];
    [Math.PI / 4, -Math.PI / 4].forEach((ang, k2) => {
      const c = Math.cos(ang) * 0.5, s2 = Math.sin(ang) * 0.5;
      pos.push(-c, -0.5, -s2, c, -0.5, s2, c, 0.5, s2, -c, 0.5, -s2);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      for (let q = 0; q < 4; q++) nor.push(0, 1, 0); // luz de cima, igual dos dois lados
      const o = k2 * 4; idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    });
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    return g;
  }
  const cruz = geoCruz();
  function plantas(nome, lista, geo = cruz) {
    if (!lista.length) return;
    const t = new THREE.CanvasTexture(planta(nome)); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
    // sem luz de face: os dois lados do plano com o mesmo tom (com luz, o lado de trás ficava preto)
    const mat = new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, color: 0x8794aa });
    mat.onBeforeCompile = comNevoa;
    const m = new THREE.InstancedMesh(geo, mat, lista.length);
    lista.forEach(([x, y, z, ry = 0], i) => { tmp.position.set(x, y, z); tmp.rotation.set(0, ry, 0); tmp.scale.setScalar(1); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix); });
    cena.add(m);
  }
  {
    const capim = [], papoula = [], dente = [], azul = [], cana = [], vitoria = [];
    for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) {
      const h = H(x, z);
      if (h < 0 || PRACA.has(k(x, z)) || !vago(x, h + 1, z) || pertoDeCena(x, z, 6) || Math.hypot(x - LUGAR.mural[0], z - LUGAR.mural[1]) < 9.5) continue;
      const grama = h > AGUA + 1 && h <= AGUA + 15;
      const beira = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => H(x + a, z + b) < 0);
      const r = r2();
      if (beira && h <= AGUA + 2 && r < 0.3) { const alto = 1 + Math.floor(r2() * 3); for (let y = 1; y <= alto; y++) cana.push([x, h + y, z]); continue; }
      if (!grama) continue;
      const campo = fbm(x * 0.15 + 5, z * 0.15 + 9);
      if (r < 0.32 * campo + 0.05) capim.push([x, h + 1, z, r2() * 3]);
      else if (r < 0.36 * campo + 0.08) [papoula, dente, azul][Math.floor(r2() * 3)].push([x, h + 1, z, r2() * 3]);
    }
    // vitórias-régias na água rasa perto da costa
    for (let x = -R - 5; x <= R + 5; x++) for (let z = -R - 5; z <= R + 5; z++) {
      if (H(x, z) >= 0) continue;
      const perto = [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, -1]].some(([a, b]) => H(x + a, z + b) >= 0);
      if (perto && r2() < 0.07) vitoria.push([x, AGUA + 0.6, z, r2() * 6]);
    }
    plantas('capim', capim); plantas('papoula', papoula); plantas('dente', dente); plantas('azulzinha', azul); plantas('cana', cana);
    const placa = new THREE.PlaneGeometry(1, 1); placa.rotateX(-Math.PI / 2);
    plantas('vitoria', vitoria, placa);
  }

  // vaga-lumes: pontinhos que acendem e apagam devagar, rente ao chão
  const vagalumes = (() => {
    const n = 140, pos = new Float32Array(n * 3), cores = new Float32Array(n * 3), base = [];
    for (let i = 0; i < n; i++) {
      let x, z, h;
      do { x = (r2() * 2 - 1) * R * 0.9; z = (r2() * 2 - 1) * R * 0.9; h = H(Math.round(x), Math.round(z)); } while (h < AGUA + 1);
      base.push([x, h + 1.2 + r2() * 2.2, z, r2() * 10, 0.5 + r2()]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(cores, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 3, sizeAttenuation: false, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    pts.frustumCulled = false;
    cena.add(pts);
    return t => {
      base.forEach(([x, y, z, f, v], i) => {
        pos[i * 3] = x + Math.sin(t * 0.3 * v + f) * 0.8; pos[i * 3 + 1] = y + Math.sin(t * 0.5 * v + f * 2) * 0.4; pos[i * 3 + 2] = z + Math.cos(t * 0.25 * v + f) * 0.8;
        const b = Math.max(0, Math.sin(t * 0.9 * v + f * 3)) ** 3;
        cores[i * 3] = 0.85 * b; cores[i * 3 + 1] = 1.0 * b; cores[i * 3 + 2] = 0.35 * b;
      });
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
    };
  })();

  // ---- água: ondas em degrau
  const agua = new THREE.Mesh(new THREE.PlaneGeometry(600, 600, 150, 150), new THREE.MeshPhongMaterial({ color: 0x1d3a78, shininess: 70, specular: 0x5a6f99, transparent: true, opacity: 0.9, flatShading: true }));
  agua.rotation.x = -Math.PI / 2;
  agua.position.y = AGUA + 0.38;
  const tempoAgua = { value: 0 };
  agua.material.onBeforeCompile = s => {
    s.uniforms.uT = tempoAgua;
    s.vertexShader = 'uniform float uT;\n' + s.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvec2 q = floor(position.xy / 4.0) * 4.0;\ntransformed.z += (sin(q.x * 0.21 + uT * 0.9) + cos(q.y * 0.17 + uT * 0.7)) * 0.09;');
    comNevoa(s);
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
    tempoAgua.value = t; uNT.value = t;
    for (const c of Object.values(cenas)) if (c.quadro) c.quadro(t, dt);
    if (!calmo) vagalumes(t);

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
    // conferência para os testes: algum ponto por onde a câmera passa fica dentro (ou colado) de terra ou de árvore?
    _verificar(orbitas = []) {
      const solido = (x, y, z) => { const xi = Math.round(x), yi = Math.round(y), zi = Math.round(z); return yi <= H(xi, zi) || ocupado.has(xi + ',' + yi + ',' + zi); };
      const encosta = v => [[0, 0, 0], [0.45, 0, 0], [-0.45, 0, 0], [0, 0.45, 0], [0, -0.45, 0], [0, 0, 0.45], [0, 0, -0.45]].some(([a, b, c]) => solido(v.x + a, v.y + b, v.z + c));
      const ruins = [];
      if (caminho) for (let i = 0; i <= 600; i++) { const v = caminho.pos.getPoint(i / 600); if (encosta(v)) ruins.push(['caminho', +(i / 600).toFixed(3), v.toArray().map(n => +n.toFixed(1))]); }
      for (const [n, c] of Object.entries(cenas)) if (c.camera && encosta(new THREE.Vector3(...c.camera))) ruins.push(['cena', n, c.camera]);
      orbitas.forEach(([alvo, r, h]) => {
        const c = cenas[alvo] ? cenas[alvo].alvo : alvo;
        for (let i = 0; i < 360; i++) { const a = i / 360 * Math.PI * 2, v = new THREE.Vector3(c[0] + Math.cos(a) * r, c[1] + h, c[2] + Math.sin(a) * r); if (encosta(v)) ruins.push(['orbita', String(alvo), i]); }
      });
      return ruins;
    },
  };
}
