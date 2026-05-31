# 深入调试关键词连接度计算
import sys
sys.path.append('web')
sys.path.append('web/vectorized_temp_data')

from vector_search_engine import VectorSearchEngine
from pathlib import Path
from web.utils import PathManager
import json

class MockConfig:
    def get_current_storybook_dir(self):
        return PathManager.get_storybook_dir()

engine = VectorSearchEngine(MockConfig())

user_input = '这人主要特点是什么'
role_name = 'Mel'

# 手动计算关键词连接度
normalized_query = engine._normalize_text(user_input)
query_words = engine._extract_keywords(normalized_query)
semantic_words = engine._expand_semantic_keywords(query_words, role_name)
all_words = query_words + semantic_words

# 获取Jade内容
test_file = PathManager.get_storybook_dir() / 'Jade.json'
with open(test_file, 'r', encoding='utf-8') as f:
    story_data = json.load(f)

content_text = engine._serialize_content(story_data)
normalized_content = engine._normalize_text(content_text)

print('=== 详细匹配分析 ===')
print(f'查询关键词({len(query_words)}): {query_words}')
print(f'语义扩展词({len(semantic_words)}): {semantic_words}')
print(f'总词数: {len(all_words)}')
print()

# 获取聊天关键词权重
chat_keywords_weights = engine._extract_chat_keywords(role_name)
print(f'聊天关键词权重: {chat_keywords_weights}')
print()

matched_words = 0
semantic_matched_words = 0
chat_weighted_score = 0.0

print('匹配详情:')
for word in all_words:
    if len(word) >= 2 and word in normalized_content:
        if word in query_words:
            matched_words += 1
            match_type = '直接匹配'
        else:
            semantic_matched_words += 1
            match_type = '语义匹配'
        
        # 检查聊天权重
        weight_info = ''
        if word in chat_keywords_weights:
            weight = chat_keywords_weights[word]
            chat_weighted_score += weight
            weight_info = f' (聊天权重: {weight:.2f})'
        
        print(f'  ✓ {match_type}: "{word}"{weight_info}')

total_words = len(query_words)
basic_match_ratio = matched_words / total_words if total_words > 0 else 0.0
semantic_bonus = min(0.2, semantic_matched_words * 0.1)

# 时间权重加成
time_weight_bonus = 0.0
if chat_weighted_score > 0:
    matched_chat_words = [w for w in all_words if w in chat_keywords_weights and len(w) >= 2 and w in normalized_content]
    if matched_chat_words:
        avg_weight = chat_weighted_score / len(matched_chat_words)
        if avg_weight >= 1.0:
            time_weight_bonus = 0.3
        elif avg_weight >= 0.8:
            time_weight_bonus = 0.2
        elif avg_weight >= 0.5:
            time_weight_bonus = 0.1

final_connection = min(1.0, basic_match_ratio + semantic_bonus + time_weight_bonus)

print(f'\n=== 计算结果 ===')
print(f'直接匹配: {matched_words}/{total_words} = {basic_match_ratio:.3f}')
print(f'语义匹配: {semantic_matched_words} 个, 加成: {semantic_bonus:.3f}')
print(f'聊天权重总分: {chat_weighted_score:.3f}')
print(f'时间权重加成: {time_weight_bonus:.3f}')
print(f'最终连接度: {basic_match_ratio:.3f} + {semantic_bonus:.3f} + {time_weight_bonus:.3f} = {final_connection:.6f}')
