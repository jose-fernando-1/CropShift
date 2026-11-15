"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import type { RecommendationRequest, ResolveRequest } from "@/contract/types";
import { useLocale } from "@/i18n/use-i18n";
import { api, ApiClientError } from "./client";

const NO_RETRY: ReadonlySet<string> = new Set([
  "out_of_coverage",
  "invalid_request",
  "invalid_coordinates",
  "no_data",
  "not_found",
  "schema_mismatch",
]);

function retryPolicy(failureCount: number, error: unknown) {
  if (error instanceof ApiClientError && NO_RETRY.has(error.code)) return false;
  return failureCount < 1;
}

// Every key ends with the locale: switching language refetches instead of reusing text in the old language.

export function useHealth() {
  return useQuery({ queryKey: ["health"], queryFn: api.health, staleTime: 5 * 60_000, retry: false });
}

export function useCrops() {
  const locale = useLocale();
  return useQuery({ queryKey: ["crops", locale], queryFn: () => api.crops(locale), staleTime: Infinity, retry: retryPolicy });
}

export function useResolve() {
  const locale = useLocale();
  return useMutation({ mutationKey: ["resolve"], mutationFn: (body: ResolveRequest) => api.resolve(body, locale) });
}

/**
 * Keeps the previous result on screen (dimmed) while new options load, but not
 * across a language switch: old-language text must not sit next to new-language UI.
 */
export function useRecommendation(request: RecommendationRequest | null) {
  const locale = useLocale();
  return useQuery({
    queryKey: ["recommendation", request, locale],
    queryFn: () => api.recommend(request!, locale),
    enabled: request !== null,
    staleTime: Infinity,
    retry: retryPolicy,
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[2] === locale ? previous : undefined),
  });
}

export function useExplanation(analysisId: string | null) {
  const locale = useLocale();
  return useQuery({
    queryKey: ["explanation", analysisId, locale],
    queryFn: () => api.explain(analysisId!, locale),
    enabled: analysisId !== null,
    staleTime: Infinity,
    retry: false,
  });
}
