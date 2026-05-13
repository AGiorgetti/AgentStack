export interface ExecutionPolicy {
  requireHumanReviewBeforeMerge: boolean;
  requireAcceptanceCriteria: boolean;
}

export const recommendedPolicy: ExecutionPolicy = {
  requireHumanReviewBeforeMerge: true,
  requireAcceptanceCriteria: true,
};
