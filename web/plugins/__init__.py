"""
插件系统
方便其他作者创作插件
"""

from .plugin_manager import PluginManager
from .plugin_base import PluginBase

__all__ = ['PluginManager', 'PluginBase']

