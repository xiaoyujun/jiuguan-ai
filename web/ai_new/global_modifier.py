"""
AI全局修改器
实现增量模式的Agent模式，对数据进行全局修改
用于临时数据分析、总结、AI智能指令、AI智能总结等功能
支持两种模式：指定数据书模式 和 AI选数据书的两步模式
"""

import json
import datetime
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path


class GlobalModifier:
    """AI全局修改器 - 增量Agent模式"""
    
    def __init__(self):
        self.modification_operations = [
            'update',           # 更新属性值
            'add_event',        # 添加事件
            'remove_event',     # 删除事件
            'update_property',  # 更新属性（与update相同）
            'delete_property',  # 删除属性
            'add_info'          # 添加新信息字段
        ]
        
        self.confidence_levels = ['high', 'medium', 'low']
        self.info_categories = ['状态', '外貌', '能力', '关系', '物品', '事件', '环境', '行为', '情绪', '其他']
    
    def _should_sync_to_storybook(self, force_sync: Optional[bool], is_silent: bool = False) -> bool:
        """
        检查是否应该同步到数据书
        
        Args:
            force_sync: 强制同步设置 (None: 根据配置, True: 强制同步, False: 仅临时数据)
            is_silent: 是否静默模式
            
        Returns:
            是否应该同步到数据书
        """
        if force_sync is not None:
            return force_sync
        
        try:
            from ..config_loader import ConfigManager
            config = ConfigManager.load_config()
            ai_smart_analysis = config.get('ai_smart_analysis', {})
            auto_sync = ai_smart_analysis.get('auto_sync', True)
            
            if not is_silent:
                sync_status = "同步到数据书" if auto_sync else "仅更新临时数据"
                print(f"🔧 同步配置: {sync_status}")
            
            return auto_sync
        except Exception as e:
            if not is_silent:
                print(f"⚠️ 无法读取同步配置，默认同步到数据书: {e}")
            return True  # 默认同步到数据书
    
    def analyze_and_modify_temp_data(self, role_id: str, 
                                   mode: str = 'auto_select',
                                   target_stories: Optional[List[str]] = None,
                                   is_silent: bool = False,
                                   force_sync: Optional[bool] = None) -> Dict[str, Any]:
        """
        分析并修改临时数据
        
        Args:
            role_id: 角色ID
            mode: 修改模式 ('auto_select': AI选择数据书, 'specified': 指定数据书)
            target_stories: 指定的数据书列表（仅在specified模式下使用）
            is_silent: 是否静默模式
            force_sync: 强制同步到数据书 (None: 根据配置, True: 强制同步, False: 仅临时数据)
            
        Returns:
            修改结果
        """
        try:
            if not is_silent:
                print(f"🔍 开始全局修改分析，角色: {role_id}, 模式: {mode}")
            
            # 0. 检查是否需要同步到数据书
            should_sync_to_storybook = self._should_sync_to_storybook(force_sync, is_silent)
            
            # 1. 获取聊天记录和临时数据
            chat_data = self._get_chat_history_and_temp_data(role_id)
            dialogue_history = chat_data["对话历史"]
            temp_data = chat_data["数据书临时数据"]
            
            if not dialogue_history and not temp_data:
                return {
                    'success': True,
                    'updated': False,
                    'message': '没有可分析的数据',
                    'data': None
                }
            
            # 2. 根据模式选择目标数据书
            if mode == 'auto_select':
                target_stories = self._ai_select_target_stories(
                    dialogue_history, temp_data, is_silent
                )
                if not target_stories:
                    return {
                        'success': False,
                        'message': 'AI未能选择合适的目标数据书',
                        'updated': False
                    }
            elif mode == 'specified':
                if not target_stories:
                    return {
                        'success': False,
                        'message': '指定数据书模式下必须提供target_stories参数',
                        'updated': False
                    }
            else:
                return {
                    'success': False,
                    'message': f'不支持的模式: {mode}',
                    'updated': False
                }
            
            if not is_silent:
                print(f"📋 目标数据书: {target_stories}")
            
            # 3. 生成修改指令
            modification_instructions = self._generate_modification_instructions(
                dialogue_history, temp_data, target_stories, is_silent
            )
            
            if not modification_instructions:
                return {
                    'success': True,
                    'updated': False,
                    'message': 'AI分析后无需修改',
                    'data': None
                }
            
            # 4. 应用修改指令
            if should_sync_to_storybook:
                apply_result = self._apply_modification_instructions(
                    role_id, modification_instructions, is_silent
                )
            else:
                # 仅更新临时数据，不同步到数据书
                apply_result = {'success': True, 'applied_count': len(modification_instructions), 'message': '仅更新临时数据'}
                if not is_silent:
                    print("📋 根据配置，仅更新临时数据，不同步到数据书")
            
            if apply_result['success'] and apply_result['applied_count'] > 0:
                # 5. 执行增量覆盖到临时数据
                self._incremental_overlay_to_temp_data(
                    role_id, modification_instructions, is_silent
                )
                
                sync_message = "并同步到数据书" if should_sync_to_storybook else "（仅更新临时数据）"
                return {
                    'success': True,
                    'updated': True,
                    'message': f"成功修改 {apply_result['applied_count']} 个设定{sync_message}",
                    'data': modification_instructions,
                    'applied_count': apply_result['applied_count'],
                    'target_stories': target_stories,
                    'mode': mode,
                    'synced_to_storybook': should_sync_to_storybook
                }
            else:
                return {
                    'success': False,
                    'updated': False,
                    'message': f"修改指令应用失败: {apply_result['message']}",
                    'data': modification_instructions
                }
                
        except Exception as e:
            error_message = f"全局修改分析失败: {str(e)}"
            if not is_silent:
                print(f"❌ {error_message}")
            
            return {
                'success': False,
                'message': error_message,
                'updated': False,
                'data': None
            }
    
    def modify_storybooks_directly(self, modification_instruction: str,
                                 target_stories: Optional[List[str]] = None,
                                 is_silent: bool = False) -> Dict[str, Any]:
        """
        直接修改数据书（不基于临时数据）
        
        Args:
            modification_instruction: 修改指令
            target_stories: 目标数据书列表，如果为None则由AI选择
            is_silent: 是否静默模式
            
        Returns:
            修改结果
        """
        try:
            if not modification_instruction:
                return {
                    'success': False,
                    'error': '修改指令不能为空'
                }
            
            # 1. 如果没有指定目标数据书，由AI选择
            if not target_stories:
                target_stories = self._ai_select_storybooks_for_instruction(
                    modification_instruction, is_silent
                )
                
                if not target_stories:
                    return {
                        'success': False,
                        'error': 'AI未能选择合适的目标数据书'
                    }
            
            if not is_silent:
                print(f"📋 目标数据书: {target_stories}")
            
            # 2. 读取目标数据书
            stories_data = self._load_target_storybooks(target_stories)
            
            if not stories_data:
                return {
                    'success': False,
                    'error': '没有找到可修改的数据书'
                }
            
            # 3. 生成编辑指令
            editing_instructions = self._generate_editing_instructions(
                modification_instruction, stories_data, is_silent
            )
            
            if not editing_instructions:
                return {
                    'success': False,
                    'error': 'AI未能生成有效的编辑指令'
                }
            
            # 4. 执行编辑指令
            result = self._execute_editing_instructions(
                editing_instructions, stories_data, is_silent
            )
            
            return result
            
        except Exception as e:
            return {
                'success': False,
                'error': f'直接修改数据书时发生错误: {str(e)}'
            }
    
    def _get_chat_history_and_temp_data(self, role_id: str) -> Dict[str, Any]:
        """获取聊天记录和临时数据"""
        try:
            from web.utils import PathManager
            
            chat_file = PathManager.get_chat_records_dir() / f"{role_id}.json"
            
            if not chat_file.exists():
                return {"对话历史": [], "数据书临时数据": {}}
            
            with open(chat_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            return {
                "对话历史": data.get("对话历史", []),
                "数据书临时数据": data.get("数据书临时数据", {})
            }
            
        except Exception as e:
            print(f"获取聊天记录失败: {e}")
            return {"对话历史": [], "数据书临时数据": {}}
    
    def _ai_select_target_stories(self, dialogue_history: List, 
                                temp_data: Dict, is_silent: bool) -> List[str]:
        """AI选择目标数据书"""
        try:
            from .prompt_manager import PromptManager
            from .ai_core import call_ai_model
            
            # 获取所有数据书索引
            from web.utils import PathManager
            
            storybook_dir = PathManager.get_storybook_dir()
            all_stories = []
            
            for json_file in storybook_dir.glob("*.json"):
                try:
                    with open(json_file, 'r', encoding='utf-8') as f:
                        story_data = json.load(f)
                    
                    story_info = {
                        'name': json_file.stem,
                        'summary': story_data.get('总结词', []),
                        'tags': story_data.get('标签', []),
                        'description': story_data.get('描述', '')[:100] + '...' if len(story_data.get('描述', '')) > 100 else story_data.get('描述', '')
                    }
                    all_stories.append(story_info)
                    
                except Exception as e:
                    if not is_silent:
                        print(f"读取数据书索引失败: {json_file}: {e}")
                    continue
            
            if not all_stories:
                return []
            
            # 构建AI选择提示词
            prompt_manager = PromptManager()
            selection_prompt = prompt_manager.get_storybook_selection_prompt(
                dialogue_history, temp_data, all_stories
            )
            
            # 调用AI模型
            ai_result = call_ai_model(
                prompt=selection_prompt,
                function_name='data_analysis',
                temperature=0.3,
                max_tokens=2048
            )
            
            if not ai_result['success']:
                if not is_silent:
                    print(f"AI选择数据书失败: {ai_result['error']}")
                return []
            
            content = ai_result['content']
            
            # 清理可能的markdown格式
            if content.startswith('```json'):
                content = content.replace('```json', '').replace('```', '').strip()
            elif content.startswith('```'):
                content = content.replace('```', '').strip()
            
            # 解析AI返回的选择结果
            try:
                selection_result = json.loads(content)
                target_stories = selection_result.get('target_stories', [])
                
                if not is_silent:
                    reasoning = selection_result.get('reasoning', '未提供选择理由')
                    confidence = selection_result.get('confidence', 0.5)
                    print(f"🤖 AI选择理由: {reasoning} (置信度: {confidence})")
                
                return target_stories
                
            except json.JSONDecodeError as e:
                if not is_silent:
                    print(f"解析AI选择结果失败: {e}")
                return []
                
        except Exception as e:
            if not is_silent:
                print(f"AI选择数据书时发生错误: {e}")
            return []
    
    def _ai_select_storybooks_for_instruction(self, instruction: str, 
                                            is_silent: bool) -> List[str]:
        """根据指令AI选择数据书"""
        try:
            from .prompt_manager import PromptManager
            from .ai_core import call_ai_model
            from web.utils import PathManager
            
            # 获取所有数据书索引
            storybook_dir = PathManager.get_storybook_dir()
            all_stories = []
            
            for json_file in storybook_dir.glob("*.json"):
                try:
                    with open(json_file, 'r', encoding='utf-8') as f:
                        story_data = json.load(f)
                    
                    story_info = {
                        'name': json_file.stem,
                        'summary': story_data.get('总结词', []),
                        'tags': story_data.get('标签', []),
                        'description': story_data.get('描述', '')[:100] + '...' if len(story_data.get('描述', '')) > 100 else story_data.get('描述', '')
                    }
                    all_stories.append(story_info)
                    
                except Exception:
                    continue
            
            if not all_stories:
                return []
            
            # 构建AI选择提示词
            prompt_manager = PromptManager()
            selection_prompt = prompt_manager.get_instruction_based_selection_prompt(
                instruction, all_stories
            )
            
            # 调用AI模型
            ai_result = call_ai_model(
                prompt=selection_prompt,
                function_name='data_analysis',
                temperature=0.3,
                max_tokens=2048
            )
            
            if not ai_result['success']:
                return []
            
            content = ai_result['content']
            
            # 清理可能的markdown格式
            if content.startswith('```json'):
                content = content.replace('```json', '').replace('```', '').strip()
            elif content.startswith('```'):
                content = content.replace('```', '').strip()
            
            # 解析AI返回的选择结果
            try:
                selection_result = json.loads(content)
                return selection_result.get('target_stories', [])
                
            except json.JSONDecodeError:
                return []
                
        except Exception:
            return []
    
    def _generate_modification_instructions(self, dialogue_history: List,
                                          temp_data: Dict, target_stories: List[str],
                                          is_silent: bool) -> Optional[Dict[str, Any]]:
        """生成修改指令"""
        try:
            from .prompt_manager import PromptManager
            from .ai_core import call_ai_model
            
            # 构建AI分析提示词
            prompt_manager = PromptManager()
            analysis_prompt = prompt_manager.get_temp_data_analysis_prompt()
            
            user_prompt = f"""
请分析以下对话历史和数据书临时数据，针对指定的数据书生成修改指令：

目标数据书: {', '.join(target_stories)}

=== 对话历史 ===
{json.dumps(dialogue_history, ensure_ascii=False, indent=2)}

=== 数据书临时数据 ===
{json.dumps(temp_data, ensure_ascii=False, indent=2)}

请严格按照规范进行分析，只针对指定的数据书生成修改指令。

重要提醒：
- 如果判断不需要修改任何设定，请直接输出：NO_CHANGES
- 如果需要修改设定，请返回修改指令JSON格式
- 只对目标数据书进行分析和修改

请严格按照要求输出，无需其他解释或说明文字。
"""
            
            # 调用AI模型
            ai_result = call_ai_model(
                prompt=f"{analysis_prompt}\n\n{user_prompt}",
                function_name='data_analysis',
                temperature=0.7,
                max_tokens=4096
            )
            
            if not ai_result['success']:
                if not is_silent:
                    print(f"AI生成修改指令失败: {ai_result['error']}")
                return None
            
            content = ai_result['content'].strip()
            
            if content in ["NO_CHANGES", "否", "no", "No"]:
                return None
            
            # 清理可能的markdown格式
            if content.startswith('```json'):
                content = content.replace('```json', '').replace('```', '').strip()
            elif content.startswith('```'):
                content = content.replace('```', '').strip()
            
            # 解析AI返回的修改指令
            try:
                modification_instructions = json.loads(content)
                
                if not isinstance(modification_instructions, dict) or "modifications" not in modification_instructions:
                    if not is_silent:
                        print(f"AI返回的不是有效的修改指令格式")
                    return None
                
                return modification_instructions
                
            except json.JSONDecodeError as e:
                if not is_silent:
                    print(f"解析AI返回的修改指令失败: {e}")
                return None
                
        except Exception as e:
            if not is_silent:
                print(f"生成修改指令时发生错误: {e}")
            return None
    
    def _load_target_storybooks(self, target_stories: List[str]) -> Dict[str, Any]:
        """加载目标数据书"""
        try:
            from web.utils import PathManager
            
            storybook_dir = PathManager.get_storybook_dir()
            stories_data = {}
            
            for story_name in target_stories:
                json_file = storybook_dir / f"{story_name}.json"
                if json_file.exists():
                    try:
                        with open(json_file, 'r', encoding='utf-8') as f:
                            story_data = json.load(f)
                        stories_data[story_name] = story_data
                    except Exception as e:
                        print(f"读取数据书 {story_name} 失败: {e}")
                        continue
            
            return stories_data
            
        except Exception as e:
            print(f"加载目标数据书失败: {e}")
            return {}
    
    def _generate_editing_instructions(self, instruction: str, 
                                     stories_data: Dict[str, Any],
                                     is_silent: bool) -> Optional[Dict[str, Any]]:
        """生成编辑指令"""
        try:
            from .prompt_manager import PromptManager
            from .ai_core import call_ai_model
            
            # 构建编辑指令生成提示词
            prompt_manager = PromptManager()
            instruction_prompt = prompt_manager.get_agent_instruction_prompt()
            
            user_prompt = f"""
用户修改指令: {instruction}

当前数据书数据:
{json.dumps(stories_data, ensure_ascii=False, indent=2)}

请根据用户指令生成精确的编辑指令。
"""
            
            # 调用AI模型
            ai_result = call_ai_model(
                prompt=f"{instruction_prompt}\n\n{user_prompt}",
                function_name='story_organization',
                temperature=0.3,
                max_tokens=4096
            )
            
            if not ai_result['success']:
                if not is_silent:
                    print(f"AI生成编辑指令失败: {ai_result['error']}")
                return None
            
            content = ai_result['content']
            
            # 清理可能的markdown格式
            if content.startswith('```json'):
                content = content.replace('```json', '').replace('```', '').strip()
            elif content.startswith('```'):
                content = content.replace('```', '').strip()
            
            # 解析AI返回的编辑指令
            try:
                editing_instructions = json.loads(content)
                return editing_instructions
                
            except json.JSONDecodeError as e:
                if not is_silent:
                    print(f"解析AI返回的编辑指令失败: {e}")
                return None
                
        except Exception as e:
            if not is_silent:
                print(f"生成编辑指令时发生错误: {e}")
            return None
    
    def _apply_modification_instructions(self, role_id: str, 
                                       modification_instructions: Dict[str, Any],
                                       is_silent: bool) -> Dict[str, Any]:
        """应用修改指令到数据书文件"""
        try:
            from web.utils import PathManager
            from web.core.summary_manager import StoryBookManager
            
            # 获取修改指令列表
            modifications = modification_instructions.get('modifications', [])
            if not modifications:
                return {
                    'success': True,
                    'message': '没有需要应用的修改指令',
                    'applied_count': 0
                }
            
            # 按数据书分组修改指令
            modifications_by_story = {}
            for mod in modifications:
                story_name = mod.get('story_name')
                if story_name:
                    if story_name not in modifications_by_story:
                        modifications_by_story[story_name] = []
                    modifications_by_story[story_name].append(mod)
            
            if not modifications_by_story:
                return {
                    'success': False,
                    'message': '没有有效的数据书修改指令',
                    'applied_count': 0
                }
            
            # 应用修改到各个数据书
            story_manager = StoryBookManager()
            total_applied = 0
            total_files = 0
            
            for story_name, story_modifications in modifications_by_story.items():
                try:
                    storybook_file = PathManager.get_storybook_dir() / f"{story_name}.json"
                    if storybook_file.exists():
                        result = story_manager.apply_modifications(storybook_file, story_modifications)
                        if result.get('success', False):
                            total_applied += result.get('applied_count', 0)
                            total_files += 1
                            if not is_silent:
                                print(f"✅ 成功应用 {result.get('applied_count', 0)} 个修改到 {story_name}")
                        else:
                            if not is_silent:
                                print(f"❌ 应用修改到 {story_name} 失败: {result.get('message', '未知错误')}")
                    else:
                        if not is_silent:
                            print(f"⚠️ 数据书文件不存在: {story_name}.json")
                            
                except Exception as story_e:
                    if not is_silent:
                        print(f"❌ 处理数据书 {story_name} 时出错: {story_e}")
                    continue
            
            return {
                'success': total_applied > 0,
                'message': f'成功应用 {total_applied} 个修改到 {total_files} 个数据书',
                'applied_count': total_applied,
                'files_count': total_files
            }
            
        except Exception as e:
            return {
                'success': False,
                'message': f'应用修改指令失败: {str(e)}',
                'applied_count': 0
            }
    
    def _incremental_overlay_to_temp_data(self, role_id: str,
                                        modification_instructions: Dict[str, Any],
                                        is_silent: bool):
        """增量覆盖到临时数据"""
        try:
            from web.utils import PathManager
            import json
            import datetime
            
            # 获取聊天记录文件路径
            chat_file = PathManager.get_chat_records_dir() / f"{role_id}.json"
            
            # 读取现有数据
            if chat_file.exists():
                try:
                    with open(chat_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                except Exception:
                    data = {"对话历史": [], "数据书临时数据": {}}
            else:
                data = {"对话历史": [], "数据书临时数据": {}}
            
            # 确保数据书临时数据字段存在
            if "数据书临时数据" not in data:
                data["数据书临时数据"] = {}
            
            temp_data = data["数据书临时数据"]
            
            # 应用修改指令到临时数据
            modifications = modification_instructions.get('modifications', [])
            overlay_count = 0
            
            for mod in modifications:
                story_name = mod.get('story_name', '')
                operation = mod.get('operation', '')
                path = mod.get('path', '')
                value = mod.get('value', '')
                confidence = mod.get('confidence', 'medium')
                category = mod.get('category', '其他')
                
                if not story_name or not path:
                    continue
                
                # 确保数据书临时数据中有对应的条目
                if story_name not in temp_data:
                    temp_data[story_name] = {}
                
                # 记录修改信息到临时数据
                overlay_entry = {
                    'operation': operation,
                    'path': path,
                    'value': value,
                    'confidence': confidence,
                    'category': category,
                    'timestamp': datetime.datetime.now().isoformat(),
                    'applied': True
                }
                
                # 使用时间戳作为唯一键，避免重复
                timestamp_key = f"overlay_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
                temp_data[story_name][timestamp_key] = overlay_entry
                overlay_count += 1
            
            # 保存更新后的数据
            if overlay_count > 0:
                # 确保目录存在
                chat_file.parent.mkdir(parents=True, exist_ok=True)
                
                with open(chat_file, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                
                if not is_silent:
                    print(f"✅ 成功增量覆盖 {overlay_count} 个修改到 {role_id} 的临时数据")
            
        except Exception as e:
            if not is_silent:
                print(f"增量覆盖失败: {e}")
    
    def _execute_editing_instructions(self, editing_instructions: Dict[str, Any],
                                    stories_data: Dict[str, Any],
                                    is_silent: bool) -> Dict[str, Any]:
        """执行编辑指令"""
        try:
            from web.utils import PathManager
            
            instructions = editing_instructions.get('instructions', [])
            processed_count = 0
            changes = []
            
            for instruction in instructions:
                target_story = instruction.get('target_story')
                action = instruction.get('action')
                field = instruction.get('field')
                value = instruction.get('value')
                
                if not target_story or target_story not in stories_data:
                    continue
                
                story_data = stories_data[target_story]
                
                try:
                    if action == 'UPDATE_ATTRIBUTE':
                        # 更新属性
                        if '.' in field:
                            path_parts = field.split('.')
                            current_obj = story_data
                            for part in path_parts[:-1]:
                                if part not in current_obj:
                                    current_obj[part] = {}
                                current_obj = current_obj[part]
                            current_obj[path_parts[-1]] = value
                        else:
                            story_data[field] = value
                        
                        changes.append(f"更新 {target_story}.{field} = {value}")
                        processed_count += 1
                    
                    elif action == 'REMOVE_ATTRIBUTE':
                        # 删除属性
                        if '.' in field:
                            path_parts = field.split('.')
                            current_obj = story_data
                            for part in path_parts[:-1]:
                                if part in current_obj:
                                    current_obj = current_obj[part]
                                else:
                                    current_obj = None
                                    break
                            if current_obj and path_parts[-1] in current_obj:
                                del current_obj[path_parts[-1]]
                        else:
                            if field in story_data:
                                del story_data[field]
                        
                        changes.append(f"删除 {target_story}.{field}")
                        processed_count += 1
                    
                    elif action == 'UPDATE_DESCRIPTION':
                        # 更新描述
                        story_data['描述'] = value
                        changes.append(f"更新 {target_story} 的描述")
                        processed_count += 1
                    
                except Exception as e:
                    if not is_silent:
                        print(f"执行编辑指令失败: {instruction}: {e}")
                    continue
            
            # 保存修改后的数据书
            storybook_dir = PathManager.get_storybook_dir()
            saved_count = 0
            
            for story_name, story_data in stories_data.items():
                try:
                    # 添加更新时间
                    story_data['更新时间'] = datetime.datetime.now().isoformat()
                    
                    json_file = storybook_dir / f"{story_name}.json"
                    with open(json_file, 'w', encoding='utf-8') as f:
                        json.dump(story_data, f, ensure_ascii=False, indent=2)
                    saved_count += 1
                    
                except Exception as e:
                    if not is_silent:
                        print(f"保存数据书 {story_name} 失败: {e}")
                    continue
            
            return {
                'success': True,
                'summary': editing_instructions.get('summary', '编辑完成'),
                'changes': changes,
                'processed_count': processed_count,
                'saved_count': saved_count,
                'estimated_changes': editing_instructions.get('estimated_changes', processed_count),
                'message': f'成功执行 {processed_count} 个编辑指令，保存 {saved_count} 个数据书'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'执行编辑指令时发生错误: {str(e)}'
            }
