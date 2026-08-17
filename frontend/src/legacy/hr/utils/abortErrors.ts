// @ts-nocheck
export const isAbortError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const abortError = error as { name?: string; message?: string };
  return (
    abortError.name === 'AbortError' ||
    abortError.message === 'signal is aborted without reason' ||
    abortError.message?.toLowerCase().includes('aborted') === true
  );
};
