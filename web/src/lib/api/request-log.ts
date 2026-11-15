/**
 * In-memory log of API calls for the data-flow inspector. Client-side only;
 * holds the last 50 calls and notifies subscribers (useSyncExternalStore).
 */
export type LoggedRequest = {
  id: number;
  at: number;
  method: string;
  path: string;
  requestBody: unknown;
  status: number | null;
  durationMs: number | null;
  mode: string | null;
  responseBody: unknown;
  schema: string;
  schemaOk: boolean | null;
  schemaIssues: string[];
};

const MAX = 50;
let entries: LoggedRequest[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const requestLog = {
  start(entry: Omit<LoggedRequest, "id" | "at" | "status" | "durationMs" | "mode" | "responseBody" | "schemaOk" | "schemaIssues">) {
    const full: LoggedRequest = {
      ...entry,
      id: nextId++,
      at: Date.now(),
      status: null,
      durationMs: null,
      mode: null,
      responseBody: undefined,
      schemaOk: null,
      schemaIssues: [],
    };
    entries = [full, ...entries].slice(0, MAX);
    emit();
    return full.id;
  },
  finish(id: number, patch: Partial<LoggedRequest>) {
    entries = entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
    emit();
  },
  clear() {
    entries = [];
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  snapshot() {
    return entries;
  },
};
