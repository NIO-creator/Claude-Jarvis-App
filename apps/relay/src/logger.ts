import pino from 'pino';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

export const logger = pino.default ? pino.default({
    level: LOG_LEVEL,
    formatters: {
        level: (label: string) => ({ level: label }),
    },
    timestamp: pino.default.stdTimeFunctions?.isoTime,
}) : pino({
    level: LOG_LEVEL,
    formatters: {
        level: (label: string) => ({ level: label }),
    },
    timestamp: (pino as any).stdTimeFunctions?.isoTime,
});
