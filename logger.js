// logger.js - 简单彩色日志模块，使用原生ANSI颜色
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

/**
 * 日志级别
 */
const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  VERBOSE: 3
};

/**
 * 创建日志实例
 * @param {boolean} verbose - 是否启用详细模式
 * @returns {Object} 日志对象
 */
function createLogger(verbose = false) {
  const level = verbose ? LogLevel.VERBOSE : LogLevel.INFO;

  const loggers = {
    error: (message, ...args) => {
      console.error(`${colors.red}[错误] ${message}${colors.reset}`, ...args);
    },
    
    warn: (message, ...args) => {
      if (level >= LogLevel.WARN) {
        console.warn(`${colors.yellow}[警告] ${message}${colors.reset}`, ...args);
      }
    },
    
    info: (message, ...args) => {
      if (level >= LogLevel.INFO) {
        console.log(`${colors.blue}[信息] ${message}${colors.reset}`, ...args);
      }
    },
    
    verbose: (message, ...args) => {
      if (level >= LogLevel.VERBOSE) {
        console.log(`${colors.gray}[详细] ${message}${colors.reset}`, ...args);
      }
    },
    
    success: (message, ...args) => {
      console.log(`${colors.green}[成功] ${message}${colors.reset}`, ...args);
    },
    
    highlight: (message, ...args) => {
      console.log(`${colors.cyan}[高亮] ${message}${colors.reset}`, ...args);
    }
  };

  /**
   * 多行消息处理
   * @param {string} message - 消息内容
   * @param {string} type - 日志类型
   */
  loggers.multiLine = (message, type = 'info') => {
    if (typeof message !== 'string') return;
    
    const lines = message.split('\n');
    const colorMap = {
      error: colors.red,
      warn: colors.yellow,
      info: colors.blue,
      success: colors.green
    };
    
    const color = colorMap[type] || colors.blue;
    
    lines.forEach(line => {
      if (line.trim()) {
        const prefix = type.toUpperCase();
        console.log(`${color}[${prefix}] ${line}${colors.reset}`);
      }
    });
  };

  /**
   * 进度指示器
   * @param {string} message - 消息内容
   * @returns {string} 格式化消息
   */
  loggers.progress = (message) => {
    return `${colors.cyan}→ ${message}${colors.reset}`;
  };

  /**
   * 文件路径高亮
   * @param {string} filePath - 文件路径
   * @returns {string} 格式化路径
   */
  loggers.filePath = (filePath) => {
    return `${colors.magenta}${filePath}${colors.reset}`;
  };

  return loggers;
}

module.exports = {
  createLogger,
  LogLevel,
  colors
};