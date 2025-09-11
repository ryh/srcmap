// cli.js - 命令行接口模块
const { Command } = require('commander');
const path = require('path');
const { createLogger } = require('./logger');
const packageJson = require('./package.json');

/**
 * 创建CLI程序
 * @returns {Command} commander命令实例
 */
function createCLI() {
  const program = new Command()
    .name('srcmap')
    .description('从SourceMap文件中提取源代码文件')
    .version(packageJson.version, '-v, --version', '显示版本号')
    .usage('<sourcemap-file> [options]');

  // 必需参数：SourceMap文件路径
  program
    .argument('<sourcemap-file>', 'SourceMap文件路径')
    .action((sourcemapFile, options) => {
      // 将控制权交给主程序
      process.emit('cli:parse', { 
        sourcemapFile: path.resolve(sourcemapFile),
        options 
      });
    });

  // 选项：dry-run模式
  program
    .option('-d, --dry-run', '模拟运行，不实际写入文件', false)
    .option('-D, --dryrun', '模拟运行，不实际写入文件（旧语法支持）', false);

  // 选项：详细日志模式
  program
    .option('-v, --verbose', '显示详细的处理日志', false)
    .option('-V, --version', '显示版本号', false);

  // 选项：输出目录
  program
    .option('-o, --output <dir>', '指定输出目录，默认为 ./source', './source')
    .option('-O, --out <dir>', '指定输出目录（简写）', './source');

  // 选项：静默模式
  program
    .option('-q, --quiet', '静默模式，只显示错误信息', false);

  // 选项：帮助和信息
  program
    .option('-h, --help', '显示帮助信息', false);

  // 自定义帮助信息
  program.helpOption('-h, --help', '显示此帮助信息');
  
  // 添加详细的帮助文本
  program.addHelpText('beforeAll', 
    `\n  ${packageJson.name} v${packageJson.version}
  ${packageJson.description}

  用法示例:
    ${packageJson.name} app.js.map
    ${packageJson.name} app.js.map --dry-run
    ${packageJson.name} app.js.map --verbose --output ./extracted
    ${packageJson.name} app.js.map -d -v -o ./my-source
  `);

  program.addHelpText('after', 
    `\n  环境变量:
    SRC_MAP_OUTPUT_DIR  默认输出目录
    SRC_MAP_VERBOSE     默认详细模式 (true/false)
    SRC_MAP_DRY_RUN     默认dry-run模式 (true/false)

  返回值:
    0 - 成功
    1 - SourceMap文件不存在或解析失败
    2 - 写入文件时发生错误
  `);

  // 错误处理
  program.exitOverride((err) => {
    const logger = createLogger(false);
    if (err.code === 'commander:argument:missing') {
      logger.error('错误: 未提供必需的SourceMap文件路径');
      logger.info('用法: srcmap <sourcemap-file> [options]');
      process.exit(1);
    } else if (err.code === 'commander:helpDisplayed') {
      process.exit(0);
    } else {
      logger.error(`意外错误: ${err.message}`);
      process.exit(1);
    }
  });

  return program;
}

/**
 * 解析命令行参数
 * @param {Array} args - 命令行参数数组
 * @returns {Object} 解析后的配置
 */
function parseArgs(args = process.argv) {
  const program = createCLI();
  
  // 监听解析事件
  process.once('cli:parse', (config) => {
    const parsedConfig = {
      sourcemapFile: config.sourcemapFile,
      dryRun: config.options.dryRun || config.options.dryrun || config.options.D,
      verbose: config.options.verbose || config.options.V,
      outputDir: config.options.output || config.options.out || config.options.O || './source',
      quiet: config.options.quiet || config.options.q,
      help: config.options.help || config.options.h
    };

    // 环境变量覆盖
    if (process.env.SRC_MAP_DRY_RUN === 'true') {
      parsedConfig.dryRun = true;
    }
    if (process.env.SRC_MAP_VERBOSE === 'true') {
      parsedConfig.verbose = true;
    }
    if (process.env.SRC_MAP_OUTPUT_DIR) {
      parsedConfig.outputDir = process.env.SRC_MAP_OUTPUT_DIR;
    }

    // 验证配置
    const validation = validateConfig(parsedConfig);
    if (!validation.isValid) {
      const logger = createLogger(false);
      logger.error(`配置验证失败: ${validation.errors.join(', ')}`);
      process.exit(1);
    }

    // 发出配置解析完成事件
    process.emit('cli:config', parsedConfig);
  });

  // 解析命令
  program.parse(args, { from: 'node' });

  return program;
}

/**
 * 验证配置
 * @param {Object} config - 配置对象
 * @returns {Object} 验证结果 { isValid, errors }
 */
function validateConfig(config) {
  const errors = [];
  let isValid = true;

  // 检查SourceMap文件路径
  if (!config.sourcemapFile || typeof config.sourcemapFile !== 'string') {
    errors.push('SourceMap文件路径无效');
    isValid = false;
  } else if (!config.sourcemapFile.endsWith('.map')) {
    // 警告但不视为错误
    console.warn('警告: 文件可能不是SourceMap文件（不以.map结尾）');
  }

  // 检查输出目录
  if (!config.outputDir || typeof config.outputDir !== 'string') {
    errors.push('输出目录配置无效');
    isValid = false;
  }

  // 检查dry-run和verbose选项
  if (typeof config.dryRun !== 'boolean') {
    errors.push('dry-run选项配置无效');
    isValid = false;
  }
  if (typeof config.verbose !== 'boolean') {
    errors.push('verbose选项配置无效');
    isValid = false;
  }

  // 检查quiet模式冲突
  if (config.quiet && config.verbose) {
    console.warn('警告: quiet模式和verbose模式同时启用，verbose将被忽略');
    config.verbose = false;
  }

  return { isValid, errors, warnings: [] };
}

/**
 * 显示配置摘要
 * @param {Object} config - 配置对象
 * @param {Object} logger - 日志实例
 */
function showConfigSummary(config, logger) {
  logger.highlight('=== 配置摘要 ===');
  logger.info(`SourceMap文件: ${logger.filePath(config.sourcemapFile)}`);
  logger.info(`输出目录: ${logger.filePath(config.outputDir)}`);
  logger.info(`模式: ${config.dryRun ? '模拟运行 (dry-run)' : '实际写入'}`);
  logger.info(`日志级别: ${config.verbose ? '详细 (verbose)' : config.quiet ? '静默 (quiet)' : '标准'}`);
  
  if (config.help) {
    logger.info('显示帮助信息');
  }
}

/**
 * 处理CLI事件
 * @param {Function} onConfig - 配置解析完成回调
 * @param {Function} onError - 错误处理回调
 */
function handleCLI(onConfig, onError) {
  // 配置解析完成
  process.once('cli:config', (config) => {
    try {
      const logger = createLogger(config.verbose);
      
      if (config.quiet) {
        // 在静默模式下减少输出
        logger.warn = () => {}; // 禁用警告
        logger.info = () => {}; // 禁用信息
        logger.verbose = () => {}; // 禁用详细日志
      }
      
      showConfigSummary(config, logger);
      onConfig(config, logger);
    } catch (error) {
      onError(error);
    }
  });

  // 全局错误处理
  process.on('uncaughtException', (error) => {
    const logger = createLogger(false);
    logger.error(`未捕获的异常: ${error.message}`);
    if (error.stack) {
      logger.verbose(error.stack);
    }
    process.exit(1);
  });
}

/**
 * 运行CLI程序
 * @param {Array} args - 命令行参数
 * @param {Function} processor - 主处理函数
 * @returns {Promise} 处理结果
 */
async function runCLI(args = process.argv, processor) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      reject(error);
    };

    const onConfig = async (config, logger) => {
      try {
        const result = await processor(config, logger);
        resolve(result);
      } catch (error) {
        onError(error);
      }
    };

    handleCLI(onConfig, onError);
    parseArgs(args);
  });
}

module.exports = {
  createCLI,
  parseArgs,
  validateConfig,
  showConfigSummary,
  handleCLI,
  runCLI
};