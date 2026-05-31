"""
向量化临时数据管理的配置管理器
解决当前游戏配置路径获取问题
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional

from web.utils import PathManager

logger = logging.getLogger(__name__)


class VectorizedConfigManager:
    """
    向量化配置管理器 - 处理配置路径获取

    配置逻辑说明：
    - data/ 下的目录是当前正在使用的配置，系统主要从这里读写
    - 游戏配置目录用于临时存储和备份，配置切换时使用
    - 向量化系统应与其他组件保持一致，优先读取 data/ 下的当前数据
    """

    def __init__(self):
        self.project_root = Path(__file__).parent.parent.parent
        self._current_config_cache = None

    def get_current_config_name(self) -> Optional[str]:
        """获取当前游戏配置名称"""
        try:
            config_file = PathManager.get_current_config_name_path()
            if config_file.exists():
                with open(config_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return data.get('当前配置名称')
        except Exception as e:
            logger.warning(f"获取当前配置名称失败: {e}")
        return None

    def get_current_storybook_dir(self) -> Path:
        """获取当前配置的数据书目录路径"""
        primary_dir = PathManager.get_storybook_dir()
        if primary_dir.exists():
            logger.info(f"使用当前数据书目录: {primary_dir}")
            return primary_dir

        current_config = self.get_current_config_name()
        if current_config:
            config_storybook_dir = PathManager.get_game_configs_dir() / current_config / '数据书'
            if config_storybook_dir.exists():
                logger.warning(f"当前数据书目录不存在，使用游戏配置目录作为fallback: {config_storybook_dir}")
                return config_storybook_dir

        logger.info(f"使用当前数据书目录（可能不存在）: {primary_dir}")
        return primary_dir

    def get_current_roles_dir(self) -> Path:
        """获取当前配置的角色目录路径"""
        primary_dir = PathManager.get_roles_dir()
        if primary_dir.exists():
            return primary_dir

        current_config = self.get_current_config_name()
        if current_config:
            config_roles_dir = PathManager.get_game_configs_dir() / current_config / '角色'
            if config_roles_dir.exists():
                logger.warning(f"当前角色目录不存在，使用游戏配置目录作为fallback: {config_roles_dir}")
                return config_roles_dir

        return primary_dir

    def get_current_players_dir(self) -> Path:
        """获取当前配置的玩家目录路径"""
        primary_dir = PathManager.get_players_dir()
        if primary_dir.exists():
            return primary_dir

        current_config = self.get_current_config_name()
        if current_config:
            config_players_dir = PathManager.get_game_configs_dir() / current_config / '玩家'
            if config_players_dir.exists():
                logger.warning(f"当前玩家目录不存在，使用游戏配置目录作为fallback: {config_players_dir}")
                return config_players_dir

        return primary_dir

    def get_current_global_world_book_dir(self) -> Path:
        """获取当前配置的全局世界书目录路径"""
        primary_dir = PathManager.get_global_world_book_dir()
        if primary_dir.exists():
            return primary_dir

        current_config = self.get_current_config_name()
        if current_config:
            config_world_book_dir = PathManager.get_game_configs_dir() / current_config / '全局世界书'
            if config_world_book_dir.exists():
                logger.warning(f"当前全局世界书目录不存在，使用游戏配置目录作为fallback: {config_world_book_dir}")
                return config_world_book_dir

        return primary_dir

    def get_config_info(self) -> Dict[str, Any]:
        """获取当前配置信息"""
        current_config = self.get_current_config_name()
        return {
            'current_config_name': current_config,
            'storybook_dir': str(self.get_current_storybook_dir()),
            'roles_dir': str(self.get_current_roles_dir()),
            'players_dir': str(self.get_current_players_dir()),
            'global_world_book_dir': str(self.get_current_global_world_book_dir()),
        }


_config_manager = None


def get_vectorized_config_manager() -> VectorizedConfigManager:
    """获取向量化配置管理器单例"""
    global _config_manager
    if _config_manager is None:
        _config_manager = VectorizedConfigManager()
    return _config_manager