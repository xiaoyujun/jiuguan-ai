"""
底层设定管理器
基于关键词的隐藏设定系统，对用户不可见，仅供开发者使用
当检测到关键词时，将相关设定以注释形式注入给AI
"""

import json
import yaml
import re
from pathlib import Path
from typing import Dict, List, Set, Any, Optional, Tuple
from web.utils import PathManager, FileManager
import datetime


class HiddenSettingsManager:
    """底层设定管理器"""
    
    def __init__(self):
        self.hidden_settings_dir = PathManager.get_hidden_settings_dir()
        self._cache = {}
        self._cache_time = None
        self._cache_duration = 300  # 缓存5分钟
    
    def _is_cache_valid(self) -> bool:
        """检查缓存是否有效"""
        if not self._cache_time:
            return False
        return (datetime.datetime.now() - self._cache_time).seconds < self._cache_duration
    
    def _load_all_settings(self) -> Dict[str, Any]:
        """加载所有底层设定"""
        if self._is_cache_valid() and 'settings' in self._cache:
            return self._cache['settings']
        
        settings = {}
        if self.hidden_settings_dir.exists():
            for yml_file in self.hidden_settings_dir.glob("*.yml"):
                try:
                    setting_name = yml_file.stem
                    with open(yml_file, 'r', encoding='utf-8') as f:
                        setting_data = yaml.safe_load(f)
                    if setting_data:
                        settings[setting_name] = setting_data
                except Exception as e:
                    print(f"加载底层设定 {yml_file} 失败: {e}")
        
        # 更新缓存
        self._cache['settings'] = settings
        self._cache_time = datetime.datetime.now()
        
        return settings
    
    def get_all_settings(self) -> Dict[str, Any]:
        """获取所有设定"""
        return self._load_all_settings()
    
    def get_setting_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """根据名称获取设定"""
        settings = self._load_all_settings()
        return settings.get(name)
    
    def create_setting(self, name: str, description: str, content: str, keywords: List[str] = None, 
                      category: str = "系统", priority: int = 1, trigger_mode: str = "keyword") -> bool:
        """
        创建新的底层设定
        
        Args:
            name: 设定名称
            description: 设定描述
            content: 设定内容（将注入给AI的内容）
            keywords: 触发关键词列表
            category: 分类
            priority: 优先级（数字越大优先级越高）
            trigger_mode: 触发模式 ("keyword": 关键词触发, "always": 始终生效, "conditional": 条件触发)
        """
        try:
            self.hidden_settings_dir.mkdir(exist_ok=True)
            yml_file = self.hidden_settings_dir / f"{name}.yml"
            
            if yml_file.exists():
                return False  # 设定已存在
            
            setting_data = {
                '名称': name,
                '描述': description,
                '内容': content,
                '关键词': keywords or [name],
                '分类': category,
                '优先级': priority,
                '触发模式': trigger_mode,
                '启用': True,
                '开发者专用': True,  # 标记为开发者专用，用户界面不显示
                '创建时间': datetime.datetime.now().isoformat(),
                '修改时间': datetime.datetime.now().isoformat()
            }
            
            with open(yml_file, 'w', encoding='utf-8') as f:
                yaml.dump(setting_data, f, allow_unicode=True, default_flow_style=False)
            
            # 清除缓存
            self._cache.clear()
            self._cache_time = None
            
            return True
        except Exception as e:
            print(f"创建底层设定失败: {e}")
            return False
    
    def update_setting(self, old_name: str, new_name: str, description: str, content: str, 
                      keywords: List[str], category: str, priority: int, trigger_mode: str, enabled: bool) -> bool:
        """更新设定"""
        try:
            old_file = self.hidden_settings_dir / f"{old_name}.yml"
            if not old_file.exists():
                return False
            
            # 读取现有数据以保留创建时间
            with open(old_file, 'r', encoding='utf-8') as f:
                existing_data = yaml.safe_load(f) or {}
            
            setting_data = {
                '名称': new_name,
                '描述': description,
                '内容': content,
                '关键词': keywords,
                '分类': category,
                '优先级': priority,
                '触发模式': trigger_mode,
                '启用': enabled,
                '开发者专用': True,
                '创建时间': existing_data.get('创建时间', datetime.datetime.now().isoformat()),
                '修改时间': datetime.datetime.now().isoformat()
            }
            
            # 如果名称改变，删除旧文件
            if old_name != new_name:
                old_file.unlink()
                new_file = self.hidden_settings_dir / f"{new_name}.yml"
            else:
                new_file = old_file
            
            with open(new_file, 'w', encoding='utf-8') as f:
                yaml.dump(setting_data, f, allow_unicode=True, default_flow_style=False)
            
            # 清除缓存
            self._cache.clear()
            self._cache_time = None
            
            return True
        except Exception as e:
            print(f"更新底层设定失败: {e}")
            return False
    
    def delete_setting(self, name: str) -> bool:
        """删除设定"""
        try:
            yml_file = self.hidden_settings_dir / f"{name}.yml"
            if yml_file.exists():
                yml_file.unlink()
                # 清除缓存
                self._cache.clear()
                self._cache_time = None
                return True
            return False
        except Exception as e:
            print(f"删除底层设定失败: {e}")
            return False
    
    def search_settings(self, query: str, category: str = None) -> Dict[str, Any]:
        """搜索设定"""
        settings = self._load_all_settings()
        results = {}
        
        query_lower = query.lower() if query else ""
        
        for name, data in settings.items():
            if not data:
                continue
                
            # 分类筛选
            if category and data.get('分类', '系统') != category:
                continue
            
            # 搜索匹配
            if not query:
                results[name] = data
                continue
                
            # 在名字、描述、关键词中搜索
            match_found = False
            
            # 搜索名字
            if query_lower in data.get('名称', '').lower():
                match_found = True
            
            # 搜索描述
            if query_lower in data.get('描述', '').lower():
                match_found = True
            
            # 搜索关键词
            keywords = data.get('关键词', [])
            if isinstance(keywords, list):
                for keyword in keywords:
                    if query_lower in str(keyword).lower():
                        match_found = True
                        break
            
            if match_found:
                results[name] = data
        
        return results
    
    def get_categories(self) -> List[str]:
        """获取所有分类"""
        settings = self._load_all_settings()
        categories = set()
        for data in settings.values():
            if data:
                categories.add(data.get('分类', '系统'))
        return sorted(list(categories))
    
    def match_keywords_in_text(self, text: str) -> Dict[str, Any]:
        """在文本中匹配关键词并返回相关设定"""
        settings = self._load_all_settings()
        matched_settings = {}
        
        text_lower = text.lower()
        
        for name, data in settings.items():
            if not data or not data.get('启用', True):
                continue
            
            trigger_mode = data.get('触发模式', 'keyword')
            
            # 始终生效的设定
            if trigger_mode == 'always':
                matched_settings[name] = data
                continue
                
            # 关键词触发的设定
            if trigger_mode == 'keyword':
                keywords = data.get('关键词', [])
                if not isinstance(keywords, list):
                    continue
                
                # 检查是否有关键词匹配
                for keyword in keywords:
                    keyword_str = str(keyword).lower()
                    if keyword_str in text_lower:
                        # 确保是完整单词匹配
                        if self._is_whole_word_match(text_lower, keyword_str):
                            priority = data.get('优先级', 1)
                            if name not in matched_settings or matched_settings[name].get('优先级', 1) < priority:
                                matched_settings[name] = data
                            break
        
        return matched_settings
    
    def _is_whole_word_match(self, text: str, keyword: str) -> bool:
        """检查是否为完整单词匹配"""
        # 对中文友好的匹配方式 - 简单包含匹配
        # 因为中文没有明确的单词边界，所以直接使用包含匹配
        return keyword.lower() in text.lower()
    
    def format_matched_settings_for_ai(self, matched_settings: Dict[str, Any]) -> str:
        """将匹配的设定格式化为AI可读的注释形式"""
        if not matched_settings:
            return ""
        
        # 按优先级排序
        sorted_settings = sorted(
            matched_settings.items(),
            key=lambda x: x[1].get('优先级', 1),
            reverse=True
        )
        
        formatted_text = "<!-- 底层设定信息（开发者专用，用户不可见） -->\n"
        
        for name, data in sorted_settings:
            content = data.get('内容', '')
            category = data.get('分类', '系统')
            keywords = data.get('关键词', [])
            
            formatted_text += f"<!-- 【{category}】{name}：{content}"
            if keywords:
                formatted_text += f" [触发词: {', '.join(map(str, keywords))}]"
            formatted_text += " -->\n"
        
        return formatted_text
    
    def process_text_with_hidden_settings(self, text: str) -> Tuple[str, Dict[str, Any]]:
        """处理文本，返回原文本和匹配的底层设定信息"""
        matched_settings = self.match_keywords_in_text(text)
        settings_context = self.format_matched_settings_for_ai(matched_settings)
        
        return text, {
            'matched_settings': matched_settings,
            'settings_context': settings_context,
            'matched_count': len(matched_settings)
        }


# 全局实例
hidden_settings_manager = HiddenSettingsManager()
