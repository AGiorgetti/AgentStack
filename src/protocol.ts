import type {
  ClaimInfo,
  DependencyStatus,
  ProtocolState,
  WorkItem,
} from './model.js';

export const allowedTransitions: Readonly<Record<ProtocolState, readonly ProtocolState[]>> = {
  draft: ['ready'],
  ready: ['claimed'],
  claimed: ['implementing', 'blocked', 'ready'],
  implementing: ['blocked', 'pr-open', 'ready'],
  blocked: ['ready'],
  'pr-open': ['in-review', 'implementing'],
  'in-review': ['done', 'implementing'],
  done: [],
  abandoned: [],
};

export function canTransition(from: ProtocolState, to: ProtocolState): boolean {
  return allowedTransitions[from].includes(to);
}

export function assertTransition(from: ProtocolState, to: ProtocolState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid protocol transition: ${from} -> ${to}`);
  }
}

export interface EligibilityOptions {
  activeClaimExists: boolean;
  blockedByOpen: DependencyStatus['blockedByOpen'];
  requireAcceptanceCriteria: boolean;
}

export interface EligibilityResult {
  ok: boolean;
  reasons: string[];
}

export function isEligibleForExecution(
  item: WorkItem,
  options: EligibilityOptions,
): EligibilityResult {
  const reasons: string[] = [];

  if (item.executionMode !== 'agent') {
    reasons.push('execution-mode-not-agent');
  }

  if (!item.readyForAgent) {
    reasons.push('not-ready-for-agent');
  }

  if (item.protocolState !== 'ready') {
    reasons.push(`invalid-state:${item.protocolState}`);
  }

  if (options.activeClaimExists) {
    reasons.push('active-claim-exists');
  }

  if (options.blockedByOpen.length > 0) {
    reasons.push('open-blocking-dependencies');
  }

  if (options.requireAcceptanceCriteria && (!item.acceptanceCriteria || item.acceptanceCriteria.length === 0)) {
    reasons.push('missing-acceptance-criteria');
  }

  return {
    ok: reasons.length === 0,
    reasons,
  };
}

function createOpaqueToken(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `${prefix}_${timePart}_${randomPart}`;
}

export function createClaimInfo(
  agentId: string,
  options?: {
    claimToken?: string;
    nowIso?: string;
    branchName?: string;
    workspaceId?: string;
  },
): ClaimInfo {
  return {
    agentId,
    claimToken: options?.claimToken ?? createOpaqueToken('clm'),
    claimedAt: options?.nowIso ?? new Date().toISOString(),
    ...(options?.branchName ? { branchName: options.branchName } : {}),
    ...(options?.workspaceId ? { workspaceId: options.workspaceId } : {}),
  };
}
