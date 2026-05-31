"""
插件基类
所有插件都应该继承这个基类
"""
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Callable
from flask import Blueprint


class PluginBase(ABC):
    """
    插件基类
    
    所有插件都应该继承这个类并实现必要的方法
    """
    
    def __init__(self):
        """初始化插件"""
        self.plugin_info = self.get_plugin_info()
        self.blueprint = None
        self.commands = []
        self.static_files = []
        
    @abstractmethod
    def get_plugin_info(self) -> Dict:
        """
        返回插件信息
        
        Returns:
            Dict: 插件信息字典，必须包含以下字段：
                - id (str): 插件唯一标识符
                - name (str): 插件名称
                - version (str): 插件版本
                - description (str): 插件描述
                - author (str): 作者
                - icon (str): 图标emoji
        """
        pass
    
    @abstractmethod
    def initialize(self) -> bool:
        """
        初始化插件
        
        在这里注册路由、命令等
        
        Returns:
            bool: 初始化是否成功
        """
        pass
    
    def register_command(self, command: Dict) -> None:
        """
        注册斜杠命令
        
        Args:
            command (Dict): 命令配置字典，包含以下字段：
                - id (str): 命令唯一标识符
                - name (str): 命令名称（显示在命令列表中）
                - description (str): 命令描述
                - icon (str): 命令图标emoji
                - category (str): 命令分类 ('ai', 'data', 'system', 'plugin')
                - action (str): 前端JavaScript函数名
        
        Example:
            self.register_command({
                'id': 'my-plugin-cmd',
                'name': '我的插件命令',
                'description': '这是一个示例命令',
                'icon': '🔥',
                'category': 'plugin',
                'action': 'executeMyPluginCommand'
            })
        """
        command['plugin_id'] = self.plugin_info['id']
        self.commands.append(command)
    
    def create_blueprint(self, name: str, import_name: str, 
                        url_prefix: Optional[str] = None) -> Blueprint:
        """
        创建Flask蓝图
        
        Args:
            name (str): 蓝图名称
            import_name (str): 导入名称（通常使用 __name__）
            url_prefix (str, optional): URL前缀
            
        Returns:
            Blueprint: Flask蓝图对象
        """
        if url_prefix is None:
            url_prefix = f'/plugins/{self.plugin_info["id"]}'
        
        self.blueprint = Blueprint(name, import_name, url_prefix=url_prefix)
        return self.blueprint
    
    def get_commands(self) -> List[Dict]:
        """
        获取插件注册的所有命令
        
        Returns:
            List[Dict]: 命令列表
        """
        return self.commands
    
    def get_blueprint(self) -> Optional[Blueprint]:
        """
        获取插件的蓝图
        
        Returns:
            Blueprint: Flask蓝图对象，如果没有则返回None
        """
        return self.blueprint
    
    def get_static_files(self) -> List[Dict]:
        """
        获取插件的静态文件信息
        
        Returns:
            List[Dict]: 静态文件信息列表，每个字典包含：
                - type (str): 文件类型 ('js', 'css')
                - path (str): 文件路径（相对于插件目录）
                - inject (str): 注入位置 ('head', 'body')
        """
        return self.static_files
    
    def register_static_file(self, file_type: str, path: str, inject: str = 'body') -> None:
        """
        注册静态文件（JS/CSS）
        
        Args:
            file_type (str): 文件类型 ('js', 'css')
            path (str): 文件路径（相对于插件目录）
            inject (str): 注入位置 ('head', 'body')
        """
        self.static_files.append({
            'type': file_type,
            'path': path,
            'inject': inject,
            'plugin_id': self.plugin_info['id']
        })
    
    def on_enable(self) -> None:
        """
        插件启用时的回调
        """
        pass
    
    def on_disable(self) -> None:
        """
        插件禁用时的回调
        """
        pass
    
    def on_uninstall(self) -> None:
        """
        插件卸载时的回调
        """
        pass

