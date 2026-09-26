import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getUsersOverview, updateAdminUser, syncAdminUsers, syncRequestsOwnership,
  linkAdminUser, forgetAdminUser, deleteSeerrUser,
} from "../api/client-admin";
import type { UpdateAdminUserBody, UsersOverview } from "../api/types";

export function useAdminUsers() {
  return useQuery<UsersOverview>({
    queryKey: ["seer-admin-users"],
    queryFn: getUsersOverview,
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
    // Une synchro tourne (celle du worker, ou lancée d'un autre onglet) : on
    // suit son avancement plutôt que d'afficher un état figé.
    refetchInterval: (query) => (query.state.data?.sync.running ? 2_000 : false),
  });
}

function useAdminUsersMutation<TArg, TResult>(fn: (arg: TArg) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["seer-admin-users"] }); },
  });
}

export const useLinkAdminUser = () => useAdminUsersMutation(linkAdminUser);
export const useForgetAdminUser = () => useAdminUsersMutation(forgetAdminUser);
export const useDeleteSeerrUser = () => useAdminUsersMutation(deleteSeerrUser);

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
