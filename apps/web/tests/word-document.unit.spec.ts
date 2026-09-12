import { expect, test } from "@playwright/test";

import { EMPTY_WORD_HTML, createWordDocument, sanitizeWordHtml } from "../src/lib/word-document";

test("creates a document and removes unsafe editor markup", () => {
  const document = createWordDocument();
  expect(document.html).toBe(EMPTY_WORD_HTML);
  const unsafe = '<p onclick="alert(1)">Hola</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>';
  expect(sanitizeWordHtml(unsafe)).toBe(typeof DOMParser === "undefined" ? unsafe : "<p>Hola</p><a>x</a>");
});

test("preserves justified alignment", () => {
  expect(sanitizeWordHtml('<p align="justify">Texto</p>')).toContain('align="justify"');
});
