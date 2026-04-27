export interface SkillDescriptor {
  name: string;
  description: string;
  path: string;
}

export const protocolSkills: readonly SkillDescriptor[] = [
  { name: 'agentstack-backlog-language', description: 'Normalize tracker-native backlog terms into AgentStack Protocol concepts.', path: '.agents/skills/agentstack-backlog-language/SKILL.md' },
  { name: 'agentstack-orchestrator', description: 'Coordinate the end-to-end agent execution workflow.', path: '.agents/skills/agentstack-orchestrator/SKILL.md' },
  { name: 'agentstack-tracker-intake', description: 'Find eligible work for autonomous execution.', path: '.agents/skills/agentstack-tracker-intake/SKILL.md' },
  { name: 'agentstack-tracker-claim', description: 'Claim eligible work exclusively before implementation.', path: '.agents/skills/agentstack-tracker-claim/SKILL.md' },
  { name: 'agentstack-tracker-graph', description: 'Read parent, child, and dependency relations.', path: '.agents/skills/agentstack-tracker-graph/SKILL.md' },
  { name: 'agentstack-work-bootstrap', description: 'Prepare a branch or worktree for isolated execution.', path: '.agents/skills/agentstack-work-bootstrap/SKILL.md' },
  { name: 'agentstack-work-plan', description: 'Create a scoped execution plan before coding.', path: '.agents/skills/agentstack-work-plan/SKILL.md' },
  { name: 'agentstack-work-implement', description: 'Implement scoped changes and validate them.', path: '.agents/skills/agentstack-work-implement/SKILL.md' },
  { name: 'agentstack-tracker-sync', description: 'Keep tracker state aligned with execution progress.', path: '.agents/skills/agentstack-tracker-sync/SKILL.md' },
  { name: 'agentstack-review-handoff', description: 'Open PRs and hand work to humans for review.', path: '.agents/skills/agentstack-review-handoff/SKILL.md' },
  { name: 'agentstack-blocker-handling', description: 'Stop safely and publish blockers when progress is unsafe.', path: '.agents/skills/agentstack-blocker-handling/SKILL.md' },
];
