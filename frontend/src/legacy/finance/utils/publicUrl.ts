// @ts-nocheck
const trimTrailingSlash = (value: string) => value.replace(/\/$/, '');

export const getPublicBaseUrl = () => {
  const envBase =
    import.meta.env.VITE_PUBLIC_APP_URL ||
    import.meta.env.VITE_SITE_URL ||
    import.meta.env.VITE_APP_URL ||
    '';

  if (envBase) return trimTrailingSlash(envBase);

  if (typeof window !== 'undefined' && !/localhost|127\.0\.0\.1/i.test(window.location.hostname)) {
    return trimTrailingSlash(window.location.origin);
  }

  return '';
};

