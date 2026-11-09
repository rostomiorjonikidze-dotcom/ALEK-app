import type { loadPdfRuntime } from "./pdf-runtime";

export type PdfService = {
  description: string;
  quantity: number;
  price: number;
  type: "labor" | "material";
  priceType: "total" | "unit" | "hourly";
  hours: number;
};

export type DocumentPdfData = {
  type: "devis" | "facture";
  number: string;
  date: string;
  due: string;
  reference: string;
  seller: { name: string; address: string; phone: string; email: string; siret: string };
  client: { name: string; address: string; phone: string; email: string };
  description: string;
  services: PdfService[];
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
  vatRate: number;
  vatExempt: boolean;
  clientIsProfessional: boolean;
  paymentTerms: string;
  paymentMethod: string;
  invoiceStatus: string;
  filename: string;
};

export function savedInvoicePdfData(
  invoice: {
    document_type: string;
    document_number: string;
    document_date: string;
    due_date: string | null;
    devis_reference: string | null;
    business_name: string | null;
    business_address: string | null;
    business_phone: string | null;
    business_email: string | null;
    business_siret: string | null;
    client_name: string | null;
    client_address: string | null;
    client_phone: string | null;
    client_email: string | null;
    description: string | null;
    services: PdfService[] | null;
    total_ht: number | string | null;
    total_vat: number | string | null;
    total_ttc: number | string | null;
    vat_rate: number | string | null;
    vat_exempt?: boolean | null;
    client_is_professional?: boolean | null;
    payment_terms: string | null;
    payment_method: string | null;
    invoice_status: string | null;
  },
): DocumentPdfData {
  if (invoice.document_type !== "facture") throw new Error("A saved invoice is required.");
  const amount = (value: number | string | null, label: string) => {
    if (value === null || value === "" || !Number.isFinite(Number(value)) || Number(value) < 0) {
      throw new Error(`Montant enregistré invalide : ${label}.`);
    }
    return Number(value);
  };
  const vatRate = Number(invoice.vat_rate);
  if (invoice.vat_rate === null || invoice.vat_rate === "" || !Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
    throw new Error("Taux de TVA enregistré invalide.");
  }
  return {
    type: "facture",
    number: invoice.document_number || "",
    date: invoice.document_date || "",
    due: invoice.due_date || "",
    reference: invoice.devis_reference || "",
    seller: {
      name: invoice.business_name || "",
      address: invoice.business_address || "",
      phone: invoice.business_phone || "",
      email: invoice.business_email || "",
      siret: invoice.business_siret || "",
    },
    client: {
      name: invoice.client_name || "",
      address: invoice.client_address || "",
      phone: invoice.client_phone || "",
      email: invoice.client_email || "",
    },
    description: invoice.description || "",
    services: Array.isArray(invoice.services) ? invoice.services : [],
    totalHT: amount(invoice.total_ht, "HT"),
    totalVAT: amount(invoice.total_vat, "TVA"),
    totalTTC: amount(invoice.total_ttc, "TTC"),
    vatRate,
    vatExempt: Boolean(invoice.vat_exempt),
    clientIsProfessional: Boolean(invoice.client_is_professional),
    paymentTerms: invoice.payment_terms || "",
    paymentMethod: invoice.payment_method || "",
    invoiceStatus: invoice.invoice_status || "unpaid",
    filename: `ALEK-Facture-${(invoice.document_number || "document").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`,
  };
}

export function savedInvoicePdfWarnings(
  invoice: Parameters<typeof savedInvoicePdfData>[0],
  snapshot: DocumentPdfData,
): string[] {
  const warnings: string[] = [];
  if (!snapshot.number || !snapshot.date || !snapshot.seller.name || !snapshot.seller.siret || !snapshot.client.name) {
    warnings.push("Une identité, le numéro ou la date du document est manquant.");
  }
  if (!snapshot.services.length) warnings.push("Aucune ligne de prestation n’est enregistrée.");
  if (snapshot.services.some((item) => !item.description || !Number.isFinite(item.price) || item.price < 0
    || !Number.isFinite(item.quantity) || item.quantity <= 0
    || !["total", "unit", "hourly"].includes(item.priceType)
    || (item.priceType === "hourly" && (!Number.isFinite(item.hours) || item.hours <= 0)))) {
    warnings.push("Une ou plusieurs lignes enregistrées contiennent des valeurs invalides.");
  }
  const lineTotal = snapshot.services.reduce((sum, item) => {
    const raw = item.priceType === "hourly" ? item.hours * item.price
      : item.priceType === "unit" ? item.quantity * item.price : item.price;
    return sum + Math.round((raw + Number.EPSILON * Math.abs(raw)) * 100) / 100;
  }, 0);
  const roundedLineTotal = Math.round((lineTotal + Number.EPSILON * Math.abs(lineTotal)) * 100) / 100;
  if (Math.abs(roundedLineTotal - snapshot.totalHT) > 0.01) {
    warnings.push(`Le détail des lignes (${roundedLineTotal.toFixed(2)} € HT) diffère du HT enregistré (${snapshot.totalHT.toFixed(2)} €).`);
  }
  const combinedTotal = Math.round((snapshot.totalHT + snapshot.totalVAT + Number.EPSILON * Math.abs(snapshot.totalHT + snapshot.totalVAT)) * 100) / 100;
  if (Math.abs(combinedTotal - snapshot.totalTTC) > 0.01) {
    warnings.push(`HT + TVA (${combinedTotal.toFixed(2)} €) diffère du TTC enregistré (${snapshot.totalTTC.toFixed(2)} €).`);
  }
  const expectedVat = Math.round((snapshot.totalHT * snapshot.vatRate / 100 + Number.EPSILON * Math.abs(snapshot.totalHT * snapshot.vatRate / 100)) * 100) / 100;
  if (Math.abs(expectedVat - snapshot.totalVAT) > 0.01) {
    warnings.push(`La TVA calculée au taux enregistré (${expectedVat.toFixed(2)} €) diffère de la TVA persistée (${snapshot.totalVAT.toFixed(2)} €).`);
  }
  return warnings;
}

export function createDocumentPdf(
  data: DocumentPdfData,
  runtime: Awaited<ReturnType<typeof loadPdfRuntime>>,
  paymentClauses: string[],
) {
  const lineTotal = (item: PdfService) => {
    const raw = item.priceType === "hourly" ? item.hours * item.price
      : item.priceType === "unit" ? item.quantity * item.price : item.price;
    return Math.round((raw + Number.EPSILON * Math.abs(raw)) * 100) / 100;
  };
  const doc = new runtime.jsPDF();
  doc.addFileToVFS("NotoSans-Regular.ttf", runtime.latinFont);
  doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
  doc.addFileToVFS("NotoSansGeorgian-Regular.ttf", runtime.georgianFont);
  doc.addFont("NotoSansGeorgian-Regular.ttf", "NotoGeorgian", "normal");
  const hasGeorgian = (value: string) => /[\u10a0-\u10ff\u1c90-\u1cbf]/u.test(value);
  const runs = (value: string) => Array.from(value).reduce<{ text: string; font: "NotoSans" | "NotoGeorgian" }[]>((result, character) => {
    const font = hasGeorgian(character) ? "NotoGeorgian" : "NotoSans";
    const last = result.at(-1);
    if (last?.font === font) last.text += character;
    else result.push({ text: character, font });
    return result;
  }, []);
  const width = (value: string) => runs(value).reduce((sum, run) => {
    doc.setFont(run.font, "normal");
    return sum + doc.getTextWidth(run.text);
  }, 0);
  const draw = (value: string, x: number, y: number) => {
    let position = x;
    for (const run of runs(value)) {
      doc.setFont(run.font, "normal");
      doc.text(run.text, position, y);
      position += doc.getTextWidth(run.text);
    }
  };
  const wrap = (value: string, maxWidth: number) => {
    const lines: string[] = [];
    let line = "";
    for (const word of value.trim().split(/\s+/u)) {
      const next = line ? `${line} ${word}` : word;
      if (width(next) <= maxWidth) { line = next; continue; }
      if (line) lines.push(line);
      line = word;
      while (line && width(line) > maxWidth) {
        const characters = Array.from(line);
        let splitAt = 1;
        while (splitAt < characters.length && width(characters.slice(0, splitAt + 1).join("")) <= maxWidth) splitAt++;
        lines.push(characters.slice(0, splitAt).join(""));
        line = characters.slice(splitAt).join("");
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : ["—"];
  };
  const safe = (value: string | null | undefined) => String(value || "—").replace(/[\r\n]+/g, " ");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 18;
  const right = pageWidth - 18;
  const textBlock = (label: string, value: string, x: number, y: number, maxWidth: number) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, x, y);
    const lines = wrap(safe(value), maxWidth);
    lines.forEach((part, index) => draw(part, x, y + 6 + index * 5));
    return y + 6 + lines.length * 5;
  };

  doc.setFillColor(15, 35, 71);
  doc.rect(0, 0, pageWidth, 37, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.text(data.type === "facture" ? "FACTURE" : "DEVIS", left, 22);
  doc.setFontSize(10);
  doc.text(safe(data.number), right, 22, { align: "right" });
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Date : ${safe(data.date)}`, left, 46);
  doc.text(`${data.type === "facture" ? "Échéance" : "Valable jusqu'au"} : ${safe(data.due)}`, left, 53);
  if (data.type === "facture" && data.reference) doc.text(`Référence devis : ${safe(data.reference)}`, left, 60);

  doc.setFontSize(9);
  const sellerLines = [data.seller.address, data.seller.phone, data.seller.email, `SIREN / SIRET : ${safe(data.seller.siret)}`];
  const clientLines = [data.client.address, data.client.phone, data.client.email];
  const blockHeight = (name: string, values: string[]) => 18 + wrap(safe(name), 75).length * 5
    + values.reduce((height, value) => height + wrap(safe(value), 75).length * 4.5, 0);
  const identityHeight = Math.max(55, blockHeight(data.seller.name, sellerLines), blockHeight(data.client.name, clientLines));
  if (identityHeight > pageHeight - 100) throw new Error("Les coordonnées sont trop longues pour le PDF.");
  doc.setFillColor(245, 248, 253);
  doc.roundedRect(left, 66, 84, identityHeight, 2, 2, "F");
  doc.roundedRect(108, 66, 84, identityHeight, 2, 2, "F");
  let sellerY = textBlock("ÉMETTEUR", data.seller.name, left + 4, 73, 75);
  for (const value of sellerLines) {
    const parts = wrap(safe(value), 75);
    parts.forEach((part, index) => draw(part, left + 4, sellerY + index * 4.5));
    sellerY += parts.length * 4.5;
  }
  let clientY = textBlock("CLIENT", data.client.name, 112, 73, 75);
  for (const value of clientLines) {
    const parts = wrap(safe(value), 75);
    parts.forEach((part, index) => draw(part, 112, clientY + index * 4.5));
    clientY += parts.length * 4.5;
  }

  const descriptionLines = wrap(safe(data.description), 174);
  let descriptionY = 78 + identityHeight;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Description des travaux", left, descriptionY);
  descriptionY += 7;
  doc.setFontSize(9);
  for (const line of descriptionLines) {
    if (descriptionY > pageHeight - 32) { doc.addPage(); descriptionY = 24; }
    draw(line, left, descriptionY);
    descriptionY += 4.5;
  }
  if (descriptionY > pageHeight - 40) { doc.addPage(); descriptionY = 24; }

  runtime.autoTable(doc, {
    startY: descriptionY + 6,
    margin: { left, right: 18, top: 20, bottom: 22 },
    head: [["Description", "Qté / Heures", "Prix", "Total HT"]],
    body: data.services.map((item) => [
      safe(item.description),
      item.priceType === "hourly" ? `${item.hours} h` : String(item.quantity),
      `${Number(item.price).toFixed(2)} EUR${item.priceType === "hourly" ? "/h" : item.priceType === "unit" ? "/u" : " (total)"}`,
      `${lineTotal(item).toFixed(2)} EUR`,
    ]),
    styles: { font: "NotoSans", fontSize: 9, cellPadding: 3, overflow: "linebreak" },
    didParseCell: (cell) => {
      const value = String(cell.cell.raw ?? "");
      if (cell.section === "body" && cell.column.index === 0 && hasGeorgian(value)) cell.cell.text = wrap(value, 72).map(() => " ");
    },
    didDrawCell: (cell) => {
      const value = String(cell.cell.raw ?? "");
      if (cell.section === "body" && cell.column.index === 0 && hasGeorgian(value)) {
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(9);
        wrap(value, 72).forEach((line, index) => draw(line, cell.cell.x + 3, cell.cell.y + 6 + index * 4.5));
      }
    },
    headStyles: { font: "helvetica", fillColor: [27, 72, 144] },
    alternateRowStyles: { fillColor: [246, 249, 253] },
    columnStyles: { 0: { cellWidth: 78 }, 1: { cellWidth: 26 }, 2: { cellWidth: 36 }, 3: { cellWidth: 34 } },
  });
  let y = ((doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? descriptionY) + 12;
  if (y + 65 > pageHeight - 18) { doc.addPage(); y = 25; }
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Total HT : ${data.totalHT.toFixed(2)} EUR`, right, y, { align: "right" });
  doc.text(`TVA (${data.vatRate} %) : ${data.totalVAT.toFixed(2)} EUR`, right, y + 8, { align: "right" });
  doc.setFillColor(231, 240, 255);
  doc.roundedRect(92, y + 13, 100, 16, 2, 2, "F");
  doc.setFont("NotoSans", "normal");
  doc.setFontSize(13);
  doc.text(`Total TTC : ${data.totalTTC.toFixed(2)} EUR`, right - 4, y + 24, { align: "right" });
  y += 34;
  doc.setFont("NotoSans", "normal");
  doc.setFontSize(9);
  const details = data.type === "facture"
    ? [data.paymentTerms && `Conditions de paiement : ${data.paymentTerms}`, data.paymentMethod && `Mode de paiement : ${data.paymentMethod}`, `Statut : ${data.invoiceStatus === "paid" ? "Payée" : data.invoiceStatus === "pending" ? "En attente" : "Non payée"}`].filter(Boolean) as string[]
    : [];
  if (data.type === "facture") details.push(...paymentClauses.slice(1));
  if (data.type === "devis" && data.vatExempt) details.push("TVA non applicable, article 293 B du CGI.");
  for (const detail of details) {
    for (const line of wrap(detail, 170)) {
      if (y > pageHeight - 22) { doc.addPage(); y = 24; }
      draw(line, left, y);
      y += 5;
    }
    y += 2;
  }
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110, 122, 140);
    doc.text(`ALEK Artisan · ${page} / ${pageCount}`, right, pageHeight - 10, { align: "right" });
  }
  return doc;
}
