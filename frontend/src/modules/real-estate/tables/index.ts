export type RealEstateTableQuery = { page: number; pageSize: number; search?: string; sort?: string; direction?: "asc" | "desc"; filters?: Readonly<Record<string, string>> };
export type RealEstateTableResult<T> = { rows: ReadonlyArray<T>; page: number; pageSize: number; total: number; loading: boolean; error?: string };
export type RealEstateTableContracts = { pagination: true; search: true; sorting: true; filters: true; columnVisibility: true; rowActions: true; bulkSelection: true; exportHook: true; mobilePresentation: true };
export const REAL_ESTATE_TABLE_CONTRACTS: RealEstateTableContracts = { pagination: true, search: true, sorting: true, filters: true, columnVisibility: true, rowActions: true, bulkSelection: true, exportHook: true, mobilePresentation: true };
/** Totals must be returned by the same repository query as rows, never derived from a page. */
export type ScopedRepository<T> = { list(query: RealEstateTableQuery): Promise<RealEstateTableResult<T>> };
