/**
 * Next.js `basePath` (next.config.ts), set at build time by NEXT_PUBLIC_BASE_PATH, e.g. `/demo` behind the
 * deployment's nginx, where the landing page owns `/`. Empty by default.
 * Next prefixes its own links and assets; plain `fetch` calls to our routes and to public/ must use this.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBasePath(path: string): string {
  return `${BASE_PATH}${path}`;
}
