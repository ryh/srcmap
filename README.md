# SourceMap提取工具

从SourceMap文件中提取原始源代码文件，支持模块化处理和多种选项。

## 功能特性

- ✅ 解析SourceMap文件（.map格式）
- ✅ 跳过没有sourcesContent的空文件
- ✅ 改进的路径清理和目录结构处理
- ✅ 支持--dry-run模拟运行模式
- ✅ 支持--verbose详细日志模式
- ✅ 支持--output自定义输出目录
- ✅ 保持原生Node.js依赖，无外部库
- ✅ ANSI彩色终端输出
- ✅ 完整的错误处理和统计报告

## 安装

```bash
# 克隆或复制项目
git clone <repository>
cd srcmap

# 安装依赖（仅打包）
pnpm install
```

## 用法

### 基本用法

```bash
# 提取SourceMap文件到默认目录 ./source
node index.js app.js.map

# 模拟运行（不实际写入文件）
node index.js app.js.map --dry-run

# 详细日志模式
node index.js app.js.map --verbose

# 自定义输出目录
node index.js app.js.map --output ./extracted-sources

# 组合选项
node index.js app.js.map --dry-run --verbose --output ./test-output
```

### 选项说明

| 选项 | 简写 | 描述 | 默认值 |
|------|------|------|--------|
| `--dry-run` | `-d` | 模拟运行，不实际写入文件 | `false` |
| `--verbose` | `-v` | 显示详细的处理日志 | `false` |
| `--output` | `-o` | 指定输出目录 | `./source` |

### 环境变量

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `SRC_MAP_DRY_RUN` | 默认dry-run模式 | `false` |
| `SRC_MAP_VERBOSE` | 默认详细模式 | `false` |
| `SRC_MAP_OUTPUT_DIR` | 默认输出目录 | `./source` |

## 输出结构

提取的文件将保存在指定的输出目录中，保持原始的目录结构：

```
./source/
├── node_modules/
│   ├── @formatjs/
│   │   └── ecma402-abstract/
│   │       └── lib/
│   │           ├── CanonicalizeLocaleList.js
│   │           └── ...
│   └── ...
├── marketing-site/
│   ├── .cache/
│   └── ...
└── gatsby-browser.js
```

## 示例

### 1. 基本提取

```bash
node index.js app-bb7cb88e877f84f437d5.js.map
```

**输出示例：**
```
[高亮] 开始处理SourceMap v1.0.0
[信息] SourceMap文件: app-bb7cb88e877f84f437d5.js.map
[信息] 输出目录: ./source
[信息] 模式: 实际写入
[信息] 日志: 标准模式
[信息] 成功解析SourceMap: version 3
[信息] 验证完成: 329个有效文件，0个跳过
[成功] 发现 329 个有效源文件
[信息] 批量处理 329 个源文件路径
[信息] 路径处理完成: 329 个唯一路径
[成功] 文件已写入: ./source/marketing-site/node_modules/@formatjs/ecma402-abstract/lib/CanonicalizeLocaleList.js
...
[高亮] === 处理完成 ===
[信息] 有效源文件: 329/329
[信息] 唯一路径: 329
[信息] 文件写入: 329/329
[信息] 目录创建: 156
[成功] 所有源文件处理完成！
```

### 2. Dry-run模式测试

```bash
node index.js app-hash.js.map --dry-run --verbose
```

**输出示例：**
```
[信息] 模式: 模拟运行 (dry-run)
[详细] 解析SourceMap文件: /path/to/app-hash.js.map
[详细] 有效源文件 1: webpack://marketing-site/./node_modules/@formatjs/ecma402-abstract/lib/CanonicalizeLocaleList.js
[信息] [DRY-RUN] 将写入文件: ./source/marketing-site/node_modules/@formatjs/ecma402-abstract/lib/CanonicalizeLocaleList.js (220 字符)
[注意] 这是dry-run模式，没有实际写入文件
```

## 处理流程

1. **参数解析**：读取命令行参数和环境变量
2. **文件验证**：检查SourceMap文件是否存在
3. **SourceMap解析**：读取并解析JSON格式的SourceMap
4. **数据验证**：过滤无效或空的sourcesContent条目
5. **路径清理**：处理webpack路径、相对路径、特殊字符等
6. **目录创建**：递归创建必要的目录结构
7. **文件写入**：将源代码写入对应路径（或dry-run模拟）
8. **统计报告**：显示处理结果和性能统计

## 路径处理规则

### Webpack路径清理

- `webpack://./` → 移除前缀
- `webpack://marketing-site/./` → `marketing-site/`
- `~/node_modules/` → `node_modules/`
- `../` → `parent/`
- `./` → `base/`（仅保留第一个）

### 特殊字符处理

- `* ^ $ | \"` → 移除
- `< >` → 替换为 `-`
- `\` → 统一为 `/`
- 查询参数 `?hash` → 移除或转换为文件名

### 文件扩展名

- 无扩展名 → 自动添加 `.txt`
- `.js?hash` → `hash.js`
- `.vue?hash` → `hash.vue`
- 图片文件（.svg, .png等） → 保持原样

## 错误处理

### 常见错误

1. **文件不存在**：`SourceMap文件不存在: <path>`
   - 解决：检查文件路径是否正确

2. **JSON解析失败**：`无法解析SourceMap文件`
   - 解决：确认文件是有效的SourceMap JSON格式

3. **权限错误**：`权限不足，请检查文件/目录权限`
   - 解决：使用适当的权限运行，或更改输出目录

4. **路径过长**：`路径过长，已截断`
   - 解决：使用更短的输出目录路径

### 返回码

- `0`：成功完成
- `1`：文件不存在或解析失败
- `2`：写入错误

## 性能优化

- **批量处理**：所有文件路径和内容一次性处理
- **内容比较**：跳过与现有文件相同的内容
- **递归目录创建**：使用 `fs.mkdirSync({ recursive: true })`
- **路径缓存**：避免重复路径冲突

## 限制和注意事项

1. **文件大小**：大型SourceMap（>100MB）可能需要更多内存
2. **特殊字符**：某些复杂路径可能被简化处理
3. **编码**：假设UTF-8编码，处理非UTF-8文件可能出错
4. **符号链接**：不跟踪符号链接，仅处理实际文件

## 故障排除

### 路径清理警告

如果看到类似以下的警告：
```
[警告] 路径清理警告: ... -> ... (en%7Ces%7Cpt%7Cfr%7Cde).txt
```

这是正常的，表示特殊字符（如URL编码 `%7C`）被转换为文件安全名称。文件内容仍然完整。

### 空源文件跳过

如果发现许多文件被跳过：
```
[信息] 验证完成: 50个有效文件，200个跳过（150个空文件）
```

这是正常的，SourceMap可能包含许多没有内容或二进制文件的条目。

### Dry-run验证

使用 `--dry-run` 模式验证处理流程：
```bash
node index.js app.js.map --dry-run --verbose
```

这将显示所有将要创建的文件，而不实际写入。

## 贡献指南

1. 克隆仓库
2. 安装依赖：`pnpm install`
3. 运行测试：`node index.js test.map --dry-run`
4. 创建分支并提交更改
5. 提交Pull Request

## 许可证

MIT License