import pino, { type Logger, type LoggerOptions } from 'pino';

function getDefaultLogLevel(): string {
    if (process.env.LOG_LEVEL) {
        return process.env.LOG_LEVEL;
    }

    return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

function getDevTransport(): LoggerOptions['transport'] | undefined {
    if (process.env.NODE_ENV === 'production') {
        return undefined;
    }

    return {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
        },
    };
}

function createLogger(options: LoggerOptions = {}): Logger {
    return pino({
        level: getDefaultLogLevel(),
        transport: getDevTransport(),
        ...options,
    });
}

const logger = createLogger();

function getLogger(name: string): Logger {
    return logger.child({ name });
}

export { createLogger, getLogger, logger };
