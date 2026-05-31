#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
图片生成服务
集成ComfyUI客户端和提示词生成器，提供完整的图片生成功能
"""

import os
import sys
import time
import uuid
from typing import List, Dict, Any, Optional

from web.utils import PathManager

# 添加参考目录到Python路径
reference_dir = os.path.join(os.path.dirname(__file__), '参考')
current_dir = os.path.dirname(__file__)
sys.path.insert(0, reference_dir)
sys.path.insert(0, current_dir)

try:
    from comfyui_client import ComfyUIClient
except ImportError:
    # 如果直接导入失败，尝试从参考目录导入
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '参考'))
    from comfyui_client import ComfyUIClient

try:
    from prompt_generator import PromptGenerator
except ImportError:
    from .prompt_generator import PromptGenerator


class ImageGenerationService:
    """图片生成服务类"""
    
    def __init__(self, server_address: str = "127.0.0.1:8188"):
        """
        初始化图片生成服务
        
        Args:
            server_address: ComfyUI服务器地址
        """
        self.server_address = server_address
        self.prompt_generator = PromptGenerator()
        
        # 图片输出目录统一放到 data/聊天记录/生成图片 下
        self.output_dir = os.fspath(PathManager.get_chat_records_dir() / "生成图片")
        
        # 确保输出目录存在
        os.makedirs(self.output_dir, exist_ok=True)
        
        # 工作流文件路径 - 从设置中读取
        self.workflow_path = self._get_workflow_path()
    
    def _get_workflow_path(self) -> str:
        """
        从设置中获取工作流文件路径
        
        Returns:
            工作流文件的完整路径
        """
        try:
            from settings_manager import get_settings_manager
            settings_manager = get_settings_manager()
            comfyui_settings = settings_manager.get_comfyui_settings()
            workflow_filename = comfyui_settings.get('workflow_file', 'LL杰出.json')
            
            workflow_path = os.path.join(os.path.dirname(__file__), "参考", workflow_filename)
            print(f"成功加载工作流: {workflow_path}")
            
            # 检查文件是否存在
            if not os.path.exists(workflow_path):
                print(f"警告: 工作流文件不存在: {workflow_path}")
                # 回退到默认工作流
                default_path = os.path.join(os.path.dirname(__file__), "参考", "LL杰出.json")
                if os.path.exists(default_path):
                    print(f"使用默认工作流: {default_path}")
                    return default_path
            
            return workflow_path
            
        except Exception as e:
            print(f"获取工作流路径失败，使用默认工作流: {e}")
            return os.path.join(os.path.dirname(__file__), "参考", "LL杰出.json")
    
    def reload_workflow_config(self):
        """
        重新加载工作流配置
        当设置更新时调用此方法
        """
        print("重新加载工作流配置...")
        self.workflow_path = self._get_workflow_path()
    
    def generate_image_for_role(self, role_name: str, additional_context: str = "", **kwargs) -> Dict[str, Any]:
        """
        为指定角色生成图片
        
        Args:
            role_name: 角色名称
            additional_context: 额外上下文信息
            **kwargs: 其他生成参数
                - width: 图片宽度，默认768
                - height: 图片高度，默认768
                - steps: 采样步数，默认25
                - cfg: CFG值，默认7.5
                - negative_prompt: 负面提示词
                - seed: 随机种子
                
        Returns:
            生成结果字典，包含success, message, image_paths等字段
        """
        try:
            print(f"开始为角色 {role_name} 生成图片...")
            
            # 检查工作流文件是否存在
            if not os.path.exists(self.workflow_path):
                return {
                    'success': False,
                    'error': f'工作流文件不存在: {self.workflow_path}',
                    'image_paths': []
                }
            
            # 生成提示词
            print("正在生成AI绘画提示词...")
            positive_prompt = self.prompt_generator.generate_prompt(role_name, additional_context)
            
            if not positive_prompt:
                return {
                    'success': False,
                    'error': '生成提示词失败',
                    'image_paths': []
                }
            
            print(f"生成的提示词: {positive_prompt}")
            
            # 创建ComfyUI客户端
            client = ComfyUIClient(server_address=self.server_address)
            
            # 准备生成参数
            generation_params = {
                'positive_prompt': positive_prompt,
                'negative_prompt': kwargs.get('negative_prompt', 'low quality, blurry, bad anatomy, worst quality'),
                'width': kwargs.get('width', 768),
                'height': kwargs.get('height', 768),
                'steps': kwargs.get('steps', 25),
                'cfg': kwargs.get('cfg', 7.5),
                'seed': kwargs.get('seed', int(time.time() * 1000) % 1000000),
                'batch_size': kwargs.get('batch_size', 1),
                'filename_prefix': f"{role_name}_{uuid.uuid4().hex[:8]}_"
            }
            
            print(f"生成参数: {generation_params}")
            
            # 生成图片
            try:
                generated_files = client.generate_image(
                    workflow_path=self.workflow_path,
                    output_dir=self.output_dir,
                    **generation_params
                )
                
                if generated_files:
                    print(f"图片生成成功，共生成 {len(generated_files)} 张图片")
                    
                    # 将生成的图片移动到web可访问的目录
                    web_accessible_paths = self._move_to_web_directory(generated_files, role_name)
                    
                    return {
                        'success': True,
                        'message': f'成功为角色 {role_name} 生成 {len(web_accessible_paths)} 张图片',
                        'image_paths': web_accessible_paths,
                        'prompt': positive_prompt,
                        'generation_params': generation_params
                    }
                else:
                    return {
                        'success': False,
                        'error': '图片生成失败，未返回任何文件',
                        'image_paths': []
                    }
                    
            except Exception as e:
                print(f"ComfyUI生成过程中出错: {e}")
                return {
                    'success': False,
                    'error': f'ComfyUI生成失败: {str(e)}',
                    'image_paths': []
                }
            finally:
                # 确保关闭客户端连接
                try:
                    client.close()
                except:
                    pass
                    
        except Exception as e:
            print(f"图片生成服务出错: {e}")
            return {
                'success': False,
                'error': f'图片生成服务错误: {str(e)}',
                'image_paths': []
            }
    
    def generate_first_person_image_for_role(self, role_name: str, additional_context: str = "", **kwargs) -> Dict[str, Any]:
        """
        为指定角色生成突出主体状态的图片
        
        与普通生图的区别：
        1. 不读取玩家数据书信息
        2. 突出角色主体的状态和行为表现
        3. 重点描述角色自身的活动和情景互动
        
        Args:
            role_name: 角色名称
            additional_context: 额外上下文信息
            **kwargs: 其他生成参数
                - width: 图片宽度，默认768
                - height: 图片高度，默认768
                - steps: 采样步数，默认25
                - cfg: CFG值，默认7.5
                - negative_prompt: 负面提示词
                - seed: 随机种子
                
        Returns:
            生成结果字典，包含success, message, image_paths等字段
        """
        try:
            print(f"开始为角色 {role_name} 生成突出主体状态的图片...")
            
            # 检查工作流文件是否存在
            if not os.path.exists(self.workflow_path):
                return {
                    'success': False,
                    'error': f'工作流文件不存在: {self.workflow_path}',
                    'image_paths': []
                }
            
            # 生成突出主体状态的提示词
            print("正在生成突出主体状态的AI绘画提示词...")
            positive_prompt = self.prompt_generator.generate_first_person_prompt(role_name, additional_context)
            
            if not positive_prompt:
                return {
                    'success': False,
                    'error': '生成突出主体状态的提示词失败',
                    'image_paths': []
                }
            
            print(f"生成的突出主体状态提示词: {positive_prompt}")
            
            # 创建ComfyUI客户端
            client = ComfyUIClient(server_address=self.server_address)
            
            # 准备生成参数
            generation_params = {
                'positive_prompt': positive_prompt,
                'negative_prompt': kwargs.get('negative_prompt', 'low quality, blurry, bad anatomy, worst quality'),
                'width': kwargs.get('width', 768),
                'height': kwargs.get('height', 768),
                'steps': kwargs.get('steps', 25),
                'cfg': kwargs.get('cfg', 7.5),
                'seed': kwargs.get('seed', int(time.time() * 1000) % 1000000),
                'batch_size': kwargs.get('batch_size', 1),
                'filename_prefix': f"{role_name}_POV_{uuid.uuid4().hex[:8]}_"  # 添加POV标识
            }
            
            print(f"突出主体状态生成参数: {generation_params}")
            
            # 生成图片
            try:
                generated_files = client.generate_image(
                    workflow_path=self.workflow_path,
                    output_dir=self.output_dir,
                    **generation_params
                )
                
                if generated_files:
                    print(f"突出主体状态图片生成成功，共生成 {len(generated_files)} 张图片")
                    
                    # 将生成的图片移动到web可访问的目录
                    web_accessible_paths = self._move_to_web_directory(generated_files, f"{role_name}_POV")
                    
                    return {
                        'success': True,
                        'message': f'成功为角色 {role_name} 生成 {len(web_accessible_paths)} 张突出主体状态的图片',
                        'image_paths': web_accessible_paths,
                        'prompt': positive_prompt,
                        'generation_params': generation_params,
                        'is_first_person': True
                    }
                else:
                    return {
                        'success': False,
                        'error': '突出主体状态图片生成失败，未返回任何文件',
                        'image_paths': []
                    }
                    
            except Exception as e:
                print(f"ComfyUI突出主体状态生成过程中出错: {e}")
                return {
                    'success': False,
                    'error': f'ComfyUI突出主体状态生成失败: {str(e)}',
                    'image_paths': []
                }
            finally:
                # 确保关闭客户端连接
                try:
                    client.close()
                except:
                    pass
                    
        except Exception as e:
            print(f"突出主体状态图片生成服务出错: {e}")
            return {
                'success': False,
                'error': f'突出主体状态图片生成服务错误: {str(e)}',
                'image_paths': []
            }
    
    def _move_to_web_directory(self, generated_files: List[str], role_name: str) -> List[str]:
        """
        将生成的图片移动到web可访问的目录
        现在图片直接保存在聊天记录目录中，需要复制到web静态目录以供访问
        
        Args:
            generated_files: 生成的图片文件路径列表
            role_name: 角色名称
            
        Returns:
            web可访问的图片路径列表
        """
        try:
            import shutil
            
            # web目录路径 - 继续使用static/generated_images作为web访问目录
            web_images_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "generated_images")
            os.makedirs(web_images_dir, exist_ok=True)
            
            web_accessible_paths = []
            
            for file_path in generated_files:
                if os.path.exists(file_path):
                    # 生成新的文件名
                    filename = os.path.basename(file_path)
                    web_file_path = os.path.join(web_images_dir, filename)
                    
                    # 复制文件到web目录（保持聊天记录目录中的原始文件）
                    shutil.copy2(file_path, web_file_path)
                    
                    # 生成web可访问的相对路径
                    relative_path = f"/static/generated_images/{filename}"
                    web_accessible_paths.append(relative_path)
                    
                    print(f"图片已复制到web目录: {relative_path}")
                    print(f"原始图片保存在: {file_path}")
            
            return web_accessible_paths
            
        except Exception as e:
            print(f"移动图片到web目录失败: {e}")
            return []
    
    def test_connection(self) -> Dict[str, Any]:
        """
        测试与ComfyUI服务器的连接
        
        Returns:
            连接测试结果
        """
        try:
            import requests
            
            # 尝试连接ComfyUI服务器
            response = requests.get(f"http://{self.server_address}/", timeout=5)
            
            if response.status_code == 200:
                return {
                    'success': True,
                    'message': f'ComfyUI服务器连接正常 ({self.server_address})'
                }
            else:
                return {
                    'success': False,
                    'error': f'ComfyUI服务器响应异常: {response.status_code}'
                }
                
        except requests.exceptions.ConnectionError:
            return {
                'success': False,
                'error': f'无法连接到ComfyUI服务器 ({self.server_address})，请确保服务器正在运行'
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'连接测试失败: {str(e)}'
            }
    
    def get_generation_status(self) -> Dict[str, Any]:
        """
        获取图片生成服务状态
        
        Returns:
            服务状态信息
        """
        status = {
            'service_status': 'running',
            'server_address': self.server_address,
            'output_directory': self.output_dir,
            'workflow_path': self.workflow_path,
            'workflow_exists': os.path.exists(self.workflow_path)
        }
        
        # 检查服务器连接
        connection_test = self.test_connection()
        status['server_connection'] = connection_test
        
        return status


def test_image_generation():
    """测试图片生成功能"""
    service = ImageGenerationService()
    
    # 测试连接
    print("测试ComfyUI服务器连接...")
    connection_result = service.test_connection()
    print(f"连接测试结果: {connection_result}")
    
    if connection_result['success']:
        # 测试生成图片
        print("\n测试生成莉塔的图片...")
        result = service.generate_image_for_role(
            role_name="莉塔",
            additional_context="正在清洁房间",
            width=512,
            height=512,
            steps=20
        )
        print(f"生成结果: {result}")
    else:
        print("ComfyUI服务器未连接，跳过图片生成测试")


if __name__ == "__main__":
    test_image_generation()
