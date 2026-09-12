import { createLocalId } from "@/lib/utils";

export type WordDocument = {
  id: string;
  title: string;
  html: string;
  updatedAt: number;
};

export const EMPTY_WORD_HTML = "<p><br></p>";
export const LEGAL_LIST_ATTRIBUTE = "data-legal-list";
export const LEGAL_LEVEL_ATTRIBUTE = "data-legal-level";
export const LEGAL_MAX_LEVEL = 5;

export function createWordDocument(): WordDocument {
  return {
    id: `word-${createLocalId()}`,
    title: "Documento sin título",
    html: EMPTY_WORD_HTML,
    updatedAt: Date.now(),
  };
}

const ALLOWED_TAGS = new Set([
  "P", "BR", "DIV", "H1", "H2", "H3", "BLOCKQUOTE", "UL", "OL", "LI",
  "STRONG", "B", "EM", "I", "U", "S", "MARK", "A", "IMG", "TABLE", "THEAD",
  "TBODY", "TR", "TH", "TD", "HR", "SPAN",
]);

function legalLevel(value: string | null): number {
  const level = Number(value);
  return Number.isInteger(level) ? Math.max(1, Math.min(LEGAL_MAX_LEVEL, level)) : 1;
}

/** Adds the legal-list marker and keeps nested ordered lists at levels 1–5. */
export function normalizeLegalLists(root: Element): void {
  for (const list of Array.from(root.querySelectorAll("ol"))) {
    const parentList = list.parentElement?.closest("ol");
    const level = parentList ? Math.min(LEGAL_MAX_LEVEL, legalLevel(parentList.getAttribute(LEGAL_LEVEL_ATTRIBUTE)) + 1) : 1;
    list.setAttribute(LEGAL_LIST_ATTRIBUTE, "true");
    list.setAttribute(LEGAL_LEVEL_ATTRIBUTE, String(level));
  }
}

/** Keeps saved editor HTML limited to the tags and links the editor can create. */
export function sanitizeWordHtml(html: string): string {
  if (typeof DOMParser === "undefined") return html || EMPTY_WORD_HTML;
  const root = new DOMParser().parseFromString(`<div>${html || EMPTY_WORD_HTML}</div>`, "text/html").body.firstElementChild;
  if (!root) return EMPTY_WORD_HTML;

  const clean = (node: Element) => {
    for (const child of Array.from(node.children)) {
      if (!ALLOWED_TAGS.has(child.tagName)) {
        child.remove();
        continue;
      }
      for (const attribute of Array.from(child.attributes)) {
        const name = attribute.name.toLowerCase();
        const value = attribute.value.trim();
        const legalAttribute = name === LEGAL_LIST_ATTRIBUTE && value === "true"
          || name === LEGAL_LEVEL_ATTRIBUTE && /^[1-5]$/.test(value);
        const allowed = legalAttribute || name === "alt" || name === "title" || name === "colspan" || name === "rowspan" || name === "style" || name === "align" || name === "href" || name === "src";
        const safeUrl = (name !== "href" && name !== "src") || /^(https?:|mailto:|data:image\/)/i.test(value);
        const safeAlign = name !== "align" || /^(left|center|right|justify)$/i.test(value);
        if (!allowed || !safeUrl || !safeAlign || name.startsWith("on")) child.removeAttribute(attribute.name);
      }
      clean(child);
    }
  };
  clean(root);
  normalizeLegalLists(root);
  return root.innerHTML || EMPTY_WORD_HTML;
}

export function isWordDocument(value: unknown): value is WordDocument {
  return !!value && typeof value === "object"
    && typeof (value as WordDocument).id === "string"
    && typeof (value as WordDocument).title === "string"
    && typeof (value as WordDocument).html === "string";
}
