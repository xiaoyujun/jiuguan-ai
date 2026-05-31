"""
自由事件功能模块
支持多角色自由对话、语义搜索数据书、总结和减负功能
"""
from flask import Blueprint, request, jsonify, render_template
import json
import os
import random
from pathlib import Path
import sys

# 添加项目根目录到Python路径
sys.path.append(str(Path(__file__).parent.parent.parent))

from web.utils import PathManager
from web.history_manager import load_history, save_history
from API import stream_chat_response_with_config, get_model_for_function
from web.vectorized_temp_data.simple_processor import get_simple_processor

event_bp = Blueprint('event', __name__)

@event_bp.route('/free-event')
def free_event_page():
    """显示自由事件页面"""
    return render_template('free_event.html')

@event_bp.route('/api/event/roles', methods=['GET'])
def get_roles():
    """获取所有可用角色"""
    try:
        roles_dir = PathManager.get_roles_dir()
        roles = []
        
        # 遍历角色目录
        for file in os.listdir(roles_dir):
            if file.endswith('.yml') or file.endswith('.yaml'):
                role_name = file.rsplit('.', 1)[0]
                
                # 使用统一的头像路由
                avatar_path = f"/avatar/{role_name}"
                
                roles.append({
                    'name': role_name,
                    'avatar': avatar_path
                })
        
        # 按名称排序
        roles.sort(key=lambda x: x['name'])
        
        return jsonify({'success': True, 'roles': roles})
    except Exception as e:
        print(f"获取角色列表失败: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@event_bp.route('/api/event/players', methods=['GET'])
def get_players():
    """获取所有可用玩家"""
    try:
        players_dir = PathManager.get_players_dir()
        players = []
        
        # 遍历玩家目录
        for file in os.listdir(players_dir):
            if file.endswith('.yml') or file.endswith('.yaml'):
                player_name = file.rsplit('.', 1)[0]
                
                # 跳过当前选择文件
                if player_name == '当前挑选玩家':
                    continue
                
                # 使用统一的头像路由
                avatar_path = f"/avatar/{player_name}"
                
                players.append({
                    'name': player_name,
                    'avatar': avatar_path
                })
        
        # 按名称排序
        players.sort(key=lambda x: x['name'])
        
        print(f"✅ 找到 {len(players)} 个玩家")
        return jsonify({'success': True, 'players': players})
    except Exception as e:
        print(f"❌ 获取玩家列表失败: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@event_bp.route('/api/event/create', methods=['POST'])
def create_event():
    """创建新事件"""
    try:
        data = request.json
        event_name = data.get('event_name', '未命名事件')
        event_description = data.get('event_description', '')
        participants = data.get('participants', [])
        
        if not participants or len(participants) < 2:
            return jsonify({'success': False, 'error': '至少需要选择两个角色'}), 400
        
        # 创建事件数据
        event_data = {
            'event_name': event_name,
            'event_description': event_description,
            'participants': participants,
            'history': [],
            'created_at': None
        }
        
        return jsonify({'success': True, 'event_data': event_data})
    except Exception as e:
        print(f"创建事件失败: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@event_bp.route('/api/event/continue', methods=['POST'])
def continue_event():
    """继续事件对话"""
    try:
        data = request.json
        event_name = data.get('event_name', '未命名事件')
        event_description = data.get('event_description', '')
        participants = data.get('participants', [])
        history = data.get('history', [])
        speak_probabilities = data.get('speak_probabilities', {})
        current_topic = data.get('current_topic', '')  # 当前对话主题
        
        if not participants:
            return jsonify({'success': False, 'error': '没有参与者'}), 400
        
        # 选择下一个说话的角色
        next_speaker = select_next_speaker(participants, speak_probabilities, history)
        
        # 构建提示词（包含主题）
        prompt = build_event_prompt(event_name, event_description, participants, history, next_speaker, current_topic)
        
        # 使用向量化处理器获取相关数据书
        processor = get_simple_processor()
        
        # 获取最近的对话内容用于语义搜索
        recent_messages = [msg['message'] for msg in history[-5:]] if history else []
        search_query = ' '.join(recent_messages) if recent_messages else event_description
        
        context, success, details = processor.process_user_input(
            role_name=next_speaker,
            user_input=search_query,
            include_player_data=False
        )
        
        # 添加上下文到提示词
        if context:
            prompt = f"{context}\n\n{prompt}"
        
        # 调用AI生成回复
        model_config = get_model_for_function('chat')
        response_text = ""
        
        # 构建系统提示词
        system_prompt = f"""你正在参与一个多角色对话事件。

事件名称：{event_name}
事件背景：{event_description if event_description else '自由对话'}

你现在扮演的是：{next_speaker}

请注意：
1. 只输出{next_speaker}说的话，不要包含其他角色的对话
2. 不要添加角色名称前缀，直接输出对话内容
3. 根据事件背景和历史对话，自然地继续对话
4. 保持角色设定和性格一致"""
        
        try:
            # 使用流式响应
            for chunk in stream_chat_response_with_config(prompt, system_prompt, model_config):
                if chunk and isinstance(chunk, str):
                    response_text += chunk
        except Exception as e:
            print(f"生成回复失败: {e}")
            import traceback
            traceback.print_exc()
            response_text = f"[{next_speaker}]：（思考中...）"
        
        # 添加到历史记录
        new_message = {
            'role': next_speaker,
            'message': response_text,
            'timestamp': None
        }
        
        return jsonify({
            'success': True,
            'message': new_message,
            'context_info': details if success else {}
        })
    except Exception as e:
        print(f"继续事件失败: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

def select_next_speaker(participants, speak_probabilities, history):
    """
    选择下一个说话的角色
    
    Args:
        participants: 参与者列表
        speak_probabilities: 说话概率字典 {角色名: 概率}
        history: 历史记录列表
        
    Returns:
        下一个说话的角色名
    """
    # 如果没有设置概率，按顺序选择
    if not speak_probabilities or all(v == 0 for v in speak_probabilities.values()):
        if not history:
            return participants[0]
        
        # 找到上一个说话的角色
        last_speaker = history[-1]['role'] if history else None
        
        # 找到下一个角色
        if last_speaker in participants:
            current_index = participants.index(last_speaker)
            next_index = (current_index + 1) % len(participants)
            return participants[next_index]
        else:
            return participants[0]
    
    # 根据概率随机选择
    total_prob = sum(speak_probabilities.get(p, 1) for p in participants)
    
    if total_prob == 0:
        return random.choice(participants)
    
    rand_val = random.random() * total_prob
    cumulative_prob = 0
    
    for participant in participants:
        prob = speak_probabilities.get(participant, 1)
        cumulative_prob += prob
        if rand_val <= cumulative_prob:
            return participant
    
    return participants[-1]

def build_event_prompt(event_name, event_description, participants, history, next_speaker, current_topic=''):
    """
    构建事件提示词
    
    Args:
        event_name: 事件名称
        event_description: 事件描述
        participants: 参与者列表
        history: 历史记录
        next_speaker: 下一个说话者
        current_topic: 当前对话主题（可选）
        
    Returns:
        提示词字符串
    """
    prompt_parts = []
    
    # 事件信息
    prompt_parts.append(f"=== 事件名称: {event_name} ===")
    if event_description:
        prompt_parts.append(f"事件背景: {event_description}")
    
    # 当前对话主题
    if current_topic:
        prompt_parts.append(f"\n【当前对话主题】: {current_topic}")
        prompt_parts.append("请围绕这个主题继续对话")
    
    # 参与者信息
    prompt_parts.append(f"\n参与角色: {', '.join(participants)}")
    
    # 历史对话
    if history:
        prompt_parts.append("\n=== 对话历史 ===")
        for msg in history[-10:]:  # 只取最近10条
            prompt_parts.append(f"{msg['role']}: {msg['message']}")
    
    # 指示下一个说话者
    instruction = f"\n现在轮到【{next_speaker}】说话。请以{next_speaker}的身份，根据以上对话和事件背景"
    if current_topic:
        instruction += f"，围绕主题「{current_topic}」"
    instruction += f"，自然地继续对话。只输出{next_speaker}说的话，不要包含其他角色的对话。"
    prompt_parts.append(instruction)
    
    return '\n'.join(prompt_parts)

@event_bp.route('/api/event/save', methods=['POST'])
def save_event():
    """保存事件到文件"""
    try:
        data = request.json
        event_name = data.get('event_name', '未命名事件')
        event_data = data.get('event_data', {})
        
        # 创建事件保存目录
        events_dir = PathManager.get_chat_records_dir() / '事件记录'
        events_dir.mkdir(exist_ok=True, parents=True)
        
        # 保存事件文件
        event_file = events_dir / f"{event_name}.json"
        with open(event_file, 'w', encoding='utf-8') as f:
            json.dump(event_data, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 事件已保存: {event_file}")
        return jsonify({'success': True, 'message': f'事件已保存'})
    except Exception as e:
        print(f"❌ 保存事件失败: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@event_bp.route('/api/event/load', methods=['GET'])
def load_event():
    """加载保存的事件"""
    try:
        event_name = request.args.get('name')
        
        if not event_name:
            return jsonify({'success': False, 'error': '未指定事件名称'}), 400
        
        events_dir = PathManager.get_chat_records_dir() / '事件记录'
        event_file = events_dir / f"{event_name}.json"
        
        if not event_file.exists():
            print(f"❌ 事件文件不存在: {event_file}")
            return jsonify({'success': False, 'error': '事件文件不存在'}), 404
        
        with open(event_file, 'r', encoding='utf-8') as f:
            event_data = json.load(f)
        
        print(f"✅ 事件已加载: {event_name}")
        return jsonify({'success': True, 'event_data': event_data})
    except Exception as e:
        print(f"❌ 加载事件失败: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@event_bp.route('/api/event/list', methods=['GET'])
def list_events():
    """列出所有保存的事件"""
    try:
        events_dir = PathManager.get_chat_records_dir() / '事件记录'
        
        if not events_dir.exists():
            print(f"📂 事件记录目录不存在，返回空列表")
            return jsonify({'success': True, 'events': []})
        
        events = []
        for file in events_dir.glob('*.json'):
            events.append(file.stem)
        
        # 按名称排序
        events.sort()
        
        print(f"📋 找到 {len(events)} 个保存的事件")
        return jsonify({'success': True, 'events': events})
    except Exception as e:
        print(f"❌ 列出事件失败: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

