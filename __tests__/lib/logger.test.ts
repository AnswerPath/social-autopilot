import { createLogger, logger, generateRequestId } from '@/lib/logger';

describe('logger', () => {
  it('exports default logger', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
  });

  it('createLogger returns child with context', () => {
    const child = createLogger({ requestId: 'req_1', service: 'test' });
    expect(child).toBeDefined();
    expect(typeof child.info).toBe('function');
  });

  it('generateRequestId returns string with req_ prefix', () => {
    const id = generateRequestId();
    expect(typeof id).toBe('string');
    expect(id.startsWith('req_')).toBe(true);
    expect(generateRequestId()).not.toBe(id);
  });
});
