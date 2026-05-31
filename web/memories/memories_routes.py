"""
纪念与回顾功能路由
支持保存聊天记录片段、上传图片、添加描述等
"""
from flask import Blueprint, render_template, request, jsonify, send_from_directory
from pathlib import Path
import json
import os
import time
from datetime import datetime
from werkzeug.utils import secure_filename
import shutil

# 导入工具模块
import sys
sys.path.append(str(Path(__file__).parent.parent.parent))
from web.utils import PathManager
from web.history_manager import load_history

memories_bp = Blueprint('memories', __name__, url_prefix='/memories')

# 纪念目录路径
MEMORIES_DIR = PathManager.get_chat_records_dir() / "纪念"
MEMORIES_IMAGES_DIR = MEMORIES_DIR / "images"

# 确保目录存在
MEMORIES_DIR.mkdir(parents=True, exist_ok=True)
MEMORIES_IMAGES_DIR.mkdir(parents=True, exist_ok=True)

# 允许的图片格式
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'}

def allowed_file(filename):
    """检查文件扩展名是否允许"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_memories_index_path():
    """获取纪念索引文件路径"""
    return MEMORIES_DIR / "index.json"

def load_memories_index():
    """加载纪念索引"""
    index_path = get_memories_index_path()
    if index_path.exists():
        try:
            with open(index_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"加载纪念索引失败: {e}")
            return []
    return []

def save_memories_index(index_data):
    """保存纪念索引"""
    index_path = get_memories_index_path()
    try:
        with open(index_path, 'w', encoding='utf-8') as f:
            json.dump(index_data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"保存纪念索引失败: {e}")
        return False

@memories_bp.route('/page')
def memories_page():
    """纪念创建页面"""
    return render_template('memories.html')

@memories_bp.route('/review')
def review_page():
    """回顾查看页面"""
    return render_template('review.html')

@memories_bp.route('/api/create', methods=['POST'])
def create_memory():
    """创建新纪念"""
    try:
        # 获取表单数据
        title = request.form.get('title', '').strip()
        description = request.form.get('description', '').strip()
        role_name = request.form.get('role_name', '').strip()
        message_count = int(request.form.get('message_count', 5))
        
        if not title:
            return jsonify({'success': False, 'error': '请输入纪念标题'}), 400
        
        if not role_name:
            return jsonify({'success': False, 'error': '请选择角色'}), 400
        
        # 获取最近的聊天记录
        try:
            history = load_history(role_name, apply_limits=False)
            # 获取最后N条消息
            recent_messages = history[-message_count:] if len(history) >= message_count else history
        except Exception as e:
            print(f"加载聊天记录失败: {e}")
            return jsonify({'success': False, 'error': f'加载聊天记录失败: {str(e)}'}), 500
        
        # 处理上传的图片
        image_filename = None
        if 'image' in request.files:
            file = request.files['image']
            if file and file.filename and allowed_file(file.filename):
                # 生成唯一文件名
                timestamp = int(time.time() * 1000)
                ext = file.filename.rsplit('.', 1)[1].lower()
                image_filename = f"{timestamp}_{secure_filename(file.filename)}"
                image_path = MEMORIES_IMAGES_DIR / image_filename
                file.save(str(image_path))
        
        # 创建纪念数据
        memory_id = f"memory_{int(time.time() * 1000)}"
        memory_data = {
            'id': memory_id,
            'title': title,
            'description': description,
            'role_name': role_name,
            'message_count': message_count,
            'messages': recent_messages,
            'image': image_filename,
            'created_at': datetime.now().isoformat(),
            'timestamp': int(time.time())
        }
        
        # 保存纪念详细数据
        memory_file_path = MEMORIES_DIR / f"{memory_id}.json"
        with open(memory_file_path, 'w', encoding='utf-8') as f:
            json.dump(memory_data, f, ensure_ascii=False, indent=2)
        
        # 更新索引
        index = load_memories_index()
        index.append({
            'id': memory_id,
            'title': title,
            'description': description,
            'role_name': role_name,
            'message_count': message_count,
            'image': image_filename,
            'created_at': memory_data['created_at'],
            'timestamp': memory_data['timestamp']
        })
        save_memories_index(index)
        
        return jsonify({
            'success': True,
            'memory_id': memory_id,
            'message': '纪念创建成功'
        })
        
    except Exception as e:
        print(f"创建纪念失败: {e}")
        import traceback
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': f'创建失败: {str(e)}'}), 500

@memories_bp.route('/api/list', methods=['GET'])
def list_memories():
    """获取纪念列表"""
    try:
        index = load_memories_index()
        # 按时间倒序排列
        index.sort(key=lambda x: x.get('timestamp', 0), reverse=True)
        return jsonify({'success': True, 'memories': index})
    except Exception as e:
        print(f"获取纪念列表失败: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@memories_bp.route('/api/get/<memory_id>', methods=['GET'])
def get_memory(memory_id):
    """获取纪念详情"""
    try:
        memory_file_path = MEMORIES_DIR / f"{memory_id}.json"
        if not memory_file_path.exists():
            return jsonify({'success': False, 'error': '纪念不存在'}), 404
        
        with open(memory_file_path, 'r', encoding='utf-8') as f:
            memory_data = json.load(f)
        
        return jsonify({'success': True, 'memory': memory_data})
    except Exception as e:
        print(f"获取纪念详情失败: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@memories_bp.route('/api/delete/<memory_id>', methods=['DELETE'])
def delete_memory(memory_id):
    """删除纪念"""
    try:
        # 加载纪念数据以获取图片文件名
        memory_file_path = MEMORIES_DIR / f"{memory_id}.json"
        if memory_file_path.exists():
            with open(memory_file_path, 'r', encoding='utf-8') as f:
                memory_data = json.load(f)
            
            # 删除图片文件
            if memory_data.get('image'):
                image_path = MEMORIES_IMAGES_DIR / memory_data['image']
                if image_path.exists():
                    os.remove(image_path)
            
            # 删除纪念文件
            os.remove(memory_file_path)
        
        # 更新索引
        index = load_memories_index()
        index = [m for m in index if m['id'] != memory_id]
        save_memories_index(index)
        
        return jsonify({'success': True, 'message': '纪念已删除'})
    except Exception as e:
        print(f"删除纪念失败: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@memories_bp.route('/api/search', methods=['GET'])
def search_memories():
    """搜索纪念"""
    try:
        keyword = request.args.get('keyword', '').strip().lower()
        role_name = request.args.get('role_name', '').strip()
        
        index = load_memories_index()
        
        # 过滤结果
        results = []
        for memory in index:
            # 角色过滤
            if role_name and memory.get('role_name') != role_name:
                continue
            
            # 关键词搜索（标题和描述）
            if keyword:
                title = memory.get('title', '').lower()
                description = memory.get('description', '').lower()
                if keyword not in title and keyword not in description:
                    continue
            
            results.append(memory)
        
        # 按时间倒序排列
        results.sort(key=lambda x: x.get('timestamp', 0), reverse=True)
        
        return jsonify({'success': True, 'memories': results})
    except Exception as e:
        print(f"搜索纪念失败: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@memories_bp.route('/api/restore/<memory_id>', methods=['POST'])
def restore_memory(memory_id):
    """还原纪念场景到聊天记录"""
    try:
        # 获取纪念数据
        memory_file_path = MEMORIES_DIR / f"{memory_id}.json"
        if not memory_file_path.exists():
            return jsonify({'success': False, 'error': '纪念不存在'}), 404
        
        with open(memory_file_path, 'r', encoding='utf-8') as f:
            memory_data = json.load(f)
        
        role_name = memory_data.get('role_name')
        messages = memory_data.get('messages', [])
        
        if not role_name:
            return jsonify({'success': False, 'error': '角色信息缺失'}), 400
        
        # 加载当前聊天记录
        from web.history_manager import save_history
        current_history = load_history(role_name, apply_limits=False)
        
        # 将纪念的消息添加到当前记录中
        # 添加一个分隔标记
        current_history.append(f'--- 还原纪念: {memory_data.get("title")} ---')
        
        # 添加纪念的消息（字符串格式）
        for msg in messages:
            current_history.append(msg)
        
        # 保存更新后的历史记录（注意：参数顺序是 history, role_name）
        save_history(current_history, role_name)
        
        return jsonify({
            'success': True,
            'message': '场景已还原到聊天记录',
            'role_name': role_name,
            'restored_count': len(messages)
        })
        
    except Exception as e:
        print(f"还原纪念失败: {e}")
        import traceback
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500

@memories_bp.route('/api/roles', methods=['GET'])
def get_roles():
    """获取角色列表"""
    try:
        roles_dir = PathManager.get_roles_dir()
        roles = []
        
        for role_file in roles_dir.glob("*.yml"):
            role_name = role_file.stem
            roles.append(role_name)
        
        roles.sort()
        return jsonify({'success': True, 'roles': roles})
    except Exception as e:
        print(f"获取角色列表失败: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@memories_bp.route('/images/<filename>')
def serve_image(filename):
    """提供纪念图片"""
    try:
        return send_from_directory(MEMORIES_IMAGES_DIR, filename)
    except Exception as e:
        print(f"提供图片失败: {e}")
        return "图片不存在", 404
