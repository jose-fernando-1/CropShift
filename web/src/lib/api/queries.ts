"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import type { RecommendationRequest } from "@/contract/types";
import { api, ApiClientError } from "./client";

const NO_RETRY: ReadonlySet<string> = new Set(["out_of_coverage", "invalid_request", "invalid_coordinates", "no_data", "not_found", "schema_mismatch"]);

export function retryPolicy(failureCount: number, error: unknown) {
  if (error instanceof ApiClientError && NO_RETRY.has(error.code)) return false;
  return failureCount < 1;
}

export function useHealth() {
  return useQuery({ queryKey: ["health"], queryFn: api.health, staleTime: 5 * 60_000, retry: false });
}

export function useCrops() {
  return useQuery({ queryKey: ["crops"], queryFn: api.crops, staleTime: Infinity, retry: retryPolicy });
}

export function useResolve() {
  return useMutation({ mutationKey: ["resolve"], mutationFn: api.resolve });
}

/** Keeps the previous result on screen (dimmed) while new options load. */
export function useRecommendation(request: RecommendationRequest | null) {
  return useQuery({
    queryKey: ["recommendation", request],
    queryFn: () => api.recommend(request!),
    enabled: request !== null,
    staleTime: Infinity,
    retry: retryPolicy,
    placeholderData: keepPreviousData,
  });
}

export function useExplanation(analysisId: string | null) {
  return useQuery({
    queryKey: ["explanation", analysisId],
    queryFn: () => api.explain(analysisId!),
    enabled: analysisId !== null,
    staleTime: Infinity,
    retry: false,
  });
}
