"""
AI应用路由
处理各种明细任务，如整理、总结、临时数据分析等
基于新的优化架构
"""

from flask import Blueprint, request, jsonify
from typing import Dict, Any, Optional
import json

# 创建蓝图
ai_new_bp = Blueprint('ai_new', __name__, url_prefix='/ai_new')

# 导入新的AI模块
from .core_generator import CoreGenerator
from .global_modifier import GlobalModifier
from .smart_filter import SmartFilter
from .prompt_manager import PromptManager


@ai_new_bp.route('/generate_storybook', methods=['POST'])
def generate_storybook():
    """
    生成数据书
    支持角色、物品、地点、系统等类型
    """
    try:
        data = request.get_json()
        
        template_type = data.get('template_type', 'character')
        user_description = data.get('description', '')
        target_name = data.get('name')
        
        if not user_description:
            return jsonify({
                'success': False,
                'error': '描述不能为空'
            }), 400
        
        # 创建生成器实例
        generator = CoreGenerator()
        
        # 生成数据书
        result = generator.generate_storybook(
            template_type=template_type,
            user_description=user_description,
            target_name=target_name
        )
        
        if result['success']:
            return jsonify(result)
        else:
            return jsonify(result), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'生成数据书时发生错误: {str(e)}'
        }), 500


@ai_new_bp.route('/batch_generate_storybooks', methods=['POST'])
def batch_generate_storybooks():
    """
    批量生成数据书
    """
    try:
        data = request.get_json()
        requests = data.get('requests', [])
        
        if not requests:
            return jsonify({
                'success': False,
                'error': '生成请求列表不能为空'
            }), 400
        
        # 创建生成器实例
        generator = CoreGenerator()
        
        # 批量生成数据书
        result = generator.batch_generate_storyboks(requests)
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'批量生成数据书时发生错误: {str(e)}'
        }), 500


@ai_new_bp.route('/generate_character_for_role', methods=['POST'])
def generate_character_for_role():
    """
    为角色生成角色数据书
    """
    try:
        data = request.get_json()
        
        role_name = data.get('role_name', '')
        role_config = data.get('role_config', {})
        creation_options = data.get('creation_options', {})
        
        if not role_name:
            return jsonify({
                'success': False,
                'error': '角色名称不能为空'
            }), 400
        
        # 创建生成器实例
        generator = CoreGenerator()
        
        # 为角色生成数据书
        result = generator.generate_character_for_role(role_name, role_config, creation_options)
        
        if result['success']:
            return jsonify(result)
        else:
            return jsonify(result), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'为角色生成数据书时发生错误: {str(e)}'
        }), 500


@ai_new_bp.route('/generate_character_for_player', methods=['POST'])
def generate_character_for_player():
    """
    为玩家生成角色数据书
    """
    try:
        data = request.get_json()
        
        player_name = data.get('player_name', '')
        player_config = data.get('player_config', {})
        
        if not player_name:
            return jsonify({
                'success': False,
                'error': '玩家名称不能为空'
            }), 400
        
        # 创建生成器实例
        generator = CoreGenerator()
        
        # 为玩家生成数据书
        result = generator.generate_character_for_player(player_name, player_config)
        
        if result['success']:
            return jsonify(result)
        else:
            return jsonify(result), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'为玩家生成数据书时发生错误: {str(e)}'
        }), 500




@ai_new_bp.route('/modify_storybooks', methods=['POST'])
def modify_storybooks():
    """
    直接修改数据书
    不基于临时数据的修改
    """
    try:
        data = request.get_json()
        
        modification_instruction = data.get('instruction', '')
        target_stories = data.get('target_stories')
        is_silent = data.get('is_silent', False)
        
        if not modification_instruction:
            return jsonify({
                'success': False,
                'error': '修改指令不能为空'
            }), 400
        
        # 创建修改器实例
        modifier = GlobalModifier()
        
        # 直接修改数据书
        result = modifier.modify_storybooks_directly(
            modification_instruction=modification_instruction,
            target_stories=target_stories,
            is_silent=is_silent
        )
        
        if result['success']:
            return jsonify(result)
        else:
            return jsonify(result), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'修改数据书时发生错误: {str(e)}'
        }), 500


@ai_new_bp.route('/filter_content', methods=['POST'])
def filter_content():
    """
    智能筛选内容
    支持多种筛选类型
    """
    try:
        data = request.get_json()
        
        filter_type = data.get('filter_type', '')
        items = data.get('items', [])
        filter_prompt = data.get('filter_prompt', '')
        context = data.get('context')
        max_results = data.get('max_results')
        is_silent = data.get('is_silent', False)
        
        if not filter_type:
            return jsonify({
                'success': False,
                'error': '筛选类型不能为空'
            }), 400
        
        if not filter_prompt:
            return jsonify({
                'success': False,
                'error': '筛选提示词不能为空'
            }), 400
        
        # 创建筛选器实例
        filter_engine = SmartFilter()
        
        # 执行筛选
        result = filter_engine.filter_by_prompt(
            filter_type=filter_type,
            items=items,
            filter_prompt=filter_prompt,
            context=context,
            max_results=max_results,
            is_silent=is_silent
        )
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'筛选内容时发生错误: {str(e)}'
        }), 500




@ai_new_bp.route('/filter_smart_instructions', methods=['POST'])
def filter_smart_instructions():
    """
    智能指令筛选
    """
    try:
        data = request.get_json()
        
        instruction = data.get('instruction', '')
        available_data = data.get('available_data', {})
        instruction_type = data.get('instruction_type', 'general')
        is_silent = data.get('is_silent', False)
        
        if not instruction:
            return jsonify({
                'success': False,
                'error': '指令不能为空'
            }), 400
        
        # 创建筛选器实例
        filter_engine = SmartFilter()
        
        # 智能指令筛选
        result = filter_engine.filter_smart_instructions(
            instruction=instruction,
            available_data=available_data,
            instruction_type=instruction_type,
            is_silent=is_silent
        )
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'智能指令筛选时发生错误: {str(e)}'
        }), 500


@ai_new_bp.route('/organize_stories', methods=['POST'])
def organize_stories():
    """
    整理数据书
    基于新的全局修改器
    """
    try:
        data = request.get_json()
        
        organize_instruction = data.get('instruction', '')
        target_stories = data.get('target_stories')
        is_silent = data.get('is_silent', False)
        
        if not organize_instruction:
            return jsonify({
                'success': False,
                'error': '整理指令不能为空'
            }), 400
        
        # 创建修改器实例
        modifier = GlobalModifier()
        
        # 整理数据书
        result = modifier.modify_storybooks_directly(
            modification_instruction=organize_instruction,
            target_stories=target_stories,
            is_silent=is_silent
        )
        
        if result['success']:
            return jsonify(result)
        else:
            return jsonify(result), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'整理数据书时发生错误: {str(e)}'
        }), 500


@ai_new_bp.route('/event_reduce', methods=['POST'])
def event_reduce():
    """
    事件减负
    删除重复或不重要的事件内容
    """
    try:
        data = request.get_json()
        
        reduce_instruction = data.get('instruction', '')
        target_stories = data.get('target_stories')
        is_silent = data.get('is_silent', False)
        
        if not reduce_instruction:
            return jsonify({
                'success': False,
                'error': '减负指令不能为空'
            }), 400
        
        # 使用新架构的全局修改器实现事件减负
        modifier = GlobalModifier()
        result = modifier.modify_storybooks_directly(
            modification_instruction=f"事件减负：{reduce_instruction}",
            target_stories=target_stories,
            is_silent=is_silent
        )
        
        if result['success']:
            return jsonify(result)
        else:
            return jsonify(result), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'事件减负时发生错误: {str(e)}'
        }), 500


@ai_new_bp.route('/smart_summary', methods=['POST'])
def smart_summary():
    """
    AI智能总结
    基于筛选和修改的组合操作
    """
    try:
        data = request.get_json()
        
        role_id = data.get('role_id', '')
        summary_type = data.get('summary_type', 'auto')  # auto, manual, targeted
        target_content = data.get('target_content')
        summary_criteria = data.get('summary_criteria', '')
        is_silent = data.get('is_silent', False)
        
        if not role_id:
            return jsonify({
                'success': False,
                'error': '角色ID不能为空'
            }), 400
        
        # 创建筛选器和修改器实例
        filter_engine = SmartFilter()
        modifier = GlobalModifier()
        
        # 根据总结类型执行不同的逻辑
        if summary_type == 'auto':
            # 自动总结：分析临时数据并自动选择要总结的内容
            result = modifier.analyze_and_modify_temp_data(
                role_id=role_id,
                mode='auto_select',
                is_silent=is_silent
            )
        elif summary_type == 'targeted':
            # 定向总结：根据特定条件筛选内容后进行总结
            if not target_content:
                return jsonify({
                    'success': False,
                    'error': '定向总结模式下必须提供目标内容'
                }), 400
            
            # 先筛选相关内容
            filter_result = filter_engine.filter_by_prompt(
                filter_type='dialogue',
                items=target_content,
                filter_prompt=summary_criteria or '筛选需要总结的重要内容',
                is_silent=is_silent
            )
            
            if filter_result['success'] and filter_result['filtered_items']:
                # 基于筛选结果进行总结
                result = modifier.analyze_and_modify_temp_data(
                    role_id=role_id,
                    mode='auto_select',
                    is_silent=is_silent
                )
            else:
                result = {
                    'success': False,
                    'error': '筛选结果为空，无法进行总结'
                }
        else:
            # 手动总结：由用户指定具体的总结内容
            result = modifier.analyze_and_modify_temp_data(
                role_id=role_id,
                mode='specified',
                target_stories=target_content,
                is_silent=is_silent
            )
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'智能总结时发生错误: {str(e)}'
        }), 500


@ai_new_bp.route('/get_prompt_template', methods=['GET'])
def get_prompt_template():
    """
    获取提示词模板
    """
    try:
        template_type = request.args.get('type', '')
        template_name = request.args.get('name', '')
        
        if not template_type or not template_name:
            return jsonify({
                'success': False,
                'error': '模板类型和名称不能为空'
            }), 400
        
        # 创建提示词管理器实例
        prompt_manager = PromptManager()
        
        # 获取模板
        if hasattr(prompt_manager, f'get_{template_name}_prompt'):
            template = getattr(prompt_manager, f'get_{template_name}_prompt')()
            return jsonify({
                'success': True,
                'template': template,
                'type': template_type,
                'name': template_name
            })
        else:
            return jsonify({
                'success': False,
                'error': f'未找到模板: {template_name}'
            }), 404
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'获取提示词模板时发生错误: {str(e)}'
        }), 500


@ai_new_bp.route('/health', methods=['GET'])
def health_check():
    """
    健康检查接口
    """
    return jsonify({
        'success': True,
        'message': 'AI新架构模块运行正常',
        'version': '1.0.0',
        'modules': [
            'CoreGenerator',
            'GlobalModifier', 
            'SmartFilter',
            'PromptManager'
        ]
    })


# 兼容性接口：提供与旧版API兼容的接口


@ai_new_bp.route('/legacy/story_creation', methods=['POST'])
def legacy_story_creation():
    """
    兼容性接口：数据书创建
    """
    try:
        data = request.get_json()
        user_description = data.get('description', '')
        template_type = data.get('type', 'character')
        
        # 使用新架构处理
        generator = CoreGenerator()
        result = generator.generate_storybook(
            template_type=template_type,
            user_description=user_description
        )
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'创建数据书时发生错误: {str(e)}'
        }), 500


# 错误处理
@ai_new_bp.errorhandler(404)
def not_found_error(error):
    return jsonify({
        'success': False,
        'error': '接口不存在',
        'code': 404
    }), 404


@ai_new_bp.errorhandler(500)
def internal_error(error):
    return jsonify({
        'success': False,
        'error': '内部服务器错误',
        'code': 500
    }), 500
