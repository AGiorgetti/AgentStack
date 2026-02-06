export type PackKind = "neutral" | "vendor";

export interface PackDefinition {
  id: string;
  displayName: string;
  description: string;
  paths: string[];
}

export interface PackSource {
  kind: PackKind;
  id: string;
  rootDir: string;
  definition: PackDefinition;
}

export interface PackSelection {
  includeNeutral: boolean;
  vendors: string[];
}

export interface ManagedBlockResult {
  updatedContent: string;
  changed: boolean;
  hasMalformedBlock: boolean;
}

export interface FilePlan {
  packId: string;
  sourcePath: string;
  targetPath: string;
  strategy: "create" | "skip" | "overwrite" | "managed-block";
  blockId?: string;
}

export interface PlanResult {
  plans: FilePlan[];
  warnings: string[];
  errors: string[];
}
