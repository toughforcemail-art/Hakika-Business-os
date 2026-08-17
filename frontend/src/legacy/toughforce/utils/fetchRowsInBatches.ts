// @ts-nocheck
type BatchedQueryResult<T> = {
  data: T[] | null;
  error: any;
};

interface FetchRowsInBatchesOptions<T> {
  ids: string[];
  batchSize?: number;
  fetchBatch: (batchIds: string[]) => PromiseLike<BatchedQueryResult<T>> | BatchedQueryResult<T>;
}

export async function fetchRowsInBatches<T>({
  ids,
  batchSize = 50,
  fetchBatch,
}: FetchRowsInBatchesOptions<T>): Promise<T[]> {
  const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));

  if (uniqueIds.length === 0) {
    return [];
  }

  const rows: T[] = [];
  const effectiveBatchSize = Math.max(1, batchSize);

  for (let index = 0; index < uniqueIds.length; index += effectiveBatchSize) {
    const batchIds = uniqueIds.slice(index, index + effectiveBatchSize);
    const { data, error } = await fetchBatch(batchIds);

    if (error) {
      throw error;
    }

    if (data?.length) {
      rows.push(...data);
    }
  }

  return rows;
}
