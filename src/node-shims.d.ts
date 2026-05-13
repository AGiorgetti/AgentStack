declare const process: {
  argv: string[];
  cwd(): string;
  exit(code?: number): never;
  execPath: string;
  env: Record<string, string | undefined>;
  platform: string;
};

declare namespace NodeJS {
  interface ProcessEnv extends Record<string, string | undefined> {}
  interface ErrnoException extends Error { code?: string | number; }
}

declare module 'node:fs' {
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): unknown;
  export function readFileSync(path: string, encoding: BufferEncoding): string;
  export function appendFileSync(path: string, data: string, encoding?: BufferEncoding): void;
  export function writeFileSync(path: string, data: string, encoding?: BufferEncoding): void;
  export function rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
  export function cpSync(src: string, dest: string, options?: { recursive?: boolean }): void;
  export function readdirSync(path: string): string[];
}

declare type BufferEncoding = 'utf8' | 'utf-8' | string;

declare module 'node:path' {
  export function dirname(path: string): string;
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}

declare module 'node:child_process' {
  export function spawnSync(command: string, args?: readonly string[], options?: unknown): { status: number | null; stdout: string; stderr: string };
  export function execFile(command: string, args: string[], options: unknown, callback: (error: Error | null, stdout: string, stderr: string) => void): void;
}
