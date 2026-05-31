#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
图片生成路由
处理/生图命令和相关的API接口
"""

import os
import sys
from flask import Blueprint, request, jsonify

# 添加当前目录到Python路径，以便导入同目录下的模块
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

try:
    from .image_generator import ImageGenerationService
except ImportError:
    # 如果相对导入失败，尝试直接导入
    from image_generator import ImageGenerationService

# 创建蓝图
image_bp = Blueprint('image_generation', __name__)

# 全局图片生成服务实例
image_service = None

def init_image_service():
    """初始化图片生成服务"""
    global image_service
    if image_service is None:
        image_service = ImageGenerationService()
    return image_service


@image_bp.route('/api/generate_image', methods=['POST'])
def generate_image():
    """
    生成图片API接口
    用于处理/生图命令
    """
    try:
        # 获取请求数据
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': '没有接收到请求数据'
            }), 400
        
        role_name = data.get('role_name')
        if not role_name:
            return jsonify({
                'success': False,
                'error': '角色名称不能为空'
            }), 400
        
        # 获取额外参数
        additional_context = data.get('additional_context', '')
        generation_params = data.get('generation_params', {})
        
        print(f"收到图片生成请求 - 角色: {role_name}, 上下文: {additional_context}")
        
        # 初始化图片生成服务
        service = init_image_service()
        
        # 生成图片
        result = service.generate_image_for_role(
            role_name=role_name,
            additional_context=additional_context,
            **generation_params
        )
        
        if result['success']:
            return jsonify({
                'success': True,
                'message': result['message'],
                'image_paths': result['image_paths'],
                'prompt': result.get('prompt', ''),
                'generation_params': result.get('generation_params', {})
            })
        else:
            return jsonify({
                'success': False,
                'error': result['error']
            }), 500
            
    except Exception as e:
        print(f"图片生成API错误: {e}")
        return jsonify({
            'success': False,
            'error': f'服务器内部错误: {str(e)}'
        }), 500


@image_bp.route('/api/image_service_status', methods=['GET'])
def get_image_service_status():
    """获取图片生成服务状态"""
    try:
        service = init_image_service()
        status = service.get_generation_status()
        
        return jsonify({
            'success': True,
            'status': status
        })
        
    except Exception as e:
        print(f"获取服务状态错误: {e}")
        return jsonify({
            'success': False,
            'error': f'获取状态失败: {str(e)}'
        }), 500


@image_bp.route('/api/test_comfyui_connection', methods=['GET'])
def test_comfyui_connection():
    """测试ComfyUI服务器连接"""
    try:
        service = init_image_service()
        connection_result = service.test_connection()
        
        return jsonify(connection_result)
        
    except Exception as e:
        print(f"连接测试错误: {e}")
        return jsonify({
            'success': False,
            'error': f'连接测试失败: {str(e)}'
        }), 500


def handle_generate_image_command(role_name: str, chat_history: list) -> dict:
    """
    处理/生图命令的核心逻辑
    这个函数将被聊天系统调用
    
    Args:
        role_name: 当前角色名称
        chat_history: 聊天历史记录
        
    Returns:
        处理结果字典
    """
    try:
        print(f"处理/生图命令 - 角色: {role_name}")
        
        # 初始化图片生成服务
        service = init_image_service()
        
        # 首先测试连接
        connection_result = service.test_connection()
        if not connection_result['success']:
            return {
                'success': False,
                'error': f'ComfyUI服务器连接失败: {connection_result["error"]}',
                'message': '请确保ComfyUI服务器正在运行'
            }
        
        # 从聊天历史中提取额外上下文（最近的用户消息）
        additional_context = ""
        if chat_history:
            # 获取最后一条用户消息作为上下文
            for msg in reversed(chat_history):
                if not msg.startswith(role_name + ":"):
                    additional_context = msg.split(":", 1)[-1].strip()
                    break
        
        # 获取用户设置的生成参数
        try:
            from settings_manager import get_settings_manager
            settings_manager = get_settings_manager()
            generation_params = settings_manager.get_generation_params()
        except Exception as e:
            print(f"获取设置失败，使用默认参数: {e}")
            generation_params = {
                'width': 768,
                'height': 768,
                'steps': 25,
                'cfg': 7.5
            }
        
        # 生成图片
        result = service.generate_image_for_role(
            role_name=role_name,
            additional_context=additional_context,
            **generation_params  # 使用设置中的参数
        )
        
        if result['success']:
            # 图片生成成功，只返回空消息，让图片自己说话
            return {
                'success': True,
                'message': "",  # 空消息，只显示图片
                'image_paths': result['image_paths'],
                'prompt': result.get('prompt', ''),
                'is_image_generation': True  # 标识这是图片生成响应
            }
        else:
            return {
                'success': False,
                'error': result['error'],
                'message': f'图片生成失败: {result["error"]}'
            }
            
    except Exception as e:
        print(f"处理/生图命令错误: {e}")
        return {
            'success': False,
            'error': str(e),
            'message': f'图片生成过程中出现错误: {str(e)}'
        }


def handle_generate_first_person_image_command(role_name: str, chat_history: list) -> dict:
    """
    处理/生成图片第一人称命令的核心逻辑
    这个函数将被聊天系统调用
    
    与普通生图的区别：
    1. 不读取玩家数据书信息
    2. 突出角色主体的状态和行为表现
    3. 重点描述角色自身的活动和情景互动
    
    Args:
        role_name: 当前角色名称
        chat_history: 聊天历史记录
        
    Returns:
        处理结果字典
    """
    try:
        print(f"处理/生成图片第一人称命令 - 角色: {role_name}")
        
        # 初始化图片生成服务
        service = init_image_service()
        
        # 首先测试连接
        connection_result = service.test_connection()
        if not connection_result['success']:
            return {
                'success': False,
                'error': f'ComfyUI服务器连接失败: {connection_result["error"]}',
                'message': '请确保ComfyUI服务器正在运行'
            }
        
        # 从聊天历史中提取额外上下文（最近的用户消息）
        additional_context = ""
        if chat_history:
            # 获取最后一条用户消息作为上下文
            for msg in reversed(chat_history):
                if not msg.startswith(role_name + ":"):
                    additional_context = msg.split(":", 1)[-1].strip()
                    break
        
        # 获取用户设置的生成参数
        try:
            from settings_manager import get_settings_manager
            settings_manager = get_settings_manager()
            generation_params = settings_manager.get_generation_params()
        except Exception as e:
            print(f"获取设置失败，使用默认参数: {e}")
            generation_params = {
                'width': 768,
                'height': 768,
                'steps': 25,
                'cfg': 7.5
            }
        
        # 使用突出主体状态生成图片
        result = service.generate_first_person_image_for_role(
            role_name=role_name,
            additional_context=additional_context,
            **generation_params  # 使用设置中的参数
        )
        
        if result['success']:
            # 图片生成成功，只返回空消息，让图片自己说话
            return {
                'success': True,
                'message': "",  # 空消息，只显示图片
                'image_paths': result['image_paths'],
                'prompt': result.get('prompt', ''),
                'is_image_generation': True,  # 标识这是图片生成响应
                'is_first_person': True  # 标识这是突出主体状态的图片
            }
        else:
            return {
                'success': False,
                'error': result['error'],
                'message': f'第一人称图片生成失败: {result["error"]}'
            }
            
    except Exception as e:
        print(f"处理/生成图片第一人称命令错误: {e}")
        return {
            'success': False,
            'error': str(e),
            'message': f'第一人称图片生成过程中出现错误: {str(e)}'
        }