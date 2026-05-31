"""
AI核心生成器
实现整体生成模式(非增量)，主要用于按照特定数据书模板生成角色的数据书
用于角色管理页面
"""

import json
import datetime
from typing import Dict, Any, Optional, List
from pathlib import Path


class CoreGenerator:
    """AI核心生成器 - 整体生成模式"""
    
    def __init__(self):
        self.generation_templates = {
            'character': self._get_character_template(),
            'item': self._get_item_template(),
            'system': self._get_system_template()
        }
    
    def _get_character_template(self, enable_events: bool = False) -> Dict[str, Any]:
        """获取角色数据书模板"""
        template = {
            "总结词": [],
            "关键词": [],  # 保留兼容性
            "属性": {
                "状态": {
                    "名称": "",
                    "描述": "",
                    "性格特点": ""
                },
                "外貌特征": {
                    "身高": "",
                    "体重": "",
                    "发色": "",
                    "瞳色": "",
                    "特征": ""
                },
                "能力值": {
                    "力量": "0/100",
                    "智力": "0/100",
                    "生命": "100/100",
                    "金币": "0"
                },
                "社交关系": {
                    "朋友": [],
                    "恋人": "无",
                    "敌人等": []
                },
                "背包": {}
            },
            "标签": [],
            "描述": ""
            # 注意：移除了"捆绑角色"和"捆绑玩家"字段，这些将在后端自动添加
            # 注意：移除了"更新时间"字段，这个将在保存时自动添加
        }
        
        # 如果启用事件功能，添加事件数组
        if enable_events:
            template["事件"] = []
            
        return template
    
    
    def _get_item_template(self) -> Dict[str, Any]:
        """获取物品数据书模板"""
        return {
            "总结词": [],
            "关键词": [],
            "属性": {
                "基本信息": {
                    "名称": "",
                    "类型": "",
                    "稀有度": "普通"
                },
                "物理属性": {
                    "重量": "",
                    "尺寸": "",
                    "材质": ""
                },
                "功能属性": {
                    "用途": "",
                    "效果": "",
                    "持续时间": ""
                },
                "获取方式": {
                    "来源": "",
                    "价格": "",
                    "制作材料": []
                }
            },
            "标签": [],
            "描述": "",
            "捆绑角色": [],
            "捆绑玩家": [],
            "更新时间": ""
        }
    
    
    def _get_system_template(self) -> Dict[str, Any]:
        """获取系统数据书模板"""
        return {
            "总结词": [],
            "关键词": [],
            "属性": {
                "系统信息": {
                    "名称": "",
                    "类型": "系统",
                    "版本": "1.0"
                },
                "功能模块": {
                    "核心功能": [],
                    "辅助功能": [],
                    "特殊机制": []
                },
                "规则设定": {
                    "基础规则": [],
                    "特殊规则": [],
                    "例外情况": []
                },
                "数据结构": {
                    "输入格式": "",
                    "输出格式": "",
                    "存储方式": ""
                }
            },
            "标签": [],
            "描述": "",
            "捆绑角色": [],
            "捆绑玩家": [],
            "更新时间": ""
        }
    
    def generate_storybook(self, template_type: str, user_description: str, 
                          target_name: Optional[str] = None) -> Dict[str, Any]:
        """
        生成数据书
        
        Args:
            template_type: 模板类型 ('character', 'item', 'system')
            user_description: 用户描述
            target_name: 目标名称，如果不提供则由AI生成
            
        Returns:
            生成结果字典
        """
        try:
            from .prompt_manager import PromptManager
            from .ai_core import call_ai_model
            
            if template_type not in self.generation_templates:
                return {
                    'success': False,
                    'error': f'不支持的模板类型: {template_type}'
                }
            
            # 获取模板
            template = self.generation_templates[template_type].copy()
            
            # 构建生成提示词
            prompt_manager = PromptManager()
            generation_prompt = prompt_manager.get_generation_prompt(
                template_type, template, user_description, target_name
            )
            
            # 调用AI模型
            ai_result = call_ai_model(
                prompt=generation_prompt,
                function_name='story_creation',
                temperature=0.7
            )
            
            if not ai_result['success']:
                return {
                    'success': False,
                    'error': f'AI模型调用失败: {ai_result["error"]}'
                }
            
            content = ai_result['content']
            
            # 清理可能的markdown格式
            if content.startswith('```json'):
                content = content.replace('```json', '').replace('```', '').strip()
            elif content.startswith('```'):
                content = content.replace('```', '').strip()
            
            # 解析AI返回的JSON
            try:
                generated_data = json.loads(content)
                
                # 添加更新时间
                generated_data['更新时间'] = datetime.datetime.now().isoformat()
                
                # 如果指定了目标名称，更新相应字段
                if target_name and 'attributes' in generated_data:
                    if template_type == 'character':
                        generated_data['属性']['状态']['名称'] = target_name
                    elif template_type in ['item', 'system']:
                        generated_data['属性']['基本信息']['名称'] = target_name
                
                return {
                    'success': True,
                    'data': generated_data,
                    'template_type': template_type,
                    'message': f'成功生成{template_type}类型的数据书'
                }
                
            except json.JSONDecodeError as e:
                return {
                    'success': False,
                    'error': f'AI返回的JSON格式不正确: {str(e)}。原始内容: {content[:200]}...'
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': f'生成数据书时发生错误: {str(e)}'
            }
    
    def batch_generate_storyboks(self, requests: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        批量生成数据书
        
        Args:
            requests: 生成请求列表，每个请求包含template_type, description, name等
            
        Returns:
            批量生成结果
        """
        results = []
        success_count = 0
        
        for i, request in enumerate(requests):
            template_type = request.get('template_type', 'character')
            description = request.get('description', '')
            name = request.get('name')
            
            if not description:
                results.append({
                    'index': i,
                    'success': False,
                    'error': '描述不能为空'
                })
                continue
            
            # 生成单个数据书
            result = self.generate_storybook(template_type, description, name)
            result['index'] = i
            results.append(result)
            
            if result['success']:
                success_count += 1
        
        return {
            'success': True,
            'results': results,
            'total_count': len(requests),
            'success_count': success_count,
            'message': f'批量生成完成，成功生成{success_count}/{len(requests)}个数据书'
        }
    
    def generate_character_for_role(self, role_name: str, role_config: Dict[str, Any], creation_options: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        为角色生成角色数据书
        
        Args:
            role_name: 角色名称
            role_config: 角色配置信息
            creation_options: 创建选项 (enable_events, additional_instructions)
            
        Returns:
            生成结果
        """
        try:
            # 处理创建选项
            creation_options = creation_options or {}
            enable_events = creation_options.get('enable_events', False)
            additional_instructions = creation_options.get('additional_instructions', '')
            
            # 从角色配置中提取描述信息
            description_parts = []
            
            if '介绍' in role_config:
                description_parts.append(f"角色介绍: {role_config['介绍']}")
            
            if '开场白' in role_config:
                description_parts.append(f"开场白: {role_config['开场白']}")
            
            if 'tags' in role_config and role_config['tags']:
                description_parts.append(f"标签: {', '.join(role_config['tags'])}")
            
            if 'voice_id' in role_config:
                description_parts.append(f"语音ID: {role_config['voice_id']}")
            
            description = '\n\n'.join(description_parts)
            
            if not description:
                description = f"请为名为'{role_name}'的角色创建详细的角色数据"
            
            # 添加事件功能说明
            if enable_events:
                description += f"\n\n**特别要求：请在数据书中添加'事件'数组字段，用于记录角色的重要经历和关键大事件。事件数组初始为空，后续可通过AI分析对话内容自动添加重要事件。**"
            
            # 添加用户的附加说明
            if additional_instructions:
                description += f"\n\n**用户附加要求：**\n{additional_instructions}"
            
            # 生成角色数据书，使用标准的提示词管理器
            if enable_events:
                # 如果启用事件，需要特殊处理模板
                template = self._get_character_template(enable_events)
                from .prompt_manager import PromptManager
                prompt_manager = PromptManager()
                generation_prompt = prompt_manager.get_generation_prompt(
                    'character', template, description, role_name
                )
                # 添加事件功能的特殊说明
                generation_prompt += "\n\n**重要：必须包含'事件'数组字段，初始为空数组[]，这个字段将用于记录角色的重要经历和关键大事件**"
                
                from .ai_core import call_ai_model
                ai_result = call_ai_model(
                    prompt=generation_prompt,
                    function_name='story_creation',
                    temperature=0.7
                )
                
                if ai_result['success']:
                    try:
                        generated_data = json.loads(ai_result['content'])
                        # 确保事件字段存在
                        if '事件' not in generated_data:
                            generated_data['事件'] = []
                        
                        result = {
                            'success': True,
                            'data': generated_data,
                            'template_type': 'character',
                            'message': '成功为角色生成角色数据书'
                        }
                    except json.JSONDecodeError as e:
                        result = {
                            'success': False,
                            'error': f'AI返回的JSON格式不正确: {str(e)}'
                        }
                else:
                    result = {
                        'success': False,
                        'error': f'AI模型调用失败: {ai_result["error"]}'
                    }
            else:
                # 使用标准的生成方法
                result = self.generate_storybook('character', description, role_name)
            
            if result['success']:
                # 自动添加系统管理的字段 - 这些字段不应该由AI生成
                if 'data' in result and isinstance(result['data'], dict):
                    # 1. 设置捆绑角色字段 - 将当前角色绑定到新创建的数据书
                    result['data']['捆绑角色'] = [role_name]
                    print(f"🔗 [数据书绑定] 已将角色 '{role_name}' 添加到数据书的捆绑角色列表")
                    
                    # 2. 初始化捆绑玩家字段为空（仅当角色类型为玩家时才会有内容）
                    result['data']['捆绑玩家'] = []
                    
                    # 3. 添加更新时间
                    result['data']['更新时间'] = datetime.datetime.now().isoformat()
                
                # 保存生成的数据书
                from web.utils import PathManager
                
                storybook_dir = PathManager.get_storybook_dir()
                storybook_file = storybook_dir / f"{role_name}.json"
                
                with open(storybook_file, 'w', encoding='utf-8') as f:
                    json.dump(result['data'], f, ensure_ascii=False, indent=2)
                
                print(f"💾 [数据书保存] 已保存数据书到: {storybook_file}")
                print(f"🔗 [最终绑定] 数据书捆绑角色列表: {result['data'].get('捆绑角色', [])}")
                
                # 调用双向绑定API确保角色文件也更新了绑定数据书列表
                try:
                    from web.api_routes import update_storybook_bindings
                    update_storybook_bindings(role_name, [role_name])
                    print(f"🔗 [双向绑定] 已完成角色 '{role_name}' 与数据书 '{role_name}' 的双向绑定")
                except Exception as binding_error:
                    print(f"⚠️ [双向绑定警告] 数据书已创建，但双向绑定更新失败: {binding_error}")
                
                result['saved_to'] = str(storybook_file)
                result['message'] = f'成功为角色{role_name}生成并保存角色数据书，已自动设置双向绑定'
            
            return result
            
        except Exception as e:
            return {
                'success': False,
                'error': f'为角色{role_name}生成数据书时发生错误: {str(e)}'
            }
    
    def generate_character_for_player(self, player_name: str, player_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        为玩家生成角色数据书
        
        Args:
            player_name: 玩家名称
            player_config: 玩家配置信息
            
        Returns:
            生成结果
        """
        try:
            # 从玩家配置中提取描述信息
            description_parts = []
            
            if '介绍' in player_config:
                description_parts.append(f"玩家介绍: {player_config['介绍']}")
            
            if '描述' in player_config:
                description_parts.append(f"玩家描述: {player_config['描述']}")
            
            # 玩家数据书应该包含玩家相关的属性和技能
            description_parts.append(f"请为玩家'{player_name}'创建一个详细的角色数据书，包含玩家的背景、技能、装备等信息")
            
            description = '\n\n'.join(description_parts)
            
            if not description:
                description = f"请为名为'{player_name}'的玩家创建详细的角色数据"
            
            # 生成角色数据书
            result = self.generate_storybook('character', description, player_name)
            
            if result['success']:
                # 自动添加系统管理的字段 - 这些字段不应该由AI生成
                if 'data' in result and isinstance(result['data'], dict):
                    # 1. 设置捆绑玩家字段 - 将当前玩家绑定到新创建的数据书
                    result['data']['捆绑玩家'] = [player_name]
                    print(f"🔗 [数据书绑定] 已将玩家 '{player_name}' 添加到数据书的捆绑玩家列表")
                    
                    # 2. 初始化捆绑角色字段为空（玩家数据书通常不绑定角色）
                    result['data']['捆绑角色'] = []
                    
                    # 3. 添加更新时间
                    result['data']['更新时间'] = datetime.datetime.now().isoformat()
                
                # 保存生成的数据书
                from web.utils import PathManager
                
                storybook_dir = PathManager.get_storybook_dir()
                storybook_file = storybook_dir / f"{player_name}.json"
                
                with open(storybook_file, 'w', encoding='utf-8') as f:
                    json.dump(result['data'], f, ensure_ascii=False, indent=2)
                
                print(f"💾 [数据书保存] 已保存数据书到: {storybook_file}")
                print(f"🔗 [最终绑定] 数据书捆绑玩家列表: {result['data'].get('捆绑玩家', [])}")
                
                # 调用双向绑定API确保玩家文件也更新了绑定数据书列表
                try:
                    from web.core.story_reference_manager import StoryReferenceManager
                    reference_manager = StoryReferenceManager()
                    binding_success = reference_manager.bind_story_to_player(player_name, player_name)
                    if binding_success:
                        print(f"🔗 [双向绑定] 已完成玩家 '{player_name}' 与数据书 '{player_name}' 的双向绑定")
                    else:
                        print(f"⚠️ [双向绑定警告] 数据书端绑定成功，但玩家端绑定失败")
                except Exception as binding_error:
                    print(f"⚠️ [双向绑定警告] 数据书已创建，但双向绑定更新失败: {binding_error}")
                
                result['saved_to'] = str(storybook_file)
                result['message'] = f'成功为玩家{player_name}生成并保存角色数据书，已自动设置双向绑定'
            
            return result
            
        except Exception as e:
            return {
                'success': False,
                'error': f'为玩家{player_name}生成数据书时发生错误: {str(e)}'
            }
