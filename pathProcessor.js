// pathProcessor.js - 路径处理模块，改进路径清理和目录结构处理
const path = require('path');
const { createLogger } = require('./logger');

/**
 * 路径清理和标准化处理器
 */
class PathProcessor {
  constructor(verbose = false) {
    this.logger = createLogger(verbose);
    this.processedPaths = new Set();
  }

  /**
   * 清理和标准化单个源文件路径
   * @param {string} originalPath - 原始源文件路径
   * @param {number} index - 文件索引（用于生成备用名称）
   * @returns {Object} { cleanedPath, isValid, warnings }
   */
  cleanPath(originalPath, index) {
    if (!originalPath || typeof originalPath !== 'string') {
      return {
        cleanedPath: `unknown-source-${index}`,
        isValid: false,
        warnings: ['无效的源路径']
      };
    }

    this.logger.verbose(`清理路径: ${originalPath}`);

    let cleaned = originalPath;

    // 1. 处理webpack路径模式
    cleaned = this.processWebpackPaths(cleaned);
    
    // 2. 移除危险字符
    cleaned = this.removeDangerousChars(cleaned);
    
    // 3. 处理模块引用和相对路径
    cleaned = this.processModulePaths(cleaned);
    
    // 4. 标准化路径分隔符和结构
    cleaned = this.normalizePathStructure(cleaned);
    
    // 5. 处理查询参数（如hash）
    cleaned = this.processQueryParams(cleaned);
    
    // 6. 最终验证和备用名称生成
    const finalResult = this.finalizePath(cleaned, index);

    if (finalResult.warnings.length > 0) {
      this.logger.warn(`路径清理警告: ${originalPath} -> ${finalResult.cleanedPath}`);
      finalResult.warnings.forEach((warn) => {
        this.logger.verbose(`  - ${warn}`);
        return; // 明确不返回值的语句，避免Biome警告
      });
    }

    this.logger.verbose(`清理完成: ${originalPath} -> ${finalResult.cleanedPath}`);
    return finalResult;
  }

  /**
   * 处理Webpack特定的路径模式
   * @param {string} pathStr - 输入路径
   * @returns {string} 清理后的路径
   */
  processWebpackPaths(pathStr) {
    // 处理 webpack:// 前缀
    pathStr = pathStr.replace(/^webpack:\/\/\/?/, '');
    
    // 处理 webpack://./ 前缀
    pathStr = pathStr.replace(/^webpack:\/\/\.\/*/, '');
    
    // 处理复杂的webpack引用模式
    pathStr = pathStr.replace(/webpack:\/\/\/[^"]+\s+"(.+?)"/, '$1');
    pathStr = pathStr.replace(/^webpack:\/\/.*?\//, '');
    
    // 处理 name/external 等特殊模式
    pathStr = pathStr.replace(/^(.*?)\/external\s+"([^"]+)"/, '$2');
    
    // 处理 namespace object 模式
    pathStr = pathStr.replace(/namespace object$/, '');
    
    return pathStr;
  }

  /**
   * 移除文件系统危险字符
   * @param {string} pathStr - 输入路径
   * @returns {string} 安全路径
   */
  removeDangerousChars(pathStr) {
    // 移除或替换文件系统不允许的字符
    pathStr = pathStr
      .replace(/[*^$|\\\"]/g, '')  // 移除特殊正则字符
      .replace(/[<>]/g, '-')       // 替换尖括号为连字符
      .replace(/"/g, "'")          // 替换双引号为单引号
      .replace(/\\/g, '/');        // 统一使用正斜杠

    return pathStr;
  }

  /**
   * 处理模块引用和相对路径
   * @param {string} pathStr - 输入路径
   * @returns {string} 处理后的路径
   */
  processModulePaths(pathStr) {
    // 处理 ~ 符号（node_modules引用）
    if (pathStr.startsWith('~')) {
      pathStr = 'node_modules' + pathStr.substring(1);
    }
    
    // 移除开头的 ~/ 
    pathStr = pathStr.replace(/^~\//, '');
    
    // 处理相对路径 ../
    pathStr = pathStr.replace(/\.\.\//g, 'parent/');
    
    // 移除多余的 .. 
    pathStr = pathStr.replace(/\.\.\//g, '');
    
    // 处理当前目录引用 ./
    if (pathStr.startsWith('./')) {
      pathStr = 'base' + pathStr.substring(1);
    }
    
    // 移除剩余的 ./
    pathStr = pathStr.replace(/\.\/+/g, '');

    return pathStr;
  }

  /**
   * 标准化路径结构
   * @param {string} pathStr - 输入路径
   * @returns {string} 标准化路径
   */
  normalizePathStructure(pathStr) {
    // 统一路径分隔符
    pathStr = pathStr.replace(/[\\/]+/g, '/');
    
    // 移除开头的 / 
    pathStr = pathStr.replace(/^\//, '');
    
    // 移除尾部的 / （除非是根目录）
    if (pathStr !== '/' && pathStr.endsWith('/')) {
      pathStr = pathStr.slice(0, -1);
    }
    
    // 处理空路径
    if (!pathStr || pathStr.trim() === '') {
      pathStr = 'unnamed';
    }

    return pathStr;
  }

  /**
   * 处理查询参数（如 ?hash）
   * @param {string} pathStr - 输入路径
   * @returns {string} 处理后的路径
   */
  processQueryParams(pathStr) {
    // 处理 vue?hash 或 js?hash 模式
    pathStr = pathStr.replace(/(vue|js)\?([0-9a-z]+)/i, function(match, ext, hash) {
      return `${hash}.${ext.toLowerCase()}`;
    });
    
    // 移除其他查询参数
    pathStr = pathStr.split('?')[0];
    
    // 移除 # 片段标识符
    pathStr = pathStr.split('#')[0];

    // 处理正则模式引用（如 ^\./.*\.svg$）
    // 使用字符串方法避免复杂的正则转义问题
    if (pathStr.startsWith('^') && pathStr.endsWith('$')) {
      // 这是正则模式，提取扩展名信息
      if (pathStr.includes('\\./') && pathStr.includes('\\.svg') ||
          pathStr.includes('\\./') && pathStr.includes('\\.json')) {
        // 常见的SVG或JSON正则模式
        if (pathStr.includes('svg')) {
          pathStr = 'assets-svg-files';
        } else if (pathStr.includes('json')) {
          pathStr = 'locale-json-files';
        } else {
          pathStr = 'regex-file-pattern';
        }
      } else if (pathStr.includes('locale')) {
        pathStr = 'locale-files';
      } else {
        pathStr = 'regex-pattern';
      }
    }

    // 处理 namespace object 模式
    if (pathStr.includes('namespace object')) {
      pathStr = 'namespace-object';
    }

    // 处理 external 模式
    if (pathStr.includes('external') && pathStr.includes('"')) {
      const quoteMatch = pathStr.match(/"([^"]+)"/);
      if (quoteMatch) {
        pathStr = `external-${quoteMatch[1].replace(/\//g, '-')}`;
      } else {
        pathStr = 'external-module';
      }
    }

    return pathStr;
  }

  /**
   * 最终路径验证和备用名称生成
   * @param {string} pathStr - 清理后的路径
   * @param {number} index - 文件索引
   * @returns {Object} 最终结果
   */
  finalizePath(pathStr, index) {
    const warnings = [];
    let cleanedPath = pathStr;

    // 检查路径是否为空
    if (!cleanedPath || cleanedPath.trim() === '') {
      cleanedPath = `source-${index}`;
      warnings.push('路径为空，使用索引名称');
    }

    // 检查路径长度（文件系统限制）
    if (cleanedPath.length > 250) {
      cleanedPath = cleanedPath.substring(0, 250);
      warnings.push('路径过长，已截断');
    }

    // 确保路径以有效字符结尾
    if (cleanedPath.endsWith('/')) {
      // 如果是目录路径，添加索引避免冲突
      cleanedPath = cleanedPath.replace(/\/$/, '') + `-${index}`;
      warnings.push('目录路径已添加索引后缀');
    }

    // 检查是否为有效文件扩展名
    const ext = path.extname(cleanedPath);
    if (!ext && !cleanedPath.includes('.')) {
      // 没有扩展名的文件，默认添加 .txt
      cleanedPath += '.txt';
      warnings.push('无扩展名，已添加 .txt');
    }

    // 特殊处理：确保 .js 文件被正确识别
    if (cleanedPath.match(/\.(jsx?|ts|vue|css|scss|less|html)$/i)) {
      // 前端相关文件保持原样
    } else if (cleanedPath.match(/\.json$/i)) {
      // JSON文件保持原样
    } else if (cleanedPath.match(/\.ya?ml$/i)) {
      // YAML文件保持原样
    } else if (cleanedPath.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/i)) {
      // 对于图片文件，内容可能是JavaScript占位符
      // 在processSources中会根据内容类型重新判断
      warnings.push('图片扩展名文件，将根据内容类型处理');
    } else if (cleanedPath.match(/\.(woff|woff2|ttf|eot)$/i)) {
      // 字体文件保持原样
    }

    // 避免重复路径
    let uniquePath = cleanedPath;
    let counter = 1;
    while (this.processedPaths.has(uniquePath) && counter < 1000) {
      const dir = path.dirname(cleanedPath);
      const base = path.basename(cleanedPath, path.extname(cleanedPath));
      const ext = path.extname(cleanedPath);
      uniquePath = path.join(dir, `${base}-${counter}${ext || '.txt'}`);
      counter++;
    }
    this.processedPaths.add(uniquePath);

    if (counter > 1) {
      warnings.push(`路径冲突，已添加编号后缀`);
    }

    return {
      cleanedPath: uniquePath,
      isValid: true,
      originalPath: pathStr,
      warnings
    };
  }

  /**
   * 批量处理多个源文件路径
   * @param {Array} sources - 源文件路径数组
   * @param {Array} sourcesContent - 源文件内容数组
   * @returns {Array} 处理后的路径信息数组
   */
  processSources(sources, sourcesContent) {
    this.logger.info(`批量处理 ${sources.length} 个源文件路径`);
    
    const processed = [];
    let validCount = 0;
    let invalidCount = 0;
    let contentBasedRenames = 0;

    sources.forEach((source, index) => {
      const content = sourcesContent[index];
      
      // 只有有内容的文件的路径才需要处理
      if (content && content.trim()) {
        let result = this.cleanPath(source, index);
        
        // 内容类型检测和重命名
        const finalPathInfo = this.detectContentTypeAndRename(result, content);
        result = finalPathInfo;
        
        if (finalPathInfo.renamed) {
          contentBasedRenames++;
          this.logger.verbose(`内容类型重命名: ${source} -> ${finalPathInfo.cleanedPath}`);
        }
        
        processed[index] = result;
        
        if (result.isValid) {
          validCount++;
        } else {
          invalidCount++;
        }
      } else {
        processed[index] = {
          cleanedPath: `skipped-${index}`,
          isValid: false,
          warnings: ['源文件内容为空，跳过路径处理']
        };
        invalidCount++;
      }
    });

    this.logger.info(`路径处理完成: ${validCount}个有效, ${invalidCount}个无效/跳过`);
    if (contentBasedRenames > 0) {
      this.logger.info(`${contentBasedRenames}个文件根据内容类型重命名`);
    }
    return processed;
  }

  /**
   * 根据文件内容检测类型并重命名
   * @param {Object} pathInfo - 路径信息
   * @param {string} content - 文件内容
   * @returns {Object} 最终路径信息
   */
  detectContentTypeAndRename(pathInfo, content) {
    const { cleanedPath, warnings } = pathInfo;
    let finalPath = cleanedPath;
    let renamed = false;
    let newWarnings = [...warnings];

    const ext = path.extname(cleanedPath).toLowerCase();
    
    // 检查是否为图片文件但内容是代码
    if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'].includes(ext)) {
      // 检查内容是否为JavaScript/CSS/HTML代码
      const isCodeContent = this.isCodeContent(content);
      
      if (isCodeContent) {
        // 在原文件名后添加.js后缀，保留原扩展名
        const dir = path.dirname(cleanedPath);
        const baseNameWithExt = path.basename(cleanedPath);
        finalPath = path.join(dir, `${baseNameWithExt}.js`);
        renamed = true;
        newWarnings.push(`图片文件内容为JavaScript代码，已添加 .js 后缀`);
        this.logger.verbose(`检测到图片文件包含代码: ${cleanedPath} -> ${finalPath}`);
      } else {
        newWarnings.push('二进制图片文件，保持原扩展名');
      }
    } else if (['.woff', '.woff2', '.ttf', '.eot'].includes(ext)) {
      // 字体文件保持原样
      newWarnings.push('字体文件，保持原扩展名');
    }

    // 检查是否为其他二进制文件但内容是文本
    if (!['.js', '.jsx', '.ts', '.tsx', '.vue', '.css', '.scss', '.less',
          '.html', '.json', '.yaml', '.yml', '.txt'].includes(ext) &&
        !['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
          '.woff', '.woff2', '.ttf', '.eot'].includes(ext)) {
      
      const isTextContent = this.isTextContent(content);
      if (isTextContent && !content.includes('\x00')) { // 检查是否包含空字节（二进制标志）
        const dir = path.dirname(cleanedPath);
        const baseNameWithExt = path.basename(cleanedPath);
        finalPath = path.join(dir, `${baseNameWithExt}.js`);
        renamed = true;
        newWarnings.push(`二进制文件扩展名但内容为文本代码，已添加 .js 后缀`);
      }
    }

    return {
      ...pathInfo,
      cleanedPath: finalPath,
      renamed,
      warnings: newWarnings
    };
  }

  /**
   * 检查内容是否为代码
   * @param {string} content - 文件内容
   * @returns {boolean} 是否为代码内容
   */
  isCodeContent(content) {
    const trimmed = content.trim();
    if (!trimmed) return false;

    // 检查JavaScript特征
    const jsIndicators = [
      'function', 'const ', 'let ', 'var ', 'class ', '=>', 'import ', 'export ',
      'function\\s*\\(', '\\{\\s*function', 'async\\s+function'
    ];
    
    // 检查CSS特征
    const cssIndicators = [
      ':\\s*{', '{\\s*}', 'background:', 'color:', 'font-', 'margin:', 'padding:',
      '@media', '@import', 'body\\s*{', '.\\w+\\s*{', '#\\w+\\s*{'
    ];

    // 检查HTML特征
    const htmlIndicators = [
      '<!DOCTYPE', '<html', '<head>', '<body', '<script', '<style', '<div', '<span',
      '</script>', '</style>', 'class="', 'id="'
    ];

    const allIndicators = [...jsIndicators, ...cssIndicators, ...htmlIndicators];
    
    return allIndicators.some(indicator =>
      trimmed.includes(indicator) || new RegExp(indicator).test(trimmed)
    );
  }

  /**
   * 检查内容是否为文本内容
   * @param {string} content - 文件内容
   * @returns {boolean} 是否为文本内容
   */
  isTextContent(content) {
    const trimmed = content.trim();
    if (!trimmed) return false;

    // 基本文本检测：包含字母数字或常见编程字符
    const textIndicators = /[a-zA-Z0-9\s{}\[\]();,=+\-*/"'`@$#.]/.test(trimmed);
    
    // 检查是否过短（可能是二进制文件片段）
    const minLength = 10;
    
    return textIndicators && trimmed.length >= minLength;
  }

  /**
   * 获取路径统计信息
   * @returns {Object} 路径处理统计
   */
  getStats() {
    return {
      totalProcessed: this.processedPaths.size,
      uniquePaths: this.processedPaths.size,
      hasConflicts: false // 这个实现中避免了冲突
    };
  }

  /**
   * 清空处理缓存（用于重置）
   */
  clearCache() {
    this.processedPaths.clear();
    this.logger.verbose('路径处理缓存已清空');
  }
}

/**
 * 创建路径处理器实例
 * @param {boolean} verbose - 是否启用详细日志
 * @returns {PathProcessor} 路径处理器实例
 */
function createPathProcessor(verbose = false) {
  return new PathProcessor(verbose);
}

module.exports = {
  createPathProcessor,
  PathProcessor
};