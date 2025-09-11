// fileWriter.js - 文件写入模块，支持dry-run和目录结构优化
const fs = require('fs');
const path = require('path');
const { createLogger } = require('./logger');

/**
 * 文件写入器类
 */
class FileWriter {
  constructor(outputDir = './source', dryRun = false, verbose = false) {
    this.outputDir = path.resolve(outputDir);
    this.dryRun = dryRun;
    this.verbose = verbose;
    this.logger = createLogger(verbose);
    this.stats = {
      filesCreated: 0,
      directoriesCreated: 0,
      filesSkipped: 0,
      errors: 0
    };
    
    // 确保输出目录存在
    this.ensureOutputDir();
  }

  /**
   * 确保输出目录存在
   */
  ensureOutputDir() {
    if (this.dryRun) {
      this.logger.verbose(`[DRY-RUN] 跳过根目录创建: ${this.outputDir}`);
      return;
    }
    
    try {
      fs.mkdirSync(this.outputDir, { recursive: true });
      this.logger.verbose(`输出目录已确保存在: ${this.outputDir}`);
    } catch (error) {
      this.logger.error(`无法创建输出目录 ${this.outputDir}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 写入单个文件
   * @param {string} filePath - 相对于输出目录的文件路径
   * @param {string} content - 文件内容
   * @param {Object} options - 写入选项
   * @returns {Object} 写入结果 { success, path, error }
   */
  writeFile(filePath, content, options = {}) {
    const fullPath = path.join(this.outputDir, filePath);
    const dirPath = path.dirname(fullPath);
    const fileName = path.basename(fullPath);
    
    this.logger.verbose(`准备写入文件: ${fullPath}`);
    
    // 确保目录存在（dry-run模式下跳过实际创建）
    if (this.dryRun) {
      this.logger.verbose(`[DRY-RUN] 跳过目录创建: ${dirPath}`);
    } else {
      try {
        fs.mkdirSync(dirPath, { recursive: true });
        this.stats.directoriesCreated++;
        this.logger.verbose(`目录已创建: ${dirPath}`);
      } catch (dirError) {
        if (dirError.code !== 'EEXIST') {
          this.logger.error(`无法创建目录 ${dirPath}: ${dirError.message}`);
          return { success: false, path: fullPath, error: dirError };
        }
      }
    }

    // 检查是否为dry-run模式
    if (this.dryRun) {
      this.logger.info(`[DRY-RUN] 将写入文件: ${this.logger.filePath(fullPath)} (${content.length} 字符)`);
      return { success: true, path: fullPath, dryRun: true };
    }

    // 实际写入文件
    try {
      // 检查文件是否已存在且内容相同（避免不必要的写入）
      if (fs.existsSync(fullPath)) {
        const existingContent = fs.readFileSync(fullPath, 'utf8');
        if (existingContent === content) {
          this.logger.verbose(`文件未更改，跳过写入: ${fullPath}`);
          this.stats.filesSkipped++;
          return { success: true, path: fullPath, skipped: true };
        }
      }

      // 写入文件
      fs.writeFileSync(fullPath, content, 'utf8');
      this.stats.filesCreated++;
      this.logger.success(`文件已写入: ${this.logger.filePath(fullPath)} (${content.length} 字符)`);
      
      // 设置文件权限（如果需要）
      if (options.permissions) {
        fs.chmodSync(fullPath, options.permissions);
        this.logger.verbose(`文件权限已设置: ${fullPath}`);
      }

      return { success: true, path: fullPath };
      
    } catch (writeError) {
      this.stats.errors++;
      this.logger.error(`写入文件失败 ${fullPath}: ${writeError.message}`);
      
      // 处理特殊错误情况
      if (writeError.code === 'EISDIR') {
        this.logger.warn(`路径 ${fullPath} 是目录，尝试创建子目录`);
        try {
          fs.mkdirSync(fullPath, { recursive: true });
          this.stats.directoriesCreated++;
          this.logger.success(`目录已创建: ${fullPath}`);
          return { success: true, path: fullPath, type: 'directory' };
        } catch (dirError) {
          this.logger.error(`创建目录也失败: ${dirError.message}`);
          return { success: false, path: fullPath, error: dirError };
        }
      }
      
      return { success: false, path: fullPath, error: writeError };
    }
  }

  /**
   * 批量写入多个文件
   * @param {Array} files - 文件数组 [{ path, content, options }]
   * @returns {Object} 批量写入结果
   */
  writeFiles(files) {
    this.logger.info(`开始批量写入 ${files.length} 个文件`);
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    files.forEach((file, index) => {
      this.logger.progress(`处理文件 ${index + 1}/${files.length}: ${file.path}`);
      const result = this.writeFile(file.path, file.content, file.options || {});
      results.push(result);
      
      if (result.success) {
        successCount++;
      } else {
        errorCount++;
      }
    });
    
    this.logger.info(`批量写入完成: ${successCount}成功, ${errorCount}失败`);
    this.logStats();
    
    return {
      success: errorCount === 0,
      total: files.length,
      successCount,
      errorCount,
      results,
      stats: this.stats
    };
  }

  /**
   * 写入目录结构（用于创建空目录）
   * @param {string} dirPath - 相对于输出目录的目录路径
   * @returns {boolean} 创建成功与否
   */
  createDirectory(dirPath) {
    const fullPath = path.join(this.outputDir, dirPath);
    
    if (this.dryRun) {
      this.logger.info(`[DRY-RUN] 将创建目录: ${this.logger.filePath(fullPath)}`);
      return true;
    }
    
    try {
      fs.mkdirSync(fullPath, { recursive: true });
      this.stats.directoriesCreated++;
      this.logger.success(`目录已创建: ${this.logger.filePath(fullPath)}`);
      return true;
    } catch (error) {
      if (error.code !== 'EEXIST') {
        this.logger.error(`创建目录失败 ${fullPath}: ${error.message}`);
        this.stats.errors++;
        return false;
      }
      this.logger.verbose(`目录已存在: ${fullPath}`);
      return true;
    }
  }

  /**
   * 从路径信息数组写入文件（与pathProcessor配合使用）
   * @param {Array} pathInfoArray - 路径信息数组（来自pathProcessor）
   * @param {Array} sourcesContent - 源文件内容数组
   * @returns {Object} 写入结果
   */
  writeFromPathInfo(pathInfoArray, sourcesContent) {
    const files = [];
    
    pathInfoArray.forEach((pathInfo, index) => {
      if (pathInfo.isValid && sourcesContent[index]) {
        files.push({
          path: pathInfo.cleanedPath,
          content: sourcesContent[index],
          options: {
            // 可以添加文件特定的选项
          }
        });
      }
    });
    
    return this.writeFiles(files);
  }

  /**
   * 记录统计信息
   */
  logStats() {
    this.logger.highlight(`=== 写入统计 ===`);
    this.logger.info(`文件创建: ${this.stats.filesCreated}`);
    this.logger.info(`目录创建: ${this.stats.directoriesCreated}`);
    this.logger.info(`文件跳过: ${this.stats.filesSkipped} (相同内容或dry-run)`);
    this.logger.info(`错误数量: ${this.stats.errors}`);
    
    if (this.stats.errors > 0) {
      this.logger.warn(`有 ${this.stats.errors} 个文件写入失败`);
    } else {
      this.logger.success('所有文件写入成功！');
    }
  }

  /**
   * 获取写入统计
   * @returns {Object} 统计信息
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * 清理临时文件（如果需要）
   * @param {Array} tempFiles - 临时文件路径数组
   */
  cleanup(tempFiles = []) {
    tempFiles.forEach(tempFile => {
      try {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
          this.logger.verbose(`清理临时文件: ${tempFile}`);
        }
      } catch (error) {
        this.logger.warn(`清理临时文件失败 ${tempFile}: ${error.message}`);
      }
    });
  }

  /**
   * 检查输出目录中的文件总数
   * @returns {number} 文件总数
   */
  countOutputFiles() {
    let count = 0;
    const walkDir = (dir) => {
      try {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        files.forEach(file => {
          const fullPath = path.join(dir, file.name);
          if (file.isDirectory()) {
            count += walkDir(fullPath);
          } else {
            count++;
          }
        });
      } catch (error) {
        this.logger.verbose(`无法读取目录 ${dir}: ${error.message}`);
      }
    };
    walkDir(this.outputDir);
    return count;
  }
}

/**
 * 创建文件写入器实例
 * @param {string} outputDir - 输出目录
 * @param {boolean} dryRun - dry-run模式
 * @param {boolean} verbose - 详细日志模式
 * @returns {FileWriter} 文件写入器实例
 */
function createFileWriter(outputDir = './source', dryRun = false, verbose = false) {
  return new FileWriter(outputDir, dryRun, verbose);
}

module.exports = {
  createFileWriter,
  FileWriter
};