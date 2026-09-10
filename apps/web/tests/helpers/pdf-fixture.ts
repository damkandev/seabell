type PdfObject = string;

function pdfStream(contents: string): PdfObject {
  return `<< /Length ${Buffer.byteLength(contents, "latin1")} >>\nstream\n${contents}\nendstream`;
}

/** A deterministic, dependency-free two-page PDF with selectable text. */
export function createSelectionPdf(): Buffer {
  const firstPage = [
    "BT",
    "/F1 18 Tf",
    "72 720 Td",
    "(Hola mundo seleccionable) Tj",
    "0 -30 Td",
    "(segunda linea de prueba) Tj",
    "0 -30 Td",
    "(Conforme a la Ley N 20.000.) Tj",
    "ET",
  ].join("\n");
  const secondPage = [
    "BT",
    "/F1 18 Tf",
    "72 720 Td",
    "(Texto de la segunda pagina) Tj",
    "ET",
  ].join("\n");
  const objects: PdfObject[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 7 0 R >>",
    pdfStream(firstPage),
    pdfStream(secondPage),
  ];

  let output = "%PDF-1.7\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index++) {
    offsets.push(Buffer.byteLength(output, "latin1"));
    output += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(output, "latin1");
  output += `xref\n0 ${objects.length + 1}\n`;
  output += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    output += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  output += `startxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(output, "latin1");
}
