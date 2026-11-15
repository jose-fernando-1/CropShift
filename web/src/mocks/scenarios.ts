/**
 * Failure scenarios for the mock API, used by the inspector and the E2E tests.
 * Selected by the `x-mock-scenario` request header or the `scenario` query param.
 */
export const SCENARIOS = {
  none: "Normal responses",
  power_down: "Recommendations fail: POWER / engine unavailable (503)",
  explain_down: "Explanation fails (500): the client falls back to its template",
  no_data: "Recommendations return no_data (404)",
} as const;

export type Scenario = keyof typeof SCENARIOS;

export const SCENARIO_HEADER = "x-mock-scenario";

export function scenarioFrom(request: Request): Scenario {
  const value = request.headers.get(SCENARIO_HEADER) ?? new URL(request.url).searchParams.get("scenario") ?? "none";
  return value in SCENARIOS ? (value as Scenario) : "none";
}
