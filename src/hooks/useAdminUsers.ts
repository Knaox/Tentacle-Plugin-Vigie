import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUsersOverview, updateAdminUser, syncAdminUsers, syncRequestsOwnership } from "../api/client-admin";
import type { UpdateAdminUserBody, UsersOverview } from "../api/types";

export function useAdminUsers() {
  return useQuery<UsersOverview>({
    queryKey: ["seer-admin-users"],
    queryFn: getUsersOverview,
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });
}

export function useUpdateAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { jellyfinUserId: string; patch: UpdateAdminUserBody }) =>
      updateAdminUser(args.jellyfinUserId, args.patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seer-admin-users"] });
    },
  });
}

export function useSyncAdminUsers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (importMissing?: boolean | string[]) => syncAdminUsers(importMissing),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seer-admin-users"] });
    },
  });
}

export function useSyncRequestsOwnership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => syncRequestsOwnership(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seer-my-requests"] });
      qc.invalidateQueries({ queryKey: ["seer-stats-overview"] });
      qc.invalidateQueries({ queryKey: ["seer-admin-users"] });
    },
  });
}
