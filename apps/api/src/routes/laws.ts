import { Hono } from "hono";

const ORIGIN = "https://leyes.pisanvs.cl/api/v1";
const WEB_ORIGIN = "https://leyes.pisanvs.cl";
const TYPES = new Set(["ley", "dl", "dfl", "dto", "cod", "res", "cir", "ord", "aa"]);
const TYPE_LABEL: Record<string, string> = {
  ley: "Ley",
  dl: "Decreto Ley",
  dfl: "Decreto con Fuerza de Ley",
  dto: "Decreto",
  cod: "Código",
  res: "Resolución",
  cir: "Circular",
  ord: "Ordenanza",
  aa: "Auto Acordado",
};

type NormaRef = {
  idNorma: number;
  tipo: string;
  numero: string;
  titulo: string;
  organismo?: string;
};

type Norma = NormaRef & {
  fecha: string;
  fechaPublicacion?: string | null;
  articulos: Array<{ slug: string; label: string }>;
};

type SearchResponse = {
  resultados: NormaRef[];
};

type Article = {
  label: string;
  body: string;
};

const laws = new Hono();

function apiHeaders(): HeadersInit {
  const key = process.env.API_KEY_LEYCHILE;
  if (!key) throw new Error("API_KEY_LEYCHILE no está configurada.");
  return { Authorization: `Bearer ${key}` };
}

async function apiJson<T>(path: string): Promise<T> {
  const response = await fetch(`${ORIGIN}${path}`, { headers: apiHeaders() });
  if (!response.ok) throw new Error(`LeyChile respondió ${response.status}.`);
  return await response.json() as T;
}

async function lawResponse(id: string, fallbackSourceUrl: string) {
  const norma = await apiJson<Norma>(`/normas/${id}`);
  const [raw, articles] = await Promise.all([
    apiJson<{ url?: string }>(`/normas/${id}/raw`).catch(() => null),
    Promise.all(norma.articulos.map(async (article) => apiJson<Article>(`/normas/${id}/articulos/${encodeURIComponent(article.slug)}`))),
  ]);

  return {
    kind: "law" as const,
    sourceUrl: raw?.url ?? fallbackSourceUrl,
    law: {
      titulo: norma.titulo,
      organismo: norma.organismo ?? "Organismo no informado",
      fecha_publicacion: norma.fechaPublicacion ?? norma.fecha,
      articles,
    },
  };
}

laws.get("/:type/:number", async (c) => {
  const { type, number } = c.req.param();
  if (!TYPES.has(type) || !/^[\da-z-]+$/iu.test(number)) return c.json({ error: "Referencia legal inválida." }, 400);
  if (!process.env.API_KEY_LEYCHILE) return c.json({ error: "La API de LeyChile no está configurada." }, 503);

  try {
    const selectedId = c.req.query("id");
    if (selectedId && /^\d+$/u.test(selectedId)) {
      return c.json(await lawResponse(selectedId, `${WEB_ORIGIN}/norma/${selectedId}`));
    }

    const search = await apiJson<SearchResponse>(`/search?tipo=${type}&numero=${number}`);
    const candidates = search.resultados.map((result) => ({
      id: String(result.idNorma),
      title: result.titulo,
      label: `${TYPE_LABEL[result.tipo] ?? result.tipo} ${result.numero}`,
      sourceUrl: `${WEB_ORIGIN}/norma/${result.idNorma}`,
    }));
    if (candidates.length === 1) return c.json(await lawResponse(candidates[0].id, candidates[0].sourceUrl));
    return c.json({ kind: "search", sourceUrl: `${WEB_ORIGIN}/buscar?q=${encodeURIComponent(`${TYPE_LABEL[type]} ${number}`)}`, candidates });
  } catch {
    return c.json({ error: "No se pudo consultar la API oficial de LeyChile." }, 502);
  }
});

export default laws;
