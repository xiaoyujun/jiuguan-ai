"""
简化的数据处理器
只保留关键词匹配和传入大语言模型的核心功能
"""

import json
import logging
from typing import Dict, Any, List, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)

class SimpleProcessor:
    """简化的数据处理器 - 只保留核心功能"""
    
    def __init__(self):
        """初始化简化处理器"""
        try:
            from .config_manager import get_vectorized_config_manager
            from .semantic_search_api import get_semantic_engine
            from .temp_data_recorder import get_temp_data_recorder
        except ImportError:
            from config_manager import get_vectorized_config_manager
            from semantic_search_api import get_semantic_engine
            from temp_data_recorder import get_temp_data_recorder
        
        self.config_manager = get_vectorized_config_manager()
        self.semantic_engine = get_semantic_engine()
        self.temp_data_recorder = get_temp_data_recorder()
        
        logger.info("简化处理器初始化完成（使用语义搜索引擎）")
    
    def process_user_input(self, role_name: str, user_input: str, 
                          include_player_data: bool = True, 
                          player_name: str = None,
                          multi_chat_participants: list = None,
                          log_role_name: str = None) -> Tuple[str, bool, Dict[str, Any]]:
        """
        处理用户输入 - 简化版本
        
        Args:
            role_name: 角色名称
            user_input: 用户输入
            include_player_data: 是否包含玩家数据
            player_name: 玩家名称
            multi_chat_participants: 多人聊天参与者列表（可选）
            log_role_name: 用于日志记录的角色名称（可选）
            
        Returns:
            (context, success, details)
        """
        try:
            logger.info(f"开始处理用户输入: {user_input[:50]}...")
            
            # 第一步：使用语义搜索引擎找到相关数据书
            search_results = self.semantic_engine.smart_search(user_input, top_k=5)
            
            matched_storybooks = {}
            match_details = []
            
            for character_key, score, character_data in search_results:
                # 跳过当前角色自己的数据书（避免重复）
                if character_key == role_name:
                    continue
                
                # 只保留有意义相关度的结果（阈值0.1）
                if score > 0.1:
                    matched_storybooks[character_key] = character_data
                    match_details.append({
                        'story_name': character_key,
                        'relevance_score': score,
                        'match_type': 'semantic_search'
                    })
            
            # 第二步：构建传入LLM的上下文
            context_parts = []
            
            # 添加匹配到的数据书内容
            for story_name, story_data in matched_storybooks.items():
                formatted_content = self._format_storybook_for_llm(story_name, story_data)
                if formatted_content:
                    context_parts.append(formatted_content)
            
            # 如果需要包含玩家数据
            if include_player_data:
                player_content = self._get_player_data(player_name)
                if player_content:
                    context_parts.append(player_content)
            
            # 合并所有内容
            final_context = "\n\n".join(context_parts)
            
            # 第三步：记录传入内容到文件
            self.temp_data_recorder.record_transmission_to_file(
                role_name=role_name,
                user_input=user_input,
                final_context=final_context,
                step1_details={"match_details": match_details},
                step2_details={"storybooks_count": len(matched_storybooks)}
            )
            
            # 返回结果
            success = len(matched_storybooks) > 0 or include_player_data
            details = {
                "matched_storybooks": len(matched_storybooks),
                "total_context_length": len(final_context),
                "match_details": match_details
            }
            
            logger.info(f"处理完成: 匹配到{len(matched_storybooks)}个数据书，上下文长度{len(final_context)}")
            
            return final_context, success, details
            
        except Exception as e:
            logger.error(f"处理用户输入失败: {e}")
            return "", False, {"error": str(e)}
    
    def _format_storybook_for_llm(self, story_name: str, story_data: Dict[str, Any]) -> str:
        """
        格式化数据书内容供LLM使用
        
        Args:
            story_name: 数据书名称
            story_data: 数据书数据
            
        Returns:
            格式化后的内容
        """
        try:
            lines = [f"=== 其他信息: {story_name} ==="]
            
            # 添加总结词
            if "总结词" in story_data and story_data["总结词"]:
                lines.append(f"总结词: {', '.join(story_data['总结词'])}")
            
            # 添加关键词
            if "关键词" in story_data and story_data["关键词"]:
                lines.append(f"关键词: {', '.join(story_data['关键词'])}")
            
            # 添加属性信息
            if "属性" in story_data and isinstance(story_data["属性"], dict):
                lines.append("属性信息:")
                for key, value in story_data["属性"].items():
                    if isinstance(value, dict):
                        lines.append(f"  {key}:")
                        for sub_key, sub_value in value.items():
                            lines.append(f"    {sub_key}: {sub_value}")
                    else:
                        lines.append(f"  {key}: {value}")
            
            # 添加其他重要字段
            important_fields = ["状态", "事件", "外貌特征", "能力值", "社交关系", "背包", "描述"]
            for field in important_fields:
                if field in story_data and story_data[field]:
                    if isinstance(story_data[field], (dict, list)):
                        lines.append(f"{field}: {json.dumps(story_data[field], ensure_ascii=False, indent=2)}")
                    else:
                        lines.append(f"{field}: {story_data[field]}")
            
            return "\n".join(lines)
            
        except Exception as e:
            logger.warning(f"格式化数据书 {story_name} 失败: {e}")
            return f"=== {story_name} ===\n{json.dumps(story_data, ensure_ascii=False, indent=2)}"
    
    def _get_player_data(self, player_name: str = None) -> str:
        """
        获取玩家数据
        
        Args:
            player_name: 玩家名称，如果为None则获取当前玩家
            
        Returns:
            格式化的玩家数据
        """
        try:
            players_dir = self.config_manager.get_current_players_dir()
            
            # 如果没有指定玩家名称，尝试获取当前玩家
            if not player_name:
                current_player_file = players_dir.parent / "当前挑选玩家.json"
                if current_player_file.exists():
                    with open(current_player_file, 'r', encoding='utf-8') as f:
                        current_data = json.load(f)
                        player_name = current_data.get('当前玩家')
            
            if not player_name:
                return ""
            
            # 查找玩家文件
            for ext in ['.yml', '.yaml', '.json']:
                player_file = players_dir / f"{player_name}{ext}"
                if player_file.exists():
                    try:
                        if ext == '.json':
                            with open(player_file, 'r', encoding='utf-8') as f:
                                player_data = json.load(f)
                        else:
                            import yaml
                            with open(player_file, 'r', encoding='utf-8') as f:
                                player_data = yaml.safe_load(f)
                        
                        return f"=== 玩家: {player_name} ===\n{json.dumps(player_data, ensure_ascii=False, indent=2)}"
                        
                    except Exception as e:
                        logger.warning(f"读取玩家文件 {player_file} 失败: {e}")
                        continue
            
            return ""
            
        except Exception as e:
            logger.warning(f"获取玩家数据失败: {e}")
            return ""
    
    def _format_priority_role_data(self, role_name: str, role_data: Dict[str, Any], is_ai_role: bool = False) -> str:
        """
        格式化优先级角色数据（AI自己的角色或玩家角色）
        
        Args:
            role_name: 角色名称
            role_data: 角色数据
            is_ai_role: 是否为AI扮演的角色
            
        Returns:
            格式化后的优先级角色数据
        """
        try:
            if is_ai_role:
                lines = [f"=== 【你的角色数据书】: {role_name} ==="]
                lines.append("注意：这是你自己的角色数据，你必须严格按照这些设定进行扮演")
            else:
                lines = [f"=== 【当前玩家角色数据书】: {role_name} ==="]
                lines.append("注意：这是当前玩家扮演的角色数据，用于理解对方的身份和背景")
            
            lines.append("")  # 空行
            
            # 添加总结词
            if "总结词" in role_data and role_data["总结词"]:
                lines.append(f"总结词: {', '.join(role_data['总结词'])}")
            
            # 添加关键词
            if "关键词" in role_data and role_data["关键词"]:
                lines.append(f"关键词: {', '.join(role_data['关键词'])}")
            
            # 添加属性信息
            if "属性" in role_data and isinstance(role_data["属性"], dict):
                lines.append("属性信息:")
                for key, value in role_data["属性"].items():
                    if isinstance(value, dict):
                        lines.append(f"  {key}:")
                        for sub_key, sub_value in value.items():
                            lines.append(f"    {sub_key}: {sub_value}")
                    else:
                        lines.append(f"  {key}: {value}")
            
            # 添加描述
            if "描述" in role_data and role_data["描述"]:
                lines.append(f"描述: {role_data['描述']}")
            
            # 添加标签
            if "标签" in role_data and role_data["标签"]:
                lines.append(f"标签: {', '.join(role_data['标签'])}")
            
            # 对于AI角色，添加额外的强调
            if is_ai_role:
                lines.append("")
                lines.append("⚠️ 重要提醒：你必须严格按照以上设定扮演这个角色，不得偏离！")
            
            return "\n".join(lines)
            
        except Exception as e:
            logger.error(f"❌ [优先级格式化] 格式化优先级角色数据失败: {e}")
            return f"=== 【{'你的' if is_ai_role else '玩家'}角色】: {role_name} ===\n数据加载失败"
    
    def get_processor_info(self) -> Dict[str, Any]:
        """获取处理器信息"""
        return {
            "processor_type": "SimpleProcessor",
            "version": "2.0",
            "engine": "SemanticSearchEngine",
            "config": self.config_manager.get_config_info(),
            "semantic_engine": self.semantic_engine.get_engine_info(),
            "features": [
                "语义搜索",
                "硬编码特征匹配",
                "模糊搜索",
                "数据书搜索",
                "LLM内容格式化",
                "处理记录"
            ]
        }

# 全局单例
_simple_processor = None

def get_simple_processor() -> SimpleProcessor:
    """获取简化处理器单例"""
    global _simple_processor
    if _simple_processor is None:
        _simple_processor = SimpleProcessor()
    return _simple_processor
