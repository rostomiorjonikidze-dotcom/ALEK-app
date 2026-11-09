export async function loadPdfRuntime() {
  const [pdf, table, latinFont, georgianFont] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    import("./notosans-font"),
    import("./notosansgeorgian-font"),
  ]);

  return {
    jsPDF: pdf.jsPDF,
    autoTable: table.default,
    latinFont: latinFont.NotoSansBase64,
    georgianFont: georgianFont.NotoSansGeorgianBase64,
  };
}
