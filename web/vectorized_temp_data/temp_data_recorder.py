"""
简化的内容记录器
将传入大语言模型的内容记录到txt文件
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List
import logging

logger = logging.getLogger(__name__)

class TempDataRecorder:
    """简化的内容记录器"""
    
    def __init__(self, config_manager):
        self.config_manager = config_manager
        self.log_dir = Path("日志")
        self.log_dir.mkdir(exist_ok=True)
    
    def record_chat_analysis(self, role_name: str, user_input: str, 
                           chat_analysis: Dict[str, Any], final_context: str,
                           processing_details: Dict[str, Any] = None):
        """
        记录详细的聊天分析过程到日志文件
        
        Args:
            role_name: 当前角色名称
            user_input: 用户输入
            chat_analysis: 聊天分析结果
            final_context: 最终传入AI的上下文
            processing_details: 处理详情
        """
        try:
            # 生成文件名
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"聊天分析日志_{role_name}_{timestamp}.txt"
            
            log_file = self.log_dir / filename
            
            # 写入详细日志
            with open(log_file, 'w', encoding='utf-8') as f:
                f.write("=" * 80 + "\n")
                f.write("🎭 聊天数据书自动引入系统 - 详细分析日志\n")
                f.write("=" * 80 + "\n\n")
                
                # 基本信息
                f.write("📋 基本信息\n")
                f.write("-" * 40 + "\n")
                f.write(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"当前角色: {role_name}\n")
                f.write(f"用户输入: {user_input}\n")
                f.write(f"输入长度: {len(user_input)} 字符\n\n")
                
                # 聊天内容分析
                f.write("🔍 聊天内容分析过程\n")
                f.write("-" * 40 + "\n")
                
                matched_storybooks = chat_analysis.get("matched_storybooks", {})
                analysis_details = chat_analysis.get("analysis_details", [])
                
                f.write(f"识别到的相关角色数量: {len(matched_storybooks)}\n")
                f.write(f"分析详情条目数量: {len(analysis_details)}\n\n")
                
                if analysis_details:
                    f.write("📊 角色识别详情:\n")
                    for i, detail in enumerate(analysis_details, 1):
                        char_name = detail.get('character_name', 'Unknown')
                        score = detail.get('relevance_score', 0)
                        analysis_type = detail.get('analysis_type', 'unknown')
                        reason = detail.get('reason', 'No reason')
                        
                        f.write(f"  {i}. {char_name}\n")
                        f.write(f"     相关度得分: {score:.3f}\n")
                        f.write(f"     识别类型: {analysis_type}\n")
                        f.write(f"     匹配原因: {reason}\n\n")
                else:
                    f.write("⚠️ 未识别到相关角色\n\n")
                
                # 数据书加载详情
                f.write("📚 数据书加载详情\n")
                f.write("-" * 40 + "\n")
                
                if matched_storybooks:
                    for char_name, char_data in matched_storybooks.items():
                        f.write(f"📖 {char_name} 数据书:\n")
                        
                        # 总结词
                        summary_words = char_data.get("总结词", [])
                        if summary_words:
                            f.write(f"   总结词: {', '.join(map(str, summary_words))}\n")
                        
                        # 关键词
                        keywords = char_data.get("关键词", [])
                        if keywords:
                            f.write(f"   关键词: {', '.join(map(str, keywords))}\n")
                        
                        # 描述
                        description = char_data.get("描述", "")
                        if description:
                            desc_preview = description[:100] + "..." if len(description) > 100 else description
                            f.write(f"   描述: {desc_preview}\n")
                        
                        # 属性信息
                        if "属性" in char_data:
                            attrs = char_data["属性"]
                            if "状态" in attrs:
                                status = attrs["状态"]
                                name = status.get("名称", "")
                                if name:
                                    f.write(f"   角色名称: {name}\n")
                                personality = status.get("性格特点", "")
                                if personality:
                                    f.write(f"   性格特点: {personality[:50]}...\n")
                        
                        f.write("\n")
                else:
                    f.write("⚠️ 未加载任何数据书\n\n")
                
                # 处理统计
                f.write("📈 处理统计信息\n")
                f.write("-" * 40 + "\n")
                if processing_details:
                    f.write(f"总处理时间: {processing_details.get('processing_time', 'N/A')}\n")
                    f.write(f"匹配的数据书数量: {processing_details.get('matched_storybooks', 0)}\n")
                    f.write(f"生成的上下文长度: {processing_details.get('total_context_length', 0)} 字符\n")
                else:
                    f.write(f"生成的上下文长度: {len(final_context)} 字符\n")
                f.write("\n")
                
                # 最终传给AI的提示词
                f.write("🤖 传给AI的完整提示词\n")
                f.write("=" * 80 + "\n")
                f.write("以下是实际传给大语言模型的完整上下文内容：\n\n")
                f.write(final_context)
                f.write("\n\n" + "=" * 80 + "\n")
                f.write("📝 提示词结束\n")
                f.write("=" * 80 + "\n")
                
            logger.info(f"详细聊天分析日志已记录到: {log_file}")
            return str(log_file)
            
        except Exception as e:
            logger.error(f"记录聊天分析日志失败: {e}")
            return None

    def record_transmission_to_file(self, role_name: str, user_input: str, 
                                   final_context: str, step1_details: Dict = None,
                                   step2_details: Dict = None, is_fallback: bool = False):
        """
        将传入大语言模型的内容记录到txt文件（简化版，保持向后兼容）
        """
        try:
            # 生成文件名
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"AI输入内容_{role_name}_{timestamp}.txt"
            
            log_file = self.log_dir / filename
            
            # 写入文件（简化版）
            with open(log_file, 'w', encoding='utf-8') as f:
                f.write("=" * 60 + "\n")
                f.write("AI输入内容记录\n")
                f.write("=" * 60 + "\n\n")
                
                f.write(f"角色: {role_name}\n")
                f.write(f"用户输入: {user_input}\n")
                f.write(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"内容长度: {len(final_context)} 字符\n")
                
                # 添加匹配详情
                if step1_details and 'match_details' in step1_details:
                    f.write(f"匹配到的数据书: {len(step1_details['match_details'])} 个\n")
                    for detail in step1_details['match_details']:
                        f.write(f"  - {detail.get('story_name', '')}: {detail.get('relevance_score', 0):.3f}\n")
                
                f.write("\n" + "-" * 60 + "\n")
                f.write("传入AI的完整内容:\n")
                f.write("-" * 60 + "\n\n")
                f.write(final_context)
                
            logger.info(f"内容已记录到文件: {log_file}")
            return str(log_file)
            
        except Exception as e:
            logger.error(f"记录内容到文件失败: {e}")
            return None
    
    def get_recent_logs(self, limit: int = 10) -> List[Dict[str, Any]]:
        """获取最近的日志记录"""
        try:
            log_files = sorted(self.log_dir.glob("AI输入内容_*.txt"), 
                             key=lambda x: x.stat().st_mtime, reverse=True)
            
            recent_logs = []
            for log_file in log_files[:limit]:
                try:
                    stat = log_file.stat()
                    recent_logs.append({
                        'filename': log_file.name,
                        'path': str(log_file),
                        'size': stat.st_size,
                        'modified': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
                    })
                except Exception as e:
                    logger.warning(f"读取日志文件信息失败 {log_file}: {e}")
                    continue
            
            return recent_logs
            
        except Exception as e:
            logger.error(f"获取最近日志失败: {e}")
            return []

# 全局单例
_temp_data_recorder = None

def get_temp_data_recorder() -> TempDataRecorder:
    """获取临时数据记录器单例"""
    global _temp_data_recorder
    if _temp_data_recorder is None:
        try:
            from .config_manager import get_vectorized_config_manager
        except ImportError:
            from config_manager import get_vectorized_config_manager
        config_manager = get_vectorized_config_manager()
        _temp_data_recorder = TempDataRecorder(config_manager)
    return _temp_data_recorder