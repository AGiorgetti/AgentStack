import { CommandExecutionError, type CommandOptions, type CommandResult, type CommandRunner } from './cli.js';

export interface MockCommandInvocation {
  command: string;
  args: string[];
  options?: CommandOptions;
}

export interface MockCommandExpectation {
  command: string;
  match?: (args: readonly string[], options?: CommandOptions) => boolean;
  result?: CommandResult;
  error?: Error;
  times?: number;
  name?: string;
}

function cloneResult(result: CommandResult): CommandResult {
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
}

export function createTextResult(stdout = '', stderr = '', exitCode = 0): CommandResult {
  return { stdout, stderr, exitCode };
}

export function createJsonResult(value: unknown, stderr = ''): CommandResult {
  return {
    stdout: JSON.stringify(value),
    stderr,
    exitCode: 0,
  };
}

export function createCommandFailure(params: {
  command: string;
  args: readonly string[];
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}): CommandExecutionError {
  return new CommandExecutionError({
    command: params.command,
    args: params.args,
    stdout: params.stdout ?? '',
    stderr: params.stderr ?? 'mock command failed',
    exitCode: params.exitCode ?? 1,
  });
}

export class MockCommandRunner implements CommandRunner {
  private readonly expectations: Array<MockCommandExpectation & { remaining: number }> = [];
  public readonly calls: MockCommandInvocation[] = [];

  public add(expectation: MockCommandExpectation): this {
    this.expectations.push({
      ...expectation,
      remaining: expectation.times ?? 1,
    });
    return this;
  }

  public when(
    command: string,
    match: MockCommandExpectation['match'],
    result: CommandResult,
    options?: { times?: number; name?: string },
  ): this {
    return this.add({
      command,
      ...(match ? { match } : {}),
      result,
      ...(options?.times !== undefined ? { times: options.times } : {}),
      ...(options?.name ? { name: options.name } : {}),
    });
  }

  public whenJson(
    command: string,
    match: MockCommandExpectation['match'],
    value: unknown,
    options?: { times?: number; name?: string },
  ): this {
    return this.add({
      command,
      ...(match ? { match } : {}),
      result: createJsonResult(value),
      ...(options?.times !== undefined ? { times: options.times } : {}),
      ...(options?.name ? { name: options.name } : {}),
    });
  }

  public whenText(
    command: string,
    match: MockCommandExpectation['match'],
    stdout: string,
    options?: { times?: number; name?: string; stderr?: string; exitCode?: number },
  ): this {
    return this.add({
      command,
      ...(match ? { match } : {}),
      result: createTextResult(stdout, options?.stderr, options?.exitCode),
      ...(options?.times !== undefined ? { times: options.times } : {}),
      ...(options?.name ? { name: options.name } : {}),
    });
  }

  public whenError(
    command: string,
    match: MockCommandExpectation['match'],
    error: Error,
    options?: { times?: number; name?: string },
  ): this {
    return this.add({
      command,
      ...(match ? { match } : {}),
      error,
      ...(options?.times !== undefined ? { times: options.times } : {}),
      ...(options?.name ? { name: options.name } : {}),
    });
  }

  public async run(command: string, args: string[], options?: CommandOptions): Promise<CommandResult> {
    this.calls.push({ command, args: [...args], ...(options ? { options } : {}) });

    const expectation = this.expectations.find(
      (candidate) =>
        candidate.remaining > 0 &&
        candidate.command === command &&
        (candidate.match ? candidate.match(args, options) : true),
    );

    if (!expectation) {
      const callSummary = `${command} ${args.join(' ')}`.trim();
      throw new Error(`No mock expectation matched command: ${callSummary}`);
    }

    expectation.remaining -= 1;

    if (expectation.error) {
      throw expectation.error;
    }

    if (!expectation.result) {
      throw new Error(`Mock expectation for ${expectation.name ?? command} did not define a result or error.`);
    }

    return cloneResult(expectation.result);
  }

  public pending(): string[] {
    return this.expectations
      .filter((expectation) => expectation.remaining > 0)
      .map((expectation) => `${expectation.name ?? expectation.command} x${expectation.remaining}`);
  }

  public assertSatisfied(): void {
    const pending = this.pending();
    if (pending.length > 0) {
      throw new Error(`Unconsumed mock expectations: ${pending.join(', ')}`);
    }
  }
}
