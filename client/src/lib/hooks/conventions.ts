/* hooks/conventions.ts — React Query hooks for the Conventions Extractor page.
   Extraction (Re-scan), the accept/reject/edit lifecycle, and promoting the
   accepted set into a skill. All data access goes through `api`. */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { ConventionCandidate, Skill, SkillType } from "@devdigest/shared";

const key = (repoId: string | null | undefined) => ["conventions", repoId];

export function useConventions(repoId: string | null | undefined) {
  return useQuery({
    queryKey: key(repoId),
    queryFn: () => api.get<ConventionCandidate[]>(`/repos/${repoId}/conventions`),
    enabled: !!repoId,
  });
}

export interface ExtractConventionsResult {
  candidates: ConventionCandidate[];
  sample_count: number;
}

export function useExtractConventions(repoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ExtractConventionsResult>(`/repos/${repoId}/conventions/extract`),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(repoId) }),
  });
}

function useStatusMutation(repoId: string, action: "accept" | "reject") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<ConventionCandidate>(`/conventions/${id}/${action}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(repoId) }),
  });
}

export const useAcceptConvention = (repoId: string) => useStatusMutation(repoId, "accept");
export const useRejectConvention = (repoId: string) => useStatusMutation(repoId, "reject");

export interface UpdateConventionInput {
  id: string;
  patch: Partial<Pick<ConventionCandidate, "rule" | "category" | "evidence_path" | "evidence_snippet">>;
}

export function useUpdateConvention(repoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateConventionInput) =>
      api.put<ConventionCandidate>(`/conventions/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(repoId) }),
  });
}

export interface CreateConventionSkillInput {
  name: string;
  description?: string;
  type: SkillType;
  body: string;
  enabled: boolean;
  convention_ids: string[];
}

export function useCreateConventionSkill(repoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateConventionSkillInput) =>
      api.post<Skill>(`/repos/${repoId}/conventions/skill`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.invalidateQueries({ queryKey: key(repoId) });
    },
  });
}
