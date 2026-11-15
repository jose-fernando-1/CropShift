/**
 * Runtime UI flags, read on the server per request (like API_MODE), so one
 * build or image can turn them on or off without a rebuild.
 */
const ON = /^(1|true|on|yes)$/i;

/**
 * SHOW_DATA_FLOW (default on): when on, the "Data flow" button and the
 * inspector show in mock mode or with ?debug=1. Unset or empty means on;
 * true/1/on/yes mean on; any other value (false, 0, a typo) means off, so a
 * mistyped value on a public demo hides the inspector instead of exposing it.
 */
export function showDataFlow(env: Record<string, string | undefined> = process.env): boolean {
  const value = env.SHOW_DATA_FLOW?.trim() ?? "";
  return value === "" || ON.test(value);
}
