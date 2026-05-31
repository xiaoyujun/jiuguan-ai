import sys
from pathlib import Path

# 添加项目根目录到Python路径
sys.path.append(str(Path(__file__).parent.parent.parent))

from API import stream_chat_response, get_model_for_function, stream_chat_response_with_config
from web.utils import PathManager
import json
import logging
from pathlib import Path
from typing import List, Tuple, Dict, Optional, Any

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class StoryBookManager:
    """数据书管理器"""
    
    def __init__(self, story_dir: str = None, chat_dir: str = None):
        self.story_dir = Path(story_dir) if story_dir else PathManager.get_storybook_dir()
        self.chat_dir = Path(chat_dir) if chat_dir else PathManager.get_chat_records_dir()
        self.规范 = self._load_specification()
        
    def _load_specification(self) -> str:
        """加载规范，可以考虑从外部文件加载"""
        return """你是一个设定修正工具，请分析发生的事件，判断是否需要更新设定。

## 统一数据卡格式说明
**重要：所有数据卡的属性部分现在都按照以下标准格式定义：**

"属性": {
  "状态": {
    "名称": "角色名称",
    "描述": "角色的简要描述和当前状态", 
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

## 判断标准
严格遵循 "不新增 json 的键（即新的设定）" 原则，仅对已有设定的内容进行调整或补充。

角色状态变化判断（适配统一格式）：
1. **状态层面变化**：名称、描述、性格特点的任何变化
2. **外貌特征变化**：身高、体重、发色、瞳色、特征的变化（如受伤后留下疤痕、染发改变发色）
3. **能力值变化**：各种能力数值的增减、金币变化、生命值变化
4. **社交关系变化**：朋友、恋人、敌人关系的变化（从普通朋友转为对立关系、从陌生人建立合作关系等）
5. **背包物品变化**：获得、失去、使用物品
6. **身份/职业变动**：如从学生转为上班族、从职员晋升为经理
7. **位置的任何变动**：如从家中前往外地出差、从学校转移到实习公司

**路径格式要求**：
- 状态相关: "属性.状态.名称", "属性.状态.描述", "属性.状态.性格特点"
- 外貌相关: "属性.外貌特征.身高", "属性.外貌特征.发色", "属性.外貌特征.特征"等
- 能力相关: "属性.能力值.力量", "属性.能力值.金币", "属性.能力值.生命"等
- 关系相关: "属性.社交关系.朋友", "属性.社交关系.恋人", "属性.社交关系.敌人"等
- 物品相关: "属性.背包.物品名称"

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

重要提醒：请逐字阅读整个文本，即使是长篇描述中的细节信息（如段落末尾提及的角色轻微状态变化、对话中隐藏的关系变动），也需精准识别，避免遗漏关键的角色状态变化、情节发展或关系调整信息！"""

    def _load_story_file(self, json_file: Path) -> Optional[Dict]:
        """加载单个数据书文件"""
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if not content:
                    logger.warning(f"{json_file.name} 文件为空，跳过处理")
                    return None
                return json.loads(content)
        except json.JSONDecodeError as e:
            logger.warning(f"无法解析 {json_file.name}，JSON格式错误: {e}")
            return None
        except Exception as e:
            logger.warning(f"读取 {json_file.name} 时出错: {e}")
            return None

    def _check_keyword_match(self, data: Dict, sentence: str, file_stem: str) -> bool:
        """检查总结词是否匹配"""
        keywords = data.get('总结词', []) + data.get('捆绑角色', [])
        
        # 检查文件名
        if file_stem in sentence:
            return True
        
        # 检查总结词
        return any(keyword in sentence for keyword in keywords)

    def _load_temp_data(self, role_name: str) -> Dict:
        """加载临时数据"""
        if not role_name:
            return {}
        
        try:
            chat_record_path = self.chat_dir / f"{role_name}.json"
            if chat_record_path.exists():
                with open(chat_record_path, 'r', encoding='utf-8') as f:
                    chat_data = json.load(f)
                    if isinstance(chat_data, dict) and "数据书临时数据" in chat_data:
                        return chat_data["数据书临时数据"]
        except Exception as e:
            logger.error(f"加载数据书临时数据失败: {e}")
        
        return {}

    def _merge_temp_data(self, original_data: Dict, temp_data: Dict) -> Dict:
        """合并临时数据"""
        merged_data = original_data.copy()
        
        # 合并属性数据
        if "属性" in temp_data:
            if "属性" not in merged_data:
                merged_data["属性"] = {}
            merged_data["属性"].update(temp_data["属性"])
        
        # 合并其他字段
        for key, value in temp_data.items():
            if key != "属性":
                merged_data[key] = value
        
        return merged_data

    def _extract_json_from_response(self, ai_response: str) -> Optional[str]:
        """从AI响应中提取JSON内容"""
        # 处理markdown格式
        if '```json' in ai_response:
            start = ai_response.find('```json') + 7
            end = ai_response.find('```', start)
            if end != -1:
                return ai_response[start:end].strip()
        elif '```' in ai_response:
            start = ai_response.find('```') + 3
            end = ai_response.find('```', start)
            if end != -1:
                return ai_response[start:end].strip()
        
        return ai_response.strip()

    def _process_ai_response(self, ai_response: Any) -> Optional[str]:
        """处理AI响应"""
        if not ai_response:
            return None
        
        # 检查是否是生成器
        if hasattr(ai_response, '__iter__') and not isinstance(ai_response, str):
            ai_response = ''.join(ai_response)
        
        ai_response = ai_response.strip()
        
        if not ai_response or ai_response == "NO_CHANGES":
            return ai_response
        
        return self._extract_json_from_response(ai_response)

    def _analyze_story_with_ai(self, data: Dict, sentence: str, progress_callback=None, story_name=None) -> Optional[Dict]:
        """使用AI分析故事并返回修改指令"""
        try:
            # 发送详细进度信息
            if progress_callback and story_name:
                progress_callback(0, 1, story_name, 'preparing', {
                    'story_data': {
                        'name': story_name,
                        'keywords': data.get('总结词', []) + data.get('捆绑角色', []),
                        'has_events': '事件' in data and len(data['事件']) > 0,
                        'attributes_count': len(data.get('属性', {})) if isinstance(data.get('属性'), dict) else 0,
                        'current_content': {
                            key: str(value)[:100] + "..." if len(str(value)) > 100 else str(value) 
                            for key, value in data.items() if key not in ['事件', '触发关键词']
                        }
                    },
                    'analyzing_text': sentence[:200] + "..." if len(sentence) > 200 else sentence
                })
            
            user_prompt = f"原先的设定：{json.dumps(data, ensure_ascii=False)}\n发生的事件：{sentence}"
            summary_model_config = get_model_for_function('summary')
            
            # 通知开始AI分析
            if progress_callback and story_name:
                progress_callback(0, 1, story_name, 'ai_analyzing', {
                    'prompt_length': len(user_prompt),
                    'model': summary_model_config.get('name', 'unknown') if summary_model_config else 'default'
                })
            
            # 使用正确的函数调用方式
            if summary_model_config:
                ai_response = stream_chat_response_with_config(user_prompt, self.规范, summary_model_config)
            else:
                ai_response = stream_chat_response(user_prompt, self.规范)
            
            # 通知AI响应完成
            if progress_callback and story_name:
                progress_callback(0, 1, story_name, 'processing_response', {
                    'response_length': len(str(ai_response)) if ai_response else 0
                })
            
            processed_response = self._process_ai_response(ai_response)
            
            if not processed_response:
                if progress_callback and story_name:
                    progress_callback(0, 1, story_name, 'failed', {'reason': 'AI响应处理失败'})
                return None
            
            if processed_response == "NO_CHANGES":
                if progress_callback and story_name:
                    progress_callback(0, 1, story_name, 'no_changes', {'reason': 'AI判断无需更新'})
                return {"no_changes": True}
            
            try:
                modification_data = json.loads(processed_response)
                if progress_callback and story_name:
                    modifications_count = len(modification_data.get('modifications', []))
                    progress_callback(0, 1, story_name, 'completed', {
                        'modifications_count': modifications_count,
                        'modifications_preview': [
                            {
                                'operation': mod.get('operation', ''),
                                'path': mod.get('path', ''),
                                'value': str(mod.get('value', ''))[:50] + "..." if len(str(mod.get('value', ''))) > 50 else str(mod.get('value', ''))
                            }
                            for mod in modification_data.get('modifications', [])[:3]  # 只显示前3个修改
                        ]
                    })
                return modification_data
            except json.JSONDecodeError as e:
                if progress_callback and story_name:
                    progress_callback(0, 1, story_name, 'failed', {'reason': f'JSON解析错误: {str(e)}'})
                logger.error(f"修改指令JSON解析错误: {e}, 内容: {processed_response[:200]}...")
                return None
                
        except Exception as e:
            if progress_callback and story_name:
                progress_callback(0, 1, story_name, 'failed', {'reason': f'分析异常: {str(e)}'})
            logger.error(f"AI分析过程中出错: {e}")
            return None

    def get_matching_story_books(self, sentence: str, role_name: str = None) -> Tuple[List[Tuple[Path, Dict]], List[Dict]]:
        """获取匹配的数据书和分析结果"""
        results = []
        no_update_stories = []
        temp_story_data = self._load_temp_data(role_name)
        processed_files = set()
        
        for json_file in self.story_dir.glob("*.json"):
            if json_file in processed_files:
                continue
                
            data = self._load_story_file(json_file)
            if not data:
                continue
            
            # 检查总结词匹配
            if not self._check_keyword_match(data, sentence, json_file.stem):
                no_update_stories.append({
                    'name': json_file.stem,
                    'reason': '未匹配到总结词'
                })
                continue
            
            processed_files.add(json_file)
            
            # 合并临时数据
            story_name = json_file.stem
            if story_name in temp_story_data:
                data = self._merge_temp_data(data, temp_story_data[story_name])
            
            # AI分析
            modification_result = self._analyze_story_with_ai(data, sentence)
            
            if not modification_result:
                no_update_stories.append({
                    'name': json_file.stem,
                    'reason': 'AI分析失败'
                })
            elif modification_result.get("no_changes"):
                no_update_stories.append({
                    'name': json_file.stem,
                    'reason': 'AI判断无需更新'
                })
            else:
                results.append((json_file, modification_result))
        
        return results, no_update_stories

    def apply_modifications_to_storybook(self, story_name: str, modifications: List[Dict]) -> Dict:
        """通过数据书名称应用修改指令"""
        try:
            # 构建数据书文件路径
            json_file = self.story_dir / f"{story_name}.json"
            
            if not json_file.exists():
                error_msg = f"数据书文件不存在: {story_name}.json"
                logger.error(f"❌ {error_msg}")
                return {
                    'success': False,
                    'error': error_msg
                }
            
            logger.info(f"📝 通过数据书名称应用修改: {story_name}")
            return self.apply_modifications(json_file, modifications)
            
        except Exception as e:
            error_msg = f"应用修改到数据书失败: {str(e)}"
            logger.error(f"❌ {error_msg}")
            return {
                'success': False,
                'error': error_msg
            }

    def apply_modifications(self, json_file: Path, modifications: List[Dict]) -> Dict:
        """应用修改指令到数据书JSON文件"""
        try:
            logger.info(f"🔄 开始应用修改指令到文件: {json_file.name}")
            logger.info(f"📝 修改指令数量: {len(modifications)}")
            
            # 记录文件路径和权限信息
            logger.info(f"📁 文件路径: {json_file.absolute()}")
            logger.info(f"🔐 文件存在: {json_file.exists()}")
            logger.info(f"📖 文件可读: {json_file.is_file()}")
            
            data = self._load_story_file(json_file)
            if not data:
                error_msg = f"无法加载文件 {json_file.name}"
                logger.error(f"❌ {error_msg}")
                return {
                    'success': False,
                    'message': error_msg,
                    'applied_count': 0,
                    'total_count': 0
                }
            
            logger.info(f"✅ 成功加载文件数据，包含 {len(data)} 个字段")
            
            applied_count = 0
            failed_modifications = []
            
            for i, modification in enumerate(modifications):
                logger.info(f"🔧 处理修改指令 {i+1}/{len(modifications)}: {modification}")
                try:
                    if self._apply_single_modification(data, modification, json_file):
                        applied_count += 1
                        logger.info(f"✅ 修改指令 {i+1} 应用成功")
                    else:
                        failed_modifications.append(f"修改 {i+1}: {modification}")
                        logger.warning(f"⚠️ 修改指令 {i+1} 应用失败")
                except Exception as mod_error:
                    failed_modifications.append(f"修改 {i+1}: {modification} - 异常: {str(mod_error)}")
                    logger.error(f"❌ 修改指令 {i+1} 应用异常: {mod_error}")
            
            logger.info(f"📊 修改结果: 成功 {applied_count}/{len(modifications)}")
            
            # 写回文件
            logger.info(f"💾 开始写回文件: {json_file.name}")
            try:
                with open(json_file, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=4)
                logger.info(f"✅ 文件写回成功")
            except Exception as write_error:
                logger.error(f"❌ 文件写回失败: {write_error}")
                return {
                    'success': False,
                    'message': f"文件写回失败: {write_error}",
                    'applied_count': applied_count,
                    'total_count': len(modifications),
                    'failed_modifications': failed_modifications
                }
            
            result_message = f"成功应用 {applied_count}/{len(modifications)} 个修改指令"
            if failed_modifications:
                result_message += f"，{len(failed_modifications)} 个失败"
            
            return {
                'success': applied_count > 0,
                'message': result_message,
                'applied_count': applied_count,
                'total_count': len(modifications),
                'failed_modifications': failed_modifications
            }
            
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            logger.error(f"❌ 应用修改指令时出错: {e}")
            logger.error(f"❌ 错误详情: {error_trace}")
            return {
                'success': False,
                'message': f"应用修改指令时出错: {e}",
                'applied_count': 0,
                'total_count': len(modifications),
                'error_trace': error_trace
            }

    def _apply_single_modification(self, data: Dict, modification: Dict, json_file: Path) -> bool:
        """应用单个修改指令"""
        story_name = modification.get("story_name")
        operation = modification.get("operation")
        path = modification.get("path")
        value = modification.get("value")
        
        logger.info(f"🔍 解析修改指令: story_name={story_name}, operation={operation}, path={path}")
        
        if not story_name:
            logger.warning("⚠️ 跳过无效修改：缺少数据书名称")
            return False
        
        if not operation:
            logger.warning("⚠️ 跳过无效修改：缺少操作类型")
            return False
        
        try:
            if operation in ["update", "update_property"]:  # 合并重复操作
                logger.info(f"🔄 执行更新操作: {path} = {value}")
                return self._update_property(data, path, value, json_file)
            elif operation == "add_event":
                logger.info(f"➕ 执行添加事件操作: {value}")
                return self._add_event(data, value, json_file)
            elif operation == "remove_event":
                logger.info(f"➖ 执行删除事件操作: {value}")
                return self._remove_event(data, value, json_file)
            elif operation == "delete_property":
                logger.info(f"🗑️ 执行删除属性操作: {path}")
                return self._delete_property(data, path, json_file)
            else:
                logger.warning(f"⚠️ 未知操作类型: {operation}")
                return False
                
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            path_str = path if path else "未知路径"
            logger.error(f"❌ 应用修改失败 {json_file.name}.{path_str}: {e}")
            logger.error(f"❌ 错误详情: {error_trace}")
            return False

    def _update_property(self, data: Dict, path: str, value: Any, json_file: Path) -> bool:
        """更新属性"""
        try:
            logger.info(f"🔄 开始更新属性: {path}")
            
            if "." in path:
                path_parts = path.split(".")
                logger.info(f"📂 嵌套路径: {path_parts}")
                current_obj = data
                for i, part in enumerate(path_parts[:-1]):
                    if part not in current_obj:
                        logger.info(f"📁 创建新对象: {part}")
                        current_obj[part] = {}
                    current_obj = current_obj[part]
                    logger.info(f"📂 进入路径 {i+1}: {part}")
                
                logger.info(f"✏️ 设置最终值: {path_parts[-1]} = {value}")
                current_obj[path_parts[-1]] = value
            else:
                logger.info(f"✏️ 设置根级属性: {path} = {value}")
                data[path] = value
            
            logger.info(f"✅ 更新成功 {json_file.name}.{path} = {value}")
            return True
            
        except Exception as e:
            logger.error(f"❌ 更新属性失败 {json_file.name}.{path}: {e}")
            return False

    def _add_event(self, data: Dict, value: str, json_file: Path) -> bool:
        """添加事件"""
        try:
            logger.info(f"➕ 开始添加事件: {value}")
            
            # 检查原始数据书是否本来就有事件数组
            if "事件" not in data:
                logger.warning(f"⚠️ 跳过添加事件到 {json_file.name}：该数据书没有事件数组，不应该添加事件")
                logger.info(f"📋 当前数据字段: {list(data.keys())}")
                return False
            
            logger.info(f"📋 事件数组当前长度: {len(data['事件'])}")
            data["事件"].append(value)
            logger.info(f"✅ 添加事件成功 {json_file.name}: {value}")
            logger.info(f"📋 事件数组新长度: {len(data['事件'])}")
            return True
            
        except Exception as e:
            logger.error(f"❌ 添加事件失败 {json_file.name}: {e}")
            return False

    def _remove_event(self, data: Dict, value: str, json_file: Path) -> bool:
        """删除事件"""
        try:
            logger.info(f"➖ 开始删除事件: {value}")
            
            if "事件" not in data:
                logger.warning(f"⚠️ 事件数组不存在于 {json_file.name}")
                return False
            
            if value not in data["事件"]:
                logger.warning(f"⚠️ 事件不存在于 {json_file.name}: {value}")
                logger.info(f"📋 当前事件列表: {data['事件']}")
                return False
            
            logger.info(f"📋 事件数组当前长度: {len(data['事件'])}")
            data["事件"].remove(value)
            logger.info(f"✅ 删除事件成功 {json_file.name}: {value}")
            logger.info(f"📋 事件数组新长度: {len(data['事件'])}")
            return True
            
        except Exception as e:
            logger.error(f"❌ 删除事件失败 {json_file.name}: {e}")
            return False

    def _delete_property(self, data: Dict, path: str, json_file: Path) -> bool:
        """删除属性"""
        try:
            logger.info(f"🗑️ 开始删除属性: {path}")
            
            if "." in path:
                path_parts = path.split(".")
                logger.info(f"📂 嵌套路径: {path_parts}")
                current_obj = data
                for i, part in enumerate(path_parts[:-1]):
                    if part not in current_obj:
                        logger.warning(f"⚠️ 路径不存在: {'.'.join(path_parts[:i+1])}")
                        return False
                    current_obj = current_obj[part]
                    logger.info(f"📂 进入路径 {i+1}: {part}")
                
                final_key = path_parts[-1]
                if final_key not in current_obj:
                    logger.warning(f"⚠️ 最终属性不存在: {path}")
                    return False
                
                logger.info(f"🗑️ 删除最终属性: {final_key}")
                del current_obj[final_key]
                logger.info(f"✅ 删除属性成功 {json_file.name}.{path}")
                return True
            else:
                if path not in data:
                    logger.warning(f"⚠️ 根级属性不存在: {path}")
                    return False
                
                logger.info(f"🗑️ 删除根级属性: {path}")
                del data[path]
                logger.info(f"✅ 删除属性成功 {json_file.name}.{path}")
                return True
                
        except Exception as e:
            logger.error(f"❌ 删除属性失败 {json_file.name}.{path}: {e}")
            return False

    def summarize_story(self, sentence: str):
        """分析句子并更新相关数据书"""
        results, no_update_stories = self.get_matching_story_books(sentence)
        
        for json_file, modification_data in results:
            modifications = modification_data.get('modifications', [])
            if modifications:
                result = self.apply_modifications(json_file, modifications)
                if result['success']:
                    logger.info(f"✅ 已成功更新 {json_file.name}")
                else:
                    logger.error(f"❌ 更新 {json_file.name} 失败: {result['message']}")

    def get_summary_result_multi(self, sentence: str, role_name: str = None):
        """获取需要更新的数据书结果，不更新文件"""
        results, no_update_stories = self.get_matching_story_books(sentence, role_name)
        
        # 收集所有数据书信息
        all_story_books = []
        for json_file in self.story_dir.glob("*.json"):
            data = self._load_story_file(json_file)
            if data:
                keywords = data.get('总结词', []) + data.get('捆绑角色', [])
                should_process = self._check_keyword_match(data, sentence, json_file.stem)
                all_story_books.append({
                    'name': json_file.stem,
                    'path': json_file,
                    'should_process': should_process,
                    'keywords': keywords
                })
        
        return results, len(results) > 0, all_story_books, no_update_stories
    
    def get_matching_story_books_with_progress(self, sentence: str, role_name: str = None, progress_callback=None) -> Tuple[List[Tuple[Path, Dict]], List[Dict]]:
        """获取匹配的数据书和分析结果，带进度回调"""
        results = []
        no_update_stories = []
        temp_story_data = self._load_temp_data(role_name)
        processed_files = set()
        
        # 先收集所有匹配的数据书
        matching_files = []
        for json_file in self.story_dir.glob("*.json"):
            if json_file in processed_files:
                continue
                
            data = self._load_story_file(json_file)
            if not data:
                continue
            
            # 检查总结词匹配
            if self._check_keyword_match(data, sentence, json_file.stem):
                matching_files.append((json_file, data))
        
        total_files = len(matching_files)
        logger.info(f"找到 {total_files} 个匹配的数据书需要分析")
        
        # 处理每个匹配的文件
        for current_index, (json_file, data) in enumerate(matching_files, 1):
            story_name = json_file.stem
            
            # 回调进度
            if progress_callback:
                progress_callback(current_index, total_files, story_name, 'analyzing')
            
            processed_files.add(json_file)
            
            # 合并临时数据
            if story_name in temp_story_data:
                data = self._merge_temp_data(data, temp_story_data[story_name])
            
            # AI分析 - 传递详细的进度回调
            def detailed_progress_callback(sub_current, sub_total, sub_story_name, status, detail_info=None):
                if progress_callback:
                    # 合并详细信息到主进度回调
                    progress_callback(current_index, total_files, story_name, status, detail_info)
            
            modification_result = self._analyze_story_with_ai(data, sentence, detailed_progress_callback, story_name)
            
            if not modification_result:
                no_update_stories.append({
                    'name': json_file.stem,
                    'reason': 'AI分析失败'
                })
                if progress_callback:
                    progress_callback(current_index, total_files, story_name, 'failed')
            elif modification_result.get("no_changes"):
                no_update_stories.append({
                    'name': json_file.stem,
                    'reason': 'AI判断无需更新'
                })
                if progress_callback:
                    progress_callback(current_index, total_files, story_name, 'no_changes')
            else:
                results.append((json_file, modification_result))
                if progress_callback:
                    progress_callback(current_index, total_files, story_name, 'completed')
        
        # 处理不匹配的文件
        for json_file in self.story_dir.glob("*.json"):
            if json_file not in processed_files:
                data = self._load_story_file(json_file)
                if data and not self._check_keyword_match(data, sentence, json_file.stem):
                    no_update_stories.append({
                        'name': json_file.stem,
                        'reason': '未匹配到总结词'
                    })
        
        return results, no_update_stories

    def get_summary_result_multi_with_progress(self, sentence: str, role_name: str = None, progress_callback=None):
        """获取需要更新的数据书结果，不更新文件，带进度回调"""
        results, no_update_stories = self.get_matching_story_books_with_progress(sentence, role_name, progress_callback)
        
        # 收集所有数据书信息
        all_story_books = []
        for json_file in self.story_dir.glob("*.json"):
            data = self._load_story_file(json_file)
            if data:
                keywords = data.get('总结词', []) + data.get('捆绑角色', [])
                should_process = self._check_keyword_match(data, sentence, json_file.stem)
                all_story_books.append({
                    'name': json_file.stem,
                    'path': json_file,
                    'should_process': should_process,
                    'keywords': keywords
                })
        
        return results, len(results) > 0, all_story_books, no_update_stories


# 向后兼容的函数
def load_story_books():
    """向后兼容的函数"""
    manager = StoryBookManager()
    story_books = {}
    for json_file in manager.story_dir.glob("*.json"):
        data = manager._load_story_file(json_file)
        if data:
            keywords = data.get('总结词', [])
            for keyword in keywords:
                story_books[keyword] = json_file
    return story_books

def apply_modifications(json_file, modifications):
    """向后兼容的函数"""
    manager = StoryBookManager()
    return manager.apply_modifications(json_file, modifications)

def summarize_story(sentence: str):
    """向后兼容的函数"""
    manager = StoryBookManager()
    manager.summarize_story(sentence)

def get_summary_result_multi(sentence: str, role_name: str = None):
    """向后兼容的函数"""
    manager = StoryBookManager()
    return manager.get_summary_result_multi(sentence, role_name)

def get_summary_result_multi_with_progress(sentence: str, role_name: str = None, progress_callback=None):
    """向后兼容的函数"""
    manager = StoryBookManager()
    return manager.get_summary_result_multi_with_progress(sentence, role_name, progress_callback)


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        user_input = sys.argv[1]
    else:
        user_input = """biabia回到了地下城一层，并休息了一会生命值恢复到了80"""
    
    manager = StoryBookManager()
    manager.summarize_story(user_input)
