"use client";

import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, FileDown, ImagePlus,
  Italic, Link, List, ListIndentDecrease, ListIndentIncrease, ListOrdered, Minus, Redo2, Search, Strikethrough,
  Table2, Underline, Undo2, X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { LEGAL_LIST_ATTRIBUTE, LEGAL_LEVEL_ATTRIBUTE, LEGAL_MAX_LEVEL, normalizeLegalLists, sanitizeWordHtml, type WordDocument } from "@/lib/word-document";

type WordEditorProps = {
  document: WordDocument;
  onChange: (document: WordDocument) => void;
};

type Command = "bold" | "italic" | "underline" | "strikeThrough" | "foreColor" | "justifyLeft" | "justifyCenter" | "justifyRight" | "justifyFull" | "insertUnorderedList" | "insertOrderedList" | "undo" | "redo";

const buttonClass = "size-8 rounded-md";
const legalListCss = "ol[data-legal-list=\"true\"]{list-style:none;padding-left:2.25em}ol[data-legal-list=\"true\"][data-legal-level=\"1\"]{counter-reset:legal-article}ol[data-legal-list=\"true\"][data-legal-level=\"2\"]{counter-reset:legal-numeral}ol[data-legal-list=\"true\"][data-legal-level=\"3\"]{counter-reset:legal-letter}ol[data-legal-list=\"true\"][data-legal-level=\"4\"]{counter-reset:legal-roman}ol[data-legal-list=\"true\"]>li{position:relative}ol[data-legal-list=\"true\"]>li::before{position:absolute;right:100%;width:2.25em;padding-right:.4em;text-align:right;color:#475569}ol[data-legal-list=\"true\"][data-legal-level=\"1\"]>li{counter-increment:legal-article}ol[data-legal-list=\"true\"][data-legal-level=\"1\"]>li::before{content:counter(legal-article) \".\"}ol[data-legal-list=\"true\"][data-legal-level=\"2\"]>li{counter-increment:legal-numeral}ol[data-legal-list=\"true\"][data-legal-level=\"2\"]>li::before{content:counter(legal-article) \".\" counter(legal-numeral) \".\"}ol[data-legal-list=\"true\"][data-legal-level=\"3\"]>li{counter-increment:legal-letter}ol[data-legal-list=\"true\"][data-legal-level=\"3\"]>li::before{content:counter(legal-letter,lower-alpha) \")\"}ol[data-legal-list=\"true\"][data-legal-level=\"4\"]>li{counter-increment:legal-roman}ol[data-legal-list=\"true\"][data-legal-level=\"4\"]>li::before{content:counter(legal-roman,lower-roman) \")\"}ol[data-legal-list=\"true\"][data-legal-level=\"5\"]>li::before{content:\"-\"}";

export function WordEditor({ document: wordDocument, onChange }: WordEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Range | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [replaceValue, setReplaceValue] = useState("");
  const [searchText, setSearchText] = useState("");
  const [printHint, setPrintHint] = useState<string | null>(null);

  useEffect(() => {
    if (editorRef.current && window.document.activeElement !== editorRef.current) {
      editorRef.current.innerHTML = sanitizeWordHtml(wordDocument.html);
      setSearchText(editorRef.current.innerText);
    }
  }, [wordDocument.id, wordDocument.html]);

  function saveContent() {
    if (editorRef.current) normalizeLegalLists(editorRef.current);
    const html = sanitizeWordHtml(editorRef.current?.innerHTML || "");
    setSearchText(editorRef.current?.innerText || "");
    onChange({ ...wordDocument, html, updatedAt: Date.now() });
  }

  function run(command: Command, value?: string) {
    editorRef.current?.focus();
    if (selectionRef.current) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(selectionRef.current);
      selectionRef.current = null;
    }
    if (command.startsWith("justify")) window.document.execCommand("styleWithCSS", false, "true");
    window.document.execCommand(command, false, value);
    saveContent();
  }

  function insertHtml(html: string) {
    editorRef.current?.focus();
    window.document.execCommand("insertHTML", false, html);
    saveContent();
  }

  function restoreSelection() {
    editorRef.current?.focus();
    if (!selectionRef.current) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(selectionRef.current);
    selectionRef.current = null;
  }

  function selectedLegalItems(): HTMLLIElement[] {
    if (!editorRef.current) return [];
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : selectionRef.current;
    const items = Array.from(editorRef.current.querySelectorAll<HTMLLIElement>(`ol[${LEGAL_LIST_ATTRIBUTE}="true"] > li`));
    if (!range) return items.slice(0, 1);
    const selected = items.filter((item) => {
      try { return range.intersectsNode(item); } catch { return false; }
    });
    return selected.length ? selected : items.filter((item) => item.contains(range.startContainer)).slice(0, 1);
  }

  function legalList(item: HTMLLIElement): HTMLOListElement | null {
    const list = item.parentElement;
    return list instanceof HTMLOListElement && list.matches(`ol[${LEGAL_LIST_ATTRIBUTE}="true"]`) ? list : null;
  }

  function setListLevel(list: HTMLOListElement, level: number) {
    list.setAttribute(LEGAL_LIST_ATTRIBUTE, "true");
    list.setAttribute(LEGAL_LEVEL_ATTRIBUTE, String(Math.max(1, Math.min(LEGAL_MAX_LEVEL, level))));
  }

  function changeLegalLevel(delta: -1 | 1) {
    restoreSelection();
    const items = selectedLegalItems();
    if (!items.length) return;
    if (delta > 0) {
      items.forEach((item) => {
        const list = legalList(item);
        const previous = item.previousElementSibling;
        if (!list || !(previous instanceof HTMLLIElement) || Number(list.dataset.legalLevel) >= LEGAL_MAX_LEVEL) return;
        let nested = Array.from(previous.children).find((child): child is HTMLOListElement => child instanceof HTMLOListElement && child.matches(`ol[${LEGAL_LIST_ATTRIBUTE}="true"]`));
        if (!nested) {
          nested = window.document.createElement("ol");
          previous.append(nested);
        }
        setListLevel(nested, Number(list.dataset.legalLevel) + 1);
        nested.append(item);
        if (!list.children.length) list.remove();
      });
    } else {
      items.forEach((item) => {
        const list = legalList(item);
        if (!list) return;
        const parentItem = list.parentElement?.closest("li");
        if (!parentItem) {
          if (Number(list.dataset.legalLevel) !== 1) setListLevel(list, 1);
          return;
        }
        const parentList = legalList(parentItem);
        if (!parentList) return;
        parentItem.after(item);
        setListLevel(parentList, Number(parentList.dataset.legalLevel));
        if (!list.children.length) list.remove();
      });
    }
    saveContent();
  }

  function exitLegalItem(item: HTMLLIElement) {
    const list = legalList(item);
    if (!list) return false;
    const paragraph = window.document.createElement("p");
    const tail = list.cloneNode(false) as HTMLOListElement;
    while (item.firstChild) paragraph.append(item.firstChild);
    while (item.nextSibling) tail.append(item.nextSibling);
    item.remove();
    if (list.children.length) list.after(paragraph);
    else list.replaceWith(paragraph);
    if (tail.children.length) paragraph.after(tail);
    placeCaretAtEnd(paragraph);
    saveContent();
    return true;
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const selection = window.getSelection();
    const item = selection?.anchorNode ? closestLegalItem(selection.anchorNode) : null;
    if (event.key === "Tab" && item) {
      event.preventDefault();
      changeLegalLevel(event.shiftKey ? -1 : 1);
      return;
    }
    if (event.key === "Enter" && item && !item.textContent?.trim() && !item.querySelector("ol,ul")) {
      event.preventDefault();
      exitLegalItem(item);
      return;
    }
    if (event.key === "Backspace" && item && !item.textContent?.trim() && !item.querySelector("ol,ul")) {
      event.preventDefault();
      const previous = item.previousElementSibling;
      if (previous instanceof HTMLLIElement) {
        item.remove();
        placeCaretAtEnd(previous);
        saveContent();
      } else {
        exitLegalItem(item);
      }
    }
  }

  function handleBeforeInput(event: React.FormEvent<HTMLDivElement>) {
    const inputType = (event.nativeEvent as InputEvent).inputType;
    if (inputType !== "deleteContentBackward") return;
    const selection = window.getSelection();
    const item = selection?.anchorNode ? closestLegalItem(selection.anchorNode) : null;
    if (!item || item.textContent?.trim() || item.querySelector("ol,ul")) return;
    event.preventDefault();
    const previous = item.previousElementSibling;
    if (previous instanceof HTMLLIElement) {
      item.remove();
      placeCaretAtEnd(previous);
      saveContent();
    } else {
      exitLegalItem(item);
    }
  }

  function insertLink() {
    const url = window.prompt("Dirección del enlace");
    if (url?.trim()) run("createLink" as Command, url.trim());
  }

  function insertTable() {
    const rows = Math.max(1, Math.min(20, Number(window.prompt("Filas", "3")) || 3));
    const columns = Math.max(1, Math.min(10, Number(window.prompt("Columnas", "3")) || 3));
    const cells = Array.from({ length: columns }, () => "<td><br></td>").join("");
    insertHtml(`<table><tbody>${Array.from({ length: rows }, () => `<tr>${cells}</tr>`).join("")}</tbody></table><p><br></p>`);
  }

  function insertImage(file: File) {
    const reader = new FileReader();
    reader.onload = () => insertHtml(`<img src="${String(reader.result)}" alt="Imagen del documento">`);
    reader.readAsDataURL(file);
  }

  function applyFontSize(value: string) {
    const size = Number(value);
    if (!Number.isInteger(size) || size < 6 || size > 96 || !editorRef.current) return;
    const selection = window.getSelection();
    const range = selectionRef.current;
    if (!range || !editorRef.current.contains(range.commonAncestorContainer)) return;
    const span = window.document.createElement("span");
    span.style.fontSize = `${size}px`;
    span.append(range.extractContents());
    range.insertNode(span);
    selection?.removeAllRanges();
    selection?.addRange(range);
    saveContent();
  }

  function rememberSelection() {
    const selection = window.getSelection();
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) {
      selectionRef.current = selection.getRangeAt(0).cloneRange();
    }
  }

  function replaceAll() {
    if (!query.trim() || !editorRef.current) return;
    const matcher = new RegExp(escapeRegExp(query), "gi");
    const walker = window.document.createTreeWalker(editorRef.current, window.NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    nodes.forEach((node) => { node.nodeValue = node.nodeValue?.replace(matcher, replaceValue) || ""; });
    saveContent();
  }

  function exportWordCompatible() {
    const body = sanitizeWordHtml(editorRef.current?.innerHTML || wordDocument.html);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(wordDocument.title)}</title><style>body{font-family:Arial,sans-serif;line-height:1.5;margin:2cm}${legalListCss}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:6px}img{max-width:100%}</style></head><body><h1>${escapeHtml(wordDocument.title)}</h1>${body}</body></html>`;
    download(new Blob([html], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), `${safeFileName(wordDocument.title)}.docx`);
  }

  function exportPdf() {
    const body = sanitizeWordHtml(editorRef.current?.innerHTML || wordDocument.html);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(wordDocument.title)}</title><style>@page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0;background:#fff;color:#111827;font-family:Arial,sans-serif}body{line-height:1.5}.page{width:210mm;min-height:297mm;padding:22mm 24mm;break-after:page}h1{margin:0 0 1.5rem;font-size:24pt}h2{font-size:18pt}h3{font-size:14pt}p{min-height:1.5em}ul,ol{padding-left:2em}${legalListCss}blockquote{border-left:3px solid #94a3b8;padding-left:1em;color:#475569}a{color:#2563eb;text-decoration:underline}img{max-width:100%;height:auto}table{width:100%;border-collapse:collapse;margin:1em 0}td,th{border:1px solid #94a3b8;padding:6px;vertical-align:top}</style></head><body><main class="page"><h1>${escapeHtml(wordDocument.title)}</h1>${body}</main></body></html>`;
    const htmlUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const printWindow = window.open(htmlUrl, "_blank");
    if (!printWindow) {
      URL.revokeObjectURL(htmlUrl);
      setPrintHint("El navegador bloqueó la ventana de impresión. Permite ventanas emergentes e inténtalo otra vez.");
      return;
    }
    setPrintHint("En el diálogo de impresión elige «Guardar como PDF».");
    const print = () => {
      URL.revokeObjectURL(htmlUrl);
      printWindow.focus();
      printWindow.print();
    };
    printWindow.addEventListener("load", print, { once: true });
    printWindow.addEventListener("afterprint", () => {
      printWindow.close();
      setPrintHint(null);
    }, { once: true });
  }

  return <div className="word-editor-print-root flex h-full min-w-0 flex-col bg-background">
    <div className="word-editor-toolbar shrink-0 border-b border-[var(--sb-color-border-strong)] bg-[var(--sb-color-surface)] px-3 py-2 print:hidden">
      <div className="flex flex-wrap items-center gap-1 bg-[var(--sb-color-surface)]">
        <ToolbarButton label="Deshacer" onClick={() => run("undo")}><Undo2 /></ToolbarButton>
        <ToolbarButton label="Rehacer" onClick={() => run("redo")}><Redo2 /></ToolbarButton>
        <span className="mx-1 h-6 w-px bg-border" />
        <select aria-label="Estilo de texto" className="h-8 rounded-md border bg-white px-2 text-sm" defaultValue="p" onChange={(event) => run("formatBlock" as Command, event.target.value)}>
          <option value="p">Normal</option><option value="h1">Título 1</option><option value="h2">Título 2</option><option value="h3">Título 3</option><option value="blockquote">Cita</option>
        </select>
        <label className="flex h-8 items-center gap-1 rounded-md border bg-white px-2 text-sm" title="Tamaño del texto en píxeles">
          <span className="sr-only">Tamaño del texto en píxeles</span>
          <input aria-label="Tamaño del texto en píxeles" type="number" min="6" max="96" step="1" defaultValue="16" className="w-12 bg-transparent text-center outline-none" onChange={(event) => applyFontSize(event.target.value)} />
          <span className="text-xs text-muted-foreground">px</span>
        </label>
        <ToolbarButton label="Negrita" onClick={() => run("bold")}><Bold /></ToolbarButton>
        <ToolbarButton label="Cursiva" onClick={() => run("italic")}><Italic /></ToolbarButton>
        <ToolbarButton label="Subrayado" onClick={() => run("underline")}><Underline /></ToolbarButton>
        <ToolbarButton label="Tachado" onClick={() => run("strikeThrough")}><Strikethrough /></ToolbarButton>
        <label className="grid size-8 cursor-pointer place-items-center rounded-md hover:bg-muted" title="Color del texto"><span className="text-sm font-bold">A</span><input className="sr-only" type="color" defaultValue="#111827" onMouseDown={() => { const selection = window.getSelection(); if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) selectionRef.current = selection.getRangeAt(0).cloneRange(); }} onChange={(event) => run("foreColor", event.target.value)} /></label>
        <span className="mx-1 h-6 w-px bg-border" />
        <ToolbarButton label="Alinear a la izquierda" onClick={() => run("justifyLeft")}><AlignLeft /></ToolbarButton>
        <ToolbarButton label="Centrar" onClick={() => run("justifyCenter")}><AlignCenter /></ToolbarButton>
        <ToolbarButton label="Alinear a la derecha" onClick={() => run("justifyRight")}><AlignRight /></ToolbarButton>
        <ToolbarButton label="Justificar" onClick={() => run("justifyFull")}><AlignJustify /></ToolbarButton>
        <ToolbarButton label="Lista" onClick={() => run("insertUnorderedList")}><List /></ToolbarButton>
        <ToolbarButton label="Lista jurídica" onClick={() => { restoreSelection(); run("insertOrderedList"); normalizeLegalLists(editorRef.current!); saveContent(); }}><ListOrdered /></ToolbarButton>
        <ToolbarButton label="Disminuir nivel" onClick={() => changeLegalLevel(-1)}><ListIndentDecrease /></ToolbarButton>
        <ToolbarButton label="Aumentar nivel" onClick={() => changeLegalLevel(1)}><ListIndentIncrease /></ToolbarButton>
        <span className="mx-1 h-6 w-px bg-border" />
        <ToolbarButton label="Insertar enlace" onClick={insertLink}><Link /></ToolbarButton>
        <ToolbarButton label="Insertar imagen" onClick={() => imageInputRef.current?.click()}><ImagePlus /></ToolbarButton>
        <ToolbarButton label="Insertar tabla" onClick={insertTable}><Table2 /></ToolbarButton>
        <ToolbarButton label="Línea horizontal" onClick={() => insertHtml("<hr><p><br></p>")}><Minus /></ToolbarButton>
        <div className="ml-auto flex items-center gap-1">
          <ToolbarButton label="Buscar" active={searchOpen} onClick={() => setSearchOpen((open) => !open)}><Search /></ToolbarButton>
          <Button variant="outline" size="sm" onClick={exportPdf}><FileDown /> Guardar PDF</Button>
          <Button variant="outline" size="sm" onClick={exportWordCompatible}>Word</Button>
        </div>
      </div>
      {searchOpen && <div className="mt-2 flex flex-wrap items-center gap-2"><Search className="size-4 text-muted-foreground" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar" className="h-8 w-36 rounded-md border bg-background px-2 text-sm" /><input value={replaceValue} onChange={(event) => setReplaceValue(event.target.value)} placeholder="Reemplazar por" className="h-8 w-36 rounded-md border bg-background px-2 text-sm" /><Button type="button" variant="outline" size="sm" onClick={replaceAll}>Reemplazar todo</Button><button type="button" aria-label="Cerrar búsqueda" onClick={() => setSearchOpen(false)}><X className="size-4" /></button><span className="text-xs text-muted-foreground">{query && countMatches(searchText, query)} coincidencias</span></div>}
      {printHint && <p className="mt-2 text-xs text-muted-foreground" role="status">{printHint}</p>}
    </div>
    <div className="min-h-0 flex-1 overflow-auto px-4 py-8 print:overflow-visible print:p-0">
      <div className="mx-auto flex w-full max-w-[794px] flex-col gap-6">
        <div className="word-page">
          <input aria-label="Título del documento" value={wordDocument.title} onChange={(event) => onChange({ ...wordDocument, title: event.target.value, updatedAt: Date.now() })} className="sb-heading mb-6 w-full border-0 bg-transparent text-4xl font-bold outline-none placeholder:text-muted-foreground print:text-3xl" placeholder="Título del documento" />
          <div ref={editorRef} contentEditable suppressContentEditableWarning role="textbox" aria-label="Contenido del documento" className="word-content min-h-[900px] outline-none" onInput={saveContent} onBeforeInput={handleBeforeInput} onKeyDown={handleKeyDown} onKeyUp={rememberSelection} onMouseUp={rememberSelection} onBlur={() => { rememberSelection(); saveContent(); }} onPaste={(event) => { event.preventDefault(); insertHtml(`<p>${escapeHtml(event.clipboardData.getData("text/plain")).replace(/\n/g, "<br>")}</p>`); }} />
        </div>
      </div>
    </div>
    <input ref={imageInputRef} className="sr-only" type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) insertImage(file); }} />
  </div>;
}

function ToolbarButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <Button type="button" variant={active ? "secondary" : "ghost"} size="icon" className={buttonClass} aria-label={label} title={label} aria-pressed={active} onMouseDown={(event) => event.preventDefault()} onClick={onClick}>{children}</Button>;
}

function closestLegalItem(node: Node): HTMLLIElement | null {
  const element = node instanceof Element ? node : node.parentElement;
  const item = element?.closest("li");
  if (item instanceof HTMLLIElement && item.parentElement?.matches(`ol[${LEGAL_LIST_ATTRIBUTE}="true"]`)) return item;
  const list = element?.closest(`ol[${LEGAL_LIST_ATTRIBUTE}="true"]`);
  return list ? Array.from(list.children).find((child): child is HTMLLIElement => child instanceof HTMLLIElement && !child.textContent?.trim() && !child.querySelector("ol,ul")) ?? null : null;
}

function placeCaretAtEnd(element: Element) {
  const range = window.document.createRange();
  const walker = window.document.createTreeWalker(element, window.NodeFilter.SHOW_TEXT);
  let lastText: Text | null = null;
  while (walker.nextNode()) lastText = walker.currentNode as Text;
  if (lastText) range.setStart(lastText, lastText.length);
  else { range.selectNodeContents(element); range.collapse(false); }
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character); }
function safeFileName(value: string) { return value.trim().replace(/[^\w\-áéíóúñ ]/gi, "").replace(/\s+/g, "-") || "documento"; }
function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const link = window.document.createElement("a"); link.href = url; link.download = name; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 0); }
function countMatches(text: string, query: string) { return query.trim() ? text.toLocaleLowerCase().split(query.toLocaleLowerCase()).length - 1 : 0; }
function escapeRegExp(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
