// parser.js - SourceMap解析模块
const fs = require('fs');
const path = require('path');
const { createLogger } = require('./logger');

/**
 * 解析SourceMap文件
 * @param {string} filePath - SourceMap文件路径
 * @param {Object} logger - 日志实例
 * @returns {Object|null} 解析后的SourceMap对象或null（解析失败）
 */
function parseSourceMap(filePath, logger) {
  const resolvedPath = path.resolve(filePath);
  
  logger.verbose(`解析SourceMap文件: ${resolvedPath}`);
  
  try {
    const content = fs.readFileSync(resolvedPath, 'utf8');
    
    // 验证JSON格式
    if (typeof content !== 'string' || !content.trim().startsWith('{')) {
      logger.error('文件内容不是有效的JSON格式');
      return null;
    }
    
    const sourceMap = JSON.parse(content);
    
    // 验证基本SourceMap结构
    if (!sourceMap.version || typeof sourceMap.sources === 'undefined') {
      logger.error('文件不是有效的SourceMap格式（缺少version或sources字段）');
      return null;
    }
    
    logger.info(`成功解析SourceMap: version ${sourceMap.version}`);
    logger.verbose(`包含 ${sourceMap.sources.length} 个源文件`);
    logger.verbose(`文件: ${sourceMap.file || '未指定'}`);
    
    return sourceMap;
    
  } catch (error) {
    logger.error(`解析SourceMap失败: ${error.message}`);
    return null;
  }
}

/**
 * 验证并过滤SourceMap数据
 * @param {Object} sourceMap - 原始SourceMap对象
 * @param {Object} logger - 日志实例
 * @returns {Object} 过滤后的SourceMap数据 { sources, sourcesContent, validCount, skippedCount }
 */
function validateAndFilterSourceMap(sourceMap, logger) {
  logger.verbose('开始验证和过滤SourceMap数据');
  
  if (!sourceMap.sourcesContent) {
    logger.warn('SourceMap缺少sourcesContent字段，将跳过所有文件');
    return {
      sources: [],
      sourcesContent: [],
      validCount: 0,
      skippedCount: sourceMap.sources ? sourceMap.sources.length : 0
    };
  }
  
  const { sources, sourcesContent } = sourceMap;
  const validatedSources = [];
  const validatedContent = [];
  let validCount = 0;
  let skippedCount = 0;
  let emptyContentCount = 0;
  
  // 确保sources和sourcesContent长度一致
  const maxLength = Math.max(sources.length, sourcesContent.length);
  
  for (let i = 0; i < maxLength; i++) {
    const sourceName = sources[i] || `unknown-source-${i}`;
    const sourceContent = sourcesContent[i];
    
    // 检查sourcesContent是否存在且非空
    if (!sourceContent || !sourceContent.trim()) {
      logger.verbose(`跳过空源文件: ${sourceName}`);
      emptyContentCount++;
      skippedCount++;
      continue;
    }
    
    // 验证源文件内容是否为有效文本
    if (typeof sourceContent !== 'string') {
      logger.verbose(`跳过无效源文件内容: ${sourceName}`);
      skippedCount++;
      continue;
    }
    
    // 检查内容长度（避免极短的内容被视为无效）
    if (sourceContent.trim().length < 2) {
      logger.verbose(`跳过过短源文件: ${sourceName} (${sourceContent.trim().length}字符)`);
      emptyContentCount++;
      skippedCount++;
      continue;
    }
    
    validatedSources.push(sourceName);
    validatedContent.push(sourceContent);
    validCount++;
    
    if (validCount <= 5) { // 只显示前5个有效文件的详细信息
      logger.verbose(`有效源文件 ${validCount}: ${sourceName} (${sourceContent.length}字符)`);
    }
  }
  
  logger.info(`验证完成: ${validCount}个有效文件，${skippedCount}个跳过（${emptyContentCount}个空文件）`);
  
  return {
    sources: validatedSources,
    sourcesContent: validatedContent,
    validCount,
    skippedCount,
    totalProcessed: maxLength
  };
}

/**
 * 获取SourceMap的统计信息
 * @param {Object} sourceMapData - 验证后的SourceMap数据
 * @param {Object} logger - 日志实例
 * @returns {Object} 统计信息
 */
function getSourceMapStats(sourceMapData, logger) {
  const stats = {
    totalSources: sourceMapData.validCount + sourceMapData.skippedCount,
    validSources: sourceMapData.validCount,
    skippedSources: sourceMapData.skippedCount,
    hasSourcesContent: sourceMapData.validCount > 0,
    version: sourceMapData.version || 'unknown',
    file: sourceMapData.file || 'unknown'
  };
  
  logger.info(`SourceMap统计: ${stats.validSources}/${stats.totalSources} 个有效源文件`);
  
  return stats;
}

/**
 * 创建解析器实例
 * @param {boolean} verbose - 是否启用详细日志
 * @returns {Object} 解析器对象
 */
function createParser(verbose = false) {
  const logger = createLogger(verbose);
  
  return {
    parse: (filePath) => parseSourceMap(filePath, logger),
    validate: (sourceMap) => validateAndFilterSourceMap(sourceMap, logger),
    getStats: (sourceMapData) => getSourceMapStats(sourceMapData, logger),
    logger
  };
}

module.exports = {
  createParser,
  parseSourceMap,
  validateAndFilterSourceMap,
  getSourceMapStats
};