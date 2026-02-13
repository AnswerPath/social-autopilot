/**
 * Structured logger for Node scripts (scheduler worker, etc.).
 * Uses Pino; outputs JSON. Pipe to pino-pretty for development if desired.
 */
const pino = require('pino');
const isDev = process.env.NODE_ENV !== 'production';

module.exports = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
}).child({ service: 'scheduler-worker' });
