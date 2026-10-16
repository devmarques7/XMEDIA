// Tema único de todos os emails (convite do portal, proposta, booking, agradecimento, avaliação): a mesma estrutura,
// cores e tipografia da app — texto em BioGrotesk (com alternativas seguras para email) e etiquetas em Fragment Mono.
export const EMAIL_SANS = "'BioGrotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif";
export const EMAIL_MONO = "'Fragment Mono', ui-monospace, Menlo, Consolas, monospace";
export const EMAIL_FONTS_LINK = `<link href="https://fonts.googleapis.com/css2?family=Fragment+Mono&display=swap" rel="stylesheet">`;
/** Etiqueta laranja por cima do título (cliente / proposta). */
export const KICKER_STYLE = `font-family:${EMAIL_MONO};font-size:12px;letter-spacing:2px;color:#ff5a1f;font-weight:400;text-transform:uppercase`;
/** Título pequeno das tabelas de detalhes. */
export const LABEL_STYLE = `font-family:${EMAIL_MONO};font-size:11px;letter-spacing:1.6px;color:#8a8a8a;text-transform:uppercase`;
