"""
重构后的主应用文件
使用模块化的蓝图架构，消除重复代码
"""
import sys
from pathlib import Path
import traceback

# 添加项目根目录到Python路径
sys.path.append(str(Path(__file__).parent.parent))

# 启动期依赖自检：缺什么先按国内镜像优先的顺序自动补齐
from web.bootstrap_dependencies import ensure_dependencies

if not ensure_dependencies():
    sys.exit(1)

from flask import Flask, render_template, request, jsonify, Response, send_from_directory, session, redirect, url_for

# 导入API模块
from API import stream_chat_response, get_model_for_function
from web.core import generate_voice_for_text, generate_voice_for_sentence, get_voice_settings, save_voice_settings, clean_audio_files
from web.audio_generator import get_role_voice_id, generate_single_sentence_audio

# 导入工具模块
from web.utils import ConfigManager, DataManager, PathManager

# 导入自定义模块
from web.config_loader import *
from web.history_manager import *
from web.auth_routes import auth_bp
from web.chat_routes import chat_bp
from web.message_routes import message_bp
from web.api_routes import api_bp
from web.ai_new import ai_new_bp  # 新的AI架构蓝图
from web.config_routes import config_bp
from web.summary_routes import summary_bp
from web.delete_service import delete_bp
from web.event_manager_routes import event_manager_bp
from web.user_attributes_routes import user_attributes_bp
from web.config_switch_routes import config_switch_bp
from web.player_management_routes import player_management_bp
from web.game_routes import game_bp
from web.keyword_worldbook_routes import keyword_worldbook_bp
from web.hidden_settings_routes import hidden_settings_bp
from web.semantic_search_routes import semantic_search_bp
from web.semantic_correction_routes import semantic_correction_bp
from web.storybook_api_routes import storybook_api_bp
from web.auto_commands.auto_routes import auto_command_bp  # 自动指令蓝图
from web.memories import memories_bp  # 纪念与回顾蓝图
from web.event.event_routes import event_bp  # 自由事件蓝图
try:
    from web.comfyui.image_generation_routes import image_bp
    from web.comfyui.settings_routes import settings_bp
except ImportError as e:
    print(f"Warning: Failed to import image generation routes: {e}")
    # 创建一个空的蓝图作为备用
    from flask import Blueprint
    image_bp = Blueprint('image_generation_fallback', __name__)
    settings_bp = Blueprint('image_settings_fallback', __name__)

# 导入插件系统
from web.plugins.plugin_manager import plugin_manager

# 创建Flask应用
app = Flask(__name__)
app.secret_key = 'your-secret-key-here'  # 设置session密钥

# 配置session
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = False  # 在开发环境中设为False
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# 配置文件上传大小限制 (50MB)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

# 全局认证中间件
@app.before_request
def global_auth_check():
    """全局认证检查，保护所有需要登录的页面"""
    # 允许访问的端点（无需登录）
    allowed_endpoints = [
        'static_files',  # 静态文件
        'static',        # 静态文件（蓝图中的）
        'game_tools',    # 游戏工具文件
        'audio_files',   # 音频文件
        'get_audio',     # 获取音频
        'avatar',        # 头像文件
        'role_images',   # 角色图片
        'player_images', # 玩家图片
        'storybook_files', # 数据书文件
        'login',         # 登录页面
        'check_login',   # 检查登录状态API
        'auth.login',    # 认证蓝图中的登录
        'auth.api_password_setup',  # 首次启动密码设置
        'game.games_index',    # 游戏列表页面
        'game.game_page',      # 游戏页面
        'game.api_games_list', # 游戏列表API
        'game.api_refresh_games', # 刷新游戏API
        'game.api_game_info',     # 游戏信息API
        'game.api_launch_game',   # 启动游戏API
        'user_attributes.user_attributes_page',  # 用户属性页面
        'user_attributes.list_characters',       # 角色列表API
        'user_attributes.get_character_attributes', # 获取角色属性API
        'user_attributes.save_character_attributes', # 保存角色属性API
        'user_attributes.create_character_storybook', # 创建数据书API
        'user_attributes.get_current_player',    # 获取当前玩家API
        'user_attributes.check_binding_status',  # 检查绑定状态API(向后兼容)
        'image_settings.image_settings_page',    # 图片设置页面
        'image_settings.get_image_settings',     # 获取图片设置API
        'image_settings.update_image_settings',  # 更新图片设置API
        'image_settings.reset_image_settings',   # 重置图片设置API
        'image_settings.validate_image_settings', # 验证图片设置API
        'image_settings.test_comfyui_connection', # 测试ComfyUI连接API
        'image_settings.get_workflow_files',     # 获取工作流文件列表API
        'image_settings.get_workflow_content',   # 获取工作流文件内容API
        'image_settings.upload_workflow_file',   # 上传工作流文件API
        'image_settings.get_history_images',     # 获取历史图像API
        'image_settings.delete_history_image',   # 删除历史图像API
        'image_settings.clear_history_images',   # 清空历史图像API
        'image_settings.serve_generated_image',  # 提供生成图像文件API
        'event.free_event_page',                 # 自由事件页面
        'event.get_roles',                       # 获取角色列表API
        'event.get_players',                     # 获取玩家列表API
        'event.create_event',                    # 创建事件API
        'event.continue_event',                  # 继续事件API
        'event.save_event',                      # 保存事件API
        'event.load_event',                      # 加载事件API
        'event.list_events',                     # 列出事件API
    ]
    
    # 如果访问的是允许的端点，直接放行
    if request.endpoint in allowed_endpoints:
        return
    
    # 检查是否为直接聊天路由 (/chat/<role_name>)
    if request.endpoint == 'direct_chat':
        # 直接聊天路由需要聊天模块的登录状态
        if not session.get('logged_in_chat', False):
            return redirect(url_for('auth.login', module='chat'))
        # 如果已登录，继续执行路由函数
        return
    
    # 判断请求的模块类型
    module = 'chat'  # 默认为聊天模块
    if (request.path.startswith('/storybook') or 
        request.path.startswith('/story_references_visualization') or
        request.path.startswith('/arcana_editor')):
        module = 'storybook'
    elif (request.path.startswith('/keyword_worldbook') or
          request.path.startswith('/global_worldbook')):
        module = 'storybook'  # 世界书管理使用数据书模块的认证
    elif request.path.startswith('/player-management'):
        module = 'chat'  # 玩家管理使用聊天模块的认证
    elif request.path.startswith('/ai_new'):
        module = 'chat'  # AI新架构功能使用聊天模块的认证
    
    # 检查登录状态
    if not session.get(f'logged_in_{module}', False):
        # 判断是否为API请求
        is_api_request = (
            request.path.startswith('/api/') or
            request.path.startswith('/chat') or
            request.path.startswith('/get_progress/') or
            request.path.startswith('/summarize_async') or
            request.path.startswith('/confirm_update') or
            '/api/' in request.path or  # 包含蓝图中的API路径
            request.headers.get('Content-Type', '').startswith('application/json') or
            request.headers.get('Accept', '').startswith('application/json')
        )
        
        if is_api_request:
            return jsonify({
                'success': False, 
                'error': '用户未登录或会话已过期，请重新登录', 
                'requires_login': True
            }), 401
        else:
            return redirect(url_for('auth.login', module=module))

# 注册蓝图
app.register_blueprint(auth_bp)
app.register_blueprint(chat_bp)
app.register_blueprint(message_bp)
app.register_blueprint(api_bp)
app.register_blueprint(ai_new_bp)  # 注册新的AI架构蓝图
app.register_blueprint(config_bp)
app.register_blueprint(summary_bp)
app.register_blueprint(delete_bp)
app.register_blueprint(event_manager_bp)
app.register_blueprint(user_attributes_bp)

app.register_blueprint(config_switch_bp)
app.register_blueprint(player_management_bp)
app.register_blueprint(game_bp)
app.register_blueprint(keyword_worldbook_bp)
app.register_blueprint(hidden_settings_bp)  # 注册底层设定管理蓝图
app.register_blueprint(semantic_search_bp)  # 注册语义搜索蓝图
app.register_blueprint(semantic_correction_bp)  # 注册语义修正蓝图
app.register_blueprint(storybook_api_bp)  # 注册统一数据书API蓝图
app.register_blueprint(image_bp)  # 注册图片生成蓝图
app.register_blueprint(settings_bp)  # 注册图片设置蓝图
app.register_blueprint(auto_command_bp)  # 注册自动指令蓝图
app.register_blueprint(memories_bp)  # 注册纪念与回顾蓝图
app.register_blueprint(event_bp)  # 注册自由事件蓝图

# 注册向量化管理蓝图已移除 - 功能已整合到 vectorized_temp_data 模块

# ========== 插件系统初始化 ==========
print("\n" + "="*50)
print("🔌 开始初始化插件系统...")
print("="*50)

# 加载所有插件
plugin_manager.load_all_plugins()

# 注册插件到应用
plugin_manager.register_plugins(app)

# 注册插件管理API
plugin_api_bp = plugin_manager.create_api_blueprint()
app.register_blueprint(plugin_api_bp)

print("="*50)
print("✅ 插件系统初始化完成")
print("="*50 + "\n")


def get_current_chat_model_config():
    """获取当前聊天模型配置"""
    config = ConfigManager.load_config()
    current_model_key = config.get('chat_models', {}).get('current_model', 'deepseek-v3')
    models = config.get('chat_models', {}).get('models', {})
    return models.get(current_model_key, {})

# 基础路由
@app.route('/')
def index():
    """主页"""
    return render_template('index.html')

@app.route('/chat/<role_name>')
def direct_chat(role_name):
    """直接进入指定角色的聊天页面"""
    try:
        # 验证角色是否存在
        roles_dir = PathManager.get_roles_dir()
        role_file = roles_dir / f"{role_name}.yml"
        
        print(f"检查角色文件: {role_file}")
        print(f"文件是否存在: {role_file.exists()}")
        
        if not role_file.exists():
            return f"角色 '{role_name}' 不存在", 404
        
        print(f"成功验证角色 '{role_name}' 存在，渲染页面...")
        # 渲染聊天页面，并传递角色名参数
        return render_template('index.html', direct_role=role_name)
        
    except Exception as e:
        print(f"直接聊天路由错误: {e}")
        import traceback
        print(f"详细错误: {traceback.format_exc()}")
        return "页面加载失败", 500

@app.route('/storybook')
def storybook():
    """数据书页面"""
    return render_template('storybook.html')

@app.route('/global_worldbook')
def global_worldbook():
    """全局世界书页面"""
    return render_template('global_worldbook.html')

@app.route('/event_manager')
def event_manager():
    """事件管理器页面"""
    return render_template('event_manager.html')

@app.route('/event_cleanup')
def event_cleanup():
    """事件清理页面 - 重定向到事件管理器"""
    return redirect(url_for('event_manager'))

@app.route('/story_references_visualization')
def story_references_visualization():
    """数据书引用关系可视化页面"""
    return render_template('story_references_visualization.html')

@app.route('/arcana_editor')
def arcana_editor():
    """奥卡纳编辑器页面"""
    return render_template('arcana_editor.html')

@app.route('/model_config')
def model_config():
    """模型配置页面"""
    return render_template('model_config.html')




# 密码设置页面路由已移至 auth_routes.py 中

@app.route('/test_api')
def test_api():
    """API测试页面"""
    return render_template('test_api.html')

@app.route('/test-export-import')
def test_export_import():
    """导出导入功能测试页面"""
    return render_template('test_export_import.html')

@app.route('/export-diagnosis')
def export_diagnosis():
    """角色导出诊断工具页面"""
    return render_template('export_diagnosis.html')

@app.route('/test-flow')
def test_flow():
    """导出导入流程测试页面"""
    with open('test_export_import_flow.html', 'r', encoding='utf-8') as f:
        return f.read()

@app.route('/analyze-luna')
def analyze_luna():
    """Luna角色卡分析页面"""
    with open('test_extract_luna.html', 'r', encoding='utf-8') as f:
        return f.read()

@app.route('/api/check_login')
def check_login():
    """检查登录状态API"""
    chat_logged_in = session.get('logged_in_chat', False)
    storybook_logged_in = session.get('logged_in_storybook', False)
    
    if chat_logged_in:
        return jsonify({
            'success': True,
            'module': 'chat',
            'chat_logged_in': chat_logged_in,
            'storybook_logged_in': storybook_logged_in
        })
    else:
        return jsonify({
            'success': False,
            'error': '用户未登录',
            'requires_login': True
        }), 401

@app.route('/login')
def login():
    """登录页面"""
    return render_template('login.html')

# 静态文件路由
@app.route('/static/<path:filename>')
def static_files(filename):
    """静态文件服务"""
    return send_from_directory('static', filename)

# 游戏工具路由
@app.route('/game_Tools/<path:filename>')
def game_tools(filename):
    """游戏工具文件服务"""
    return send_from_directory('game_Tools', filename)

# Favicon路由 - 避免404错误
@app.route('/favicon.ico')
def favicon():
    """返回favicon，避免404错误"""
    return send_from_directory('static/images', 'default-avatar.svg', mimetype='image/svg+xml')

# 音频文件路由
@app.route('/audio/<path:filename>')
def audio_files(filename):
    """音频文件服务"""
    return send_from_directory('audio', filename)

# 角色图片路由
@app.route('/role_images/<path:filename>')
def role_images(filename):
    """角色图片服务"""
    roles_dir = PathManager.get_roles_dir()
    return send_from_directory(roles_dir, filename)

# 玩家图片路由
@app.route('/player_images/<path:filename>')
def player_images(filename):
    """玩家图片服务"""
    players_dir = PathManager.get_players_dir()
    return send_from_directory(players_dir, filename)

# 数据书文件路由
@app.route('/storybook_files/<path:filename>')
def storybook_files(filename):
    """数据书文件服务"""
    storybook_dir = PathManager.get_storybook_dir()
    return send_from_directory(storybook_dir, filename)

# 头像路由 - 支持角色和玩家头像
@app.route('/avatar/<path:name>')
def get_avatar(name):
    """获取头像文件，支持角色和玩家"""
    try:
        # 首先尝试在角色目录中查找
        roles_dir = PathManager.get_roles_dir()
        for ext in ['png', 'jpg', 'jpeg', 'gif', 'webp']:
            avatar_file = roles_dir / f"{name}.{ext}"
            if avatar_file.exists():
                response = send_from_directory(roles_dir, f"{name}.{ext}")
                # 添加缓存控制头
                response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
                response.headers['Pragma'] = 'no-cache'
                response.headers['Expires'] = '0'
                return response
        
        # 如果角色目录中没有，尝试在玩家目录中查找
        players_dir = PathManager.get_players_dir()
        for ext in ['png', 'jpg', 'jpeg', 'gif', 'webp']:
            avatar_file = players_dir / f"{name}.{ext}"
            if avatar_file.exists():
                response = send_from_directory(players_dir, f"{name}.{ext}")
                # 添加缓存控制头
                response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
                response.headers['Pragma'] = 'no-cache'
                response.headers['Expires'] = '0'
                return response
        
        # 如果都没有找到，返回默认头像
        response = send_from_directory('static/images', 'default-avatar.svg')
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response
    except Exception as e:
        print(f"获取头像失败: {e}")
        # 发生异常时也返回默认头像
        response = send_from_directory('static/images', 'default-avatar.svg')
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response

# 历史记录路由
@app.route('/history/<role>')
def get_history(role):
    """获取指定角色的历史记录"""
    try:
        # 检查是否有apply_limits参数
        apply_limits = request.args.get('apply_limits', 'true').lower() == 'true'
        history = load_history(role, apply_limits=apply_limits)
        return jsonify(history)
    except Exception as e:
        print(f"加载历史记录失败: {e}")
        return jsonify([]), 500

# 语音生成路由
@app.route('/generate_voice', methods=['POST'])
def generate_voice():
    """生成语音文件"""
    try:
        data = request.json
        text = data.get('text', '')
        role = data.get('role', 'biabia')
        
        if not text.strip():
            return jsonify({'success': False, 'message': '文本内容不能为空'}), 400
        
        print(f"开始为角色 {role} 生成语音: {text[:50]}...")
        
        # 生成语音文件
        audio_files = generate_voice_for_text(text, role)
        
        if audio_files and len(audio_files) > 0:
            # 转换为相对URL路径
            audio_urls = []
            for audio_file in audio_files:
                if audio_file and audio_file.exists():
                    audio_urls.append(f'/audio/{audio_file.name}')
            
            print(f"语音生成成功，共生成 {len(audio_urls)} 个音频文件")
            return jsonify({
                'success': True,
                'audio_urls': audio_urls,
                'message': '语音生成成功'
            })
        else:
            print("语音生成失败：没有生成任何音频文件")
            return jsonify({
                'success': False,
                'message': '语音生成失败：没有生成任何音频文件'
            }), 500
            
    except Exception as e:
        print(f"语音生成异常: {e}")
        import traceback
        print(f"详细错误: {traceback.format_exc()}")
        return jsonify({
            'success': False,
            'message': f'语音生成失败: {str(e)}'
        }), 500

# 初始化密码系统
def init_password_system():
    """初始化密码系统"""
    # 密码初始化逻辑统一由 auth_routes.py 处理，这里保留空实现以兼容旧调用。
    return

# 应用启动时初始化
if __name__ == '__main__':
    init_password_system()
    app.run(debug=True, host='0.0.0.0', port=8000)
