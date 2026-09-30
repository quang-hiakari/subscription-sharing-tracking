// Result of a form Server Action. Success redirects, so only errors are returned.
export type FormState = { error?: string };

/**
 * A positive integer id from a hidden form field, or null if missing/invalid. Used instead of
 * `action.bind(null, id)` to get an id into a Server Action: Cloudflare's edge runtime does not
 * reliably support Next.js's closure-encryption for bound Server Action arguments — a bound
 * action 404s in production despite working in local dev. Pass the id as a hidden field instead
 * (see `ActionForm`'s `hidden` prop) and read it with this helper.
 */
export function formId(formData: FormData, field = 'id'): number | null {
  const n = Number(formData.get(field));
  return Number.isInteger(n) && n > 0 ? n : null;
}
