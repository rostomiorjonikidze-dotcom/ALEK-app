type Establishment = { siret?: string; [key: string]: unknown };
export type CompanyRecord = {
  siren?: string;
  siege?: Establishment;
  matching_etablissements?: Establishment[];
  [key: string]: unknown;
};

export function findExactCompany(results: CompanyRecord[], identifier: string) {
  return results.find((company) => identifier.length === 9
    ? company.siren === identifier
    : company.siege?.siret === identifier || company.matching_etablissements?.some((item) => item.siret === identifier));
}
