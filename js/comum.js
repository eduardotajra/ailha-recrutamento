/* Partes comuns: música, aviso do modo de teste, número ao vivo na barra de cima, contador animado. */
(function () {
  const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.IlhaCalmo = calmo;

  // ---- números que sobem até o valor
  window.IlhaContar = (el, ate) => {
    const de = parseInt(el.dataset.v || el.textContent, 10) || 0;
    el.dataset.v = ate;
    if (calmo || de === ate) { el.textContent = ate; return; }
    const t0 = performance.now(), ms = Math.min(1400, 300 + Math.abs(ate - de) * 40);
    const passo = t => {
      const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(de + (ate - de) * e);
      if (k < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  };
  window.IlhaPlural = (n, um, varios) => (n === 1 ? um : varios);

  // ---- música (Novos Ares, a do menu do jogo). Só toca se a pessoa pedir; lembra a escolha.
  const botao = document.querySelector('.botao-som');
  if (botao) {
    const audio = new Audio('midia/novos_ares.m4a');
    audio.loop = true; audio.volume = 0;
    let ligada = false;
    const fade = (alvo, ms) => {
      const ini = audio.volume, t0 = performance.now();
      const passo = t => {
        const k = Math.min(1, (t - t0) / ms);
        audio.volume = ini + (alvo - ini) * k;
        if (k < 1) requestAnimationFrame(passo); else if (alvo === 0) audio.pause();
      };
      requestAnimationFrame(passo);
    };
    botao.addEventListener('click', () => {
      ligada = !ligada;
      botao.setAttribute('aria-pressed', ligada);
      try { localStorage.setItem('ilha_som', ligada ? '1' : '0'); } catch (e) { /* sem armazenamento */ }
      if (ligada) audio.play().then(() => fade(0.45, 1800)).catch(() => {}); else fade(0, 600);
    });
    let lembrada = false;
    try { lembrada = localStorage.getItem('ilha_som') === '1'; } catch (e) { /* sem armazenamento */ }
    if (lembrada) {
      const primeiro = e => { if (!ligada && !e.target.closest('.botao-som')) botao.click(); };
      addEventListener('pointerdown', primeiro, { once: true });
      addEventListener('keydown', primeiro, { once: true });
    }
  }

  // ---- modo de teste
  if (window.IlhaDados && IlhaDados.teste) {
    const a = document.createElement('div');
    a.className = 'aviso-teste';
    a.textContent = 'Modo de teste: sem servidor, as fichas e os números ficam só neste navegador.';
    document.body.appendChild(a);
  }

  // ---- número ao vivo da barra de cima
  const vivo = document.getElementById('vivoN');
  if (vivo) {
    const atualizar = () => IlhaDados.contagem().then(d => {
      IlhaContar(vivo, d.total || 0);
      document.getElementById('vivoT').textContent = IlhaPlural(d.total, 'respondeu', 'responderam');
      window.IlhaUltima = d; // quem carregar depois (módulos) lê daqui
      document.dispatchEvent(new CustomEvent('ilha:contagem', { detail: d }));
    }).catch(() => {});
    atualizar();
    setInterval(atualizar, (window.ILHA.atualizarACada || 20) * 1000);
  }
})();
