/*
 * Conversa com o servidor (Apps Script) ou, sem endereço configurado, guarda tudo neste navegador (modo de teste).
 * O painel só recebe números: quantas candidaturas por área e quando chegaram. Nunca nomes.
 */
(function () {
  const C = window.ILHA;
  const CHAVE = 'ilha_recrutamento_teste';
  const teste = !C.endpoint;

  function local() {
    try { return JSON.parse(localStorage.getItem(CHAVE)) || []; } catch (e) { return []; }
  }

  function contar(lista) {
    const cargos = {}, ultimas = {};
    C.cargos.forEach(c => { cargos[c.id] = 0; });
    lista.forEach(r => (r.cargos || []).forEach(id => { if (id in cargos) { cargos[id]++; ultimas[id] = r.quando; } }));
    const recentes = lista.slice(-12).reverse().map(r => ({ cargos: r.cargos, quando: r.quando }));
    return { total: lista.length, cargos, ultimas, recentes, atualizado: Date.now() };
  }

  async function contagem() {
    if (teste) return contar(local());
    const r = await fetch(C.endpoint + '?acao=contagem&t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if (j.ok === false) throw new Error(j.erro || 'falha');
    return j;
  }

  async function enviar(dados) {
    if (teste) {
      const lista = local();
      lista.push({ cargos: dados.cargos, quando: Date.now() });
      try { localStorage.setItem(CHAVE, JSON.stringify(lista)); } catch (e) { /* navegador sem armazenamento */ }
      return { ok: true, ...contar(lista) };
    }
    // text/plain evita a pré-verificação de CORS, que o Apps Script não responde
    const r = await fetch(C.endpoint, { method: 'POST', body: JSON.stringify(dados) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if (!j.ok) throw new Error(j.erro || 'recusado');
    return j;
  }

  window.IlhaDados = { teste, contagem, enviar };
})();
