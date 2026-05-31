"""
认证和权限管理模块
包含登录、登出、密码管理等功能
"""
from flask import Blueprint, render_template, request, jsonify, redirect, url_for, session
from werkzeug.security import generate_password_hash, check_password_hash

from web.utils import ConfigManager

auth_bp = Blueprint('auth', __name__)
PASSWORD_MODULES = ('chat', 'storybook', 'admin')

def _is_password_hash(value):
    """判断配置中的密码是否为 werkzeug 可识别的哈希。"""
    if not isinstance(value, str) or not value:
        return False
    try:
        check_password_hash(value, "__codex_probe__")
        return True
    except ValueError:
        return False
    except Exception:
        return False


def _passwords_are_ready(passwords):
    """判断系统是否已完成密码初始化。"""
    if not isinstance(passwords, dict):
        return False
    return all(_is_password_hash(passwords.get(module)) for module in PASSWORD_MODULES)


def is_password_setup_required():
    """是否需要首次设置密码。"""
    config = ConfigManager.load_config()
    return not _passwords_are_ready(config.get('passwords'))


def _set_requires_password_setup(config):
    """同步写入首次设置状态标记。"""
    required = not _passwords_are_ready(config.get('passwords'))
    if config.get('requires_password_setup') != required:
        config['requires_password_setup'] = required
        return True
    return False


def init_password_system():
    """初始化密码系统，迁移旧密码格式"""
    config = ConfigManager.load_config()
    config_changed = False
    
    # 如果还是旧的密码格式，则迁移到新格式
    if 'password' in config and 'passwords' not in config:
        old_password = config.get('password', '123456')
        config['passwords'] = {
            'chat': generate_password_hash(old_password),
            'storybook': generate_password_hash(old_password),
            'admin': generate_password_hash(old_password)  # 管理员密码
        }
        config_changed = True
        print("密码系统已升级到新格式")
    
    # 新 data 首次启动：不再设置默认密码，要求用户首次自行设置
    elif 'passwords' not in config:
        config['passwords'] = {}
        config_changed = True
        print("首次启动：需要先设置密码")

    passwords = config.get('passwords', {})
    if not isinstance(passwords, dict):
        passwords = {}
        config['passwords'] = passwords
        config_changed = True

    # 兼容旧配置中的明文密码，按已有值转哈希（不会创建缺失模块密码）
    for module in PASSWORD_MODULES:
        if module not in passwords:
            continue
        current_value = passwords.get(module)
        if isinstance(current_value, str) and current_value and not _is_password_hash(current_value):
            passwords[module] = generate_password_hash(current_value)
            config_changed = True

    if _set_requires_password_setup(config):
        config_changed = True

    if config_changed:
        ConfigManager.save_config(config)

def check_module_password(password, module):
    """检查模块密码"""
    config = ConfigManager.load_config()
    if config.get('requires_password_setup', False):
        return False

    passwords = config.get('passwords', {})
    
    if module not in passwords:
        return False
    
    stored_password = passwords[module]
    if not _is_password_hash(stored_password):
        return stored_password == password

    return check_password_hash(stored_password, password)

def update_module_password(module, new_password):
    """更新模块密码"""
    config = ConfigManager.load_config()
    if 'passwords' not in config:
        config['passwords'] = {}
    
    config['passwords'][module] = generate_password_hash(new_password)
    _set_requires_password_setup(config)
    ConfigManager.save_config(config)
    return True


def setup_all_module_passwords(new_password):
    """首次初始化：统一设置所有模块密码。"""
    if not isinstance(new_password, str) or len(new_password) < 6:
        return False

    config = ConfigManager.load_config()
    config['passwords'] = {
        module: generate_password_hash(new_password) for module in PASSWORD_MODULES
    }
    config['requires_password_setup'] = False
    return ConfigManager.save_config(config)

def get_legacy_password():
    """获取旧格式密码，用于兼容"""
    config = ConfigManager.load_config()
    return config.get('password', '123456')

def get_module_from_request():
    """根据请求路径确定模块"""
    path = request.path
    
    # 数据书相关路径
    if any(keyword in path for keyword in ['/storybook', '/api/stories', '/edit_story']):
        return 'storybook'
    
    # 默认为聊天模块
    return 'chat'

# 初始化密码系统
init_password_system()

# 认证逻辑已移至 app_new.py 的全局认证中间件中

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    module = request.args.get('module', 'chat')  # 默认聊天模块
    requires_password_setup = is_password_setup_required()
    
    if request.method == 'POST':
        if requires_password_setup:
            if request.is_json:
                return jsonify({
                    'success': False,
                    'message': '首次启动请先设置密码',
                    'requires_password_setup': True
                }), 403
            return render_template(
                'login.html',
                error='首次启动请先设置密码',
                module=module,
                requires_password_setup=True
            )

        # 检查是否是JSON请求
        if request.is_json:
            password = request.json.get('password')
            module = request.json.get('module', 'chat')
            
            print(f"🔑 JSON登录请求: module={module}, password={'*' * len(password) if password else 'None'}")
            
            if check_module_password(password, module):
                session[f'logged_in_{module}'] = True
                
                # 如果登录聊天模块，也给予数据书权限（可选）
                if module == 'chat':
                    session['logged_in_storybook'] = True
                
                print(f"✅ 登录成功: {module}")
                return jsonify({'success': True, 'message': '登录成功', 'module': module})
            else:
                print(f"❌ 登录失败: 密码错误")
                return jsonify({'success': False, 'message': '密码错误'}), 401
        else:
            # 表单登录
            password = request.form.get('password')
            
            print(f"🔑 表单登录请求: module={module}, password={'*' * len(password) if password else 'None'}")
            print(f"检查密码结果: {check_module_password(password, module)}")
            
            if check_module_password(password, module):
                session[f'logged_in_{module}'] = True
                
                # 如果登录聊天模块，也给予数据书权限（可选）
                if module == 'chat':
                    session['logged_in_storybook'] = True
                
                print(f"✅ 表单登录成功: {module}")
                print(f"Session设置: logged_in_{module} = True")
                
                # 重定向到对应模块
                if module == 'storybook':
                    return redirect(url_for('storybook'))
                else:
                    return redirect(url_for('index'))
            else:
                print(f"❌ 表单登录失败: 密码错误")
                return render_template(
                    'login.html',
                    error='密码错误',
                    module=module,
                    requires_password_setup=False
                )
    
    return render_template('login.html', module=module, requires_password_setup=requires_password_setup)

@auth_bp.route('/logout')
def logout():
    module = request.args.get('module', 'all')
    
    if module == 'all':
        # 清除所有模块的登录状态
        session.clear()
    else:
        # 只清除指定模块的登录状态
        session.pop(f'logged_in_{module}', None)
    
    return redirect(url_for('auth.login'))

@auth_bp.route('/password_settings')
def password_settings():
    """密码设置页面"""
    # 全局认证中间件已处理登录检查
    return render_template('password_settings.html')


@auth_bp.route('/api/password_setup', methods=['POST'])
def api_password_setup():
    """首次启动密码设置 API。"""
    data = request.json if request.is_json else request.form
    new_password = (data.get('new_password') or '').strip()
    confirm_password = (data.get('confirm_password') or '').strip()

    if not is_password_setup_required():
        return jsonify({'success': False, 'error': '密码已初始化，无需再次设置'}), 400

    if len(new_password) < 6:
        return jsonify({'success': False, 'error': '密码长度至少6位'}), 400

    if new_password != confirm_password:
        return jsonify({'success': False, 'error': '两次输入的密码不一致'}), 400

    if not setup_all_module_passwords(new_password):
        return jsonify({'success': False, 'error': '保存密码失败'}), 500

    return jsonify({'success': True, 'message': '首次密码设置成功，请使用新密码登录'})

@auth_bp.route('/api/password_management', methods=['GET', 'POST', 'PUT'])
def api_password_management():
    """密码管理API"""
    # 全局认证中间件已处理登录检查
    
    if request.method == 'GET':
        # 获取密码设置状态（不返回实际密码）
        config = ConfigManager.load_config()
        passwords = config.get('passwords', {})
        
        return jsonify({
            'success': True,
            'modules': {
                'chat': 'chat' in passwords,
                'storybook': 'storybook' in passwords,
                'admin': 'admin' in passwords
            }
        })
    
    elif request.method == 'POST':
        # 验证密码
        data = request.json
        password = data.get('password')
        module = data.get('module', 'chat')
        
        if check_module_password(password, module):
            return jsonify({'success': True, 'message': '密码正确'})
        else:
            return jsonify({'success': False, 'error': '密码错误'})
    
    elif request.method == 'PUT':
        # 修改密码
        data = request.json
        current_password = data.get('current_password')
        new_password = data.get('new_password')
        module = data.get('module', 'chat')
        
        # 验证当前密码
        if not check_module_password(current_password, module):
            return jsonify({'success': False, 'error': '当前密码错误'})
        
        # 更新密码
        if update_module_password(module, new_password):
            return jsonify({'success': True, 'message': f'{module}模块密码修改成功'})
        else:
            return jsonify({'success': False, 'error': '密码修改失败'})
