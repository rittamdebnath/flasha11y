import pino from 'pino';

export type Logger = pino.Logger;

export function createLogger(verbose: boolean): Logger {
  return pino({
    level: verbose ? 'debug' : 'info',
    transport: verbose
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  });
}
