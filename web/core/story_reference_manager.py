"""
数据书引用管理器
用于管理数据书与角色、玩家的绑定关系，以及数据书之间的引用关系
"""

import json
import yaml
from pathlib import Path
from typing import Dict, List, Set, Any, Optional
import datetime

from web.utils import PathManager


class StoryReferenceManager:
    """数据书引用管理器"""
    
    def __init__(self, stories_dir: Optional[Path] = None, players_dir: Optional[Path] = None):
        self.stories_dir = Path(stories_dir) if stories_dir else PathManager.get_storybook_dir()
        self.players_dir = Path(players_dir) if players_dir else PathManager.get_players_dir()
        self._cache = {}  # 缓存机制
        self._cache_time = None
        self._cache_duration = 60  # 缓存60秒
    
    def _is_cache_valid(self) -> bool:
        """检查缓存是否有效"""
        if not self._cache_time:
            return False
        return (datetime.datetime.now() - self._cache_time).seconds < self._cache_duration
    
    def _load_stories_data(self) -> Dict[str, Any]:
        """加载所有数据书数据"""
        if self._is_cache_valid() and 'stories' in self._cache:
            return self._cache['stories']
        
        stories_data = {}
        if self.stories_dir.exists():
            for json_file in self.stories_dir.glob("*.json"):
                try:
                    with open(json_file, 'r', encoding='utf-8') as f:
                        story_data = json.load(f)
                    story_name = json_file.stem
                    stories_data[story_name] = story_data
                except Exception as e:
                    print(f"读取数据书 {json_file} 失败: {e}")
                    continue
        
        # 更新缓存
        self._cache['stories'] = stories_data
        self._cache_time = datetime.datetime.now()
        
        return stories_data
    
    def _load_players_data(self) -> Dict[str, Any]:
        """加载所有玩家数据"""
        if self._is_cache_valid() and 'players' in self._cache:
            return self._cache['players']
        
        players_data = {}
        if self.players_dir.exists():
            for yml_file in self.players_dir.glob("*.yml"):
                try:
                    with open(yml_file, 'r', encoding='utf-8') as f:
                        player_data = yaml.safe_load(f)
                    player_name = yml_file.stem
                    players_data[player_name] = player_data
                except Exception as e:
                    print(f"读取玩家 {yml_file} 失败: {e}")
                    continue
        
        # 更新缓存
        self._cache['players'] = players_data
        self._cache_time = datetime.datetime.now()
        
        return players_data
    
    def _get_role_bound_storybooks(self, role_name: str) -> Set[str]:
        """
        从角色获取绑定的数据书列表（仅使用自动同名绑定逻辑）
        
        参数:
        role_name (str): 角色名称
        
        返回:
        Set[str]: 绑定的数据书名称集合
        """
        bound_storybooks = set()
        
        try:
            # 使用自动绑定逻辑
            import sys
            from pathlib import Path
            project_root = Path(__file__).parent.parent.parent
            if str(project_root) not in sys.path:
                sys.path.insert(0, str(project_root))
            
            from auto_binding_utils import get_bound_storybooks_auto
            
            bound_stories = get_bound_storybooks_auto(role_name)
            bound_storybooks = set(bound_stories.keys())
            
            if bound_storybooks:
                print(f"通过自动绑定为 {role_name} 找到数据书: {bound_storybooks}")
            
        except Exception as e:
            print(f"使用自动绑定逻辑失败: {e}")
        
        return bound_storybooks
    
    def get_bound_story_data_with_references(self, role_name: str) -> Dict[str, Any]:
        """
        获取与指定角色捆绑的数据书数据（增强版，包括引用的数据书）
        
        参数:
        role_name (str): 角色名称，例如 'biabia'
        
        返回:
        dict: 角色捆绑的数据书数据，键为数据书名称，值为数据书内容（不包括关键词）
        """
        stories_data = self._load_stories_data()
        bound_stories = {}
        
        # 第一轮：找到直接捆绑的数据书（两种方式）
        direct_bound_stories = set()
        
        # 1. 从数据书文件的"捆绑角色"字段查找
        for story_name, story_data in stories_data.items():
            if isinstance(story_data, dict) and "捆绑角色" in story_data:
                bound_roles = story_data["捆绑角色"]
                if isinstance(bound_roles, list) and role_name in bound_roles:
                    direct_bound_stories.add(story_name)
        
        # 2. 从角色文件的"绑定数据书"字段查找
        role_bound_storybooks = self._get_role_bound_storybooks(role_name)
        direct_bound_stories.update(role_bound_storybooks)
        
        # 第二轮：找到引用的数据书
        referenced_stories = set()
        for story_name in direct_bound_stories:
            if story_name in stories_data:
                story_data = stories_data[story_name]
                if "引用数据书" in story_data:
                    references = story_data["引用数据书"]
                    if isinstance(references, list):
                        referenced_stories.update(references)
        
        # 合并所有相关的数据书
        all_related_stories = direct_bound_stories | referenced_stories
        
        # 构建返回数据
        for story_name in all_related_stories:
            if story_name in stories_data:
                story_data = stories_data[story_name]
                # 移除不需要的字段（关键词、捆绑角色、引用数据书等），只保留实际数据
                story_content = {k: v for k, v in story_data.items() 
                               if k not in ["关键词", "捆绑角色", "引用数据书", "更新时间"]}
                bound_stories[story_name] = story_content
        
        return bound_stories
    
    def get_player_bound_story_data(self, player_name: str) -> Dict[str, Any]:
        """
        获取与指定玩家捆绑的数据书数据
        
        参数:
        player_name (str): 玩家名称，例如 '奥特曼'
        
        返回:
        dict: 玩家捆绑的数据书数据
        """
        stories_data = self._load_stories_data()
        bound_stories = {}
        
        for story_name, story_data in stories_data.items():
            if isinstance(story_data, dict) and "捆绑玩家" in story_data:
                bound_players = story_data["捆绑玩家"]
                if isinstance(bound_players, list) and player_name in bound_players:
                    # 移除不需要的字段，只保留实际数据
                    story_content = {k: v for k, v in story_data.items() 
                                   if k not in ["关键词", "捆绑玩家", "捆绑角色", "引用数据书", "更新时间"]}
                    bound_stories[story_name] = story_content
        
        return bound_stories
    
    def get_all_bound_story_data(self, role_name: str, player_name: str) -> Dict[str, Any]:
        """
        获取角色和玩家都捆绑的数据书数据
        
        参数:
        role_name (str): 角色名称
        player_name (str): 玩家名称
        
        返回:
        dict: 合并后的数据书数据
        """
        # 获取角色捆绑的数据书
        role_stories = self.get_bound_story_data_with_references(role_name)
        
        # 获取玩家捆绑的数据书
        player_stories = self.get_player_bound_story_data(player_name)
        
        # 合并数据，玩家捆绑的数据书优先级更高
        all_stories = role_stories.copy()
        all_stories.update(player_stories)
        
        return all_stories
    
    def process_keyword_triggers_with_references(self, sentence: str) -> Dict[str, Any]:
        """
        处理句子中的关键词，支持数据书引用关系和连锁引用
        
        参数:
        sentence (str): 输入句子
        
        返回:
        tuple: (处理后的句子, 触发的数据书数据)
        """
        stories_data = self._load_stories_data()
        triggered_stories = {}
        
        # 收集所有关键词
        all_keywords = {}
        for story_name, story_data in stories_data.items():
            if isinstance(story_data, dict) and "关键词" in story_data:
                keywords = story_data["关键词"]
                if isinstance(keywords, list):
                    # 移除关键词部分，保留其他数据
                    other_parts = {k: v for k, v in story_data.items() if k != "关键词"}
                    content = json.dumps(other_parts, ensure_ascii=False, indent=2)
                    for kw in keywords:
                        all_keywords[kw] = content
        
        # 处理句子中的关键词
        placeholders = {}
        placeholder_counter = 0
        processed_sentence = sentence
        
        for keyword in all_keywords:
            # 使用精确匹配检查关键词是否在句子中
            if self._exact_keyword_match(keyword, processed_sentence):
                placeholder = f"__PLACEHOLDER_{placeholder_counter}__"
                processed_sentence = processed_sentence.replace(keyword, placeholder)
                placeholders[placeholder] = keyword
                placeholder_counter += 1
                
                # 只有真正在句子中找到关键词时，才记录对应的数据书数据
                # 根据关键词找到对应的数据书名称
                for story_name, story_data in stories_data.items():
                    if isinstance(story_data, dict) and "关键词" in story_data:
                        if keyword in story_data["关键词"]:
                            triggered_stories[story_name] = {k: v for k, v in story_data.items() if k != "关键词"}
                            print(f"关键词直接触发: {story_name} (关键词: {keyword})")
                            break
        
        # 连锁引用：检查已触发的数据书数据中是否包含其他关键词
        self._process_cascade_references(triggered_stories, stories_data, all_keywords)
        
        # 替换占位符
        for placeholder, keyword in placeholders.items():
            content = all_keywords[keyword]
            processed_sentence = processed_sentence.replace(placeholder, f"{keyword} ({content})")
        
        return processed_sentence, triggered_stories
    
    def _process_cascade_references(self, triggered_stories: Dict[str, Any], stories_data: Dict[str, Any], all_keywords: Dict[str, str]):
        """
        处理连锁引用：检查已触发的数据书数据中是否包含其他关键词
        
        参数:
        triggered_stories: 已触发的数据书数据
        stories_data: 所有数据书数据
        all_keywords: 所有关键词映射
        """
        # 继续处理直到没有新的连锁引用
        while True:
            new_references = {}
            
            # 检查每个已触发的数据书数据
            for story_name, story_data in triggered_stories.items():
                # 只检查描述字段中是否包含关键词，避免属性值误触发
                # 构建用于关键词匹配的文本：只包含描述性内容，不包括数值属性
                search_text_parts = []
                
                # 添加描述字段
                if isinstance(story_data, dict):
                    if "描述" in story_data:
                        search_text_parts.append(str(story_data["描述"]))
                    if "标签" in story_data and isinstance(story_data["标签"], list):
                        search_text_parts.append(" ".join(story_data["标签"]))
                    # 添加总结词作为描述性内容
                    if "总结词" in story_data and isinstance(story_data["总结词"], list):
                        search_text_parts.append(" ".join(story_data["总结词"]))
                
                # 合并所有描述性文本
                story_text = " ".join(search_text_parts)
                
                # 检查是否包含其他关键词（使用精确匹配）
                for keyword in all_keywords:
                    # 使用精确词匹配，避免部分匹配导致的误触发
                    if self._exact_keyword_match(keyword, story_text):
                        # 找到包含此关键词的数据书
                        for ref_story_name, ref_story_data in stories_data.items():
                            if (isinstance(ref_story_data, dict) and "关键词" in ref_story_data and 
                                keyword in ref_story_data["关键词"] and ref_story_name not in triggered_stories):
                                new_references[ref_story_name] = {k: v for k, v in ref_story_data.items() if k != "关键词"}
                                print(f"连锁引用触发: {story_name} -> {ref_story_name} (关键词: {keyword})")
                                break
            
            # 如果没有新的引用，退出循环
            if not new_references:
                break
                
            # 添加新的引用
            triggered_stories.update(new_references)
    
    def _exact_keyword_match(self, keyword: str, text: str) -> bool:
        """
        精确关键词匹配，支持中文和英文，避免部分匹配导致的误触发
        
        参数:
        keyword: 要匹配的关键词
        text: 要搜索的文本
        
        返回:
        bool: 是否精确匹配
        """
        import re
        
        # 如果关键词包含中文，使用简单的字符串匹配
        if re.search(r'[\u4e00-\u9fff]', keyword):
            # 中文关键词：检查是否存在完整匹配
            # 对于中文，我们简化处理：只要关键词存在于文本中就认为匹配
            return keyword in text
        else:
            # 英文关键词：使用单词边界
            pattern = r'\b' + re.escape(keyword) + r'\b'
            return bool(re.search(pattern, text))
    
    def bind_story_to_player(self, story_name: str, player_name: str) -> bool:
        """
        将数据书绑定到玩家
        
        参数:
        story_name (str): 数据书名称
        player_name (str): 玩家名称
        
        返回:
        bool: 是否成功
        """
        try:
            story_file = self.stories_dir / f"{story_name}.json"
            if not story_file.exists():
                return False
            
            # 读取现有数据
            with open(story_file, 'r', encoding='utf-8') as f:
                story_data = json.load(f)
            
            # 添加玩家绑定
            if "捆绑玩家" not in story_data:
                story_data["捆绑玩家"] = []
            
            if player_name not in story_data["捆绑玩家"]:
                story_data["捆绑玩家"].append(player_name)
                story_data["更新时间"] = datetime.datetime.now().isoformat()
                
                # 保存数据
                with open(story_file, 'w', encoding='utf-8') as f:
                    json.dump(story_data, f, ensure_ascii=False, indent=2)
                
                # 清除缓存
                self._cache.clear()
                return True
            
            return True  # 已经绑定了
            
        except Exception as e:
            print(f"绑定数据书到玩家失败: {e}")
            return False
    
    def unbind_story_from_player(self, story_name: str, player_name: str) -> bool:
        """
        解除数据书与玩家的绑定
        
        参数:
        story_name (str): 数据书名称
        player_name (str): 玩家名称
        
        返回:
        bool: 是否成功
        """
        try:
            story_file = self.stories_dir / f"{story_name}.json"
            if not story_file.exists():
                return False
            
            # 读取现有数据
            with open(story_file, 'r', encoding='utf-8') as f:
                story_data = json.load(f)
            
            # 移除玩家绑定
            if "捆绑玩家" in story_data and player_name in story_data["捆绑玩家"]:
                story_data["捆绑玩家"].remove(player_name)
                story_data["更新时间"] = datetime.datetime.now().isoformat()
                
                # 保存数据
                with open(story_file, 'w', encoding='utf-8') as f:
                    json.dump(story_data, f, ensure_ascii=False, indent=2)
                
                # 清除缓存
                self._cache.clear()
                return True
            
            return True  # 本来就没有绑定
            
        except Exception as e:
            print(f"解除数据书与玩家绑定失败: {e}")
            return False
    
    def get_story_bindings(self, story_name: str) -> Dict[str, List[str]]:
        """
        获取数据书的绑定信息
        
        参数:
        story_name (str): 数据书名称
        
        返回:
        dict: 包含角色和玩家绑定信息的字典
        """
        try:
            story_file = self.stories_dir / f"{story_name}.json"
            if not story_file.exists():
                return {"角色": [], "玩家": []}
            
            with open(story_file, 'r', encoding='utf-8') as f:
                story_data = json.load(f)
            
            return {
                "角色": story_data.get("捆绑角色", []),
                "玩家": story_data.get("捆绑玩家", [])
            }
            
        except Exception as e:
            print(f"获取数据书绑定信息失败: {e}")
            return {"角色": [], "玩家": []}
    
    def analyze_references(self, analysis_type: str = "all", story_name: str = None, keyword: str = None) -> Dict[str, Any]:
        """
        分析数据书引用关系
        
        参数:
        analysis_type (str): 分析类型 ("all", "single", "circular", "orphaned", "keyword")
        story_name (str): 单个数据书分析时的数据书名称
        keyword (str): 关键词测试时的关键词
        
        返回:
        dict: 分析结果
        """
        stories_data = self._load_stories_data()
        
        if analysis_type == "all":
            return self._analyze_all_references(stories_data)
        elif analysis_type == "single":
            if not story_name:
                raise ValueError("单个数据书分析需要指定数据书名称")
            return self._analyze_single_story_references(stories_data, story_name)
        elif analysis_type == "circular":
            return self._analyze_circular_references(stories_data)
        elif analysis_type == "orphaned":
            return self._analyze_orphaned_stories(stories_data)
        elif analysis_type == "keyword":
            if not keyword:
                raise ValueError("关键词测试需要指定关键词")
            return self._analyze_keyword_references(stories_data, keyword)
        else:
            raise ValueError(f"不支持的分析类型: {analysis_type}")
    
    def _analyze_all_references(self, stories_data: Dict[str, Any]) -> Dict[str, Any]:
        """分析所有数据书的引用关系"""
        reference_map = {}
        
        for story_name, story_data in stories_data.items():
            if isinstance(story_data, dict) and "引用数据书" in story_data:
                references = story_data["引用数据书"]
                if isinstance(references, list):
                    reference_map[story_name] = references
                else:
                    reference_map[story_name] = []
            else:
                reference_map[story_name] = []
        
        return {
            "reference_map": reference_map,
            "total_stories": len(stories_data),
            "stories_with_references": len([refs for refs in reference_map.values() if refs])
        }
    
    def _analyze_single_story_references(self, stories_data: Dict[str, Any], story_name: str) -> Dict[str, Any]:
        """分析单个数据书的引用关系"""
        if story_name not in stories_data:
            raise ValueError(f"数据书 '{story_name}' 不存在")
        
        story_data = stories_data[story_name]
        
        # 获取此数据书引用的其他数据书
        references = []
        if isinstance(story_data, dict) and "引用数据书" in story_data:
            refs = story_data["引用数据书"]
            if isinstance(refs, list):
                references = refs
        
        # 查找引用此数据书的其他数据书
        referenced_by = []
        for other_story_name, other_story_data in stories_data.items():
            if other_story_name != story_name and isinstance(other_story_data, dict) and "引用数据书" in other_story_data:
                other_refs = other_story_data["引用数据书"]
                if isinstance(other_refs, list) and story_name in other_refs:
                    referenced_by.append(other_story_name)
        
        return {
            "story_name": story_name,
            "references": references,
            "referenced_by": referenced_by,
            "reference_count": len(references),
            "referenced_by_count": len(referenced_by)
        }
    
    def _analyze_circular_references(self, stories_data: Dict[str, Any]) -> Dict[str, Any]:
        """检测循环引用"""
        # 构建引用图
        graph = {}
        for story_name, story_data in stories_data.items():
            if isinstance(story_data, dict) and "引用数据书" in story_data:
                refs = story_data["引用数据书"]
                if isinstance(refs, list):
                    graph[story_name] = refs
                else:
                    graph[story_name] = []
            else:
                graph[story_name] = []
        
        # 使用DFS检测循环
        def has_cycle_dfs(node, visited, rec_stack):
            visited.add(node)
            rec_stack.add(node)
            
            for neighbor in graph.get(node, []):
                if neighbor not in visited:
                    if has_cycle_dfs(neighbor, visited, rec_stack):
                        return True
                elif neighbor in rec_stack:
                    return True
            
            rec_stack.remove(node)
            return False
        
        def find_cycles():
            visited = set()
            cycles = []
            
            for node in graph:
                if node not in visited:
                    rec_stack = set()
                    if has_cycle_dfs(node, visited, rec_stack):
                        # 找到循环，尝试提取循环路径
                        cycle_path = self._extract_cycle_path(node, graph)
                        if cycle_path:
                            cycles.append(cycle_path)
            
            return cycles
        
        circular_references = find_cycles()
        
        return {
            "circular_references": circular_references,
            "has_circular_references": len(circular_references) > 0,
            "circular_count": len(circular_references)
        }
    
    def _extract_cycle_path(self, start_node: str, graph: Dict[str, List[str]]) -> List[str]:
        """提取循环路径"""
        def dfs_find_cycle(node, path, visited):
            if node in path:
                # 找到循环
                cycle_start = path.index(node)
                return path[cycle_start:] + [node]
            
            if node in visited:
                return None
            
            visited.add(node)
            path.append(node)
            
            for neighbor in graph.get(node, []):
                result = dfs_find_cycle(neighbor, path.copy(), visited.copy())
                if result:
                    return result
            
            return None
        
        return dfs_find_cycle(start_node, [], set())
    
    def _analyze_orphaned_stories(self, stories_data: Dict[str, Any]) -> Dict[str, Any]:
        """检测孤立数据书（没有引用关系的数据书）"""
        # 构建引用关系图
        has_references = set()  # 有引用其他数据书的数据书
        is_referenced = set()   # 被其他数据书引用的数据书
        
        for story_name, story_data in stories_data.items():
            if isinstance(story_data, dict) and "引用数据书" in story_data:
                refs = story_data["引用数据书"]
                if isinstance(refs, list) and refs:
                    has_references.add(story_name)
                    for ref in refs:
                        is_referenced.add(ref)
        
        # 找出既没有引用其他数据书，也没有被其他数据书引用的数据书
        all_stories = set(stories_data.keys())
        orphaned_stories = all_stories - has_references - is_referenced
        
        return {
            "orphaned_stories": list(orphaned_stories),
            "orphaned_count": len(orphaned_stories),
            "has_orphaned": len(orphaned_stories) > 0
        }
    
    def _analyze_keyword_references(self, stories_data: Dict[str, Any], keyword: str) -> Dict[str, Any]:
        """分析关键词在数据书中的引用情况"""
        matched_stories = []
        all_keywords = set()
        
        for story_name, story_data in stories_data.items():
            if not isinstance(story_data, dict):
                continue
            
            # 收集所有关键词用于显示
            if "关键词" in story_data and isinstance(story_data["关键词"], list):
                all_keywords.update(story_data["关键词"])
            
            # 检查关键词匹配
            match_info = self._check_keyword_match(story_data, keyword)
            if match_info:
                match_info["story_name"] = story_name
                matched_stories.append(match_info)
        
        return {
            "keyword": keyword,
            "matched_stories": matched_stories,
            "match_count": len(matched_stories),
            "all_keywords": sorted(list(all_keywords)),
            "has_matches": len(matched_stories) > 0
        }
    
    def _check_keyword_match(self, story_data: Dict[str, Any], keyword: str) -> Optional[Dict[str, Any]]:
        """检查数据书数据中是否包含指定关键词"""
        if not isinstance(story_data, dict):
            return None
        
        match_info = {
            "match_type": [],
            "description": story_data.get("描述", ""),
            "keywords": story_data.get("关键词", [])
        }
        
        # 检查关键词列表
        if "关键词" in story_data and isinstance(story_data["关键词"], list):
            if keyword in story_data["关键词"]:
                match_info["match_type"].append("关键词列表")
        
        # 检查描述
        if "描述" in story_data and isinstance(story_data["描述"], str):
            if keyword in story_data["描述"]:
                match_info["match_type"].append("描述")
        
        # 检查属性值
        if "属性" in story_data and isinstance(story_data["属性"], dict):
            for attr_name, attr_value in story_data["属性"].items():
                if isinstance(attr_value, str) and keyword in attr_value:
                    match_info["match_type"].append(f"属性({attr_name})")
                elif isinstance(attr_value, dict):
                    for sub_key, sub_value in attr_value.items():
                        if isinstance(sub_value, str) and keyword in sub_value:
                            match_info["match_type"].append(f"属性({attr_name}.{sub_key})")
        
        # 检查总结词
        if "总结词" in story_data and isinstance(story_data["总结词"], list):
            if keyword in story_data["总结词"]:
                match_info["match_type"].append("总结词")
        
        # 检查标签
        if "标签" in story_data and isinstance(story_data["标签"], list):
            if keyword in story_data["标签"]:
                match_info["match_type"].append("标签")
        
        # 检查事件
        if "事件" in story_data and isinstance(story_data["事件"], list):
            for event in story_data["事件"]:
                if isinstance(event, str) and keyword in event:
                    match_info["match_type"].append("事件")
                    break
        
        # 如果有匹配，返回匹配信息
        if match_info["match_type"]:
            match_info["match_type"] = ", ".join(match_info["match_type"])
            return match_info
        
        return None

    def clear_cache(self):
        """清除缓存"""
        self._cache.clear()
        self._cache_time = None


# 全局实例
story_manager = StoryReferenceManager()

# 便捷函数
def get_bound_story_data_with_references(role_name: str) -> Dict[str, Any]:
    """获取与指定角色捆绑的数据书数据（包括引用的数据书）"""
    return story_manager.get_bound_story_data_with_references(role_name)

def get_player_bound_story_data(player_name: str) -> Dict[str, Any]:
    """获取与指定玩家捆绑的数据书数据"""
    return story_manager.get_player_bound_story_data(player_name)

def get_all_bound_story_data(role_name: str, player_name: str) -> Dict[str, Any]:
    """获取角色和玩家都捆绑的数据书数据"""
    return story_manager.get_all_bound_story_data(role_name, player_name)

def process_keyword_triggers_with_references(sentence: str) -> tuple:
    """处理句子中的关键词，支持数据书引用关系"""
    return story_manager.process_keyword_triggers_with_references(sentence)

def bind_story_to_player(story_name: str, player_name: str) -> bool:
    """将数据书绑定到玩家"""
    return story_manager.bind_story_to_player(story_name, player_name)

def unbind_story_from_player(story_name: str, player_name: str) -> bool:
    """解除数据书与玩家的绑定"""
    return story_manager.unbind_story_from_player(story_name, player_name)

def get_story_bindings(story_name: str) -> Dict[str, List[str]]:
    """获取数据书的绑定信息"""
    return story_manager.get_story_bindings(story_name)

def clear_cache():
    """清除缓存"""
    story_manager.clear_cache()

def analyze_references(analysis_type: str = "all", story_name: str = None, keyword: str = None) -> Dict[str, Any]:
    """分析数据书引用关系"""
    return story_manager.analyze_references(analysis_type, story_name, keyword)


if __name__ == "__main__":
    # 测试代码
    print("数据书引用管理器测试")
    
    # 测试获取角色捆绑的数据书
    role_stories = get_bound_story_data_with_references("少年")
    print(f"角色'少年'捆绑的数据书: {list(role_stories.keys())}")
    
    # 测试获取玩家捆绑的数据书
    player_stories = get_player_bound_story_data("奥特曼")
    print(f"玩家'奥特曼'捆绑的数据书: {list(player_stories.keys())}")
    
    # 测试获取所有绑定数据
    all_stories = get_all_bound_story_data("少年", "奥特曼")
    print(f"所有绑定数据: {list(all_stories.keys())}")
    
    # 测试关键词处理
    test_sentence = "我使用了背包中的金币"
    processed, triggered = process_keyword_triggers_with_references(test_sentence)
    print(f"处理后的句子: {processed}")
    print(f"触发的数据书: {list(triggered.keys())}")
