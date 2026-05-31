"""
插件API助手
提供常用的功能接口供插件使用
"""
from typing import Dict, Optional, List
import requests
from pathlib import Path
import json


class PluginAPI:
    """
    插件API助手类
    
    提供常用的功能接口，方便插件开发
    """
    
    def __init__(self, base_url: str = 'http://localhost:5000'):
        """
        初始化API助手
        
        Args:
            base_url (str): 应用的基础URL
        """
        self.base_url = base_url
    
    def trigger_character_message(self, role_name: str, message: str, 
                                  save_to_history: bool = True) -> Dict:
        """
        触发角色发送消息（用于插件向角色发送消息）
        
        Args:
            role_name (str): 角色名称
            message (str): 消息内容
            save_to_history (bool): 是否保存到历史记录
            
        Returns:
            Dict: 响应结果
                - success (bool): 是否成功
                - content (str): 角色回复内容
                - error (str): 错误信息（如果失败）
        """
        try:
            response = requests.post(
                f'{self.base_url}/chat',
                json={
                    'message': message,
                    'role': role_name,
                    'new_topic': False
                },
                timeout=30
            )
            return response.json()
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def simulate_ai_event(self, role_name: str, event_description: str) -> Dict:
        """
        模拟AI事件（修改角色状态）
        
        这是设计思路中提到的"事件模拟"功能
        
        Args:
            role_name (str): 角色名称
            event_description (str): 事件描述（例如："角色感到非常疲惫"）
            
        Returns:
            Dict: 响应结果
                - success (bool): 是否成功
                - summary (str): 事件总结
                - error (str): 错误信息（如果失败）
        """
        try:
            response = requests.post(
                f'{self.base_url}/ai_new/organize_stories',
                json={
                    'instruction': event_description,
                    'role_name': role_name,
                    'include_temp_data': True
                },
                timeout=60
            )
            return response.json()
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_chat_history(self, role_name: str, limit: Optional[int] = None) -> Dict:
        """
        获取聊天历史
        
        Args:
            role_name (str): 角色名称
            limit (int, optional): 限制返回的消息条数
            
        Returns:
            Dict: 聊天历史
                - success (bool): 是否成功
                - history (List): 聊天历史列表
                - error (str): 错误信息（如果失败）
        """
        try:
            response = requests.get(
                f'{self.base_url}/api/history/{role_name}',
                timeout=10
            )
            data = response.json()
            
            if data.get('success') and limit:
                data['history'] = data['history'][-limit:]
            
            return data
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def save_to_storybook(self, role_name: str, content: Dict) -> Dict:
        """
        保存到角色数据书
        
        Args:
            role_name (str): 角色名称
            content (Dict): 要保存的内容
            
        Returns:
            Dict: 保存结果
        """
        try:
            response = requests.post(
                f'{self.base_url}/api/storybook/save',
                json={
                    'role_name': role_name,
                    'content': content
                },
                timeout=10
            )
            return response.json()
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_role_info(self, role_name: str) -> Dict:
        """
        获取角色信息
        
        Args:
            role_name (str): 角色名称
            
        Returns:
            Dict: 角色信息
        """
        try:
            # 读取角色配置文件
            from web.utils import PathManager
            roles_dir = PathManager.get_roles_dir()
            role_file = roles_dir / f"{role_name}.yml"
            
            if role_file.exists():
                import yaml
                with open(role_file, 'r', encoding='utf-8') as f:
                    role_data = yaml.safe_load(f)
                return {
                    'success': True,
                    'role_data': role_data
                }
            else:
                return {
                    'success': False,
                    'error': '角色不存在'
                }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def create_notification(self, title: str, message: str, 
                          notification_type: str = 'info') -> Dict:
        """
        创建系统通知
        
        Args:
            title (str): 通知标题
            message (str): 通知内容
            notification_type (str): 通知类型 ('info', 'success', 'warning', 'error')
            
        Returns:
            Dict: 结果
        """
        # 这将通过WebSocket或其他方式发送通知
        # 暂时返回成功，实际实现需要集成通知系统
        return {
            'success': True,
            'notification': {
                'title': title,
                'message': message,
                'type': notification_type
            }
        }


# 创建全局API实例
plugin_api = PluginAPI()

