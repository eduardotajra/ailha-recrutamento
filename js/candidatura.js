/* Ficha de candidatura: cinco etapas, rascunho salvo no navegador, conferência por etapa e envio. */
(function () {
  const C = window.ILHA;
  const form = document.getElementById('ficha');
  const etapas = [...form.querySelectorAll('.etapa')];
  const lista = document.getElementById('etapas');
  const voltar = document.getElementById('voltar'), seguir = document.getElementById('seguir');
  const aviso = document.getElementById('avisoCampo');
  const RASCUNHO = 'ilha_ficha';
  const inicio = Date.now();
  let atual = 0, maxVista = 0;

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // ---------- montar as peças repetidas
  document.querySelectorAll('.fichas[data-opcoes]').forEach(montarFichas);
  const exp = document.getElementById('experiencias');
  exp.dataset.opcoes = [...C.experiencias, 'Nenhuma ainda'].join('|');
  montarFichas(exp);
  document.querySelectorAll('.cartoes-opcao').forEach(el => {
    el.innerHTML = el.dataset.opcoes.split('|').map((o, i) =>
      `<label class="opcao"><input type="radio" name="${el.dataset.nome}" value="${esc(o)}"><span><b>${'ABC'[i]}</b>${esc(o)}</span></label>`).join('');
  });
  function montarFichas(el) {
    el.innerHTML = el.dataset.opcoes.split('|').map(o =>
      `<label class="ficha-op"><input type="${el.dataset.tipo}" name="${el.dataset.nome}" value="${esc(o)}"><span>${esc(o)}</span></label>`).join('');
  }

  const areas = document.getElementById('areas');
  areas.innerHTML = C.cargos.map(c => `
    <label class="area-op">
      <input type="checkbox" name="cargos" value="${c.id}">
      <img class="area-ic" data-bloco="${c.bloco}" alt="" width="46" height="46">
      <span class="area-txt"><b>${esc(c.nome)}</b><small>${esc(c.chamada)}</small></span>
      <span class="area-marca" aria-hidden="true"></span>
    </label>`).join('');

  lista.innerHTML = etapas.map((e, i) => `<li><button type="button" data-i="${i}" title="${esc(e.dataset.titulo)}"><i></i><span class="n">${i + 1}</span><span class="vh">${esc(e.dataset.titulo)}</span></button></li>`).join('');
  lista.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const i = +b.dataset.i;
    if (i <= maxVista && (i < atual || conferir(atual))) ir(i);
  });

  // pronomes "outro"
  form.addEventListener('change', e => {
    if (e.target.name === 'pronomes') {
      const outro = form.pronomesOutro;
      outro.hidden = e.target.value !== 'outro';
      if (!outro.hidden) outro.focus();
    }
    if (e.target.name === 'cargos') montarPorArea();
    if (e.target.name === 'experiencias') {
      // "Nenhuma ainda" e as outras não andam juntas
      const nenhuma = form.querySelector('input[name=experiencias][value="Nenhuma ainda"]');
      if (e.target === nenhuma && nenhuma.checked) form.querySelectorAll('input[name=experiencias]').forEach(i => { if (i !== nenhuma) i.checked = false; });
      else if (e.target.checked) nenhuma.checked = false;
    }
  });

  // régua de horas
  const horas = form.horas, horasTexto = document.getElementById('horasTexto');
  const textoHoras = () => {
    const v = +horas.value;
    horasTexto.textContent = v >= 30 ? '30 h ou mais por semana' : v + (v === 1 ? ' hora' : ' h') + ' por semana';
    horas.style.setProperty('--p', ((v - 1) / 29 * 100) + '%');
  };
  horas.addEventListener('input', textoHoras);

  // um bloco por área escolhida: o que já fez nela e um link
  const porArea = document.getElementById('porArea');
  function montarPorArea() {
    const guardados = {};
    porArea.querySelectorAll('textarea, input').forEach(i => { guardados[i.name + (i.type === 'checkbox' ? ':' + i.value : '')] = i.type === 'checkbox' ? i.checked : i.value; });
    const escolhidas = escolhidosDe('cargos');
    porArea.innerHTML = escolhidas.map(id => {
      const c = C.cargos.find(x => x.id === id);
      return `<div class="por-area">
        <h3><span aria-hidden="true">${c.icone}</span> ${esc(c.nome)}</h3>
        <label class="campo"><span>Qual a sua experiência com ${esc(c.nome.toLowerCase())}?</span>
          <textarea name="exp_${id}" required data-erro="Conte a sua experiência com ${esc(c.nome.toLowerCase())}, mesmo que seja nenhuma." maxlength="1500" rows="4" placeholder="O que já fez, por quanto tempo. Se nunca fez, conte como pretende aprender."></textarea></label>
        ${c.ferramentas ? `<fieldset class="campo"><legend>O que você já usou ou fez <em>(opcional)</em></legend>
          <div class="fichas">${c.ferramentas.map(f => `<label class="ficha-op"><input type="checkbox" name="ferr_${id}" value="${esc(f)}"><span>${esc(f)}</span></label>`).join('')}</div></fieldset>` : ''}
        ${c.amostra ? `<label class="campo"><span>Uma amostra</span><small class="enunciado">${esc(c.amostra)}</small>
          <textarea name="amostra_${id}" required data-erro="Escreva a amostra: pode ser bem curta." maxlength="600" rows="5"></textarea></label>` : ''}
        <label class="campo"><span>Link de trabalhos <em>(${c.pedeLink ? 'imagens, Imgur, Drive, ArtStation, Sketchfab, vídeo' : 'opcional'})</em></span>
          <input name="link_${id}" type="url" maxlength="300" placeholder="https://"${c.pedeLink ? ` data-pede="${esc(c.nome.toLowerCase())}"` : ''}></label>
        ${c.pedeLink ? `<label class="termo sem-link"><input type="checkbox" name="semlink_${id}" value="1"><span>Ainda não tenho nada para mostrar em ${esc(c.nome.toLowerCase())}</span></label>` : ''}
      </div>`;
    }).join('');
    porArea.querySelectorAll('textarea, input').forEach(i => {
      if (i.type === 'checkbox') i.checked = !!guardados[i.name + ':' + i.value];
      else if (guardados[i.name]) i.value = guardados[i.name];
    });
    montarTermos();
  }

  const termos = document.getElementById('termos');
  function montarTermos() {
    const marcados = new Set([...termos.querySelectorAll('input:checked')].map(i => i.value));
    const blocos = [{ titulo: 'Para todas as áreas', itens: C.termosGerais }];
    escolhidosDe('cargos').forEach(id => {
      const c = C.cargos.find(x => x.id === id);
      blocos.push({ titulo: c.nome, itens: c.termos });
    });
    termos.innerHTML = blocos.map(b => `<div class="termo-bloco"><h3>${esc(b.titulo)}</h3>${b.itens.map(t =>
      `<label class="termo"><input type="checkbox" name="termo" value="${esc(t)}"${marcados.has(t) ? ' checked' : ''}><span>${esc(t)}</span></label>`).join('')}</div>`).join('');
  }

  // ---------- leitura dos valores
  const escolhidosDe = n => [...form.querySelectorAll(`input[name="${n}"]:checked`)].map(i => i.value);
  const um = n => (form.querySelector(`input[name="${n}"]:checked`) || {}).value || '';
  const val = n => (form.elements[n] ? String(form.elements[n].value).trim() : '');

  function dados() {
    const cargos = escolhidosDe('cargos');
    const porCargo = {};
    cargos.forEach(id => {
      porCargo[id] = { experiencia: val('exp_' + id), ferramentas: escolhidosDe('ferr_' + id), amostra: val('amostra_' + id), link: val('link_' + id) };
    });
    return {
      versao: 1,
      nome: val('nome'), idade: +val('idade') || null, discord: val('discord'),
      pronomes: um('pronomes') === 'outro' ? val('pronomesOutro') || 'outro' : um('pronomes'),
      ocupacao: val('ocupacao'),
      horas: +horas.value, dias: escolhidosDe('dias'), periodos: escolhidosDe('periodos'),
      proatividade: um('proatividade'), proatividadeExemplo: val('proatividadeExemplo'),
      experiencias: escolhidosDe('experiencias'), cargos, porCargo,
      qualidades: val('qualidades'), defeitos: val('defeitos'), criticas: um('criticas'), criticasComo: val('criticasComo'),
      motivacao: val('motivacao'), jogar: um('jogar'), extra: val('extra'),
      termos: escolhidosDe('termo'),
      site: val('site'), tempo: Date.now() - inicio,
    };
  }

  // ---------- conferência de cada etapa
  function falta(el, msg) {
    aviso.textContent = msg;
    const alvo = el.closest('.campo') || el;
    alvo.classList.add('com-erro');
    alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const foco = alvo.querySelector('input, textarea') || el;
    setTimeout(() => foco.focus({ preventScroll: true }), 250);
    return false;
  }
  function conferir(i) {
    const e = etapas[i];
    e.querySelectorAll('.com-erro').forEach(x => x.classList.remove('com-erro'));
    aviso.textContent = '';
    for (const campo of e.querySelectorAll('input[required], textarea[required]')) {
      const v = campo.value.trim();
      const rotulo = (campo.closest('.campo')?.querySelector('span, legend')?.textContent || 'Este campo').replace(/\(.*\)/, '').trim().replace(/[?:.]+$/, '');
      if (!v) return falta(campo, campo.dataset.erro || `Preencha: ${rotulo.charAt(0).toLowerCase() + rotulo.slice(1)}.`);
      if (campo.type === 'number' && +v < +campo.min) return falta(campo, `A equipe aceita pessoas a partir de ${campo.min} anos.`);
      if (campo.type === 'number' && +v > +campo.max) return falta(campo, 'Confira a idade.');
    }
    for (const c of e.querySelectorAll('input[type=url]')) {
      if (c.value.trim() && !/^https?:\/\/\S+\.\S+/.test(c.value.trim())) return falta(c, 'O link precisa começar com https://');
      const sem = form.elements['semlink_' + c.name.slice(5)];
      if (c.dataset.pede && !c.value.trim() && !(sem && sem.checked)) {
        return falta(c, `Mande um link com trabalhos de ${c.dataset.pede}, ou marque que ainda não tem nada para mostrar.`);
      }
    }
    const grupos = { 0: ['pronomes'], 1: ['dias', 'periodos', 'proatividade'], 2: ['experiencias', 'cargos'], 3: ['criticas', 'jogar'] }[i] || [];
    for (const g of grupos) {
      if (!form.querySelector(`input[name="${g}"]:checked`)) {
        const el = form.querySelector(`input[name="${g}"]`);
        return falta(el.closest('fieldset') || el, `Escolha uma opção em: ${(el.closest('fieldset')?.querySelector('legend')?.textContent || g).trim()}`);
      }
    }
    if (i === 0 && !/^@?[a-z0-9_.]{2,32}$/i.test(val('discord'))) return falta(form.discord, 'Confira o Discord: só letras, números, ponto e sublinhado.');
    if (i === 0 && um('pronomes') === 'outro' && !val('pronomesOutro')) return falta(form.pronomesOutro, 'Escreva os seus pronomes.');
    if (i === 4) {
      const soltos = [...termos.querySelectorAll('input:not(:checked)')];
      if (soltos.length) return falta(soltos[0].closest('.termo'), 'Para enviar, é preciso aceitar todos os termos.');
    }
    return true;
  }

  // ---------- navegação
  function ir(i) {
    etapas[atual].hidden = true;
    atual = i;
    maxVista = Math.max(maxVista, i);
    etapas[i].hidden = false;
    etapas[i].classList.remove('entra');
    void etapas[i].offsetWidth;
    etapas[i].classList.add('entra');
    voltar.style.visibility = i === 0 ? 'hidden' : 'visible';
    const ultima = i === etapas.length - 1;
    seguir.textContent = ultima ? 'Enviar ficha' : 'Continuar';
    const nomeEtapa = document.getElementById('nomeEtapa');
    nomeEtapa.textContent = etapas[i].dataset.titulo;
    nomeEtapa.classList.remove('mostra'); void nomeEtapa.offsetWidth; nomeEtapa.classList.add('mostra');
    seguir.classList.toggle('grande', ultima);
    if (ultima) { montarTermos(); resumo(); if (!C.aberto) { seguir.disabled = true; aviso.textContent = C.avisoFechado; } }
    lista.querySelectorAll('li').forEach((li, n) => {
      li.className = n < i ? 'feita' : n === i ? 'atual' : n <= maxVista ? 'vista' : '';
      li.querySelector('button').toggleAttribute('aria-current', n === i);
    });
    document.getElementById('barra').style.width = ((i + 1) / etapas.length * 100) + '%';
    aviso.textContent = '';
    form.scrollIntoView({ block: 'start', behavior: 'smooth' });
    salvar();
  }
  voltar.addEventListener('click', () => atual > 0 && ir(atual - 1));
  seguir.addEventListener('click', () => {
    if (!conferir(atual)) return;
    if (atual < etapas.length - 1) ir(atual + 1); else enviar();
  });
  form.addEventListener('submit', e => e.preventDefault());
  form.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && e.target.type !== 'radio') { e.preventDefault(); seguir.click(); }
  });
  form.addEventListener('input', e => { if (e.target.closest('.com-erro')) { e.target.closest('.com-erro').classList.remove('com-erro'); aviso.textContent = ''; } salvarLogo(); });
  form.addEventListener('change', salvarLogo);
  addEventListener('pagehide', salvar);
  document.addEventListener('visibilitychange', () => { if (document.hidden) salvar(); });

  function resumo() {
    const d = dados();
    const nomes = d.cargos.map(id => C.cargos.find(c => c.id === id).nome).join(', ');
    document.getElementById('resumo').innerHTML = `<h3>Conferindo</h3><dl>
      <dt>Nome</dt><dd>${esc(d.nome)} (${esc(d.pronomes)}), ${esc(d.idade)} anos</dd>
      <dt>Discord</dt><dd>${esc(d.discord)}</dd>
      <dt>Tempo</dt><dd>${esc(horasTexto.textContent)} · ${esc(d.dias.join(', '))} · ${esc(d.periodos.join(', '))}</dd>
      <dt>Áreas</dt><dd>${esc(nomes)}</dd></dl>`;
  }

  // ---------- rascunho
  let temporizador;
  function salvarLogo() { clearTimeout(temporizador); temporizador = setTimeout(salvar, 400); }
  function salvar() {
    const campos = {};
    [...form.elements].forEach(el => {
      if (!el.name || el.name === 'site') return;
      if (el.type === 'checkbox' || el.type === 'radio') { if (el.checked) (campos[el.name] = campos[el.name] || []).push(el.value); }
      else if (el.value) campos[el.name] = el.value;
    });
    try {
      localStorage.setItem(RASCUNHO, JSON.stringify({ campos, atual, maxVista }));
      document.getElementById('rascunho').hidden = false;
    } catch (e) { /* sem armazenamento */ }
  }
  function restaurar() {
    let r;
    try { r = JSON.parse(localStorage.getItem(RASCUNHO)); } catch (e) { r = null; }
    const pedida = new URLSearchParams(location.search).get('area');
    if (!r) {
      if (pedida) { const c = form.querySelector(`input[name=cargos][value="${pedida}"]`); if (c) c.checked = true; }
      montarPorArea(); textoHoras(); return 0;
    }
    const aplicar = (nome, valores) => {
      const els = form.querySelectorAll(`[name="${nome}"]`);
      els.forEach(el => {
        if (el.type === 'checkbox' || el.type === 'radio') el.checked = [].concat(valores).includes(el.value);
        else el.value = valores;
      });
    };
    aplicar('cargos', r.campos.cargos || []);
    if (pedida) { const c = form.querySelector(`input[name=cargos][value="${pedida}"]`); if (c) c.checked = true; }
    montarPorArea();
    Object.entries(r.campos).forEach(([k, v]) => { if (k !== 'cargos' && k !== 'termo') aplicar(k, v); });
    montarTermos();
    aplicar('termo', r.campos.termo || []);
    form.pronomesOutro.hidden = um('pronomes') !== 'outro';
    textoHoras();
    maxVista = r.maxVista || 0;
    document.getElementById('rascunho').hidden = false;
    return Math.min(r.atual || 0, etapas.length - 1);
  }

  // ---------- envio
  async function enviar() {
    const erro = document.getElementById('erroEnvio');
    erro.hidden = true;
    seguir.disabled = true;
    seguir.textContent = 'Enviando...';
    try {
      const d = dados();
      const r = await IlhaDados.enviar(d);
      try { localStorage.removeItem(RASCUNHO); } catch (e) { /* sem armazenamento */ }
      etapas.forEach(e => { e.hidden = true; });
      document.getElementById('navegacao').hidden = true;
      document.getElementById('nomeEtapa').textContent = 'Ficha enviada';
      document.dispatchEvent(new CustomEvent('ilha:enviada'));
      lista.querySelectorAll('li').forEach(li => { li.className = 'feita'; });
      const partes = d.cargos.map(id => {
        const c = C.cargos.find(x => x.id === id);
        const n = r.cargos && r.cargos[id];
        return n ? `${n}ª em ${c.nome}` : c.nome;
      });
      const itens = partes.map(p => `<b>${esc(p)}</b>`);
      const juntas = itens.length > 1 ? itens.slice(0, -1).join(', ') + ' e ' + itens[itens.length - 1] : itens[0];
      document.getElementById('recebidoTexto').innerHTML =
        `Sua ficha é a ${juntas}. Lemos todas. Se o seu perfil combinar com o que a equipe precisa agora, chamamos você no Discord (${esc(d.discord)}).`;
      if (C.discord) { const l = document.getElementById('linkDiscord'); l.href = C.discord; l.hidden = false; }
      const ok = document.getElementById('recebido');
      ok.hidden = false;
      ok.classList.add('entra');
      ok.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } catch (e) {
      erro.textContent = 'Não deu para enviar agora (' + e.message + '). Sua ficha continua salva aqui: tente de novo em instantes.';
      erro.hidden = false;
      seguir.disabled = false;
      seguir.textContent = 'Tentar de novo';
    }
  }

  ir(restaurar());
})();
