"""
公共工具模块
包含所有重复的配置管理、路径处理等通用功能
"""
import json
import shutil
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml

# 项目根目录
PROJECT_ROOT = Path(__file__).parent.parent

# 添加项目根目录到Python路径
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# 用户数据统一放在根目录 data/ 下
DATA_ROOT = PROJECT_ROOT / "data"

# 兼容旧版根目录布局
LEGACY_CONFIG_PATH = PROJECT_ROOT / "config.json"
LEGACY_KEY_PATH = PROJECT_ROOT / "key.json"
LEGACY_ROLES_DIR = PROJECT_ROOT / "角色"
LEGACY_STORYBOOK_DIR = PROJECT_ROOT / "数据书"
LEGACY_PLAYERS_DIR = PROJECT_ROOT / "玩家"
LEGACY_GLOBAL_WORLD_BOOK_DIR = PROJECT_ROOT / "全局世界书"
LEGACY_HIDDEN_SETTINGS_DIR = PROJECT_ROOT / ".hidden_settings"
LEGACY_BASE_DESCRIPTION_PATH = PROJECT_ROOT / "底层描述.yml"
LEGACY_CHAT_RECORDS_DIR = PROJECT_ROOT / "聊天记录"
LEGACY_GAME_CONFIGS_DIR = PROJECT_ROOT / "游戏配置"
LEGACY_KEYWORD_WORLD_BOOK_DIR = PROJECT_ROOT / "关键词世界书"
LEGACY_SETTINGS_BOOK_DIR = PROJECT_ROOT / "设定书"
LEGACY_CHAT_HISTORY_SETTINGS_PATH = PROJECT_ROOT / "chat_history_settings.json"
LEGACY_USER_SEMANTIC_CONFIG_PATH = PROJECT_ROOT / "user_semantic_config.json"
LEGACY_BOLD_ENTRY_CONFIG_PATH = PROJECT_ROOT / "bold_entry_config.json"
LEGACY_CURRENT_CONFIG_NAME_PATH = PROJECT_ROOT / "当前配置名称.json"

# data/ 下的新路径
CONFIG_PATH = DATA_ROOT / "config.json"
KEY_PATH = DATA_ROOT / "key.json"
ROLES_DIR = DATA_ROOT / "角色"
STORYBOOK_DIR = DATA_ROOT / "数据书"
PLAYERS_DIR = DATA_ROOT / "玩家"
GLOBAL_WORLD_BOOK_DIR = DATA_ROOT / "全局世界书"
HIDDEN_SETTINGS_DIR = DATA_ROOT / ".hidden_settings"
BASE_DESCRIPTION_PATH = DATA_ROOT / "底层描述.yml"
CHAT_RECORDS_DIR = DATA_ROOT / "聊天记录"
GAME_CONFIGS_DIR = DATA_ROOT / "游戏配置"
KEYWORD_WORLD_BOOK_DIR = DATA_ROOT / "关键词世界书"
SETTINGS_BOOK_DIR = DATA_ROOT / "设定书"
CHAT_HISTORY_SETTINGS_PATH = DATA_ROOT / "chat_history_settings.json"
USER_SEMANTIC_CONFIG_PATH = DATA_ROOT / "user_semantic_config.json"
BOLD_ENTRY_CONFIG_PATH = DATA_ROOT / "bold_entry_config.json"
CURRENT_CONFIG_NAME_PATH = DATA_ROOT / "当前配置名称.json"

DATA_DIRECTORIES = {
    "角色": ROLES_DIR,
    "数据书": STORYBOOK_DIR,
    "玩家": PLAYERS_DIR,
    "全局世界书": GLOBAL_WORLD_BOOK_DIR,
    ".hidden_settings": HIDDEN_SETTINGS_DIR,
    "聊天记录": CHAT_RECORDS_DIR,
    "游戏配置": GAME_CONFIGS_DIR,
    "关键词世界书": KEYWORD_WORLD_BOOK_DIR,
    "设定书": SETTINGS_BOOK_DIR,
}

DATA_FILES = {
    "config.json": CONFIG_PATH,
    "底层描述.yml": BASE_DESCRIPTION_PATH,
    "chat_history_settings.json": CHAT_HISTORY_SETTINGS_PATH,
    "user_semantic_config.json": USER_SEMANTIC_CONFIG_PATH,
    "bold_entry_config.json": BOLD_ENTRY_CONFIG_PATH,
    "当前配置名称.json": CURRENT_CONFIG_NAME_PATH,
}

LEGACY_DATA_DIRECTORIES = {
    "角色": LEGACY_ROLES_DIR,
    "数据书": LEGACY_STORYBOOK_DIR,
    "玩家": LEGACY_PLAYERS_DIR,
    "全局世界书": LEGACY_GLOBAL_WORLD_BOOK_DIR,
    ".hidden_settings": LEGACY_HIDDEN_SETTINGS_DIR,
    "聊天记录": LEGACY_CHAT_RECORDS_DIR,
    "游戏配置": LEGACY_GAME_CONFIGS_DIR,
    "关键词世界书": LEGACY_KEYWORD_WORLD_BOOK_DIR,
    "设定书": LEGACY_SETTINGS_BOOK_DIR,
}

LEGACY_DATA_FILES = {
    "config.json": LEGACY_CONFIG_PATH,
    "底层描述.yml": LEGACY_BASE_DESCRIPTION_PATH,
    "chat_history_settings.json": LEGACY_CHAT_HISTORY_SETTINGS_PATH,
    "user_semantic_config.json": LEGACY_USER_SEMANTIC_CONFIG_PATH,
    "bold_entry_config.json": LEGACY_BOLD_ENTRY_CONFIG_PATH,
    "当前配置名称.json": LEGACY_CURRENT_CONFIG_NAME_PATH,
}

CONFIG_SWITCH_DIRECTORY_NAMES = ("角色", "玩家", "数据书", "全局世界书", "聊天记录")
CONFIG_SWITCH_FILE_NAMES = ("当前配置名称.json",)


def _copy_legacy_path_if_needed(source: Path, target: Path) -> None:
    """将旧版根目录中的用户数据复制到 data/ 下，避免升级后丢失读取路径。"""
    if target.exists() or not source.exists():
        return

    target.parent.mkdir(parents=True, exist_ok=True)

    try:
        if source.is_dir():
            shutil.copytree(source, target)
        else:
            shutil.copy2(source, target)
        print(f"📁 用户数据已迁移到 data 目录: {source} -> {target}")
    except Exception as e:
        print(f"⚠️ 迁移用户数据失败 {source} -> {target}: {e}")


def _move_sensitive_file_to_data(source: Path, target: Path) -> None:
    """将敏感配置迁移到 data/，并清理根目录副本。"""
    if not source.exists() or source.is_dir():
        return

    target.parent.mkdir(parents=True, exist_ok=True)

    try:
        if not target.exists():
            shutil.move(str(source), str(target))
            print(f"🔐 敏感配置已迁移到 data 目录: {source} -> {target}")
            return

        if source.stat().st_mtime > target.stat().st_mtime:
            shutil.copy2(source, target)
            print(f"🔄 已使用根目录较新配置覆盖 data 配置: {source} -> {target}")

        source.unlink()
        print(f"🧹 已清理根目录敏感配置副本: {source}")
    except Exception as e:
        print(f"⚠️ 迁移敏感配置失败 {source} -> {target}: {e}")


def initialize_data_layout() -> None:
    """初始化 data/ 用户数据目录，并兼容旧版根目录结构。"""
    DATA_ROOT.mkdir(parents=True, exist_ok=True)

    for name, target in DATA_DIRECTORIES.items():
        _copy_legacy_path_if_needed(LEGACY_DATA_DIRECTORIES[name], target)

    for name, target in DATA_FILES.items():
        if name == "config.json":
            continue
        _copy_legacy_path_if_needed(LEGACY_DATA_FILES[name], target)

    # 模型与密码等敏感配置统一迁移到 data/，并清理根目录暴露
    _move_sensitive_file_to_data(LEGACY_CONFIG_PATH, CONFIG_PATH)
    _move_sensitive_file_to_data(LEGACY_KEY_PATH, KEY_PATH)

    for required_dir in DATA_DIRECTORIES.values():
        required_dir.mkdir(parents=True, exist_ok=True)


initialize_data_layout()


class ConfigManager:
    """配置管理器，统一处理配置文件的加载和保存"""

    @staticmethod
    def load_config() -> Dict[str, Any]:
        """加载配置文件"""
        try:
            with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            return {
                "passwords": {},
                "requires_password_setup": True,
                "current_role": "",
                "current_player": "",
                "current_storybook": "",
                "model_configs": [],
            }
        except Exception as e:
            print(f"加载配置文件时出错: {e}")
            return {}

    @staticmethod
    def save_config(config_data: Dict[str, Any]) -> bool:
        """保存配置文件"""
        try:
            CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
            with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
                json.dump(config_data, f, ensure_ascii=False, indent=4)
            return True
        except Exception as e:
            print(f"保存配置文件时出错: {e}")
            return False


class PathManager:
    """路径管理器，统一处理各种文件路径"""

    @staticmethod
    def get_project_root() -> Path:
        """获取项目根目录"""
        return PROJECT_ROOT

    @staticmethod
    def get_data_root() -> Path:
        """获取统一的用户数据根目录"""
        return DATA_ROOT

    @staticmethod
    def get_config_path() -> Path:
        """获取配置文件路径"""
        return CONFIG_PATH

    @staticmethod
    def get_key_path() -> Path:
        """获取模型密钥兼容文件路径"""
        return KEY_PATH

    @staticmethod
    def get_roles_dir() -> Path:
        """获取角色目录路径"""
        return ROLES_DIR

    @staticmethod
    def get_storybook_dir() -> Path:
        """获取数据书目录路径"""
        return STORYBOOK_DIR

    @staticmethod
    def get_players_dir() -> Path:
        """获取玩家目录路径"""
        return PLAYERS_DIR

    @staticmethod
    def get_global_world_book_dir() -> Path:
        """获取全局世界书目录路径"""
        return GLOBAL_WORLD_BOOK_DIR

    @staticmethod
    def get_hidden_settings_dir() -> Path:
        """获取底层设定目录路径"""
        return HIDDEN_SETTINGS_DIR

    @staticmethod
    def get_base_description_path() -> Path:
        """获取底层描述文件路径"""
        return BASE_DESCRIPTION_PATH

    @staticmethod
    def get_chat_records_dir() -> Path:
        """获取聊天记录目录路径"""
        return CHAT_RECORDS_DIR

    @staticmethod
    def get_chat_history_settings_path() -> Path:
        """获取聊天记录设置文件路径"""
        return CHAT_HISTORY_SETTINGS_PATH

    @staticmethod
    def get_user_semantic_config_path() -> Path:
        """获取用户语义配置文件路径"""
        return USER_SEMANTIC_CONFIG_PATH

    @staticmethod
    def get_bold_entry_config_path() -> Path:
        """获取大胆录入配置文件路径"""
        return BOLD_ENTRY_CONFIG_PATH

    @staticmethod
    def get_current_config_name_path() -> Path:
        """获取当前配置名称文件路径"""
        return CURRENT_CONFIG_NAME_PATH

    @staticmethod
    def get_game_configs_dir() -> Path:
        """获取游戏配置目录路径"""
        return GAME_CONFIGS_DIR

    @staticmethod
    def get_keyword_world_book_dir() -> Path:
        """获取关键词世界书目录路径"""
        return KEYWORD_WORLD_BOOK_DIR

    @staticmethod
    def get_settings_book_dir() -> Path:
        """获取设定书目录路径"""
        return SETTINGS_BOOK_DIR

    @staticmethod
    def get_named_data_dir(name: str) -> Path:
        """按目录名获取用户数据目录路径"""
        return DATA_DIRECTORIES[name]

    @staticmethod
    def get_named_data_file(name: str) -> Path:
        """按文件名获取用户数据文件路径"""
        return DATA_FILES[name]

    @staticmethod
    def get_config_switch_directories() -> Dict[str, Path]:
        """获取配置切换所需的数据目录映射"""
        return {name: DATA_DIRECTORIES[name] for name in CONFIG_SWITCH_DIRECTORY_NAMES}

    @staticmethod
    def get_config_switch_files() -> Dict[str, Path]:
        """获取配置切换所需的数据文件映射"""
        return {name: DATA_FILES[name] for name in CONFIG_SWITCH_FILE_NAMES}

    @staticmethod
    def ensure_data_layout() -> None:
        """确保 data/ 布局存在"""
        initialize_data_layout()


class FileManager:
    """文件管理器，统一处理文件读写操作"""

    @staticmethod
    def load_json_file(file_path: Path) -> Optional[Dict[str, Any]]:
        """加载JSON文件"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"加载JSON文件 {file_path} 时出错: {e}")
            return None

    @staticmethod
    def save_json_file(file_path: Path, data: Dict[str, Any]) -> bool:
        """保存JSON文件"""
        try:
            file_path.parent.mkdir(parents=True, exist_ok=True)
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=4)
            return True
        except Exception as e:
            print(f"保存JSON文件 {file_path} 时出错: {e}")
            return False

    @staticmethod
    def load_yaml_file(file_path: Path) -> Optional[Dict[str, Any]]:
        """加载YAML文件"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        except Exception as e:
            print(f"加载YAML文件 {file_path} 时出错: {e}")
            return None

    @staticmethod
    def save_yaml_file(file_path: Path, data: Dict[str, Any]) -> bool:
        """保存YAML文件"""
        try:
            file_path.parent.mkdir(parents=True, exist_ok=True)
            with open(file_path, 'w', encoding='utf-8') as f:
                yaml.dump(data, f, default_flow_style=False, allow_unicode=True)
            return True
        except Exception as e:
            print(f"保存YAML文件 {file_path} 时出错: {e}")
            return False


class DataManager:
    """数据管理器，统一处理各种数据操作"""

    @staticmethod
    def get_available_roles() -> List[str]:
        """获取所有可用角色"""
        roles = []
        roles_dir = PathManager.get_roles_dir()
        if roles_dir.exists():
            for yml_file in roles_dir.glob("*.yml"):
                role_name = yml_file.stem
                if role_name != '旁白':
                    roles.append(role_name)
        return roles

    @staticmethod
    def get_available_storybooks() -> List[str]:
        """获取所有可用数据书"""
        storybooks = []
        storybook_dir = PathManager.get_storybook_dir()
        if storybook_dir.exists():
            for json_file in storybook_dir.glob("*.json"):
                storybooks.append(json_file.stem)
        return storybooks

    @staticmethod
    def get_available_players() -> List[str]:
        """获取所有可用玩家"""
        players = []
        players_dir = PathManager.get_players_dir()
        if players_dir.exists():
            for yml_file in players_dir.glob("*.yml"):
                if yml_file.name != "当前玩家.yml":
                    players.append(yml_file.stem)
        return players

    @staticmethod
    def load_role_data(role_name: str) -> Optional[Dict[str, Any]]:
        """加载角色数据"""
        role_file = PathManager.get_roles_dir() / f"{role_name}.yml"
        return FileManager.load_yaml_file(role_file)

    @staticmethod
    def save_role_data(role_name: str, data: Dict[str, Any]) -> bool:
        """保存角色数据"""
        role_file = PathManager.get_roles_dir() / f"{role_name}.yml"
        return FileManager.save_yaml_file(role_file, data)

    @staticmethod
    def load_storybook_data(storybook_name: str) -> Optional[Dict[str, Any]]:
        """加载数据书数据"""
        storybook_file = PathManager.get_storybook_dir() / f"{storybook_name}.json"
        return FileManager.load_json_file(storybook_file)

    @staticmethod
    def save_storybook_data(storybook_name: str, data: Dict[str, Any]) -> bool:
        """保存数据书数据"""
        storybook_file = PathManager.get_storybook_dir() / f"{storybook_name}.json"
        return FileManager.save_json_file(storybook_file, data)

    @staticmethod
    def load_player_data(player_name: str) -> Optional[Dict[str, Any]]:
        """加载玩家数据"""
        player_file = PathManager.get_players_dir() / f"{player_name}.yml"
        return FileManager.load_yaml_file(player_file)

    @staticmethod
    def save_player_data(player_name: str, data: Dict[str, Any]) -> bool:
        """保存玩家数据"""
        player_file = PathManager.get_players_dir() / f"{player_name}.yml"
        return FileManager.save_yaml_file(player_file, data)


# 向后兼容的函数，保持原有接口
def load_config() -> Dict[str, Any]:
    """加载配置文件（向后兼容）"""
    return ConfigManager.load_config()


def save_config(config_data: Dict[str, Any]) -> bool:
    """保存配置文件（向后兼容）"""
    return ConfigManager.save_config(config_data)


def get_available_roles() -> List[str]:
    """获取所有可用角色（向后兼容）"""
    return DataManager.get_available_roles()


def get_available_storybooks() -> List[str]:
    """获取所有可用数据书（向后兼容）"""
    return DataManager.get_available_storybooks()


def get_available_players() -> List[str]:
    """获取所有可用玩家（向后兼容）"""
    return DataManager.get_available_players()
