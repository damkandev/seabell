export type LawType = "ley" | "dl" | "dfl" | "dto" | "cod" | "res" | "cir" | "ord" | "aa";

export type LawReference = {
  id: string;
  pageNumber: number;
  type: LawType;
  number: string;
  idNorma?: number;
  articleNumber?: string;
  label: string;
  context: string;
  /** Offsets in the indexed text of its PDF page. */
  start: number;
  end: number;
};

export type ArticleMention = {
  articleNumber: string;
  context: string;
  start: number;
  end: number;
};

type LawPattern = {
  type: LawType;
  label: string;
  expression: RegExp;
};

type NamedLaw = {
  type: LawType;
  number: string;
  label: string;
  idNorma?: number;
};

// Kept deliberately conservative: a false positive in a legal document is
// worse than leaving an uncommon citation for a later iteration.
const LAW_PATTERNS: LawPattern[] = [
  { type: "ley", label: "Ley", expression: /\bLey\s*(?:N(?:[°ºo.]|\s)*\s*)?(\d{1,3}(?:[.\s]\d{3})+)\b/giu },
  { type: "ley", label: "Ley Orgánica Constitucional", expression: /\bLey\s+Orgánica\s+Constitucional\s*(?:N(?:[°ºo.]|\s)*\s*)?(\d{1,3}(?:[.\s]\d{3})+)\b/giu },
  { type: "ley", label: "Ley de Quórum Calificado", expression: /\bLey\s+de\s+Quórum\s+Calificado\s*(?:N(?:[°ºo.]|\s)*\s*)?(\d{1,3}(?:[.\s]\d{3})+)\b/giu },
  { type: "ley", label: "Ley Interpretativa de la Constitución", expression: /\bLey\s+Interpretativa\s+de\s+la\s+Constitución\s*(?:N(?:[°ºo.]|\s)*\s*)?(\d{1,3}(?:[.\s]\d{3})+)\b/giu },
  { type: "dfl", label: "DFL", expression: /\b(?:Decreto\s+con\s+Fuerza\s+de\s+Ley|DFL)\s*(?:N(?:[°ºo.]|\s)*\s*)?(\d{1,3}(?:[.\s]\d{3})*)\b/giu },
  { type: "dl", label: "DL", expression: /\b(?:Decreto\s+Ley|DL)\s*(?:N(?:[°ºo.]|\s)*\s*)?(\d{1,3}(?:[.\s]\d{3})*)\b/giu },
  { type: "dto", label: "Decreto", expression: /\bDecreto\s+(?:Supremo\s+)?(?:N(?:[°ºo.]|\s)*\s*)?(\d{1,3}(?:[.\s]\d{3})*)\b/giu },
  { type: "res", label: "Resolución", expression: /\b(?:Resolución\s+Exenta|Resolución|Res\.)\s*(?:N(?:[°ºo.]|\s)*\s*)?(\d{1,3}(?:[.\s]\d{3})*)\b/giu },
  { type: "cir", label: "Circular", expression: /\b(?:Circular|CIR)\s*(?:N(?:[°ºo.]|\s)*\s*)?(\d{1,3}(?:[.\s]\d{3})*)\b/giu },
  { type: "ord", label: "Ordenanza", expression: /\bOrdenanza\s*(?:N(?:[°ºo.]|\s)*\s*)?(\d{1,3}(?:[.\s]\d{3})*)\b/giu },
  { type: "aa", label: "Auto Acordado", expression: /\bAuto\s+Acordado\s*(?:N(?:[°ºo.]|\s)*\s*)?(\d{1,3}(?:[.\s]\d{3})*)\b/giu },
];

const NAMED_LAWS: NamedLaw[] = [
  { type: "dto", number: "100", label: "Constitución Política de la República", idNorma: 242302 },
  { type: "dto", number: "100", label: "Constitución", idNorma: 242302 },
  { type: "dto", number: "100", label: "Carta Fundamental", idNorma: 242302 },
  { type: "cod", number: "1855", label: "Código Civil", idNorma: 1973 },
  { type: "cod", number: "1984", label: "Código Penal", idNorma: 1984 },
  { type: "cod", number: "comercio", label: "Código de Comercio", idNorma: 1974 },
  { type: "dfl", number: "1", label: "Código del Trabajo", idNorma: 3471 },
  { type: "dl", number: "830", label: "Código Tributario", idNorma: 6374 },
  { type: "dfl", number: "725", label: "Código Sanitario", idNorma: 5595 },
  { type: "dfl", number: "1122", label: "Código de Aguas", idNorma: 5605 },
  { type: "ley", number: "18248", label: "Código de Minería", idNorma: 29668 },
  { type: "ley", number: "18916", label: "Código Aeronáutico", idNorma: 30287 },
  { type: "ley", number: "19696", label: "Código Procesal Penal", idNorma: 176595 },
  { type: "ley", number: "1552", label: "Código de Procedimiento Civil", idNorma: 22740 },
  { type: "ley", number: "7421", label: "Código Orgánico de Tribunales" },
  { type: "dto", number: "2226", label: "Código de Justicia Militar", idNorma: 18914 },
  { type: "ley", number: "21643", label: "Ley Karin" },
  { type: "ley", number: "20609", label: "Ley Zamudio" },
  { type: "ley", number: "20770", label: "Ley Emilia" },
  { type: "ley", number: "21020", label: "Ley Cholito" },
  { type: "ley", number: "21560", label: "Ley Naín-Retamal" },
  { type: "ley", number: "21389", label: "Ley Papito Corazón" },
  { type: "ley", number: "21015", label: "Ley de Inclusión Laboral" },
  { type: "ley", number: "21120", label: "Ley de Identidad de Género" },
  { type: "ley", number: "20084", label: "Ley de Responsabilidad Penal Adolescente" },
  { type: "ley", number: "20285", label: "Ley de Transparencia" },
  { type: "ley", number: "20730", label: "Ley de Lobby" },
  { type: "ley", number: "21595", label: "Ley de Delitos Económicos" },
  { type: "ley", number: "19496", label: "Ley de Protección al Consumidor" },
  { type: "ley", number: "19496", label: "Ley del Consumidor" },
  { type: "ley", number: "18046", label: "Ley de Sociedades Anónimas" },
  { type: "dfl", number: "3", label: "Ley General de Bancos" },
  { type: "dfl", number: "458", label: "Ley General de Urbanismo y Construcciones" },
  { type: "ley", number: "21442", label: "Ley de Copropiedad Inmobiliaria" },
  { type: "ley", number: "17336", label: "Ley de Propiedad Intelectual" },
  { type: "ley", number: "19039", label: "Ley de Propiedad Industrial" },
  { type: "ley", number: "18045", label: "Ley de Mercado de Valores" },
  { type: "dl", number: "824", label: "Ley de Impuesto a la Renta" },
  { type: "dl", number: "825", label: "Ley sobre Impuesto a las Ventas y Servicios" },
  { type: "dl", number: "825", label: "Ley de IVA" },
  { type: "dfl", number: "29", label: "Estatuto Administrativo" },
  { type: "dfl", number: "1", label: "Estatuto Docente" },
  { type: "ley", number: "19378", label: "Estatuto de Atención Primaria de Salud" },
  { type: "ley", number: "20370", label: "Ley General de Educación" },
  { type: "ley", number: "18695", label: "Ley Orgánica Constitucional de Municipalidades" },
  { type: "ley", number: "18918", label: "Ley Orgánica Constitucional del Congreso Nacional" },
  { type: "ley", number: "18840", label: "Ley Orgánica Constitucional del Banco Central" },
  { type: "ley", number: "18575", label: "Ley de Bases Generales de la Administración del Estado" },
];

const ACCENT_VARIANTS: Record<string, string> = {
  a: "áàäâ",
  e: "éèëê",
  i: "íìïî",
  o: "óòöô",
  u: "úùüû",
  n: "ñ",
};

function namedLawPattern(label: string): RegExp {
  let expression = "";
  for (const character of label.toLocaleLowerCase()) {
    if (/\s/u.test(character)) expression += "\\s+";
    else if (character === "-") expression += "[-‐‑–—]";
    else {
      const base = character.normalize("NFD").replace(/\p{M}/gu, "");
      const variants = ACCENT_VARIANTS[base];
      expression += variants ? `[${base}${variants}]` : character.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    }
  }
  return new RegExp(`(?<![\\p{L}\\p{N}])${expression}(?![\\p{L}\\p{N}])`, "giu");
}

const NAMED_LAW_PATTERNS = [...NAMED_LAWS]
  .sort((left, right) => right.label.length - left.label.length)
  .map((law) => ({ ...law, expression: namedLawPattern(law.label) }));

const ARTICLE_BEFORE_PATTERNS = [
  /\b(?:artículo|artículos|articulo|articulos)\.?\s*(?:N(?:[°ºo.]|\s)*\s*)?(\d+(?:\s+(?:bis|ter|quáter))?)\s*(?:[°ºo.]|\b)\s*(?:(?:de\s+(?:la|el)|del)\s+)?$/iu,
  /\barts?\.?\s*(?:N(?:[°ºo.]|\s)*\s*)?(\d+(?:\s+(?:bis|ter|quáter))?)\s*(?:[°ºo.]|\b)\s*(?:(?:de\s+(?:la|el)|del)\s+)?$/iu,
];

const ARTICLE_AFTER_PATTERNS = [
  /^\s*(?:(?:[,;:]|\b(?:en\s+su|en\s+el|del|de|y\s+el)\b)\s*)*(?:artículo|artículos|articulo|articulos)\.?\s*(?:N(?:[°ºo.]|\s)*\s*)?(\d+(?:\s+(?:bis|ter|quáter))?)\s*(?:[°ºo.]|\b)/iu,
  /^\s*(?:(?:[,;:]|\b(?:en\s+su|en\s+el|del|de|y\s+el)\b)\s*)*arts?\.?\s*(?:N(?:[°ºo.]|\s)*\s*)?(\d+(?:\s+(?:bis|ter|quáter))?)\s*(?:[°ºo.]|\b)/iu,
];

const ARTICLE_MENTION_PATTERNS = [
  /\b(?:artículo|artículos|articulo|articulos)\.?\s*(?:N(?:[°ºo.]|\s)*\s*)?(\d+(?:\s+(?:bis|ter|quáter))?)\s*(?:[°ºo.]|\b)/giu,
  /\barts?\.?\s*(?:N(?:[°ºo.]|\s)*\s*)?(\d+(?:\s+(?:bis|ter|quáter))?)\s*(?:[°ºo.]|\b)/giu,
];

function normalizeNumber(value: string): string {
  return value.replace(/\D/gu, "");
}

function compactContext(text: string, start: number, end: number): string {
  const padding = 90;
  const before = text.slice(Math.max(0, start - padding), start).replace(/\s+/gu, " ").trim();
  const match = text.slice(start, end).replace(/\s+/gu, " ").trim();
  const after = text.slice(end, end + padding).replace(/\s+/gu, " ").trim();
  return `${before ? `…${before} ` : ""}${match}${after ? ` ${after}…` : ""}`;
}

function findArticleNumber(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]) return match[1].replace(/\s+/gu, " ").trim().toLowerCase();
  }
  return undefined;
}

function citedArticleNumber(text: string, start: number, end: number): string | undefined {
  const before = text.slice(Math.max(0, start - 48), start);
  const beforeArticle = findArticleNumber(before, ARTICLE_BEFORE_PATTERNS);
  if (beforeArticle) return beforeArticle;

  const after = text.slice(end, end + 48);
  return findArticleNumber(after, ARTICLE_AFTER_PATTERNS);
}

export function findArticleMentions(text: string): ArticleMention[] {
  const mentions: ArticleMention[] = [];
  for (const pattern of ARTICLE_MENTION_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      if (match.index === undefined || !match[1]) continue;
      mentions.push({
        articleNumber: match[1].replace(/\s+/gu, " ").trim().toLowerCase(),
        context: compactContext(text, match.index, match.index + match[0].length),
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }
  return mentions.sort((left, right) => left.start - right.start);
}

export function findArticleReferences(
  text: string,
  pageNumber: number,
  law: Pick<LawReference, "type" | "number" | "label" | "idNorma">,
  linkedReferences: Pick<LawReference, "articleNumber" | "start" | "end">[] = [],
): LawReference[] {
  return findArticleMentions(text)
    .filter((mention) => !linkedReferences.some((reference) => reference.articleNumber !== undefined &&
      mention.start >= reference.start - 48 && mention.start <= reference.end + 48,
    ))
    .map((mention) => ({
      id: `${pageNumber}-${law.type}-${law.number}-article-${mention.start}`,
      pageNumber,
      type: law.type,
      number: law.number,
      ...(law.idNorma ? { idNorma: law.idNorma } : {}),
      articleNumber: mention.articleNumber,
      label: law.label,
      context: mention.context,
      start: mention.start,
      end: mention.end,
    }));
}

export function findLawReferences(text: string, pageNumber: number): LawReference[] {
  const found: LawReference[] = [];
  const seen = new Set<string>();

  for (const pattern of LAW_PATTERNS) {
    pattern.expression.lastIndex = 0;
    for (const match of text.matchAll(pattern.expression)) {
      const number = normalizeNumber(match[1] ?? "");
      if (!number || match.index === undefined) continue;
      // Do not turn the "Ley" portion of "Decreto Ley" into a separate law.
      if (pattern.type === "ley" && /decreto\s+$/iu.test(text.slice(Math.max(0, match.index - 12), match.index))) continue;
      const key = `${pattern.type}-${number}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const articleNumber = citedArticleNumber(text, match.index, match.index + match[0].length);
      found.push({
        id: `${pageNumber}-${key}`,
        pageNumber,
        type: pattern.type,
        number,
        ...(articleNumber ? { articleNumber } : {}),
        label: `${pattern.label} ${number.replace(/(\d)(?=(\d{3})+$)/gu, "$1.")}`,
        context: compactContext(text, match.index, match.index + match[0].length),
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  for (const named of NAMED_LAW_PATTERNS) {
    named.expression.lastIndex = 0;
    for (const match of text.matchAll(named.expression)) {
      if (match.index === undefined) continue;
      const key = `${named.type}-${named.number}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const articleNumber = citedArticleNumber(text, match.index, match.index + match[0].length);
      found.push({
        id: `${pageNumber}-${key}`,
        pageNumber,
        type: named.type,
        number: named.number,
        ...(named.idNorma ? { idNorma: named.idNorma } : {}),
        ...(articleNumber ? { articleNumber } : {}),
        label: named.label,
        context: compactContext(text, match.index, match.index + match[0].length),
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  return found.sort((left, right) => left.id.localeCompare(right.id));
}
