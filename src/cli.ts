export interface CliOptions {
  healthcheck: boolean;
  once: boolean;
}

export function parseCliArgs(argv: string[] = process.argv.slice(2)): CliOptions {
  return {
    healthcheck: argv.includes('--healthcheck'),
    once: argv.includes('--once'),
  };
}
