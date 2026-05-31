"""
AI智能筛选器
根据提示词进行筛选，主要用于智能指令、AI智能总结、多人聊天模式下筛选谁来进行回复等逻辑
"""

import json
from typing import Dict, Any, List, Optional, Tuple


class SmartFilter:
    """AI智能筛选器"""
    
    def __init__(self):
        self.filter_types = {
            'storybook': self._filter_storybooks,
            'character': self._filter_characters,
            'player': self._filter_players,
            'dialogue': self._filter_dialogue_entries,
            'content': self._filter_content_items
        }
    
    def filter_by_prompt(self, filter_type: str, items: List[Any], 
                        filter_prompt: str, context: Optional[Dict[str, Any]] = None,
                        max_results: Optional[int] = None,
                        is_silent: bool = False) -> Dict[str, Any]:
        """
        根据提示词筛选项目
        
        Args:
            filter_type: 筛选类型 ('storybook', 'character', 'player', 'dialogue', 'content')
            items: 待筛选的项目列表
            filter_prompt: 筛选提示词
            context: 上下文信息
            max_results: 最大结果数量
            is_silent: 是否静默模式
            
        Returns:
            筛选结果
        """
        try:
            if filter_type not in self.filter_types:
                return {
                    'success': False,
                    'error': f'不支持的筛选类型: {filter_type}',
                    'supported_types': list(self.filter_types.keys())
                }
            
            if not items:
                return {
                    'success': True,
                    'filtered_items': [],
                    'total_count': 0,
                    'filtered_count': 0,
                    'message': '没有可筛选的项目'
                }
            
            if not filter_prompt.strip():
                return {
                    'success': False,
                    'error': '筛选提示词不能为空'
                }
            
            # 调用对应的筛选函数
            filter_function = self.filter_types[filter_type]
            filtered_items = filter_function(items, filter_prompt, context, is_silent)
            
            # 应用最大结果数量限制
            if max_results and len(filtered_items) > max_results:
                filtered_items = filtered_items[:max_results]
            
            return {
                'success': True,
                'filtered_items': filtered_items,
                'total_count': len(items),
                'filtered_count': len(filtered_items),
                'filter_type': filter_type,
                'filter_prompt': filter_prompt,
                'message': f'筛选完成，从{len(items)}个项目中筛选出{len(filtered_items)}个结果'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'筛选过程中发生错误: {str(e)}',
                'filtered_items': [],
                'total_count': len(items) if items else 0,
                'filtered_count': 0
            }
    
    
    def filter_smart_instructions(self, instruction: str, available_data: Dict[str, Any],
                                instruction_type: str = 'general',
                                is_silent: bool = False) -> Dict[str, Any]:
        """
        智能指令筛选
        
        Args:
            instruction: 用户指令
            available_data: 可用数据（角色、数据书等）
            instruction_type: 指令类型
            is_silent: 是否静默模式
            
        Returns:
            筛选结果
        """
        try:
            # 分析指令内容
            instruction_analysis = self._analyze_instruction(instruction, is_silent)
            
            if not instruction_analysis['success']:
                return instruction_analysis
            
            # 根据指令分析结果筛选相关数据
            relevant_data = self._filter_relevant_data(
                available_data, instruction_analysis['analysis'], is_silent
            )
            
            return {
                'success': True,
                'instruction': instruction,
                'instruction_type': instruction_type,
                'analysis': instruction_analysis['analysis'],
                'relevant_data': relevant_data,
                'message': '智能指令筛选完成'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'智能指令筛选时发生错误: {str(e)}'
            }
    
    def _filter_storybooks(self, storybooks: List[Dict[str, Any]], 
                          filter_prompt: str, context: Optional[Dict[str, Any]],
                          is_silent: bool) -> List[Dict[str, Any]]:
        """筛选数据书"""
        try:
            from .prompt_manager import PromptManager
            from .ai_core import call_ai_model
            
            # 构建筛选提示词
            prompt_manager = PromptManager()
            selection_prompt = prompt_manager.get_storybook_filter_prompt(
                storybooks, filter_prompt, context
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
                    print(f"AI筛选数据书失败: {ai_result['error']}")
                return []
            
            content = ai_result['content']
            
            # 清理可能的markdown格式
            if content.startswith('```json'):
                content = content.replace('```json', '').replace('```', '').strip()
            elif content.startswith('```'):
                content = content.replace('```', '').strip()
            
            # 解析AI返回的筛选结果
            try:
                filter_result = json.loads(content)
                selected_names = filter_result.get('selected_storybooks', [])
                
                # 根据选择的名称筛选数据书
                filtered_storybooks = []
                for storybook in storybooks:
                    if storybook.get('name') in selected_names:
                        filtered_storybooks.append(storybook)
                
                return filtered_storybooks
                
            except json.JSONDecodeError as e:
                if not is_silent:
                    print(f"解析AI筛选结果失败: {e}")
                return []
                
        except Exception as e:
            if not is_silent:
                print(f"筛选数据书时发生错误: {e}")
            return []
    
    def _filter_characters(self, characters: List[Dict[str, Any]], 
                          filter_prompt: str, context: Optional[Dict[str, Any]],
                          is_silent: bool) -> List[Dict[str, Any]]:
        """筛选角色"""
        try:
            from .prompt_manager import PromptManager
            from .ai_core import call_ai_model
            
            # 构建筛选提示词
            prompt_manager = PromptManager()
            selection_prompt = prompt_manager.get_character_filter_prompt(
                characters, filter_prompt, context
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
                    print(f"AI筛选角色失败: {ai_result['error']}")
                return []
            
            content = ai_result['content']
            
            # 清理可能的markdown格式
            if content.startswith('```json'):
                content = content.replace('```json', '').replace('```', '').strip()
            elif content.startswith('```'):
                content = content.replace('```', '').strip()
            
            # 解析AI返回的筛选结果
            try:
                filter_result = json.loads(content)
                selected_names = filter_result.get('selected_characters', [])
                
                # 根据选择的名称筛选角色
                filtered_characters = []
                for character in characters:
                    if character.get('name') in selected_names:
                        filtered_characters.append(character)
                
                return filtered_characters
                
            except json.JSONDecodeError as e:
                if not is_silent:
                    print(f"解析AI筛选结果失败: {e}")
                return []
                
        except Exception as e:
            if not is_silent:
                print(f"筛选角色时发生错误: {e}")
            return []
    
    def _filter_players(self, players: List[Dict[str, Any]], 
                       filter_prompt: str, context: Optional[Dict[str, Any]],
                       is_silent: bool) -> List[Dict[str, Any]]:
        """筛选玩家"""
        # 与角色筛选类似的逻辑
        return self._filter_characters(players, filter_prompt, context, is_silent)
    
    def _filter_dialogue_entries(self, dialogue_entries: List[Dict[str, Any]], 
                               filter_prompt: str, context: Optional[Dict[str, Any]],
                               is_silent: bool) -> List[Dict[str, Any]]:
        """筛选对话条目"""
        try:
            from .prompt_manager import PromptManager
            from .ai_core import call_ai_model
            
            # 构建筛选提示词
            prompt_manager = PromptManager()
            selection_prompt = prompt_manager.get_dialogue_filter_prompt(
                dialogue_entries, filter_prompt, context
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
                    print(f"AI筛选对话条目失败: {ai_result['error']}")
                return []
            
            content = ai_result['content']
            
            # 清理可能的markdown格式
            if content.startswith('```json'):
                content = content.replace('```json', '').replace('```', '').strip()
            elif content.startswith('```'):
                content = content.replace('```', '').strip()
            
            # 解析AI返回的筛选结果
            try:
                filter_result = json.loads(content)
                selected_indices = filter_result.get('selected_indices', [])
                
                # 根据选择的索引筛选对话条目
                filtered_entries = []
                for i, entry in enumerate(dialogue_entries):
                    if i in selected_indices:
                        filtered_entries.append(entry)
                
                return filtered_entries
                
            except json.JSONDecodeError as e:
                if not is_silent:
                    print(f"解析AI筛选结果失败: {e}")
                return []
                
        except Exception as e:
            if not is_silent:
                print(f"筛选对话条目时发生错误: {e}")
            return []
    
    def _filter_content_items(self, content_items: List[Any], 
                            filter_prompt: str, context: Optional[Dict[str, Any]],
                            is_silent: bool) -> List[Any]:
        """筛选通用内容项目"""
        try:
            from .prompt_manager import PromptManager
            from .ai_core import call_ai_model
            
            # 构建筛选提示词
            prompt_manager = PromptManager()
            selection_prompt = prompt_manager.get_content_filter_prompt(
                content_items, filter_prompt, context
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
                    print(f"AI筛选内容项目失败: {ai_result['error']}")
                return []
            
            content = ai_result['content']
            
            # 清理可能的markdown格式
            if content.startswith('```json'):
                content = content.replace('```json', '').replace('```', '').strip()
            elif content.startswith('```'):
                content = content.replace('```', '').strip()
            
            # 解析AI返回的筛选结果
            try:
                filter_result = json.loads(content)
                selected_indices = filter_result.get('selected_indices', [])
                
                # 根据选择的索引筛选内容项目
                filtered_items = []
                for i, item in enumerate(content_items):
                    if i in selected_indices:
                        filtered_items.append(item)
                
                return filtered_items
                
            except json.JSONDecodeError as e:
                if not is_silent:
                    print(f"解析AI筛选结果失败: {e}")
                return []
                
        except Exception as e:
            if not is_silent:
                print(f"筛选内容项目时发生错误: {e}")
            return []
    
    
    def _analyze_instruction(self, instruction: str, is_silent: bool) -> Dict[str, Any]:
        """分析用户指令"""
        try:
            from .prompt_manager import PromptManager
            from .ai_core import call_ai_model
            
            # 构建指令分析提示词
            prompt_manager = PromptManager()
            analysis_prompt = prompt_manager.get_instruction_analysis_prompt(instruction)
            
            # 调用AI模型
            ai_result = call_ai_model(
                prompt=analysis_prompt,
                function_name='data_analysis',
                temperature=0.3,
                max_tokens=1024
            )
            
            if not ai_result['success']:
                return {
                    'success': False,
                    'error': f'AI分析指令失败: {ai_result["error"]}'
                }
            
            content = ai_result['content']
            
            # 清理可能的markdown格式
            if content.startswith('```json'):
                content = content.replace('```json', '').replace('```', '').strip()
            elif content.startswith('```'):
                content = content.replace('```', '').strip()
            
            # 解析AI返回的分析结果
            try:
                analysis_result = json.loads(content)
                
                return {
                    'success': True,
                    'analysis': analysis_result
                }
                
            except json.JSONDecodeError as e:
                return {
                    'success': False,
                    'error': f'解析AI分析结果失败: {e}'
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': f'分析指令时发生错误: {e}'
            }
    
    def _filter_relevant_data(self, available_data: Dict[str, Any], 
                            instruction_analysis: Dict[str, Any],
                            is_silent: bool) -> Dict[str, Any]:
        """根据指令分析结果筛选相关数据"""
        try:
            relevant_data = {}
            
            # 根据分析结果中的关键词和类型筛选数据
            keywords = instruction_analysis.get('keywords', [])
            target_types = instruction_analysis.get('target_types', [])
            intent = instruction_analysis.get('intent', '')
            
            # 筛选相关的数据书
            if 'storybooks' in available_data:
                relevant_storybooks = []
                for storybook in available_data['storybooks']:
                    # 根据关键词匹配
                    storybook_text = json.dumps(storybook, ensure_ascii=False).lower()
                    for keyword in keywords:
                        if keyword.lower() in storybook_text:
                            relevant_storybooks.append(storybook)
                            break
                
                relevant_data['storybooks'] = relevant_storybooks
            
            # 筛选相关的角色
            if 'characters' in available_data:
                relevant_characters = []
                for character in available_data['characters']:
                    character_text = json.dumps(character, ensure_ascii=False).lower()
                    for keyword in keywords:
                        if keyword.lower() in character_text:
                            relevant_characters.append(character)
                            break
                
                relevant_data['characters'] = relevant_characters
            
            # 筛选相关的玩家
            if 'players' in available_data:
                relevant_players = []
                for player in available_data['players']:
                    player_text = json.dumps(player, ensure_ascii=False).lower()
                    for keyword in keywords:
                        if keyword.lower() in player_text:
                            relevant_players.append(player)
                            break
                
                relevant_data['players'] = relevant_players
            
            return relevant_data
            
        except Exception as e:
            if not is_silent:
                print(f"筛选相关数据时发生错误: {e}")
            return {}
