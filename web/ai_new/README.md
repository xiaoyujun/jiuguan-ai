# AI新架构模块

## 概述

基于优化逻辑重构的AI功能模块，解决了旧版架构中的重复逻辑问题，提供了更清晰、更高效的AI功能组织方式。

## 核心理念

根据优化逻辑文档，AI智能总结和总结是两个不同的概念。新架构通过以下三个核心模块来组织功能：

1. **整体生成** (非增量模式) - 用于按照特定数据书模板生成角色的数据书
2. **全局修改** (增量Agent模式) - 对数据进行全局修改，用于临时数据分析、总结、AI智能指令等
3. **智能筛选** - 根据提示词进行筛选，用于智能指令和多人聊天模式等

## 架构组件

### 1. CoreGenerator (核心生成器)
```python
from web.ai_new import CoreGenerator

generator = CoreGenerator()
result = generator.generate_storybook(
    template_type='character',
    user_description='一个勇敢的战士',
    target_name='亚瑟'
)
```

**特性:**
- 支持角色、物品、系统等多种模板类型
- 非增量模式，完整生成数据结构
- 批量生成支持
- 为角色配置自动生成数据书

### 2. GlobalModifier (全局修改器)
```python
from web.ai_new import GlobalModifier

modifier = GlobalModifier()
result = modifier.analyze_and_modify_temp_data(
    role_id='character_name',
    mode='auto_select'  # 或 'specified'
)
```

**特性:**
- 增量Agent模式，智能修改现有数据
- 支持自动选择和指定数据书两种模式
- 临时数据分析和增量覆盖
- 直接修改数据书功能

### 3. SmartFilter (智能筛选器)
```python
from web.ai_new import SmartFilter

filter_engine = SmartFilter()
result = filter_engine.filter_by_prompt(
    filter_type='storybook',
    items=storybook_list,
    filter_prompt='筛选战斗相关的数据书'
)
```

**特性:**
- 支持多种筛选类型：数据书、角色、玩家、对话、通用内容
- 多人聊天回复者筛选
- 智能指令分析和筛选
- AI驱动的内容筛选

### 4. PromptManager (提示词管理器)
```python
from web.ai_new import PromptManager

prompt_manager = PromptManager()
prompt = prompt_manager.get_generation_prompt(
    template_type='character',
    template=template_data,
    user_description='角色描述'
)
```

**特性:**
- 统一管理所有AI提示词
- 分类管理：生成、修改、筛选、分析
- 动态提示词构建
- 向后兼容旧版接口

## API接口

### RESTful API (蓝图前缀: `/ai_new/`)

| 接口 | 方法 | 功能 | 示例 |
|------|------|------|------|
| `/health` | GET | 健康检查 | 检查模块状态 |
| `/generate_storybook` | POST | 生成数据书 | 生成角色、物品等 |
| `/batch_generate_storybooks` | POST | 批量生成 | 一次生成多个数据书 |
| `/analyze_temp_data` | POST | 分析临时数据 | 智能分析和更新 |
| `/modify_storybooks` | POST | 修改数据书 | 直接修改数据书内容 |
| `/filter_content` | POST | 智能筛选 | 根据条件筛选内容 |
| `/filter_multi_chat_responders` | POST | 多人聊天筛选 | 选择合适的回复者 |
| `/organize_stories` | POST | 整理数据书 | 组织和清理数据 |
| `/smart_summary` | POST | 智能总结 | AI驱动的智能总结 |

### 兼容性接口 (前缀: `/ai_new/legacy/`)

为保持向后兼容性，提供了兼容旧版API的接口。

## 安装和配置

### 1. 导入模块
```python
# 在 Flask 应用中注册蓝图
from web.ai_new import ai_new_bp
app.register_blueprint(ai_new_bp)
```

### 2. 配置要求
- 使用现有的 `config.json` 配置文件
- 需要配置相应的AI模型 (data_analysis, story_creation等)
- 支持回退到默认模型配置

### 3. 依赖关系
- Flask 蓝图支持
- 现有的 `web.ai.ai_routes` 模块 (用于AI模型调用)
- 现有的 `web.utils` 模块 (用于路径和配置管理)

## 使用示例

查看 `usage_examples.py` 文件获取完整的使用示例。

### 快速开始

```python
# 1. 生成角色数据书
from web.ai_new import CoreGenerator
generator = CoreGenerator()
result = generator.generate_storybook('character', '勇敢的战士', '亚瑟')

# 2. 分析临时数据  
from web.ai_new import GlobalModifier
modifier = GlobalModifier()
result = modifier.analyze_and_modify_temp_data('character_id')

# 3. 智能筛选
from web.ai_new import SmartFilter
filter_engine = SmartFilter()
result = filter_engine.filter_by_prompt('storybook', items, '筛选条件')
```

## 与旧版对比

| 功能 | 旧版 | 新版 | 改进 |
|------|------|------|------|
| 代码组织 | 分散在多个文件 | 统一的模块化架构 | 消除重复逻辑 |
| 提示词管理 | 散落各处 | 统一管理 | 便于维护和优化 |
| 筛选功能 | 分散实现 | 专门的筛选器 | 功能更强大 |
| 批量操作 | 不支持 | 原生支持 | 提高效率 |
| API设计 | 不一致 | RESTful设计 | 更好的可用性 |

## 性能优势

1. **减少重复代码**: 消除了旧版中大量的重复逻辑
2. **模块化设计**: 每个组件职责单一，便于维护
3. **统一接口**: 提供一致的API设计
4. **智能筛选**: 新增强大的筛选功能
5. **批量处理**: 支持高效的批量操作

## 迁移指南

详细的迁移说明请参考 `MIGRATION_GUIDE.md` 文档。

### 迁移策略
1. **并行运行**: 新旧架构同时存在，逐步迁移
2. **兼容性接口**: 提供兼容旧版的接口
3. **渐进式迁移**: 可以逐个功能模块进行迁移

## 开发和调试

### 健康检查
```bash
curl http://localhost:5000/ai_new/health
```

### 日志和调试
- 所有操作都有详细的日志输出
- 支持静默模式 (`is_silent=True`) 来减少日志
- 统一的错误处理和响应格式

### 测试
```python
# 运行使用示例
python web/ai_new/usage_examples.py
```

## 未来规划

1. **完全迁移**: 将所有旧版功能迁移到新架构
2. **性能优化**: 进一步优化AI调用和数据处理
3. **功能扩展**: 基于统一架构添加新功能
4. **代码清理**: 移除旧版重复代码

## 贡献指南

1. 遵循模块化设计原则
2. 保持API接口的一致性
3. 添加适当的错误处理和日志
4. 更新相关文档和示例

## 许可证

本项目遵循与主项目相同的许可证。
