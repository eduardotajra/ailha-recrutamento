/*
 * Configuração do site de recrutamento da equipe de A Ilha.
 * Tudo o que você pode querer trocar sem mexer no resto está aqui.
 */
window.ILHA = {
  // Endereço do Apps Script publicado (ver backend/LEIAME.md). Vazio = modo de teste: as candidaturas ficam só
  // neste navegador e o painel mostra os números daqui, com um aviso.
  endpoint:
    "https://script.google.com/macros/s/AKfycbwuTeefVgJN6iNyRWO8zE1LRgX8NlKc9_gVdKHpaiaZ9HUbbW3JIxCXYWlCzAf267R5yA/exec",

  // De quanto em quanto tempo o painel pergunta os números (segundos).
  atualizarACada: 20,

  // Inscrições abertas? Com false, o botão de enviar some e aparece o aviso abaixo.
  aberto: true,
  avisoFechado:
    "As inscrições estão fechadas por enquanto. Fique de olho no Discord.",

  // Vídeo com som, aberto pelo botão "Vídeo" no topo. Pode ser um mp4 da pasta midia/ ou um link do YouTube.
  // Vazio = o botão não aparece.
  trailer: "",

  // Convite do Discord (aparece no fim da candidatura e no rodapé). Vazio = não aparece.
  discord: "https://discord.gg/x9AK6nPxTr",

  // As áreas em que a equipe precisa de gente. A ordem aqui é a ordem no site.
  cargos: [
    {
      id: "construcao",
      nome: "Construção",
      icone: "▣",
      chamada: "Precisamos de gente para construir na ilha.",
      bloco: "tijolo",
      sobre:
        "Precisamos de pessoas para construir na ilha. O que vai ser construído, você descobre quando entrar.",
      faz: [
        "Construir na ilha, junto com a equipe",
        "Decorar: interiores, detalhes e acabamento",
        "Propor ideias sem esperar alguém pedir",
      ],
      ajuda: "Proatividade, criatividade e saber construir e decorar.",
      cena: "casa",
      pedeLink: true,
      ferramentas: [
        "Bloco a bloco",
        "WorldEdit",
        "Axiom",
        "Litematica",
        "Outra",
      ],
      termos: [
        "Construo no mundo de construção da equipe, nunca direto no mapa dos jogadores sem combinar.",
        "O que eu construir para o servidor pode ser usado, ajustado e reaproveitado no mapa.",
      ],
    },
    {
      id: "arte",
      nome: "Arte",
      icone: "◩",
      chamada: "Pixel art para os itens, e desenhos também.",
      bloco: "la",
      sobre:
        "Pixel art para os itens e também desenhos: ilustrações, personagens, artes do servidor e o que mais vier.",
      faz: [
        "Pixel art dos itens, no estilo do jogo",
        "Desenhos e ilustrações",
        "Artes para anúncios e eventos",
      ],
      ajuda: "Pixel art ou desenho (ou os dois). Aseprite, Photoshop, Krita, Procreate, papel: o que você usar.",
      cena: "mural",
      pedeLink: true,
      ferramentas: [
        "Aseprite",
        "Photoshop",
        "Krita",
        "Piskel",
        "Procreate",
        "Papel e scanner",
        "Outra",
      ],
      termos: [
        "Não uso imagem gerada por inteligência artificial em nada que entregar.",
        "O que eu desenhar para o servidor pode ser usado no mod, no mapa e na divulgação, com crédito.",
      ],
    },
    {
      id: "modelagem",
      nome: "Modelagem",
      icone: "◰",
      chamada: "Modelos de blocos, itens e personagens, e skins.",
      bloco: "argila",
      sobre:
        "Modelos de blocos, itens e personagens, e skins.",
      faz: [
        "Modelos de blocos e itens",
        "Personagens",
        "Skins",
      ],
      ajuda: "Blockbench e noção de textura. Para skins, o editor que você preferir.",
      cena: "lobo",
      pedeLink: true,
      ferramentas: [
        "Modelos de bloco e item",
        "Personagens",
        "Skins",
        "Textura e UV",
        "Animação",
      ],
      termos: [
        "Não uso modelo ou textura gerados por inteligência artificial.",
        "O que eu modelar para o servidor pode ser usado e ajustado no mod, com crédito.",
      ],
    },
    {
      id: "lore",
      nome: "Escrita de lore",
      icone: "✎",
      chamada: "Diários, cartas, registros e eventos da história.",
      bloco: "estante",
      sobre:
        "Diários, cartas, registros, falas e eventos. Você entra na história por dentro e ajuda a escrever o que ainda não aconteceu.",
      faz: [
        "Textos encontrados pelo mapa (diários, bilhetes, registros)",
        "Ideias e roteiro de eventos",
        "Personagens, com o resto da equipe",
      ],
      ajuda: "Escrever bem em português, gostar de terror e de mistério.",
      cena: "livro",
      ferramentas: [
        "Contos",
        "Roteiro",
        "RPG de mesa",
        "Fanfic",
        "Poesia",
        "Interpretação (RP)",
      ],
      amostra:
        "Escreva um bilhete curto que alguém deixou num lugar abandonado. Tema livre, até 600 letras. Queremos ver o seu jeito de escrever, não uma resposta certa.",
      termos: [
        "Nada da lore sai da equipe: nem prints, nem conversas, nem pistas para amigos.",
        "O que eu escrever para o servidor passa a fazer parte da história de A Ilha.",
      ],
    },
    {
      id: "arquivo",
      nome: "Organização da lore",
      icone: "☰",
      chamada: "Reunir, ordenar e manter a história em dia.",
      bloco: "barril_lado",
      sobre:
        "Já existe muita coisa escrita e espalhada. Alguém precisa reunir, ordenar, apontar o que contradiz o quê e manter isso em dia.",
      faz: [
        "Reunir e organizar tudo o que já foi decidido (Notion)",
        "Linha do tempo, fichas de personagens e lugares",
        "Apontar contradições antes que cheguem aos jogadores",
      ],
      ajuda: "Gostar de organizar, Notion ou planilhas, atenção a detalhe.",
      cena: "ordem",
      ferramentas: [
        "Notion",
        "Obsidian",
        "Google Docs",
        "Planilhas",
        "Wiki",
        "Trello",
      ],
      termos: [
        "Nada da lore sai da equipe: nem prints, nem conversas, nem pistas para amigos.",
        "Mantenho o arquivo organizado e aviso quando algo estiver desatualizado.",
      ],
    },
  ],

  // Áreas em que a pessoa pode dizer que JÁ TEM experiência (mais amplo que as vagas).
  experiencias: [
    "Construção",
    "Pixel art e texturas",
    "Desenho e ilustração",
    "Modelagem (Blockbench)",
    "Escrita",
    "Organização e documentação",
    "Edição de vídeo",
    "Programação",
    "Moderação",
    "Balanceamento",
    "Interpretação (RP)",
    "Eventos",
  ],

  // Termos que valem para todas as áreas.
  termosGerais: [
    "Sei que entrar na equipe não me dá vantagem nenhuma como jogador.",
    "Aviso quando for ficar ausente, em vez de sumir.",
    "Respeito o resto da equipe e as decisões finais do servidor, mesmo quando discordo.",
  ],
};
