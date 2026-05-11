export interface SkillDescriptor {
  name: string;
  description: string;
  path: string;
}

export const protocolSkills: readonly SkillDescriptor[] = [
  { name: 'agentstack-protocol-backlog-language', description: 'Normalize tracker-native backlog terms into AgentStack Protocol concepts.', path: '.agents/skills/agentstack-protocol-backlog-language/SKILL.md' },
  { name: 'agentstack-protocol-orchestrator', description: 'Coordinate the end-to-end agent execution workflow.', path: '.agents/skills/agentstack-protocol-orchestrator/SKILL.md' },
  { name: 'agentstack-protocol-tracker-intake', description: 'Find eligible work for autonomous execution.', path: '.agents/skills/agentstack-protocol-tracker-intake/SKILL.md' },
  { name: 'agentstack-protocol-tracker-claim', description: 'Claim eligible work exclusively before implementation.', path: '.agents/skills/agentstack-protocol-tracker-claim/SKILL.md' },
  { name: 'agentstack-protocol-tracker-graph', description: 'Read parent, child, and dependency relations.', path: '.agents/skills/agentstack-protocol-tracker-graph/SKILL.md' },
  { name: 'agentstack-protocol-work-bootstrap', description: 'Prepare a branch or worktree for isolated execution.', path: '.agents/skills/agentstack-protocol-work-bootstrap/SKILL.md' },
  { name: 'agentstack-protocol-work-plan', description: 'Create a scoped execution plan before coding.', path: '.agents/skills/agentstack-protocol-work-plan/SKILL.md' },
  { name: 'agentstack-protocol-work-implement', description: 'Implement scoped changes and validate them.', path: '.agents/skills/agentstack-protocol-work-implement/SKILL.md' },
  { name: 'agentstack-protocol-tracker-sync', description: 'Keep tracker state aligned with execution progress.', path: '.agents/skills/agentstack-protocol-tracker-sync/SKILL.md' },
  { name: 'agentstack-protocol-submit-review', description: 'Submit completed agent work for human review.', path: '.agents/skills/agentstack-protocol-submit-review/SKILL.md' },
  { name: 'agentstack-protocol-block', description: 'Stop safely and publish blockers when progress is unsafe.', path: '.agents/skills/agentstack-protocol-block/SKILL.md' },
  { name: 'git-worktree-ops', description: 'Operate git worktrees safely for concurrent agent execution.', path: '.agents/skills/git-worktree-ops/SKILL.md' },
];
