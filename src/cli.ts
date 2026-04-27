export interface CommandOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface CommandRunner {
  run(command: string, args: readonly string[], options?: CommandOptions): Promise<CommandResult>;
}

export interface CommandExecutionErrorParams {
  command: string;
  args: readonly string[];
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class CommandExecutionError extends Error {
  public readonly command: string;
  public readonly args: readonly string[];
  public readonly stdout: string;
  public readonly stderr: string;
  public readonly exitCode: number;

  public constructor(params: CommandExecutionErrorParams) {
    super(`Command failed (${params.exitCode}): ${params.command} ${params.args.join(' ')}`);
    this.name = 'CommandExecutionError';
    this.command = params.command;
    this.args = params.args;
    this.stdout = params.stdout;
    this.stderr = params.stderr;
    this.exitCode = params.exitCode;
  }
}

export function parseJsonOutput<T>(stdout: string): T {
  const text = stdout.trim();
  if (text.length === 0) {
    throw new Error('Expected JSON output but command returned empty stdout.');
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse command JSON output: ${message}`);
  }
}

export function createExecFileRunner(): CommandRunner {
  return {
    async run(command: string, args: readonly string[], options?: CommandOptions): Promise<CommandResult> {
      const importModule = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>;
      const childProcess = await importModule('node:child_process');
      const execFile = childProcess.execFile as (
        file: string,
        args: readonly string[],
        options: Record<string, unknown>,
        callback: (error: unknown, stdout: string, stderr: string) => void,
      ) => void;

      return new Promise<CommandResult>((resolve, reject) => {
        const invocation = resolveCommandInvocation(command, args);
        const execOptions: Record<string, unknown> = {
          encoding: 'utf8',
        };

        if (options?.cwd !== undefined) {
          execOptions.cwd = options.cwd;
        }
        if (options?.env !== undefined) {
          execOptions.env = options.env;
        }
        if (options?.timeoutMs !== undefined) {
          execOptions.timeout = options.timeoutMs;
        }

        execFile(invocation.command, invocation.args, execOptions, (error, stdout, stderr) => {
          if (error !== null && error !== undefined) {
            const exitCode = readExitCode(error);
            reject(new CommandExecutionError({ command, args, stdout, stderr, exitCode }));
            return;
          }

          resolve({ stdout, stderr, exitCode: 0 });
        });
      });
    },
  };
}

export function resolveCommandInvocation(
  command: string,
  args: readonly string[],
  platform = currentPlatform(),
): { command: string; args: readonly string[] } {
  if (platform === 'win32' && command === 'az') {
    return { command: 'cmd.exe', args: ['/d', '/s', '/c', 'az', ...args] };
  }
  if (platform === 'win32' && command === 'gh') {
    return { command: 'gh.exe', args };
  }
  return { command, args };
}

function currentPlatform(): string {
  return typeof process !== 'undefined' ? process.platform : '';
}

function readExitCode(error: unknown): number {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'number') {
      return code;
    }
  }
  return 1;
}
