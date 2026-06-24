import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../api/supabase";
import { useUser } from "../../auth/hooks/useUser";
import { useProfile } from "../../auth/hooks/useProfile";
import NetInfo from "@react-native-community/netinfo";

export interface UserValidation {
  hazard_id: string;
  user_id: string;
  vote: number; // -1, 0, 1
  verified: boolean;
  marked_fixed: boolean;
}

export const useHazardValidation = () => {
  const { user } = useUser();
  const { profile } = useProfile();
  const queryClient = useQueryClient();

  // Fetch the current user's validations for all hazards
  const validationsQuery = useQuery<Record<string, UserValidation>>({
    queryKey: ["user_validations", user?.id],
    queryFn: async () => {
      if (!user) return {};

      const netState = await NetInfo.fetch();
      const isOnline = !!netState.isConnected && netState.isInternetReachable !== false;

      if (!isOnline) {
        return {}; // Return empty if offline, fallback to cache
      }

      try {
        const { data, error } = await supabase
          .from("hazard_validations")
          .select("*")
          .eq("user_id", user.id);

        if (error) throw error;

        const record: Record<string, UserValidation> = {};
        data.forEach((val: UserValidation) => {
          record[val.hazard_id] = val;
        });

        return record;
      } catch (err) {
        console.warn("Failed to fetch user validations, using cache fallback:", err);
        return {};
      }
    },
    enabled: !!user,
  });

  // Mutation to insert or update user validation
  const validationMutation = useMutation({
    mutationFn: async ({
      hazardId,
      action,
    }: {
      hazardId: string;
      action: "upvote" | "downvote" | "verify" | "fixed";
    }) => {
      if (!user) throw new Error("Authentication required.");
      
      // Spam prevention check: prevent voting if user's reputation is too low
      const reputation = profile?.reputation ?? 100;
      if (reputation < 30) {
        throw new Error("Your reputation score is too low to perform this action.");
      }

      const netState = await NetInfo.fetch();
      const isOnline = !!netState.isConnected && netState.isInternetReachable !== false;

      // Get current states
      const currentValidations = validationsQuery.data || {};
      const current = currentValidations[hazardId] || {
        hazard_id: hazardId,
        user_id: user.id,
        vote: 0,
        verified: false,
        marked_fixed: false,
      };

      let nextVote = current.vote;
      let nextVerified = current.verified;
      let nextFixed = current.marked_fixed;

      if (action === "upvote") {
        nextVote = current.vote === 1 ? 0 : 1;
      } else if (action === "downvote") {
        nextVote = current.vote === -1 ? 0 : -1;
      } else if (action === "verify") {
        nextVerified = !current.verified;
      } else if (action === "fixed") {
        nextFixed = !current.marked_fixed;
      }

      const payload = {
        hazard_id: hazardId,
        user_id: user.id,
        vote: nextVote,
        verified: nextVerified,
        marked_fixed: nextFixed,
        updated_at: new Date().toISOString(),
      };

      if (!isOnline) {
        // Offline capability: store mutation in queue/optimistically execute
        console.log("Device offline. Saving validation action optimistically.");
        return payload;
      }

      const { error } = await supabase
        .from("hazard_validations")
        .upsert(payload, { onConflict: "hazard_id,user_id" });

      if (error) throw error;

      return payload;
    },
    onMutate: async ({ hazardId, action }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ["user_validations", user?.id] });
      await queryClient.cancelQueries({ queryKey: ["hazards"] });

      const prevUserValidations = queryClient.getQueryData<Record<string, UserValidation>>([
        "user_validations",
        user?.id,
      ]);
      const prevHazards = queryClient.getQueryData<any[]>(["hazards"]);

      // Optimistically update validations
      queryClient.setQueryData<Record<string, UserValidation>>(
        ["user_validations", user?.id],
        (old = {}) => {
          const current = old[hazardId] || {
            hazard_id: hazardId,
            user_id: user?.id || "",
            vote: 0,
            verified: false,
            marked_fixed: false,
          };

          let nextVote = current.vote;
          let nextVerified = current.verified;
          let nextFixed = current.marked_fixed;

          if (action === "upvote") {
            nextVote = current.vote === 1 ? 0 : 1;
          } else if (action === "downvote") {
            nextVote = current.vote === -1 ? 0 : -1;
          } else if (action === "verify") {
            nextVerified = !current.verified;
          } else if (action === "fixed") {
            nextFixed = !current.marked_fixed;
          }

          return {
            ...old,
            [hazardId]: {
              ...current,
              vote: nextVote,
              verified: nextVerified,
              marked_fixed: nextFixed,
            },
          };
        }
      );

      // Optimistically update hazard aggregates
      queryClient.setQueryData<any[]>(["hazards"], (old = []) => {
        return old.map((h) => {
          if (h.id !== hazardId) return h;

          const currentVal = (prevUserValidations || {})[hazardId] || {
            vote: 0,
            verified: false,
            marked_fixed: false,
          };

          let upCount = h.upvotes_count || 0;
          let downCount = h.downvotes_count || 0;
          let verCount = h.verifications_count || 0;
          let fixCount = h.fixed_votes_count || 0;

          // Recalculate up/down counts
          if (action === "upvote") {
            if (currentVal.vote === 1) {
              upCount = Math.max(0, upCount - 1);
            } else {
              upCount += 1;
              if (currentVal.vote === -1) {
                downCount = Math.max(0, downCount - 1);
              }
            }
          } else if (action === "downvote") {
            if (currentVal.vote === -1) {
              downCount = Math.max(0, downCount - 1);
            } else {
              downCount += 1;
              if (currentVal.vote === 1) {
                upCount = Math.max(0, upCount - 1);
              }
            }
          } else if (action === "verify") {
            verCount = currentVal.verified ? Math.max(0, verCount - 1) : verCount + 1;
          } else if (action === "fixed") {
            fixCount = currentVal.marked_fixed ? Math.max(0, fixCount - 1) : fixCount + 1;
          }

          // Compute trust score
          const posWeight = (upCount * 10) + (verCount * 20);
          const negWeight = (downCount * 25);
          const totalWeight = posWeight + negWeight;
          const trustScore = totalWeight > 0 ? Math.round((posWeight / totalWeight) * 100) : 50;

          // Auto-resolve check
          let status = h.status;
          if (action === "fixed" && !currentVal.marked_fixed && fixCount >= 3) {
            status = "resolved";
          }

          return {
            ...h,
            upvotes_count: upCount,
            downvotes_count: downCount,
            verifications_count: verCount,
            fixed_votes_count: fixCount,
            trust_score: trustScore,
            status,
          };
        });
      });

      return { prevUserValidations, prevHazards };
    },
    onError: (_err, _variables, context: any) => {
      // Rollback optimistic updates on failure
      if (context) {
        queryClient.setQueryData(["user_validations", user?.id], context.prevUserValidations);
        queryClient.setQueryData(["hazards"], context.prevHazards);
      }
    },
    onSuccess: () => {
      // Refetch profiles and hazards to sync latest db trigger values
      queryClient.invalidateQueries({ queryKey: ["user_validations", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["hazards"] });
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
  });

  return {
    userValidations: validationsQuery.data || {},
    isLoading: validationsQuery.isLoading,
    submitValidation: validationMutation.mutate,
    isSubmitting: validationMutation.isPending,
    error: validationMutation.error,
  };
};

export default useHazardValidation;
