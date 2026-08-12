export type RealEstateFormMode = "create" | "edit" | "read-only";
export type RealEstateFieldError = { field: string; message: string };
export type RealEstateFormState = { mode: RealEstateFormMode; errors: ReadonlyArray<RealEstateFieldError>; submitting: boolean; dirty: boolean };
export type RealEstateFormContracts = {
  text: { name: string; label: string };
  number: { name: string; label: string; currency?: string };
  relation: { name: string; label: string; resource: string };
  date: { name: string; label: string };
  upload: { name: string; label: string; acceptedTypes: ReadonlyArray<string> };
};
/** UI contracts only; mutation wiring belongs in server actions after legacy audit. */
export const REAL_ESTATE_FORM_CONTRACTS: RealEstateFormContracts = {
  text: { name: "text", label: "Text input" }, number: { name: "number", label: "Number or currency input", currency: "KES" }, relation: { name: "relation", label: "Searchable relation selector", resource: "tenant-scoped-resource" }, date: { name: "date", label: "Date input" }, upload: { name: "upload", label: "File upload placeholder", acceptedTypes: ["application/pdf", "image/*"] },
};
