// @ts-nocheck
/**
 * Hook: Generate Company Code
 * 
 * Replicates the backend logic for generating company codes from company names.
 * Used in the frontend for real-time preview and validation.
 */

export const useGenerateCompanyCode = () => {
  /**
   * Generate a company code from a company name
   * Examples:
   * - "Acme Rentals Inc." → "ACME-RENTALS"
   * - "The Property Co" → "THE-PROPERTY-CO"
   * - "123 Real Estate" → "123-REAL-ESTATE"
   */
  const generate = (name: string): string => {
    if (!name || typeof name !== 'string') {
      return '';
    }

    // Convert to uppercase and trim
    let slug = name.toUpperCase().trim();

    // Remove all special characters except spaces and numbers
    slug = slug.replace(/[^A-Z0-9\s]/g, '');

    // Replace multiple spaces with single space, then replace spaces with hyphens
    slug = slug.replace(/\s+/g, '-');

    // Remove leading/trailing hyphens
    slug = slug.replace(/^-+|-+$/g, '');

    // If empty after sanitization, return a default
    if (!slug) {
      const timestamp = new Date().toISOString().replace(/[:\-\.]/g, '').slice(0, 14);
      slug = `COMPANY-${timestamp}`;
    }

    return slug;
  };

  /**
   * Validate a company code format
   * - Must be uppercase letters, numbers, and hyphens only
   * - Cannot be empty
   * - Should be reasonably short (max 50 chars for practicality)
   */
  const validate = (code: string): { valid: boolean; error?: string } => {
    if (!code || !code.trim()) {
      return { valid: false, error: 'Code cannot be empty' };
    }

    if (!/^[A-Z0-9\-]+$/.test(code)) {
      return {
        valid: false,
        error: 'Code must contain only uppercase letters, numbers, and hyphens',
      };
    }

    if (code.length > 50) {
      return { valid: false, error: 'Code is too long (max 50 characters)' };
    }

    if (code.startsWith('-') || code.endsWith('-')) {
      return { valid: false, error: 'Code cannot start or end with a hyphen' };
    }

    if (code.includes('--')) {
      return { valid: false, error: 'Code cannot contain consecutive hyphens' };
    }

    return { valid: true };
  };

  return { generate, validate };
};
