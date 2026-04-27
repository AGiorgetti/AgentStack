export interface ExecutionPolicy {
  allowAgentDecomposition: boolean;
  allowAgentAutoStartChildren: boolean;
  requireHumanReviewBeforeMerge: boolean;
  allowAgentToCloseItems: boolean;
  requireAcceptanceCriteria: boolean;
  heartbeatIntervalMinutes?: number;
  allowStaleClaimRecovery?: boolean;
}

export const recommendedPolicy: ExecutionPolicy = {
  allowAgentDecomposition: true,
  allowAgentAutoStartChildren: false,
  requireHumanReviewBeforeMerge: true,
  allowAgentToCloseItems: false,
  requireAcceptanceCriteria: true,
  heartbeatIntervalMinutes: 30,
  allowStaleClaimRecovery: false,
};
