export type PersistedDocument = { document_type: string };

export function isIssuedInvoice(document: PersistedDocument): boolean {
  return document.document_type === "facture";
}

export function canModifyDocument(document: PersistedDocument): boolean {
  return !isIssuedInvoice(document);
}

export function canDeleteDocument(document: PersistedDocument): boolean {
  return !isIssuedInvoice(document);
}
