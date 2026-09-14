// src/utils/logger.js

// ============================================
// LOGGER SIMPLE
// ============================================

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const CURRENT_LEVEL = LOG_LEVELS.INFO;

function formatMessage(level, message, ...args) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}]`;
  return `${prefix} ${message}`;
}

function debug(message, ...args) {
  if (CURRENT_LEVEL <= LOG_LEVELS.DEBUG) {
    console.log(formatMessage('DEBUG', message), ...args);
  }
}

function info(message, ...args) {
  if (CURRENT_LEVEL <= LOG_LEVELS.INFO) {
    console.log(formatMessage('INFO', message), ...args);
  }
}

function warn(message, ...args) {
  if (CURRENT_LEVEL <= LOG_LEVELS.WARN) {
    console.warn(formatMessage('WARN', message), ...args);
  }
}

function error(message, ...args) {
  if (CURRENT_LEVEL <= LOG_LEVELS.ERROR) {
    console.error(formatMessage('ERROR', message), ...args);
  }
}

// Exportar como objeto con métodos
const logger = {
  debug,
  info,
  warn,
  error,
  levels: LOG_LEVELS
};

export default logger;