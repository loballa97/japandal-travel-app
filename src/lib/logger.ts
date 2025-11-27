/**
 * Centralized logger for JAPANDAL
 * Provides consistent logging across the application
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const shouldLog = (level: LogLevel): boolean => {
  if (typeof window === 'undefined') {
    // Server-side: always log
    return true;
  }
  
  // Client-side: only log in development
  return process.env.NODE_ENV !== 'production';
};

export const logger = {
  debug: (...args: unknown[]) => {
    if (shouldLog('debug')) {
      console.debug('[JAPANDAL:DEBUG]', ...args);
    }
  },

  info: (...args: unknown[]) => {
    if (shouldLog('info')) {
      console.info('[JAPANDAL:INFO]', ...args);
    }
  },

  warn: (...args: unknown[]) => {
    if (shouldLog('warn')) {
      console.warn('[JAPANDAL:WARN]', ...args);
    }
  },

  error: (...args: unknown[]) => {
    // Always log errors, even in production
    console.error('[JAPANDAL:ERROR]', ...args);
    
    // TODO: Send to external monitoring service (Sentry, LogRocket, etc.) in production
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(args[0]);
    }
  },
};

// Legacy exports for backward compatibility
export const log = logger.debug;
export const error = logger.error;
