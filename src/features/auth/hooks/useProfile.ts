import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../api/supabase";
import { useUser } from "./useUser";

export type UserRole = "citizen" | "moderator" | "municipality";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  reputation?: number;
}

/**
 * Hook to retrieve user profile data and evaluate role levels.
 * Gracefully defaults to a mock profile using auth metadata if the public.profiles
 * table is not yet created or queries fail.
 */
export const useProfile = () => {
  const { user } = useUser();
  const queryClient = useQueryClient();

  const profileQuery = useQuery<Profile | null>({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (error) {
          // Graceful fallback to User metadata during initial setup
          console.warn("Profiles table query failed. Utilizing metadata fallbacks.");
          return {
            id: user.id,
            email: user.email || "",
            full_name: user.user_metadata?.full_name || "Hazr User",
            role: (user.user_metadata?.role as UserRole) || "citizen",
            created_at: user.created_at,
            reputation: 100,
          };
        }

        return data as Profile;
      } catch {
        return {
          id: user.id,
          email: user.email || "",
          full_name: user.user_metadata?.full_name || "Hazr User",
          role: "citizen",
          created_at: user.created_at,
          reputation: 100,
        };
      }
    },
    enabled: !!user,
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (newRole: UserRole) => {
      if (!user) throw new Error("User session not found.");

      try {
        const { error } = await supabase
          .from("profiles")
          .update({ role: newRole })
          .eq("id", user.id);

        if (error) {
          console.warn("Database profiles table update failed. Writing directly to auth metadata.");
          // Update user metadata as fallback if profiles table is missing
          const { error: metaErr } = await supabase.auth.updateUser({
            data: { role: newRole },
          });
          if (metaErr) throw metaErr;
        }

        return newRole;
      } catch (err: any) {
        console.error("Update role failed:", err);
        throw err;
      }
    },
    onSuccess: (newRole) => {
      // Hydrate query caches optimistically
      queryClient.setQueryData<Profile | null>(["profile", user?.id], (old) => {
        if (!old) return null;
        return { ...old, role: newRole };
      });
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["hazards"] }); // Refresh feed lists
    },
  });

  const role = profileQuery.data?.role || "citizen";

  return {
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    role,
    isCitizen: role === "citizen",
    isModerator: role === "moderator",
    isMunicipality: role === "municipality",
    updateRole: updateRoleMutation.mutate,
    isUpdatingRole: updateRoleMutation.isPending,
  };
};

export default useProfile;
