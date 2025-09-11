#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 导入模块
const { createParser } = require('./parser');
const { createPathProcessor } = require('./pathProcessor');
const { createFileWriter } = require('./fileWriter');
const { createLogger } = require('./logger');
const packageJson = require('./package.json');

// ANSI颜色
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

/**
 * 打印彩色消息
 * @param {string} color - 颜色键
 * @param {string} message - 消息内容
 */
function colorLog(color, message) {
  const lines = message.split('\n');
  lines.forEach(line => {
    if (line.trim()) {
      console.log(`${colors[color]}${line}${colors.reset}`);
    }
  });
}

/**
 * 打印彩色错误
 * @param {string} color - 颜色键
 * @param {string} message - 错误消息
 */
function colorError(color, message) {
  const lines = message.split('\n');
  lines.forEach(line => {
    if (line.trim()) {
      console.error(`${colors[color]}${line}${colors.reset}`);
    }
  });
}

/**
 * 解析命令行参数
 * @param {Array} args - 命令行参数
 * @returns {Object} 配置对象
 */
function parseArgs(args = process.argv.slice(2)) {
  const config = {
    sourcemapFile: null,
    dryRun: false,
    verbose: false,
    outputDir: './source'
  };

  // 检查参数
  if (args.length === 0) {
    colorError('red', '错误: 未提供SourceMap文件路径');
    colorLog('blue', `用法: srcmap <sourcemap-file> [--dry-run] [--verbose] [--output <dir>]
  --dry-run, -d    模拟运行，不实际写入文件
  --verbose, -v    显示详细处理日志
  --output, -o     指定输出目录 (默认: ./source)
  v1.3
  `);
    process.exit(1);
  }

  // 第一个参数是SourceMap文件
  config.sourcemapFile = args[0];

  // 解析选项
  args.slice(1).forEach(arg => {
    if (arg === '--dry-run' || arg === '-d') {
      config.dryRun = true;
    } else if (arg === '--verbose' || arg === '-v') {
      config.verbose = true;
    } else if (arg === '--output' || arg === '-o') {
      const dirIndex = args.indexOf(arg) + 1;
      if (dirIndex < args.length) {
        config.outputDir = args[dirIndex];
      } else {
        colorError('yellow', '警告: --output 需要指定目录路径');
      }
    }
  });

  return config;
}

/**
 * 主处理函数
 * @param {Object} config - 配置对象
 * @returns {Object} 处理结果
 */
function processSourceMap(config) {
  const logger = createLogger(config.verbose);
  
  logger.highlight(`开始处理SourceMap v${packageJson.version}`);
  
  try {
    // 1. 检查SourceMap文件是否存在
    if (!fs.existsSync(config.sourcemapFile)) {
      logger.error(`SourceMap文件不存在: ${config.sourcemapFile}`);
      return { success: false, error: 'SourceMap文件不存在' };
    }

    logger.info(`SourceMap文件: ${logger.filePath(config.sourcemapFile)}`);
    logger.info(`输出目录: ${logger.filePath(config.outputDir)}`);
    logger.info(`模式: ${config.dryRun ? '模拟运行 (dry-run)' : '实际写入'}`);
    logger.info(`日志: ${config.verbose ? '详细模式' : '标准模式'}`);

    // 2. 创建解析器
    const parser = createParser(config.verbose);
    
    // 3. 解析SourceMap
    logger.progress('解析SourceMap文件...');
    const sourceMap = parser.parse(config.sourcemapFile);
    if (!sourceMap) {
      logger.error('无法解析SourceMap文件');
      return { success: false, error: 'SourceMap解析失败' };
    }

    // 4. 验证和过滤SourceMap数据
    logger.progress('验证源文件数据...');
    const validatedData = parser.validate(sourceMap);
    const stats = parser.getStats(validatedData);

    if (validatedData.validCount === 0) {
      logger.warn('没有有效的源文件内容可处理');
      if (sourceMap.sourcesContent) {
        logger.info(`sources.length: ${sourceMap.sources ? sourceMap.sources.length : 0}`);
        logger.info(`sourcesContent.length: ${sourceMap.sourcesContent.length}`);
      }
      return { success: true, processed: 0, stats };
    }

    logger.success(`发现 ${stats.validSources} 个有效源文件`);

    // 5. 创建路径处理器
    logger.progress('处理文件路径...');
    const pathProcessor = createPathProcessor(config.verbose);
    const processedPaths = pathProcessor.processSources(
      validatedData.sources, 
      validatedData.sourcesContent
    );

    const pathStats = pathProcessor.getStats();
    logger.info(`路径处理完成: ${pathStats.uniquePaths} 个唯一路径`);

    // 6. 创建文件写入器
    logger.progress('准备文件写入...');
    const fileWriter = createFileWriter(
      config.outputDir, 
      config.dryRun, 
      config.verbose
    );

    // 7. 执行文件写入
    logger.progress('写入源文件...');
    const writeResult = fileWriter.writeFromPathInfo(
      processedPaths, 
      validatedData.sourcesContent
    );

    // 8. 显示最终统计
    logger.highlight('=== 处理完成 ===');
    logger.info(`有效源文件: ${stats.validSources}/${stats.totalSources}`);
    logger.info(`唯一路径: ${pathStats.uniquePaths}`);
    logger.info(`文件写入: ${writeResult.successCount}/${writeResult.total}`);
    logger.info(`目录创建: ${fileWriter.getStats().directoriesCreated}`);
    
    if (config.dryRun) {
      logger.info('注意: 这是dry-run模式，没有实际写入文件');
    }

    if (writeResult.errorCount > 0) {
      logger.warn(`${writeResult.errorCount} 个文件写入失败`);
      return { 
        success: false, 
        processed: stats.validSources,
        errors: writeResult.errorCount,
        stats: { ...stats, ...pathStats, ...fileWriter.getStats() }
      };
    }

    logger.success('所有源文件处理完成！');
    return { 
      success: true, 
      processed: stats.validSources,
      stats: { ...stats, ...pathStats, ...fileWriter.getStats() }
    };

  } catch (error) {
    logger.error(`处理过程中发生错误: ${error.message}`);
    if (config.verbose && error.stack) {
      logger.verbose(error.stack);
    }
    return { success: false, error: error.message };
  }
}

// 主程序入口
if (require.main === module) {
  const config = parseArgs();
  
  const result = processSourceMap(config);
  
  if (result.success) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

module.exports = {
  processSourceMap,
  parseArgs,
  colorLog,
  colorError
};