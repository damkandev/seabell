import { NextResponse } from "next/server";

const TYPES = new Set(["ley", "dl", "dfl", "dto"]);
const TYPE_LABEL: Record<string, string> = { ley: "Ley", dl: "Decreto Ley", dfl: "Decreto con Fuerza de Ley", dto: "Decreto" };
const ORIGIN = "https://leyes.pisanvs.cl";
const BCN_SPARQL = "https://datos.bcn.cl/sparql";
const BCN_TYPE: Record<string, string> = { ley: "ley", dl: "dl", dfl: "dfl", dto: "dto" };

type CommitsResponse = {
  norma: { id_norma: number; numero: string; tipo: string; titulo: string; organismo: string; fecha_publicacion: string };
  commits: Array<{ date: string }>;
};

function plain(value: string): string {
  return value.replace(/<!--[\s\S]*?-->/gu, " ").replace(/<[^>]+>/gu, " ").replace(/&(?:amp|quot|#39);/gu, " ").replace(/\s+/gu, " ").trim();
}

function candidatesFromSearch(html: string, type: string, number: string) {
  const candidates: Array<{ id: string; title: string; label: string; sourceUrl: string }> = [];
  const seen = new Set<string>();
  const links = /<a[^>]*href="(\/norma\/(\d+)\/[^"#]+)[^>]*>([\s\S]*?)<\/a>/gu;
  for (const match of html.matchAll(links)) {
    const id = match[2];
    const body = match[3];
    const title = plain(/<h3[^>]*>([\s\S]*?)<\/h3>/u.exec(body)?.[1] ?? "");
    const label = plain(/<div[^>]*>([\s\S]*?)<\/div>/u.exec(body)?.[1] ?? "");
    const labelNumber = label.replace(/\D/gu, "");
    const expectedType = TYPE_LABEL[type].toLocaleLowerCase();
    if (!id || !title || seen.has(id) || labelNumber !== number || !label.toLocaleLowerCase().startsWith(expectedType)) continue;
    seen.add(id);
    candidates.push({ id, title, label, sourceUrl: new URL(match[1], ORIGIN).toString() });
    if (candidates.length === 5) break;
  }
  return candidates;
}

async function lawResponse(id: string, sourceUrl: string) {
  const metadataResponse = await fetch(`${ORIGIN}/api/idx/commits/${id}`, { next: { revalidate: 86_400 } });
  if (!metadataResponse.ok) throw new Error("No se pudieron obtener los metadatos de la norma.");
  const metadata = await metadataResponse.json() as CommitsResponse;
  const date = metadata.commits.at(-1)?.date ?? metadata.norma.fecha_publicacion;
  const textResponse = await fetch(`${ORIGIN}/api/text/${id}/${date}`, { next: { revalidate: 86_400 } });
  if (!textResponse.ok) throw new Error("No se pudo obtener el texto de la norma.");
  return { kind: "law", sourceUrl, law: { ...metadata.norma, text: await textResponse.text() } };
}

async function resolveBcnId(type: string, number: string): Promise<string | null> {
  const query = `PREFIX bcn: <http://datos.bcn.cl/ontologies/bcn-norms#>
SELECT DISTINCT ?code WHERE {
  ?s bcn:leychileCode ?code .
  FILTER(REGEX(STR(?s), "/${BCN_TYPE[type]}/[^/]+/[^/]+/${number}$"))
} LIMIT 2`;
  const response = await fetch(BCN_SPARQL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ query, format: "application/json" }),
    next: { revalidate: 86_400 },
  });
  if (!response.ok) return null;
  const payload = await response.json() as { results?: { bindings?: Array<{ code?: { value?: string } }> } };
  return payload.results?.bindings?.[0]?.code?.value ?? null;
}

export async function GET(request: Request, { params }: { params: Promise<{ type: string; number: string }> }) {
  const { type, number } = await params;
  if (!TYPES.has(type) || !/^\d+$/u.test(number)) return NextResponse.json({ error: "Referencia legal inválida." }, { status: 400 });

  try {
    const bcnId = await resolveBcnId(type, number);
    if (bcnId) {
      const sourceUrl = `https://www.bcn.cl/leychile/navegar?idNorma=${bcnId}`;
      try {
        return NextResponse.json(await lawResponse(bcnId, sourceUrl));
      } catch {
        return NextResponse.json({ kind: "official", sourceUrl });
      }
    }
  } catch {
    // LeyChile remains a fallback only if the official linked-data service is unavailable.
  }

  const directUrl = new URL(`/${type}/${number}`, ORIGIN);
  try {
    const selectedId = new URL(request.url).searchParams.get("id");
    if (selectedId && /^\d+$/u.test(selectedId)) return NextResponse.json(await lawResponse(selectedId, new URL(`/norma/${selectedId}`, ORIGIN).toString()));
    const shortUrl = await fetch(directUrl, { method: "HEAD", redirect: "manual", next: { revalidate: 86_400 } });
    const location = shortUrl.headers.get("location") ?? "";
    const id = /\/norma\/(\d+)(?:\/|$)/u.exec(location)?.[1];
    if (id) return NextResponse.json(await lawResponse(id, directUrl.toString()));
  } catch {
    // Fall through to the provider's search page for ambiguous citations.
  }

  const searchUrl = new URL("/buscar", ORIGIN);
  searchUrl.searchParams.set("q", `${TYPE_LABEL[type]} ${number}`);
  const searchResponse = await fetch(searchUrl, { next: { revalidate: 86_400 } });
  const candidates = searchResponse.ok ? candidatesFromSearch(await searchResponse.text(), type, number) : [];
  return NextResponse.json({ kind: "search", sourceUrl: searchUrl.toString(), candidates });
}
