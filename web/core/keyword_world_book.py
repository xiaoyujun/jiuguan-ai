"""
关键词世界书管理器
基于关键词的智能注入系统，当用户提到关键词时以注释方式传入给AI
"""

import json
import yaml
import re
from pathlib import Path
from typing import Dict, List, Set, Any, Optional, Tuple
from web.utils import PathManager, FileManager
import datetime


class KeywordWorldBook:
    """关键词世界书管理器"""
    
    def __init__(self):
        self.global_worldbook_dir = PathManager.get_global_world_book_dir()
        self._cache = {}
        self._cache_time = None
        self._cache_duration = 300  # 缓存5分钟
    
    def _is_cache_valid(self) -> bool:
        """检查缓存是否有效"""
        if not self._cache_time:
            return False
        return (datetime.datetime.now() - self._cache_time).seconds < self._cache_duration
    
    def _load_all_entries(self) -> Dict[str, Any]:
        """加载所有世界书条目"""
        if self._is_cache_valid() and 'entries' in self._cache:
            return self._cache['entries']
        
        entries = {}
        if self.global_worldbook_dir.exists():
            for yml_file in self.global_worldbook_dir.glob("*.yml"):
                try:
                    entry_name = yml_file.stem
                    with open(yml_file, 'r', encoding='utf-8') as f:
                        entry_data = yaml.safe_load(f)
                    if entry_data:
                        entries[entry_name] = entry_data
                except Exception as e:
                    print(f"加载世界书条目 {yml_file} 失败: {e}")
        
        # 更新缓存
        self._cache['entries'] = entries
        self._cache_time = datetime.datetime.now()
        
        return entries
    
    def get_all_entries(self) -> Dict[str, Any]:
        """获取所有条目"""
        return self._load_all_entries()
    
    def get_entry_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """根据名称获取条目"""
        entries = self._load_all_entries()
        return entries.get(name)
    
    def create_entry(self, name: str, description: str, keywords: List[str] = None, category: str = "默认", priority: int = 1, trigger_mode: str = "keyword") -> bool:
        """创建新条目"""
        try:
            self.global_worldbook_dir.mkdir(exist_ok=True)
            yml_file = self.global_worldbook_dir / f"{name}.yml"
            
            if yml_file.exists():
                return False  # 条目已存在
            
            entry_data = {
                '名字': name,
                '描述': description,
                '关键词': keywords or [name],
                '分类': category,
                '优先级': priority,
                '启用': True,
                '触发模式': trigger_mode,
                '创建时间': datetime.datetime.now().isoformat(),
                '修改时间': datetime.datetime.now().isoformat()
            }
            
            with open(yml_file, 'w', encoding='utf-8') as f:
                yaml.dump(entry_data, f, allow_unicode=True, default_flow_style=False)
            
            # 清除缓存
            self._cache.clear()
            self._cache_time = None
            
            return True
        except Exception as e:
            print(f"创建条目失败: {e}")
            return False
    
    def update_entry(self, old_name: str, new_name: str, description: str, keywords: List[str], category: str, priority: int, enabled: bool, trigger_mode: str = "keyword") -> bool:
        """更新条目"""
        try:
            old_file = self.global_worldbook_dir / f"{old_name}.yml"
            if not old_file.exists():
                return False
            
            # 读取现有数据以保留创建时间
            with open(old_file, 'r', encoding='utf-8') as f:
                existing_data = yaml.safe_load(f) or {}
            
            entry_data = {
                '名字': new_name,
                '描述': description,
                '关键词': keywords,
                '分类': category,
                '优先级': priority,
                '启用': enabled,
                '触发模式': trigger_mode,
                '创建时间': existing_data.get('创建时间', datetime.datetime.now().isoformat()),
                '修改时间': datetime.datetime.now().isoformat()
            }
            
            # 如果名称改变，删除旧文件
            if old_name != new_name:
                old_file.unlink()
                new_file = self.global_worldbook_dir / f"{new_name}.yml"
            else:
                new_file = old_file
            
            with open(new_file, 'w', encoding='utf-8') as f:
                yaml.dump(entry_data, f, allow_unicode=True, default_flow_style=False)
            
            # 清除缓存
            self._cache.clear()
            self._cache_time = None
            
            return True
        except Exception as e:
            print(f"更新条目失败: {e}")
            return False
    
    def delete_entry(self, name: str) -> bool:
        """删除条目"""
        try:
            yml_file = self.global_worldbook_dir / f"{name}.yml"
            if yml_file.exists():
                yml_file.unlink()
                # 清除缓存
                self._cache.clear()
                self._cache_time = None
                return True
            return False
        except Exception as e:
            print(f"删除条目失败: {e}")
            return False
    
    def search_entries(self, query: str, category: str = None) -> Dict[str, Any]:
        """搜索条目"""
        entries = self._load_all_entries()
        results = {}
        
        query_lower = query.lower() if query else ""
        
        for name, data in entries.items():
            if not data:
                continue
                
            # 分类筛选
            if category and data.get('分类', '默认') != category:
                continue
            
            # 搜索匹配
            if not query:
                results[name] = data
                continue
                
            # 在名字、描述、关键词中搜索
            match_found = False
            
            # 搜索名字
            if query_lower in data.get('名字', '').lower():
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
        entries = self._load_all_entries()
        categories = set()
        for data in entries.values():
            if data:
                categories.add(data.get('分类', '默认'))
        return sorted(list(categories))
    
    def get_always_active_entries(self) -> Dict[str, Any]:
        """获取全局生效的条目"""
        entries = self._load_all_entries()
        always_active = {}
        
        for name, data in entries.items():
            if data and data.get('启用', True) and data.get('触发模式', 'keyword') == 'always':
                always_active[name] = data
        
        return always_active
    
    def match_keywords_in_text(self, text: str) -> Dict[str, Any]:
        """在文本中匹配关键词并返回相关条目"""
        entries = self._load_all_entries()
        matched_entries = {}
        
        text_lower = text.lower()
        
        for name, data in entries.items():
            if not data or not data.get('启用', True):
                continue
            
            # 检查触发模式
            trigger_mode = data.get('触发模式', 'keyword')
            
            if trigger_mode == 'always':
                # 全局生效模式 - 直接添加到匹配结果
                priority = data.get('优先级', 1)
                if name not in matched_entries or matched_entries[name].get('优先级', 1) < priority:
                    matched_entries[name] = data
                continue
            
            # 关键词触发模式（默认）
            keywords = data.get('关键词', [])
            if not isinstance(keywords, list):
                continue
            
            # 检查是否有关键词匹配
            for keyword in keywords:
                keyword_str = str(keyword).lower()
                if keyword_str in text_lower:
                    # 确保是完整单词匹配（避免部分匹配）
                    if self._is_whole_word_match(text_lower, keyword_str):
                        priority = data.get('优先级', 1)
                        if name not in matched_entries or matched_entries[name].get('优先级', 1) < priority:
                            matched_entries[name] = data
                        break
        
        return matched_entries
    
    def _is_whole_word_match(self, text: str, keyword: str) -> bool:
        """检查是否为完整单词匹配"""
        # 对中文友好的匹配方式 - 简单包含匹配
        # 因为中文没有明确的单词边界，所以直接使用包含匹配
        return keyword.lower() in text.lower()
    
    def format_matched_entries_for_ai(self, matched_entries: Dict[str, Any]) -> str:
        """将匹配的条目格式化为AI可读的注释形式"""
        if not matched_entries:
            return ""
        
        # 按优先级排序
        sorted_entries = sorted(
            matched_entries.items(),
            key=lambda x: x[1].get('优先级', 1),
            reverse=True
        )
        
        formatted_text = "<!-- 世界书相关信息 -->\n"
        
        for name, data in sorted_entries:
            description = data.get('描述', '')
            category = data.get('分类', '默认')
            keywords = data.get('关键词', [])
            
            formatted_text += f"<!-- 【{category}】{name}：{description}"
            if keywords:
                formatted_text += f" [关键词: {', '.join(map(str, keywords))}]"
            formatted_text += " -->\n"
        
        return formatted_text
    
    def process_text_with_worldbook(self, text: str) -> Tuple[str, Dict[str, Any]]:
        """处理文本，返回原文本和匹配的世界书条目信息"""
        matched_entries = self.match_keywords_in_text(text)
        worldbook_context = self.format_matched_entries_for_ai(matched_entries)
        
        return text, {
            'matched_entries': matched_entries,
            'worldbook_context': worldbook_context,
            'matched_count': len(matched_entries)
        }


# 全局实例
keyword_worldbook = KeywordWorldBook()
