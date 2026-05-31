"""
插件管理器
负责加载、注册和管理所有插件
"""
import os
import sys
import importlib
import importlib.util
from pathlib import Path
from typing import List, Dict, Optional
from flask import Flask, jsonify, Blueprint
import traceback

from .plugin_base import PluginBase


class PluginManager:
    """
    插件管理器
    
    负责：
    1. 扫描和加载插件
    2. 注册插件的蓝图和命令
    3. 管理插件生命周期
    """
    
    def __init__(self, plugins_dir: str = None):
        """
        初始化插件管理器
        
        Args:
            plugins_dir (str): 插件目录路径
        """
        if plugins_dir is None:
            # 默认插件目录
            plugins_dir = Path(__file__).parent
        
        self.plugins_dir = Path(plugins_dir)
        self.plugins: Dict[str, PluginBase] = {}
        self.enabled_plugins: List[str] = []
        
        print(f"📦 插件管理器初始化，插件目录: {self.plugins_dir}")
    
    def discover_plugins(self) -> List[str]:
        """
        扫描插件目录，发现所有可用的插件
        
        Returns:
            List[str]: 发现的插件目录名列表
        """
        discovered = []
        
        if not self.plugins_dir.exists():
            print(f"⚠️ 插件目录不存在: {self.plugins_dir}")
            return discovered
        
        for item in self.plugins_dir.iterdir():
            if item.is_dir() and not item.name.startswith('_') and not item.name.startswith('.'):
                # 检查是否有 plugin.py 文件
                plugin_file = item / 'plugin.py'
                if plugin_file.exists():
                    discovered.append(item.name)
                    print(f"🔍 发现插件: {item.name}")
        
        return discovered
    
    def load_plugin(self, plugin_name: str) -> Optional[PluginBase]:
        """
        加载单个插件
        
        Args:
            plugin_name (str): 插件目录名
            
        Returns:
            PluginBase: 插件实例，失败则返回None
        """
        try:
            plugin_dir = self.plugins_dir / plugin_name
            plugin_file = plugin_dir / 'plugin.py'
            
            if not plugin_file.exists():
                print(f"❌ 插件文件不存在: {plugin_file}")
                return None
            
            # 动态导入插件模块
            spec = importlib.util.spec_from_file_location(
                f"plugins.{plugin_name}.plugin",
                plugin_file
            )
            module = importlib.util.module_from_spec(spec)
            sys.modules[spec.name] = module
            spec.loader.exec_module(module)
            
            # 查找插件类（应该继承自PluginBase）
            plugin_class = None
            for item_name in dir(module):
                item = getattr(module, item_name)
                if (isinstance(item, type) and 
                    issubclass(item, PluginBase) and 
                    item is not PluginBase):
                    plugin_class = item
                    break
            
            if plugin_class is None:
                print(f"❌ 插件 {plugin_name} 中未找到有效的插件类")
                return None
            
            # 创建插件实例
            plugin_instance = plugin_class()
            
            # 初始化插件
            if not plugin_instance.initialize():
                print(f"❌ 插件 {plugin_name} 初始化失败")
                return None
            
            plugin_info = plugin_instance.get_plugin_info()
            print(f"✅ 成功加载插件: {plugin_info['name']} v{plugin_info['version']}")
            
            return plugin_instance
            
        except Exception as e:
            print(f"❌ 加载插件 {plugin_name} 时出错: {e}")
            traceback.print_exc()
            return None
    
    def load_all_plugins(self) -> Dict[str, PluginBase]:
        """
        加载所有发现的插件
        
        Returns:
            Dict[str, PluginBase]: 成功加载的插件字典 {plugin_id: plugin_instance}
        """
        discovered = self.discover_plugins()
        
        for plugin_name in discovered:
            plugin = self.load_plugin(plugin_name)
            if plugin:
                plugin_id = plugin.get_plugin_info()['id']
                self.plugins[plugin_id] = plugin
                self.enabled_plugins.append(plugin_id)
        
        print(f"\n📊 插件加载总结:")
        print(f"   发现: {len(discovered)} 个")
        print(f"   成功: {len(self.plugins)} 个")
        print(f"   失败: {len(discovered) - len(self.plugins)} 个\n")
        
        return self.plugins
    
    def register_plugins(self, app: Flask) -> None:
        """
        将所有插件注册到Flask应用
        
        Args:
            app (Flask): Flask应用实例
        """
        from flask import send_from_directory
        
        for plugin_id, plugin in self.plugins.items():
            # 注册蓝图
            blueprint = plugin.get_blueprint()
            if blueprint:
                app.register_blueprint(blueprint)
                print(f"📘 注册插件蓝图: {plugin.get_plugin_info()['name']}")
            
            # 注册静态文件路由
            plugin_dir = self.plugins_dir / plugin_id
            static_dir = plugin_dir / 'static'
            
            if static_dir.exists():
                # 为每个插件创建静态文件路由，使用唯一的endpoint名称
                @app.route(f'/plugins/{plugin_id}/static/<path:filename>', endpoint=f'serve_plugin_static_{plugin_id}')
                def serve_plugin_static(filename, pid=plugin_id):
                    plugin_static = self.plugins_dir / pid / 'static'
                    return send_from_directory(plugin_static, filename)
                
                print(f"📁 注册插件静态文件: {plugin.get_plugin_info()['name']}")
            
            # 调用启用回调
            plugin.on_enable()
    
    def get_all_commands(self) -> List[Dict]:
        """
        获取所有插件注册的命令
        
        Returns:
            List[Dict]: 所有命令的列表
        """
        all_commands = []
        for plugin in self.plugins.values():
            commands = plugin.get_commands()
            all_commands.extend(commands)
        
        return all_commands
    
    def get_plugin(self, plugin_id: str) -> Optional[PluginBase]:
        """
        根据ID获取插件实例
        
        Args:
            plugin_id (str): 插件ID
            
        Returns:
            PluginBase: 插件实例，不存在则返回None
        """
        return self.plugins.get(plugin_id)
    
    def get_plugin_info_list(self) -> List[Dict]:
        """
        获取所有插件的信息列表
        
        Returns:
            List[Dict]: 插件信息列表
        """
        return [plugin.get_plugin_info() for plugin in self.plugins.values()]
    
    def create_api_blueprint(self) -> Blueprint:
        """
        创建插件管理API蓝图
        
        Returns:
            Blueprint: 插件API蓝图
        """
        plugin_api_bp = Blueprint('plugin_api', __name__, url_prefix='/api/plugins')
        
        @plugin_api_bp.route('/list', methods=['GET'])
        def list_plugins():
            """获取所有插件列表"""
            plugins_info = []
            for plugin in self.plugins.values():
                info = plugin.get_plugin_info().copy()
                
                # 添加静态文件URL
                static_files = plugin.get_static_files()
                info['css_files'] = []
                info['js_files'] = []
                
                for static_file in static_files:
                    file_url = f"/plugins/{info['id']}/static/{Path(static_file['path']).name}"
                    if static_file['type'] == 'css':
                        info['css_files'].append(file_url)
                    elif static_file['type'] == 'js':
                        info['js_files'].append(file_url)
                
                plugins_info.append(info)
            
            return jsonify({
                'success': True,
                'plugins': plugins_info
            })
        
        @plugin_api_bp.route('/commands', methods=['GET'])
        def get_commands():
            """获取所有插件命令"""
            return jsonify({
                'success': True,
                'commands': self.get_all_commands()
            })
        
        @plugin_api_bp.route('/<plugin_id>/info', methods=['GET'])
        def get_plugin_info(plugin_id):
            """获取指定插件的详细信息"""
            plugin = self.get_plugin(plugin_id)
            if plugin:
                return jsonify({
                    'success': True,
                    'plugin': plugin.get_plugin_info()
                })
            else:
                return jsonify({
                    'success': False,
                    'error': '插件不存在'
                }), 404
        
        return plugin_api_bp


# 创建全局插件管理器实例
plugin_manager = PluginManager()

