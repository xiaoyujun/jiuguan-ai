"""
语义搜索API路由
提供智能语义搜索功能的REST API接口和页面
"""

from flask import Blueprint, request, jsonify, render_template
import logging
import time
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

# 创建蓝图
semantic_search_bp = Blueprint('semantic_search', __name__)

def get_semantic_api():
    """获取语义搜索API实例"""
    try:
        from web.vectorized_temp_data import (
            smart_search, fuzzy_search, name_search, tolerant_search,
            precise_search, tiered_search, search_by_category,
            get_engine_status
        )
        return {
            'smart_search': smart_search,
            'fuzzy_search': fuzzy_search,
            'name_search': name_search,
            'tolerant_search': tolerant_search,
            'precise_search': precise_search,
            'tiered_search': tiered_search,
            'search_by_category': search_by_category,
            'get_engine_status': get_engine_status
        }
    except Exception as e:
        logger.error(f"语义搜索API初始化失败: {e}")
        raise

# 页面路由
@semantic_search_bp.route('/semantic-search')
def semantic_search_page():
    """语义搜索页面"""
    return render_template('semantic_search.html')

@semantic_search_bp.route('/test-smart-narrator')
def test_smart_narrator_page():
    """智能旁白角色@功能测试页面"""
    return render_template('test_smart_narrator.html')

# API路由
@semantic_search_bp.route('/api/semantic/search', methods=['POST'])
def api_semantic_search():
    """
    智能语义搜索API
    
    POST /api/semantic/search
    {
        "query": "一个喜欢跑步的女生",
        "max_results": 5,
        "search_type": "smart"  // smart, fuzzy, name, tolerant, precise
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': '请求数据为空'}), 400
        
        query = data.get('query', '').strip()
        if not query:
            return jsonify({'success': False, 'error': '查询内容不能为空'}), 400
        
        max_results = data.get('max_results', 5)
        search_type = data.get('search_type', 'smart')
        
        # 获取语义搜索API
        api = get_semantic_api()
        
        # 根据搜索类型调用对应函数
        if search_type == 'smart':
            results = api['smart_search'](query, max_results)
        elif search_type == 'fuzzy':
            results = api['fuzzy_search'](query, max_results)
        elif search_type == 'name':
            results = api['name_search'](query, max_results)
        elif search_type == 'tolerant':
            results = api['tolerant_search'](query, max_results)
        elif search_type == 'precise':
            results = api['precise_search'](query, max_results)
        else:
            return jsonify({'success': False, 'error': f'不支持的搜索类型: {search_type}'}), 400
        
        return jsonify({
            'success': True,
            'query': query,
            'search_type': search_type,
            'results_count': len(results),
            'results': results
        })
        
    except Exception as e:
        logger.error(f"语义搜索失败: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@semantic_search_bp.route('/api/semantic/tiered-search', methods=['POST'])
def api_tiered_search():
    """
    分层语义搜索API
    根据相关度返回不同详细程度的数据
    
    POST /api/semantic/tiered-search
    {
        "query": "运动女生",
        "max_results": 5
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': '请求数据为空'}), 400
        
        query = data.get('query', '').strip()
        if not query:
            return jsonify({'success': False, 'error': '查询内容不能为空'}), 400
        
        max_results = data.get('max_results', 5)
        
        # 获取语义搜索API
        api = get_semantic_api()
        results = api['tiered_search'](query, max_results)
        
        return jsonify({
            'success': True,
            'query': query,
            'search_type': 'tiered',
            'results_count': len(results),
            'results': results
        })
        
    except Exception as e:
        logger.error(f"分层搜索失败: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@semantic_search_bp.route('/api/semantic/category-search', methods=['POST'])
def api_category_search():
    """
    按类别语义搜索API
    
    POST /api/semantic/category-search
    {
        "query": "田径健将",
        "category": "female",  // female, sports, athlete, student, artist, etc.
        "max_results": 5
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': '请求数据为空'}), 400
        
        query = data.get('query', '').strip()
        if not query:
            return jsonify({'success': False, 'error': '查询内容不能为空'}), 400
        
        category = data.get('category', '').strip()
        if not category:
            return jsonify({'success': False, 'error': '类别不能为空'}), 400
        
        max_results = data.get('max_results', 5)
        
        # 获取语义搜索API
        api = get_semantic_api()
        results = api['search_by_category'](query, category, max_results)
        
        return jsonify({
            'success': True,
            'query': query,
            'category': category,
            'search_type': 'category',
            'results_count': len(results),
            'results': results
        })
        
    except Exception as e:
        logger.error(f"分类搜索失败: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@semantic_search_bp.route('/api/semantic/multi-search', methods=['POST'])
def api_multi_search():
    """
    多查询语义搜索API
    
    POST /api/semantic/multi-search
    {
        "queries": ["一个喜欢跑步的女生", "艺术家角色", "学生角色"],
        "max_results": 3
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': '请求数据为空'}), 400
        
        queries = data.get('queries', [])
        if not queries or not isinstance(queries, list):
            return jsonify({'success': False, 'error': '查询列表不能为空'}), 400
        
        max_results = data.get('max_results', 3)
        
        # 获取语义搜索API
        api = get_semantic_api()
        
        # 执行多个搜索
        results = {}
        for query in queries:
            if query and query.strip():
                results[query] = api['smart_search'](query.strip(), max_results)
        
        return jsonify({
            'success': True,
            'queries': queries,
            'search_type': 'multi',
            'results': results
        })
        
    except Exception as e:
        logger.error(f"多查询搜索失败: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@semantic_search_bp.route('/api/semantic/smart-role-selection', methods=['POST'])
def api_smart_role_selection():
    """
    智能角色选择API - 用于旁白角色的自动@功能
    
    POST /api/semantic/smart-role-selection
    {
        "message": "你好啊",
        "bound_roles": ["Elena", "Jade", "Luna"],
        "chat_history": ["Elena: 大家好", "Jade: 今天天气很好"],
        "max_results": 1
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': '请求数据为空'}), 400
        
        message = data.get('message', '').strip()
        bound_roles = data.get('bound_roles', [])
        chat_history = data.get('chat_history', [])
        max_results = data.get('max_results', 1)
        
        if not message:
            return jsonify({'success': False, 'error': '消息内容不能为空'}), 400
        
        if not bound_roles:
            return jsonify({'success': False, 'error': '捆绑角色列表不能为空'}), 400
        
        # 调用智能角色选择逻辑
        result = smart_narrator_role_selection(message, bound_roles, chat_history, max_results)
        
        return jsonify({
            'success': True,
            'message': message,
            'bound_roles': bound_roles,
            'selection_result': result
        })
        
    except Exception as e:
        logger.error(f"智能角色选择失败: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def smart_narrator_role_selection(message: str, bound_roles: List[str], chat_history: List[str], max_results: int = 1) -> Dict[str, Any]:
    """
    智能旁白角色选择逻辑
    
    Args:
        message: 玩家消息内容
        bound_roles: 捆绑的角色列表
        chat_history: 聊天历史记录
        max_results: 返回结果数量
        
    Returns:
        选择结果字典
    """
    import time
    
    try:
        start_time = time.time()
        
        # 初始化变量
        context_analysis = None
        search_time = 0.0
        history_time = 0.0
        
        # 获取语义搜索API
        api = get_semantic_api()
        
        # 1. 基于消息内容的语义搜索
        search_start = time.time()
        content_results = api['smart_search'](message, len(bound_roles))
        search_time = time.time() - search_start
        logger.info(f"⏱️ 语义搜索耗时: {search_time:.3f}秒")
        
        # 2. 基于聊天历史的相关度分析
        history_start = time.time()
        history_relevance = analyze_chat_history_relevance(bound_roles, chat_history)
        history_time = time.time() - history_start
        logger.info(f"⏱️ 历史分析耗时: {history_time:.3f}秒")
        
        # 3. 计算综合得分
        role_scores = {}
        
        # 消息内容相关度得分 (权重: 0.7)
        content_scores = {}
        for result in content_results:
            role_key = result.get('key', '')
            role_name = result.get('name', role_key)
            if role_name in bound_roles or role_key in bound_roles:
                # 使用角色名称或key匹配
                matched_role = role_name if role_name in bound_roles else role_key
                content_scores[matched_role] = result.get('score', 0.0)
        
        # 聊天历史相关度得分 (权重: 0.3)
        for role in bound_roles:
            content_score = content_scores.get(role, 0.0) * 0.7
            history_score = history_relevance.get(role, 0.0) * 0.3
            role_scores[role] = content_score + history_score
        
        # 4. 基于相关度的概率选择
        if not role_scores or max(role_scores.values()) == 0:
            # 如果所有得分都是0，使用随机选择
            import random
            selected_role = random.choice(bound_roles)
            selection_method = "random"
            final_score = 0.0
            selection_probability = 1.0 / len(bound_roles)
            logger.info(f"🎲 智能选择: 所有相关度为0，随机选择 {selected_role}")
        else:
            # 基于相关度的概率选择，考虑连续性
            selected_role, final_score, selection_probability, probabilities = probabilistic_role_selection(
                role_scores, 
                max_probability=0.89,
                bound_roles=bound_roles,
                message=message,
                chat_history=chat_history
            )
            selection_method = "probabilistic"
            logger.info(f"🎯 概率选择: 选择 {selected_role} (得分: {final_score:.3f}, 概率: {selection_probability:.1%})")
        
        # 构建返回结果
        result = {
            'selected_role': selected_role,
            'selection_method': selection_method,
            'final_score': round(final_score, 3),
            'role_scores': {k: round(v, 3) for k, v in role_scores.items()},
            'content_scores': {k: round(v, 3) for k, v in content_scores.items()},
            'history_relevance': {k: round(v, 3) for k, v in history_relevance.items()},
            'debug_info': {
                'message_analyzed': message,
                'bound_roles_count': len(bound_roles),
                'history_entries_count': len(chat_history),
                'content_search_results': len(content_results)
            }
        }
        
        # 如果是概率选择，添加概率信息
        if selection_method == "probabilistic":
            result['selection_probability'] = round(selection_probability, 3)
            result['role_probabilities'] = {k: round(v, 3) for k, v in probabilities.items()}
        elif selection_method == "random":
            result['selection_probability'] = round(selection_probability, 3)
            result['role_probabilities'] = {role: round(1.0/len(bound_roles), 3) for role in bound_roles}
        
        # 添加总耗时和上下文信息
        total_time = time.time() - start_time
        result['debug_info']['total_processing_time'] = round(total_time, 3)
        result['debug_info']['search_time'] = round(search_time, 3)
        result['debug_info']['history_time'] = round(history_time, 3)
        
        # 添加上下文分析结果
        if context_analysis:
            result['context_analysis'] = {
                'message_type': context_analysis.get('message_type', 'neutral'),
                'topic_continuity': round(context_analysis.get('topic_continuity', 0.0), 3),
                'last_speaker': context_analysis.get('last_speaker'),
                'role_activity': {k: round(v['recent_weight'], 2) for k, v in context_analysis.get('role_activity', {}).items()}
            }
        
        # 记录选择结果用于学习优化
        record_selection_result(message, bound_roles, selected_role, result)
        
        logger.info(f"⏱️ 总处理耗时: {total_time:.3f}秒")
        
        return result
        
    except Exception as e:
        logger.error(f"智能角色选择逻辑失败: {e}")
        # 降级到随机选择
        import random
        return {
            'selected_role': random.choice(bound_roles) if bound_roles else None,
            'selection_method': "fallback_random",
            'final_score': 0.0,
            'error': str(e)
        }

def probabilistic_role_selection(role_scores: Dict[str, float], max_probability: float = 0.89, 
                                bound_roles: List[str] = None, message: str = "", 
                                chat_history: List[str] = None) -> tuple:
    """
    基于相关度的概率选择算法 - 增强版
    
    Args:
        role_scores: 角色得分字典
        max_probability: 最高角色的最大选择概率
        bound_roles: 捆绑角色列表
        message: 玩家消息
        chat_history: 聊天历史
        
    Returns:
        tuple: (selected_role, final_score, selection_probability, all_probabilities)
    """
    import random
    import math
    import re
    
    if not role_scores:
        return None, 0.0, 0.0, {}
    
    # 获取所有角色和得分
    roles = list(role_scores.keys())
    scores = list(role_scores.values())
    
    # 1. 增强版角色提及检测
    mention_result = detect_role_mention(message, bound_roles or roles)
    if mention_result['mentioned_role']:
        mentioned_role = mention_result['mentioned_role']
        confidence = mention_result['confidence']
        mention_type = mention_result['mention_type']
        
        logger.info(f"🎯 检测到角色提及: {mentioned_role} (置信度: {confidence:.2f}, 类型: {mention_type})")
        
        # 根据置信度动态调整概率
        mention_probability = 0.6 + (confidence - 0.6) * 0.5  # 0.6-0.85范围
        other_probability = (1.0 - mention_probability) / (len(roles) - 1)
        
        probabilities = {role: other_probability if role != mentioned_role else mention_probability for role in roles}
        selected_role = weighted_random_choice(probabilities)
        
        return selected_role, role_scores[selected_role], probabilities[selected_role], probabilities
    
    # 2. 增强版对话上下文分析
    context_analysis = analyze_conversation_context(chat_history, bound_roles or roles, message)
    
    # 获取所有角色和得分
    roles = list(role_scores.keys())
    scores = list(role_scores.values())
    
    # 3. 智能连续性判断
    max_score = max(scores)
    continuity_role = context_analysis['suggested_continuity_role']
    continuity_confidence = context_analysis['continuity_confidence']
    message_type = context_analysis['message_type']
    
    # 如果相关度低且有合适的连续性角色
    if max_score <= 0.15 and continuity_role and continuity_role in roles and continuity_confidence > 0.4:
        logger.info(f"🔄 智能连续性: {continuity_role} (置信度: {continuity_confidence:.2f}, 消息类型: {message_type})")
        
        # 根据连续性置信度动态调整概率
        continuity_probability = 0.4 + continuity_confidence * 0.4  # 0.4-0.8范围
        other_probability = (1.0 - continuity_probability) / (len(roles) - 1)
        
        probabilities = {role: other_probability if role != continuity_role else continuity_probability for role in roles}
        selected_role = weighted_random_choice(probabilities)
        
        return selected_role, role_scores[selected_role], probabilities[selected_role], probabilities
    
    # 确保所有得分为正数（加上最小偏移量）
    min_score = min(scores)
    if min_score <= 0:
        adjusted_scores = [score - min_score + 0.01 for score in scores]
    else:
        adjusted_scores = scores
    
    # 使用softmax函数计算概率，但限制最高概率
    # 先计算原始softmax概率
    max_adjusted_score = max(adjusted_scores)
    exp_scores = [math.exp(score - max_adjusted_score) for score in adjusted_scores]
    sum_exp_scores = sum(exp_scores)
    raw_probabilities = [exp_score / sum_exp_scores for exp_score in exp_scores]
    
    # 找到最高概率的索引
    max_prob_index = raw_probabilities.index(max(raw_probabilities))
    max_raw_prob = raw_probabilities[max_prob_index]
    
    # 动态调整最高概率限制
    # 根据对话上下文动态调整概率上限
    dynamic_max_prob = max_probability
    
    # 如果有强烈的上下文指示，可以适当提高概率上限
    if 'context_analysis' in locals():
        topic_continuity = context_analysis.get('topic_continuity', 0.0)
        if topic_continuity > 0.5:  # 主题连贯性高
            dynamic_max_prob = min(0.95, max_probability + 0.05)
            logger.info(f"📈 主题连贯性高 ({topic_continuity:.2f})，提高概率上限至 {dynamic_max_prob:.2f}")
    
    # 如果最高概率超过动态限制，进行调整
    if max_raw_prob > dynamic_max_prob:
        # 计算需要重新分配的概率
        excess_prob = max_raw_prob - dynamic_max_prob
        
        # 将最高概率设为动态限制值
        adjusted_probabilities = raw_probabilities.copy()
        adjusted_probabilities[max_prob_index] = dynamic_max_prob
        
        # 将多余的概率按比例分配给其他角色
        other_indices = [i for i in range(len(adjusted_probabilities)) if i != max_prob_index]
        if other_indices:
            total_other_prob = sum(adjusted_probabilities[i] for i in other_indices)
            if total_other_prob > 0:
                # 按原有比例重新分配
                redistribution_factor = (1.0 - dynamic_max_prob) / total_other_prob
                for i in other_indices:
                    adjusted_probabilities[i] *= redistribution_factor
            else:
                # 如果其他角色概率为0，平均分配
                avg_prob = excess_prob / len(other_indices)
                for i in other_indices:
                    adjusted_probabilities[i] = avg_prob
        
        final_probabilities = adjusted_probabilities
    else:
        final_probabilities = raw_probabilities
    
    # 创建概率字典
    probabilities = {roles[i]: final_probabilities[i] for i in range(len(roles))}
    
    # 根据概率选择角色
    rand_value = random.random()
    cumulative_prob = 0.0
    selected_role = roles[-1]  # 默认选择最后一个角色
    
    for i, role in enumerate(roles):
        cumulative_prob += final_probabilities[i]
        if rand_value <= cumulative_prob:
            selected_role = role
            break
    
    final_score = role_scores[selected_role]
    selection_probability = probabilities[selected_role]
    
    return selected_role, final_score, selection_probability, probabilities

def detect_role_mention(message: str, roles: List[str]) -> Dict[str, Any]:
    """
    增强版角色提及检测 - 支持多种提及方式和置信度评估
    
    Args:
        message: 玩家消息
        roles: 角色列表
        
    Returns:
        Dict: {
            'mentioned_role': str,     # 被提及的角色名
            'confidence': float,       # 置信度 (0.0-1.0)
            'mention_type': str,       # 提及类型
            'context': str            # 上下文信息
        }
    """
    import re
    
    message_lower = message.lower()
    best_match = {'mentioned_role': None, 'confidence': 0.0, 'mention_type': 'none', 'context': ''}
    
    for role in roles:
        role_lower = role.lower()
        confidence = 0.0
        mention_type = 'none'
        context = ''
        
        # 1. 直接提及 (最高置信度)
        direct_patterns = [
            rf'\b{re.escape(role_lower)}\b',  # 完整角色名
            rf'^{re.escape(role_lower)}[，,：:]',  # 开头+标点
            rf'@{re.escape(role_lower)}\b',   # @提及
            rf'找{re.escape(role_lower)}\b',   # "找Elena"
            rf'叫{re.escape(role_lower)}\b',   # "叫Elena"
        ]
        
        for i, pattern in enumerate(direct_patterns):
            if re.search(pattern, message_lower):
                confidence = 0.95 - i * 0.05  # 递减置信度
                mention_type = ['direct', 'addressing', 'at_mention', 'seeking', 'calling'][i]
                context = f"直接提及: {pattern}"
                break
        
        # 2. 间接提及 (中等置信度)
        if confidence == 0.0:
            indirect_patterns = [
                rf'{re.escape(role_lower)}.*?怎么样',  # "Elena怎么样"
                rf'和{re.escape(role_lower)}.*?聊',    # "和Elena聊"
                rf'{re.escape(role_lower)}.*?在.*?吗', # "Elena在吗"
                rf'问.*?{re.escape(role_lower)}',      # "问Elena"
                rf'告诉.*?{re.escape(role_lower)}',    # "告诉Elena"
            ]
            
            for i, pattern in enumerate(indirect_patterns):
                if re.search(pattern, message_lower):
                    confidence = 0.75 - i * 0.05
                    mention_type = 'indirect'
                    context = f"间接提及: {pattern}"
                    break
        
        # 3. 模糊提及 (较低置信度)
        if confidence == 0.0:
            fuzzy_patterns = [
                rf'{re.escape(role_lower[:-1])}',  # 角色名前缀
                rf'{re.escape(role_lower[-3:])}' if len(role_lower) > 3 else rf'{re.escape(role_lower)}',  # 后缀
            ]
            
            for i, pattern in enumerate(fuzzy_patterns):
                if len(pattern) > 2 and re.search(pattern, message_lower):
                    confidence = 0.4 - i * 0.1
                    mention_type = 'fuzzy'
                    context = f"模糊提及: {pattern}"
                    break
        
        # 更新最佳匹配
        if confidence > best_match['confidence']:
            best_match = {
                'mentioned_role': role,
                'confidence': confidence,
                'mention_type': mention_type,
                'context': context
            }
    
    # 只有置信度超过阈值才返回结果
    if best_match['confidence'] >= 0.6:
        return best_match
    else:
        return {'mentioned_role': None, 'confidence': 0.0, 'mention_type': 'none', 'context': ''}

def analyze_conversation_context(chat_history: List[str], roles: List[str], message: str) -> Dict[str, Any]:
    """
    增强版对话上下文分析 - 分析对话流程、主题连贯性和角色活跃度
    
    Args:
        chat_history: 聊天历史
        roles: 角色列表  
        message: 当前消息
        
    Returns:
        Dict: 上下文分析结果
    """
    if not chat_history:
        return {
            'last_speaker': None,
            'conversation_flow': [],
            'topic_continuity': 0.0,
            'role_activity': {},
            'suggested_continuity_role': None,
            'continuity_confidence': 0.0
        }
    
    # 1. 分析最近的对话流程
    conversation_flow = []
    role_activity = {role: {'count': 0, 'recent_weight': 0.0} for role in roles}
    
    for i, msg in enumerate(reversed(chat_history[-10:])):  # 分析最近10条消息
        weight = 1.0 / (i + 1)  # 越近的消息权重越高
        
        for role in roles:
            if msg.startswith(f"{role}:"):
                conversation_flow.append(role)
                role_activity[role]['count'] += 1
                role_activity[role]['recent_weight'] += weight
                break
    
    last_speaker = conversation_flow[0] if conversation_flow else None
    
    # 2. 分析消息类型和期望的回应者
    message_lower = message.lower()
    response_indicators = {
        'agreement': ['好的', '嗯', '是的', '对', '没错', '同意'],
        'question_back': ['那你呢', '你觉得', '你说呢', '怎么办'],
        'continuation': ['然后', '接下来', '继续', '还有'],
        'gratitude': ['谢谢', '感谢', '多谢'],
        'confusion': ['什么', '为什么', '怎么', '不懂', '不明白']
    }
    
    message_type = 'neutral'
    for msg_type, indicators in response_indicators.items():
        if any(indicator in message_lower for indicator in indicators):
            message_type = msg_type
            break
    
    # 3. 计算主题连贯性
    topic_continuity = 0.0
    if len(chat_history) >= 2:
        # 简单的主题连贯性：检查关键词重复
        recent_messages = ' '.join(chat_history[-3:]).lower()
        current_words = set(message_lower.split())
        recent_words = set(recent_messages.split())
        
        if current_words and recent_words:
            intersection = current_words.intersection(recent_words)
            topic_continuity = len(intersection) / max(len(current_words), len(recent_words))
    
    # 4. 确定建议的连续性角色和置信度
    suggested_role = None
    continuity_confidence = 0.0
    
    if last_speaker:
        base_confidence = 0.6
        
        # 根据消息类型调整置信度
        type_adjustments = {
            'agreement': 0.8,      # 同意类消息，很可能继续对话
            'question_back': 0.3,  # 反问，可能需要其他角色
            'continuation': 0.9,   # 继续类消息，强烈倾向于同一角色
            'gratitude': 0.7,      # 感谢，适度倾向于继续
            'confusion': 0.5,      # 困惑，可能需要解释
            'neutral': 0.6         # 中性消息
        }
        
        continuity_confidence = type_adjustments.get(message_type, 0.6)
        
        # 考虑角色最近活跃度
        if last_speaker in role_activity:
            recent_weight = role_activity[last_speaker]['recent_weight']
            if recent_weight > 2.0:  # 最近很活跃
                continuity_confidence += 0.1
            elif recent_weight < 0.5:  # 最近不活跃
                continuity_confidence -= 0.1
        
        # 考虑主题连贯性
        continuity_confidence += topic_continuity * 0.2
        
        # 限制在合理范围内
        continuity_confidence = max(0.2, min(0.9, continuity_confidence))
        suggested_role = last_speaker
    
    return {
        'last_speaker': last_speaker,
        'conversation_flow': conversation_flow,
        'topic_continuity': topic_continuity,
        'role_activity': role_activity,
        'suggested_continuity_role': suggested_role,
        'continuity_confidence': continuity_confidence,
        'message_type': message_type
    }

def weighted_random_choice(probabilities: Dict[str, float]) -> str:
    """
    基于概率进行加权随机选择
    
    Args:
        probabilities: 角色概率字典
        
    Returns:
        str: 选中的角色名
    """
    import random
    
    roles = list(probabilities.keys())
    weights = list(probabilities.values())
    
    # 累积概率选择
    rand_value = random.random()
    cumulative_prob = 0.0
    
    for role, prob in probabilities.items():
        cumulative_prob += prob
        if rand_value <= cumulative_prob:
            return role
    
    # 备用选择（理论上不应该到达这里）
    return roles[-1]

def analyze_chat_history_relevance(bound_roles: List[str], chat_history: List[str]) -> Dict[str, float]:
    """
    分析聊天历史中各角色的相关度
    
    Args:
        bound_roles: 捆绑角色列表
        chat_history: 聊天历史记录
        
    Returns:
        角色相关度字典
    """
    relevance_scores = {role: 0.0 for role in bound_roles}
    
    if not chat_history:
        return relevance_scores
    
    # 分析最近的聊天记录（最多分析最近10条）
    recent_history = chat_history[-10:] if len(chat_history) > 10 else chat_history
    
    for i, message in enumerate(reversed(recent_history)):
        # 越近的消息权重越高
        weight = 1.0 / (i + 1)
        
        # 检查消息中是否提到某个角色
        for role in bound_roles:
            if role in message:
                relevance_scores[role] += weight * 0.5
        
        # 检查消息是否由某个角色发出
        for role in bound_roles:
            if message.startswith(f"{role}:"):
                relevance_scores[role] += weight * 0.3
    
    # 归一化得分
    max_score = max(relevance_scores.values()) if relevance_scores.values() else 1.0
    if max_score > 0:
        relevance_scores = {k: v / max_score for k, v in relevance_scores.items()}
    
    return relevance_scores

def record_selection_result(message: str, bound_roles: List[str], selected_role: str, result: Dict[str, Any]):
    """
    记录选择结果用于学习优化 - 简化版本
    
    Args:
        message: 原始消息
        bound_roles: 捆绑角色列表
        selected_role: 选择的角色
        result: 完整结果
    """
    try:
        # 简化的学习记录，只记录关键信息
        learning_record = {
            'timestamp': time.time(),
            'message_length': len(message),
            'message_type': result.get('context_analysis', {}).get('message_type', 'neutral'),
            'selection_method': result.get('selection_method', 'unknown'),
            'selected_role': selected_role,
            'selection_probability': result.get('selection_probability', 0.0),
            'bound_roles_count': len(bound_roles),
            'processing_time': result.get('debug_info', {}).get('total_processing_time', 0.0)
        }
        
        # 可以在这里添加更复杂的学习逻辑
        # 比如记录到文件、数据库或内存中，用于后续分析和优化
        logger.debug(f"📚 学习记录: {learning_record}")
        
    except Exception as e:
        logger.warning(f"记录学习数据失败: {e}")

@semantic_search_bp.route('/api/semantic/suggestions', methods=['GET'])
def api_search_suggestions():
    """
    搜索建议API
    
    GET /api/semantic/suggestions?q=partial_query&limit=5
    """
    try:
        partial_query = request.args.get('q', '').strip()
        if not partial_query:
            return jsonify({'success': False, 'error': '查询参数不能为空'}), 400
        
        limit = int(request.args.get('limit', 5))
        
        # 简单的搜索建议逻辑
        suggestions = []
        
        # 基于常见搜索模式生成建议
        common_patterns = [
            f"喜欢{partial_query}的角色",
            f"{partial_query}类型的角色",
            f"擅长{partial_query}的角色",
            f"{partial_query}风格的角色",
            f"具有{partial_query}特征的角色"
        ]
        
        # 性别相关建议
        if any(keyword in partial_query for keyword in ['女', '男', 'girl', 'boy', 'woman', 'man']):
            if '女' in partial_query or 'girl' in partial_query or 'woman' in partial_query:
                suggestions.extend([
                    f"{partial_query}角色",
                    f"阳光开朗的{partial_query}",
                    f"运动型{partial_query}"
                ])
        
        # 运动相关建议
        if any(keyword in partial_query for keyword in ['运动', '跑', '田径', 'sport', 'run']):
            suggestions.extend([
                f"{partial_query}员",
                f"喜欢{partial_query}的女生",
                f"{partial_query}健将"
            ])
        
        # 职业相关建议
        if any(keyword in partial_query for keyword in ['学生', '艺术', '冒险', 'student', 'artist', 'adventurer']):
            suggestions.extend([
                f"{partial_query}角色",
                f"年轻的{partial_query}",
                f"有才华的{partial_query}"
            ])
        
        # 去重并限制数量
        suggestions = list(set(suggestions + common_patterns))[:limit]
        
        return jsonify({
            'success': True,
            'query': partial_query,
            'suggestions': suggestions
        })
        
    except Exception as e:
        logger.error(f"获取搜索建议失败: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@semantic_search_bp.route('/api/semantic/status', methods=['GET'])
def api_engine_status():
    """
    搜索引擎状态API
    
    GET /api/semantic/status
    """
    try:
        # 获取语义搜索API
        api = get_semantic_api()
        status = api['get_engine_status']()
        
        return jsonify({
            'success': True,
            'status': status
        })
        
    except Exception as e:
        logger.error(f"获取引擎状态失败: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@semantic_search_bp.route('/api/semantic/test', methods=['GET'])
def api_test_search():
    """
    测试语义搜索功能
    
    GET /api/semantic/test
    """
    try:
        # 获取语义搜索API
        api = get_semantic_api()
        
        # 执行测试搜索
        test_query = "一个喜欢跑步的女生"
        results = api['smart_search'](test_query, 3)
        
        return jsonify({
            'success': True,
            'test_query': test_query,
            'results_count': len(results),
            'results': results,
            'message': '语义搜索功能正常'
        })
        
    except Exception as e:
        logger.error(f"测试搜索失败: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# 错误处理
@semantic_search_bp.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'error': '接口不存在'}), 404

@semantic_search_bp.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'error': '服务器内部错误'}), 500
