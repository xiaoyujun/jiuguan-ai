"""
AI提示词管理器
统一管理所有AI功能的提示词，支持新的优化架构

## 模块大纲
### 1. 生成类提示词 (Generation)
- character: 角色数据书生成
- item: 物品数据书生成
- system: 系统数据书生成

### 2. 修改类提示词 (Modification)
- temp_data_analysis: 临时数据分析与设定修正
- agent_instruction: Agent指令生成
- event_reduction: 事件减负处理

### 3. 筛选类提示词 (Filter)
- storybook_selection: 数据书智能筛选
- instruction_based_selection: 基于指令的筛选
- storybook_filter: 数据书内容筛选
- character_filter: 角色筛选
- dialogue_filter: 对话条目筛选
- content_filter: 内容项目筛选
- chat_responder_selection: 聊天回复者选择

### 4. 分析类提示词 (Analysis)
- instruction_analysis: 用户指令分析

### 5. 角色处理类提示词 (Character Processing)
- datacard_generation: 角色数据卡生成
- tavern_translate: 酒馆卡翻译
- tavern_polish: 酒馆卡润色
- tavern_enhance: 酒馆卡增强
- tavern_localize: 酒馆卡本地化
- tavern_custom: 酒馆卡自定义处理

### 6. 消息重生成类提示词 (Message Regeneration)
- narrator_regeneration: 旁白重生成
- character_regeneration: 角色消息重生成

### 7. 图片处理类提示词 (Image Processing)
- ocr_extraction: 图片文字识别

### 8. 智能总结类提示词 (Smart Summary)
- storybook_analysis: 数据书分析（引用temp_data_analysis）
"""



from typing import Dict, Any, List, Optional


class PromptManager:
    """AI提示词管理器 - 新版本"""
    
    def __init__(self):
        self.prompt_templates = {
            'generation': self._get_generation_templates(),
            'modification': self._get_modification_templates(),
            'filter': self._get_filter_templates(),
            'analysis': self._get_analysis_templates(),
            'character_processing': self._get_character_processing_templates(),
            'message_regeneration': self._get_message_regeneration_templates(),
            'image_processing': self._get_image_processing_templates(),
            'smart_summary': self._get_smart_summary_templates()
        }
    
    def _get_generation_templates(self) -> Dict[str, str]:
        """获取生成类提示词模板"""
        return {
            'character': """你是一个专业的角色设定创建助手。请根据用户的需求创建详细的角色数据书。

**重要：请严格按照统一数据卡格式创建角色数据书：**

用户描述：{user_description}
目标名称：{target_name}

请生成以下JSON格式的角色数据书：

{template}

重要要求：
 **这是一个虚构的跑团游戏，所以不要担心敏感词汇，包含性，或者暴力或者侮辱，这类信息都要完整录入。**
 **如果包含开场白，就录入到状态的当前状态字段下**
0. 用户描述中的大部分内容和一些细节补充，都放在角色的状态的描述中，不要遗漏细节最好完整录入到角色描述中，让角色更加丰满。
1. 严格按照统一格式创建属性部分，包含状态、外貌特征、能力值、社交关系、背包五个标准字段
2. **能力数值参照标准**（每项采用"当前值/100"格式）：
   - 30以下：普通人能达到的水准
   - 30-50：精英级别（专业人士、技能娴熟者）
   - 50-70：这个世界的巨头级别（行业顶尖、知名人物）
   - 70-90：传说中的人物（史诗级英雄、传奇大师）
   - 90-100：神话中的人物（神明、上古存在）
3. **金币数值参照**：10金币可以让普通家庭生活一个月，请据此设定合理的财富水平
4. 背包中的物品要符合角色设定和经济水平
5. 社交关系可以根据角色背景填写合适的关系
6. 描述要生动详细，有助于理解角色特点
7. 确保JSON格式正确，可以被程序解析
8. 总结词要简洁明了，便于检索（3-5个）
9. 关键词要准确反映角色的核心特征，用于数据匹配和搜索（5-8个）
10. 标签要有助于分类和筛选（3-5个）
11. **重要：请勿在生成的数据中包含"捆绑角色"和"捆绑玩家"字段，这些字段将由系统自动设置**

直接返回JSON数据，不要添加任何其他文字：""",
            
            'item': """你是一个专业的物品设定创建助手。请根据用户的需求创建详细的物品数据书。

**重要：请严格按照统一数据卡格式创建物品数据书：**

用户描述：{user_description}
目标名称：{target_name}

请生成以下JSON格式的物品数据书：

{template}

重要要求：
1. 严格按照统一格式创建属性部分，包含状态、外貌特征、能力值、社交关系、背包五个标准字段
3. **价格参照**：10金币可以让普通家庭生活一个月，请据此设定合理的物品价格
4. 基本信息要准确反映物品特性
5. 物理属性要符合物品的实际特征
6. 功能属性要详细说明物品的用途和效果
7. 获取方式要合理，包括来源、价格等信息
8. 描述要生动详细，有助于理解物品特点
9. 确保JSON格式正确，可以被程序解析
10. 总结词要简洁明了，便于检索（3-5个）
11. 关键词要准确反映物品的核心特征，用于数据匹配和搜索（5-8个）
12. 标签要有助于分类和筛选（3-5个）

直接返回JSON数据，不要添加任何其他文字：""",
            
            
            'system': """你是一个专业的系统设定创建助手。请根据用户的需求创建详细的系统数据书。

**重要：请严格按照统一数据卡格式创建系统数据书：**

用户描述：{user_description}
目标名称：{target_name}

请生成以下JSON格式的系统数据书：

{template}

重要要求：
1. 严格按照统一格式创建属性部分，包含状态、外貌特征、能力值、社交关系、背包五个标准字段
2. **能力数值参照标准**（每项采用"当前值/100"格式）：
   - 30以下：基础系统（简单规则、基本功能）
   - 30-50：完善系统（复杂规则、专业功能）
   - 50-70：高级系统（精密规则、强大功能）
   - 70-90：传奇系统（史诗规则、超凡功能）
   - 90-100：神话系统（神级规则、不可思议的功能）
3. **经济参照**：10金币可以让普通家庭生活一个月，请据此设定系统中的经济相关数值
4. 系统信息要准确反映系统特性
5. 功能模块要详细说明系统的各项功能
6. 规则设定要清晰明确，包括基础规则和特殊规则
7. 数据结构要符合系统的设计需求
8. 描述要生动详细，有助于理解系统特点
9. 确保JSON格式正确，可以被程序解析
10. 总结词要简洁明了，便于检索（3-5个）
11. 关键词要准确反映系统的核心特征，用于数据匹配和搜索（5-8个）
12. 标签要有助于分类和筛选（3-5个）

直接返回JSON数据，不要添加任何其他文字："""
        }
    



    def _get_modification_templates(self) -> Dict[str, str]:
        """获取修改类提示词模板"""
        return {
            'temp_data_analysis': """你是一个设定修正工具，请分析发生的事件，判断是否需要更新设定。

## 统一数据卡格式说明
**重要：所有数据卡的属性部分现在都按照以下标准格式定义：**

 "属性": {
   "状态": {
     "名称": "角色名称",
     "描述": "角色的简要描述和基本设定", 
     "当前状态": "角色的实时状态变化和动态信息",
     "性格特点": "角色的主要性格特征和行为模式"
   },
  "事件": [] (如果勾选了开启才有这个部分),
  "外貌特征": {
    "身高": "具体身高",
    "体重": "具体体重", 
    "发色": "头发颜色",
    "瞳色": "眼睛颜色",
    "特征": "其他外貌特征描述"
  },
  "能力值": {
    "可以是力量智慧等面板信息": "数值/100",
    "生命": "数值/100",
    "金币": "数值"
  },
  "社交关系": {
    "朋友": [],
    "恋人": "无",
    "敌人等": []
  },
  "背包": {
    "物品名": "物品描述"
  }
}

## 分析重点
1. 识别角色状态、事件、属性的变化（遵循统一格式）
2. 只输出需要修改的具体部分**  
3. 保持原有数据结构不变
4. **优先使用统一格式的标准字段路径**
5. **关键词管理**：根据事件内容更新关键词，如果关键词列表过多（超过15个），应该替换旧的关键词而不是无限累积

## 判断标准
严格遵循 "不新增 json 的键（即新的设定）" 原则，仅对已有设定的内容进行调整或补充。

 角色状态变化判断（适配统一格式）：
 1. **状态层面变化**：名称、描述（基本设定）、当前状态（实时状态）、性格特点的任何变化
2. **外貌特征变化**：身高、体重、发色、瞳色、特征的变化（如受伤后留下疤痕、染发改变发色）
3. **能力值变化**：各种能力数值的增减、金币变化、生命值变化
4. **社交关系变化**：朋友、恋人、敌人关系的变化（从普通朋友转为对立关系、从陌生人建立合作关系等）
5. **背包物品变化**：获得、失去、使用物品
6. **身份/职业变动**：如从学生转为上班族、从职员晋升为经理
7. **位置的任何变动**：如从家中前往外地出差、从学校转移到实习公司

 **路径格式要求**：
 - 状态相关: "属性.状态.名称", "属性.状态.描述", "属性.状态.当前状态", "属性.状态.性格特点"
- 外貌相关: "属性.外貌特征.身高", "属性.外貌特征.发色", "属性.外貌特征.特征"等
- 能力相关: "属性.能力值.力量", "属性.能力值.金币", "属性.能力值.生命"等
- 关系相关: "属性.社交关系.朋友", "属性.社交关系.恋人", "属性.社交关系.敌人"等
- 物品相关: "属性.背包.物品名称"
- 关键词相关: "关键词"

关键词更新判断：
当事件涉及新的重要概念、地点、人物、技能、物品、关系等时，应该更新关键词列表：
- 如果关键词列表少于10个，可以添加新的关键词
- 如果关键词列表已有10个或更多，应该替换最不相关的旧关键词，而不是无限累积
- 新关键词应该准确反映角色的当前状态和核心特征
- 关键词应该简洁明了，便于搜索和匹配

新情节发展判断（宽泛化）：
不仅包含重大剧情转折，还包括但不限于：角色间产生新的约定（如约定周末合作完成项目）、遭遇意外事件（如路上捡到关键物品、被陌生角色请求帮助）、获取关键信息（如得知家族隐藏秘密、发现目标线索）、日常场景中的特殊事件（如在家中发现陌生人留下的痕迹、通勤时遇到交通意外）具备情节推进意义的内容，均需添加到 "属性.事件" 数组中。

特别注意（强化覆盖）：
除 "现有角色的失踪、不见了、消失" 外，若提到角色 "被限制自由（如被软禁、拘留）""失去联系超过合理时间（如失联 3 天及以上）""下落不明（如外出后未按约定返回且无法联系）" 等类似状态，均属于需强制更新角色状态的情况，必须第一时间更新设定。

完全无关日常行为界定（明确化）：
仅 "无特殊背景、无后续影响的纯粹日常行为" 才输出 NO_CHANGES，例如："正常吃早餐（无身体不适、无特殊对话）""日常起床后刷牙洗脸""下班后常规回家（无任何异常事件）"；若日常行为附带特殊情况（如 "吃早餐时突然呕吐""起床后发现家门被撬""回家路上遇到熟人并产生重要对话"），则不属于此类，需按对应标准判断是否更新设定。

**无实际交互行为界定（重要补充）**：
以下情况必须输出 NO_CHANGES：
- "路过/经过某地点但无交互"：如"路过了一家商店""经过了国师府门口""走过醉风楼附近"
- "远观/看见但无交互"：如"看到远处的幻影楼""望见了月华"（仅视觉接触）
- "想起/回忆但无现实影响"：如"想起了某角色""回忆起某事件"（纯精神活动）
- "听说/得知但无直接参与"：如"听说商店有新货""得知某角色的消息"（二手信息）

只有发生以下情况才需要更新：
- 实际交互：购买、对话、触摸、使用等
- 状态改变：情绪变化、身体变化、位置变化等  
- 获得/失去：物品、信息、关系等具体变化
- 事件发生：冲突、协议、发现等具体事件

触发关键词保护：
触发关键词部分不允许任何修改，需完整保留原有内容。

## 输出格式
如果不需要修改，输出：NO_CHANGES
**重要：如果json中没有"事件"数组，绝对不要使用add_event操作，而是直接输出 NO_CHANGES**
**只有当数据书原本就有"事件"数组时，才可以考虑添加事件**
**如果有事件，不是重大事件不需要记录,记录事件简短即可**

如果需要修改，输出修改指令（重要，只输出需要修改的部分，不要输出整个json的数据）：
```json
{
  "modifications": [
    {
      "story_name": "数据书名称",
      "operation": "update|add_event|remove_event|delete_property",
      "path": "属性路径（如：属性.状态、事件[0]等）",
      "value": "新值（对于删除操作可为null）"
    }
  ]
}
```

**重要提醒**：
1. 绝对不要输出与原数据相同的值作为"更新"
2. 只有当值确实需要改变时才输出修改指令
3. 如果事件仅是"路过、看见、想起"等无实际影响的行为，必须输出 NO_CHANGES

## 操作类型说明
- update: 更新属性值
- add_event: 添加新事件到事件数组
- remove_event: 从事件数组中删除指定事件
- delete_property: 删除指定属性

## 关键词更新示例
当需要更新关键词时，可以使用以下操作：
```json
{
  "story_name": "角色名",
  "operation": "update",
  "path": "关键词",
  "value": ["更新后的关键词1", "更新后的关键词2", "新关键词3", "..."]
}
```
注意：关键词数组会被完全替换，请确保包含所有需要保留的关键词

重要提醒：请逐字阅读整个文本，即使是长篇描述中的细节信息（如段落末尾提及的角色轻微状态变化、对话中隐藏的关系变动），也需精准识别，避免遗漏关键的角色状态变化、情节发展或关系调整信息！""",
            
            'agent_instruction': """作为专业的数据书编辑指令生成器，请分析用户的整理需求，生成精确的编辑指令。

## 指令格式规范
请返回以下格式的JSON：
{
  "instructions": [
    {
      "target_story": "数据书名称",
      "action": "UPDATE_ATTRIBUTE|REMOVE_ATTRIBUTE|UPDATE_DESCRIPTION|ADD_KEYWORD|REMOVE_KEYWORD|ADD_TAG|REMOVE_TAG",
      "field": "属性路径（如：属性.状态.描述、属性.能力值.金币等）",
      "value": "新值或要操作的内容"
    }
  ],
  "summary": "编辑操作的简要说明",
  "estimated_changes": 预计的修改数量
}

## 支持的操作类型
- UPDATE_ATTRIBUTE: 更新属性值
- REMOVE_ATTRIBUTE: 删除属性
- UPDATE_DESCRIPTION: 更新描述字段
- ADD_KEYWORD: 添加总结词（已禁用）
- REMOVE_KEYWORD: 删除总结词（已禁用）
- ADD_TAG: 添加标签（已禁用）
- REMOVE_TAG: 删除标签（已禁用）

## 重要限制
- 禁止修改总结词、标签、捆绑角色、捆绑玩家等保护字段
- 只能修改属性部分和描述字段
- 属性路径必须遵循统一数据卡格式

## 属性路径示例
- 属性.状态.描述
- 属性.外貌特征.发色
- 属性.能力值.生命
- 属性.社交关系.朋友
- 属性.背包.武器

请根据用户需求生成合适的编辑指令，只返回JSON格式，不要添加其他文字。""",
            
            'event_reduction': """作为一个专业的数据书事件减负助手，请根据用户的指令对以下数据书数据进行事件减负处理。

请按照用户的指令进行事件减负，主要操作包括：
1. 删除重复的事件和内容
2. 移除不重要或冗余的信息
3. 合并相似的事件条目
4. 精简过于详细的描述
5. 保留核心和重要的事件内容

重要要求：
- 必须保持数据书的原有JSON格式结构不变
- 保留所有必要的字段（总结词、属性、标签、描述等）
- 只对内容进行精简和去重，不改变数据结构
- 确保处理后的数据仍然完整可用

请返回处理后的数据书数据，格式如下：
{
    "reduced_stories": {
        "数据书名1": {处理后的数据书数据，保持原有JSON格式},
        "数据书名2": {处理后的数据书数据，保持原有JSON格式},
        ...
    },
    "summary": "事件减负操作的简要总结说明",
    "changes": ["具体的减负内容1", "减负内容2", ...]
}

请确保：
1. 保持数据书的基本JSON结构完整
2. 根据指令进行有意义的事件减负
3. 删除的都是真正重复或不重要的内容
4. 返回有效的JSON格式，与原格式保持一致

直接返回JSON数据，不要添加其他文字："""
        }
    
    def _get_filter_templates(self) -> Dict[str, str]:
        """获取筛选类提示词模板"""
        return {
            'storybook_selection': """作为数据书智能筛选器，请根据对话历史和临时数据分析，判断哪些数据书可能需要修改。

## 筛选原则
1. 根据对话内容的关键词，匹配可能相关的数据书
2. 优先考虑与对话主题直接相关的数据书
3. 如果对话涉及特定角色或物品，筛选包含这些元素的数据书
4. 如果对话是全局性的（如"整理所有"、"统一格式"），可能需要选择所有数据书
5. 如果对话很具体（如"更新某个角色信息"），只选择相关的数据书

## 输出格式
请返回JSON格式的结果：
{
    "target_stories": ["数据书名1", "数据书名2", ...],
    "reasoning": "筛选原因说明",
    "confidence": 0.8
}

重要：
- target_stories 应该包含所有可能需要修改的数据书名称
- 如果不确定，宁可多选而不是漏选
- 如果对话不明确或过于宽泛，可以选择所有数据书
- 只返回JSON，不要添加其他文字""",
            
            'instruction_based_selection': """作为数据书智能筛选器，请根据用户指令分析，判断哪些数据书可能需要修改。

## 筛选原则
1. 根据指令的关键词，匹配可能相关的数据书
2. 优先考虑与指令主题直接相关的数据书
3. 如果指令涉及特定属性或标签，筛选包含这些元素的数据书
4. 如果指令是全局性的（如"整理所有"、"统一格式"），可能需要选择所有数据书
5. 如果指令很具体（如"更新某个角色信息"），只选择相关的数据书

## 输出格式
请返回JSON格式的结果：
{
    "target_stories": ["数据书名1", "数据书名2", ...],
    "reasoning": "筛选原因说明",
    "confidence": 0.8
}

重要：
- target_stories 应该包含所有可能需要修改的数据书名称
- 如果不确定，宁可多选而不是漏选
- 如果指令不明确或过于宽泛，可以选择所有数据书
- 只返回JSON，不要添加其他文字""",
            
            'storybook_filter': """作为数据书筛选器，请根据筛选提示词从给定的数据书列表中筛选出符合条件的数据书。

筛选提示词：{filter_prompt}

上下文信息：{context}

可选数据书列表：
{storybooks}

## 筛选原则
1. 根据筛选提示词的关键词匹配数据书内容
2. 考虑数据书的总结词、标签、描述等信息
3. 如果提示词包含特定条件，严格按条件筛选
4. 如果提示词比较宽泛，可以放宽筛选条件

## 输出格式
请返回JSON格式的结果：
{
    "selected_storybooks": ["数据书名1", "数据书名2", ...],
    "reasoning": "筛选原因说明",
    "total_count": 总数据书数量,
    "selected_count": 筛选结果数量
}

只返回JSON，不要添加其他文字""",
            
            'character_filter': """作为角色筛选器，请根据筛选提示词从给定的角色列表中筛选出符合条件的角色。

筛选提示词：{filter_prompt}

上下文信息：{context}

可选角色列表：
{characters}

## 筛选原则
1. 根据筛选提示词的关键词匹配角色信息
2. 考虑角色的名称、介绍、标签等信息
3. 如果提示词包含特定条件，严格按条件筛选
4. 如果提示词比较宽泛，可以放宽筛选条件

## 输出格式
请返回JSON格式的结果：
{
    "selected_characters": ["角色名1", "角色名2", ...],
    "reasoning": "筛选原因说明",
    "total_count": 总角色数量,
    "selected_count": 筛选结果数量
}

只返回JSON，不要添加其他文字""",
            
            'dialogue_filter': """作为对话条目筛选器，请根据筛选提示词从给定的对话条目列表中筛选出符合条件的条目。

筛选提示词：{filter_prompt}

上下文信息：{context}

可选对话条目列表（带索引）：
{dialogue_entries}

## 筛选原则
1. 根据筛选提示词的关键词匹配对话内容
2. 考虑对话的发言者、内容、时间等信息
3. 如果提示词包含特定条件，严格按条件筛选
4. 如果提示词比较宽泛，可以放宽筛选条件

## 输出格式
请返回JSON格式的结果：
{
    "selected_indices": [0, 2, 5, ...],
    "reasoning": "筛选原因说明",
    "total_count": 总条目数量,
    "selected_count": 筛选结果数量
}

只返回JSON，不要添加其他文字""",
            
            'content_filter': """作为内容项目筛选器，请根据筛选提示词从给定的内容项目列表中筛选出符合条件的项目。

筛选提示词：{filter_prompt}

上下文信息：{context}

可选内容项目列表（带索引）：
{content_items}

## 筛选原则
1. 根据筛选提示词的关键词匹配内容
2. 考虑内容的类型、主题、关键词等信息
3. 如果提示词包含特定条件，严格按条件筛选
4. 如果提示词比较宽泛，可以放宽筛选条件

## 输出格式
请返回JSON格式的结果：
{
    "selected_indices": [0, 2, 5, ...],
    "reasoning": "筛选原因说明",
    "total_count": 总项目数量,
    "selected_count": 筛选结果数量
}

只返回JSON，不要添加其他文字""",
            
            'chat_responder_selection': """作为聊天回复者选择器，请根据对话上下文和选择标准从给定的角色列表中选择合适的回复者。

对话上下文：
{dialogue_context}

选择标准：{selection_criteria}

可选角色列表：
{characters}

最大回复者数量：{max_responders}

## 选择原则
1. 根据对话内容选择最相关的角色
2. 考虑角色的性格、背景、当前状态等因素
3. 优先选择与当前话题相关的角色
4. 避免选择不合适的角色（如正在休息、不在场等）
5. 保持对话的自然性和流畅性

## 输出格式
请返回JSON格式的结果：
{{
    "selected_responders": ["角色名1", "角色名2", ...],
    "reasoning": "选择原因说明",
    "confidence": 0.8
}}

只返回JSON，不要添加其他文字"""
        }
    
    def _get_analysis_templates(self) -> Dict[str, str]:
        """获取分析类提示词模板"""
        return {
            'instruction_analysis': """作为智能指令分析器，请分析用户指令的意图、关键词和目标类型。

用户指令：{instruction}

## 分析维度
1. 指令意图：用户想要做什么（创建、修改、删除、查询等）
2. 关键词：指令中的重要关键词
3. 目标类型：指令涉及的对象类型（角色、数据书、玩家等）
4. 操作范围：指令的影响范围（单个、多个、全部）
5. 优先级：指令的紧急程度（高、中、低）

## 输出格式
请返回JSON格式的结果：
{
    "intent": "指令意图的简要描述",
    "keywords": ["关键词1", "关键词2", ...],
    "target_types": ["角色", "数据书", "玩家"],
    "scope": "single|multiple|all",
    "priority": "high|medium|low",
    "confidence": 0.8
}

只返回JSON，不要添加其他文字"""
        }
    
    # 公共方法
    def get_generation_prompt(self, template_type: str, template: Dict[str, Any], 
                            user_description: str, target_name: Optional[str] = None) -> str:
        """获取生成提示词"""
        if template_type not in self.prompt_templates['generation']:
            raise ValueError(f"不支持的生成模板类型: {template_type}")
        
        prompt_template = self.prompt_templates['generation'][template_type]
        
        import json
        template_json = json.dumps(template, ensure_ascii=False, indent=2)
        
        return prompt_template.format(
            user_description=user_description,
            target_name=target_name or "AI自动生成",
            template=template_json
        )
    
    def get_temp_data_analysis_prompt(self) -> str:
        """获取临时数据分析提示词"""
        return self.prompt_templates['modification']['temp_data_analysis']
    
    def get_agent_instruction_prompt(self) -> str:
        """获取Agent指令提示词"""
        return self.prompt_templates['modification']['agent_instruction']
    
    def get_event_reduction_prompt(self) -> str:
        """获取事件减负提示词"""
        return self.prompt_templates['modification']['event_reduction']
    
    def get_storybook_selection_prompt(self, dialogue_history: List, 
                                     temp_data: Dict, all_stories: List) -> str:
        """获取数据书选择提示词"""
        import json
        
        prompt = self.prompt_templates['filter']['storybook_selection']
        
        context = f"""
对话历史：
{json.dumps(dialogue_history, ensure_ascii=False, indent=2)}

临时数据：
{json.dumps(temp_data, ensure_ascii=False, indent=2)}

可选数据书列表：
{json.dumps(all_stories, ensure_ascii=False, indent=2)}
"""
        
        return prompt + "\n\n" + context
    
    def get_instruction_based_selection_prompt(self, instruction: str, 
                                             all_stories: List) -> str:
        """获取基于指令的选择提示词"""
        import json
        
        prompt = self.prompt_templates['filter']['instruction_based_selection']
        
        context = f"""
用户指令：{instruction}

可选数据书列表：
{json.dumps(all_stories, ensure_ascii=False, indent=2)}
"""
        
        return prompt + "\n\n" + context
    
    def get_storybook_filter_prompt(self, storybooks: List, filter_prompt: str, 
                                  context: Optional[Dict[str, Any]]) -> str:
        """获取数据书筛选提示词"""
        import json
        
        return self.prompt_templates['filter']['storybook_filter'].format(
            filter_prompt=filter_prompt,
            context=json.dumps(context or {}, ensure_ascii=False, indent=2),
            storybooks=json.dumps(storybooks, ensure_ascii=False, indent=2)
        )
    
    def get_character_filter_prompt(self, characters: List, filter_prompt: str,
                                  context: Optional[Dict[str, Any]]) -> str:
        """获取角色筛选提示词"""
        import json
        
        return self.prompt_templates['filter']['character_filter'].format(
            filter_prompt=filter_prompt,
            context=json.dumps(context or {}, ensure_ascii=False, indent=2),
            characters=json.dumps(characters, ensure_ascii=False, indent=2)
        )
    
    def get_dialogue_filter_prompt(self, dialogue_entries: List, filter_prompt: str,
                                 context: Optional[Dict[str, Any]]) -> str:
        """获取对话筛选提示词"""
        import json
        
        # 为对话条目添加索引
        indexed_entries = [{"index": i, "content": entry} for i, entry in enumerate(dialogue_entries)]
        
        return self.prompt_templates['filter']['dialogue_filter'].format(
            filter_prompt=filter_prompt,
            context=json.dumps(context or {}, ensure_ascii=False, indent=2),
            dialogue_entries=json.dumps(indexed_entries, ensure_ascii=False, indent=2)
        )
    
    def get_content_filter_prompt(self, content_items: List, filter_prompt: str,
                                context: Optional[Dict[str, Any]]) -> str:
        """获取内容筛选提示词"""
        import json
        
        # 为内容项目添加索引
        indexed_items = [{"index": i, "content": item} for i, item in enumerate(content_items)]
        
        return self.prompt_templates['filter']['content_filter'].format(
            filter_prompt=filter_prompt,
            context=json.dumps(context or {}, ensure_ascii=False, indent=2),
            content_items=json.dumps(indexed_items, ensure_ascii=False, indent=2)
        )
    
    def get_chat_responder_selection_prompt(self, characters: List, dialogue_context: Dict,
                                          selection_criteria: str, max_responders: int) -> str:
        """获取聊天回复者选择提示词"""
        import json
        
        return self.prompt_templates['filter']['chat_responder_selection'].format(
            dialogue_context=json.dumps(dialogue_context, ensure_ascii=False, indent=2),
            selection_criteria=selection_criteria,
            characters=json.dumps(characters, ensure_ascii=False, indent=2),
            max_responders=max_responders
        )
    
    def get_instruction_analysis_prompt(self, instruction: str) -> str:
        """获取指令分析提示词"""
        return self.prompt_templates['analysis']['instruction_analysis'].format(
            instruction=instruction
        )
    # 新增模板方法
    def _get_character_processing_templates(self) -> Dict[str, str]:
        """获取角色处理类提示词模板"""
        return {
            'datacard_generation': """你是一个专业的角色设定创建助手。请根据角色描述为角色"{character_name}"创建详细的数据卡。

**重要：请严格按照统一数据卡格式返回数据卡内容：**

角色名称：{character_name}
角色描述：{description}

请生成以下JSON格式的数据卡：

{template}

重要要求：
1. 严格按照统一格式创建属性部分，包含状态、外貌特征、能力值、社交关系、背包五个标准字段
2. **能力数值参照标准**（每项采用"当前值/100"格式）：
   - 30以下：普通人能达到的水准
   - 30-50：精英级别（专业人士、技能娴熟者）
   - 50-70：这个世界的巨头级别（行业顶尖、知名人物）
   - 70-90：传说中的人物（史诗级英雄、传奇大师）
   - 90-100：神话中的人物（神明、上古存在）
3. **金币数值参照**：10金币可以让普通家庭生活一个月，请据此设定合理的财富水平
4. 背包中的物品要符合角色设定和经济水平
5. 社交关系可以根据角色背景填写合适的关系
6. 描述要生动详细，有助于理解角色特点
7. 确保JSON格式正确，可以被程序解析
8. 总结词要简洁明了，便于检索（3-5个）
9. 标签要有助于分类和筛选（3-5个）

直接返回JSON数据，不要添加任何其他文字：""",

            'tavern_translate': """请将下面的英文角色介绍翻译成中文，保持原有的格式和结构。只返回翻译后的中文内容，不要包含任何解释或标记：

{content}""",

            'tavern_polish': """请润色和优化下面的角色介绍，使其更加生动、详细和吸引人，保持原有的角色特色。只返回润色后的内容：

{content}""",

            'tavern_enhance': """请为下面的角色补充更多的背景细节、性格特点和设定信息，使角色更加立体丰满。只返回补充细节后的完整角色介绍：

{content}""",

            'tavern_localize': """请将下面的角色设定本地化，使其更适合中文语境和文化背景，调整名称、地点、文化元素等。只返回本地化后的角色介绍：

{content}""",

            'tavern_custom': """请根据指令"{instruction}"处理下面的角色介绍。只返回处理后的结果：

{content}"""
        }
    
    
    
    def _get_message_regeneration_templates(self) -> Dict[str, str]:
        """获取消息重生成类提示词模板"""
        return {
            'narrator_regeneration': """请重新描述当前情况，可以从不同角度或用新的方式来叙述当前的场景和事件。""",
            
            'character_regeneration': """请以{role_name}的身份重新回应当前的对话情况，你可以用不同的方式、语气或角度来回应。"""
        }
    
    def _get_image_processing_templates(self) -> Dict[str, str]:
        """获取图片处理类提示词模板"""
        return {
            'ocr_extraction': """你是一个专业的图片文字识别和角色描述提取助手。请仔细分析上传的图片，提取其中的所有文本内容，特别关注角色相关的描述信息。

请按以下要求处理：

1. **文字识别**：准确识别图片中的所有文字内容，包括中文、英文、数字等
2. **角色信息提取**：特别关注角色的名称、外貌、性格、背景等描述
3. **格式整理**：将提取的信息整理成清晰易读的格式
4. **完整性**：尽可能保留所有重要信息，不要遗漏关键细节

请直接返回提取的文本内容，不要添加额外的解释或格式标记："""
        }
    
    # 新增公共方法
    def get_character_datacard_generation_prompt(self, character_name: str, description: str, template: Dict[str, Any]) -> str:
        """获取角色数据卡生成提示词"""
        import json
        template_json = json.dumps(template, ensure_ascii=False, indent=2)
        
        return self.prompt_templates['character_processing']['datacard_generation'].format(
            character_name=character_name,
            description=description,
            template=template_json
        )
    
    def get_tavern_card_processing_prompt(self, processing_type: str, content: str, instruction: str = "") -> str:
        """获取酒馆角色卡处理提示词"""
        valid_types = ['tavern_translate', 'tavern_polish', 'tavern_enhance', 'tavern_localize', 'tavern_custom']
        if processing_type not in valid_types:
            raise ValueError(f"不支持的处理类型: {processing_type}，支持的类型: {valid_types}")
        
        template = self.prompt_templates['character_processing'][processing_type]
        
        if processing_type == 'tavern_custom':
            return template.format(instruction=instruction, content=content)
        else:
            return template.format(content=content)
    
    
    
    def get_message_regeneration_prompt(self, regeneration_type: str, role_name: str = "") -> str:
        """获取消息重生成提示词"""
        if regeneration_type == 'narrator':
            return self.prompt_templates['message_regeneration']['narrator_regeneration']
        elif regeneration_type == 'character':
            return self.prompt_templates['message_regeneration']['character_regeneration'].format(role_name=role_name)
        else:
            raise ValueError(f"不支持的重生成类型: {regeneration_type}")
    
    def get_image_ocr_prompt(self) -> str:
        """获取图片OCR提示词"""
        return self.prompt_templates['image_processing']['ocr_extraction']
    
    def _get_smart_summary_templates(self) -> Dict[str, str]:
        """获取智能总结类提示词模板 - 现在直接引用统一的temp_data_analysis版本"""
        return {
            # 注释：storybook_analysis现在通过get_storybook_analysis_prompt()直接引用temp_data_analysis
            # 这样确保所有分析功能使用完全相同的提示词规范
        }
    
    # 智能总结相关公共方法
    def get_storybook_analysis_prompt(self) -> str:
        """获取数据书分析提示词 - 直接使用temp_data_analysis的统一版本"""
        return self.prompt_templates['modification']['temp_data_analysis']
    
    def get_storybook_analysis_user_prompt(self, storybook_data: Dict[str, Any], event_description: str) -> str:
        """获取数据书分析用户提示词"""
        import json
        storybook_json = json.dumps(storybook_data, ensure_ascii=False, indent=2)
        return f"原先的设定：{storybook_json}\n发生的事件：{event_description}"
