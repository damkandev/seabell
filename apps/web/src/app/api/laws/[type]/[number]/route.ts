import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export async function GET(request: Request, { params }: { params: Promise<{ type: string; number: string }> }) {
  const { type, number } = await params;
  const url = new URL(`/laws/${type}/${number}`, API_URL);
  const id = new URL(request.url).searchParams.get("id");
  if (id) url.searchParams.set("id", id);

  try {
    const response = await fetch(url);
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json({ error: "No se pudo conectar con el servicio legal." }, { status: 502 });
  }
}
