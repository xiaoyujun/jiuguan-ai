from flask import Blueprint, jsonify, render_template, request
import json
import os
import yaml
from pathlib import Path
from web.utils import PathManager

user_attributes_bp = Blueprint('user_attributes', __name__)

@user_attributes_bp.route('/user-attributes')
def user_attributes_page():
    """用户属性显示页面"""
    return render_template('user_attributes.html')

@user_attributes_bp.route('/api/characters/list')
def list_characters():
    """获取所有角色和玩家列表"""
    try:
        characters = []
        
        # 获取所有玩家
        players_dir = PathManager.get_players_dir()
        if players_dir.exists():
            for player_file in players_dir.glob('*.yml'):
                if player_file.name != '当前挑选玩家.json':
                    characters.append({
                        'name': player_file.stem,
                        'type': 'player',
                        'display_name': f"👤 {player_file.stem} (玩家)"
                    })
        
        # 获取所有角色
        roles_dir = PathManager.get_roles_dir()
        if roles_dir.exists():
            for role_file in roles_dir.glob('*.yml'):
                characters.append({
                    'name': role_file.stem,
                    'type': 'role',
                    'display_name': f"🎭 {role_file.stem} (角色)"
                })
        
        # 按名称排序
        characters.sort(key=lambda x: x['name'])
        
        return jsonify({
            'success': True,
            'characters': characters
        })
        
    except Exception as e:
        print(f"获取角色列表失败: {e}")
        return jsonify({
            'success': False,
            'error': f'获取角色列表失败: {str(e)}'
        }), 500

@user_attributes_bp.route('/api/character/<character_name>/attributes')
def get_character_attributes(character_name):
    """获取指定角色的所有属性数据"""
    try:
        # 判断是玩家还是角色
        player_file = PathManager.get_players_dir() / f'{character_name}.yml'
        role_file = PathManager.get_roles_dir() / f'{character_name}.yml'
        
        character_type = None
        basic_data = {}
        
        if player_file.exists():
            character_type = 'player'
            with open(player_file, 'r', encoding='utf-8') as f:
                basic_data = yaml.safe_load(f) or {}
        elif role_file.exists():
            character_type = 'role'
            with open(role_file, 'r', encoding='utf-8') as f:
                basic_data = yaml.safe_load(f) or {}
        else:
            return jsonify({
                'success': False,
                'error': f'未找到名为 "{character_name}" 的角色或玩家'
            }), 404
        
        # 查找关联的数据书 - 直接查找数据书路径下的同名文件
        storybook_data = None
        storybooks_dir = PathManager.get_storybook_dir()
        
        if storybooks_dir.exists():
            # 直接查找同名数据书文件
            storybook_file = storybooks_dir / f'{character_name}.json'
            
            if storybook_file.exists():
                try:
                    with open(storybook_file, 'r', encoding='utf-8') as f:
                        storybook_data = json.load(f)
                    print(f"找到角色 {character_name} 的数据书文件: {storybook_file}")
                except Exception as e:
                    print(f"读取数据书文件 {storybook_file} 失败: {e}")
        
        # 构建完整的属性数据
        result = {
            'success': True,
            'character_name': character_name,
            'character_type': character_type,
            'basic_info': basic_data,
            'storybook_data': storybook_data,
            'has_storybook': storybook_data is not None
        }
        
        return jsonify(result)
        
    except Exception as e:
        print(f"获取角色属性失败: {e}")
        return jsonify({
            'success': False,
            'error': f'获取角色属性失败: {str(e)}'
        }), 500

@user_attributes_bp.route('/api/character/<character_name>/save', methods=['POST'])
def save_character_attributes(character_name):
    """保存角色属性到数据书

    DEPRECATED: 路径差异保存接口，仅由旧版 character_card_display.js / user_attributes.js
    的内联编辑模式调用。新版 /user-attributes 与 /storybook 已统一改走
    PUT /api/stories/<storybook_name> 整文档保存。保留此端点用于兼容外部脚本，
    后续清理 PR 中可删除。
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': '请求数据为空'}), 400
        
        character_type = data.get('character_type')
        changes = data.get('changes', {})
        
        if not character_type:
            return jsonify({'success': False, 'error': '未指定角色类型'}), 400
        
        if not changes:
            return jsonify({'success': False, 'error': '没有检测到任何更改'}), 400
        
        # 查找或创建数据书
        storybooks_dir = PathManager.get_storybook_dir()
        storybooks_dir.mkdir(exist_ok=True)
        
        binding_key = '捆绑玩家' if character_type == 'player' else '捆绑角色'
        storybook_file = None
        storybook_data = None
        
        # 查找现有数据书
        for file_path in storybooks_dir.glob('*.json'):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data_content = json.load(f)
                
                if binding_key in data_content and character_name in data_content[binding_key]:
                    storybook_file = file_path
                    storybook_data = data_content
                    break
                    
            except Exception as e:
                print(f"读取数据书文件 {file_path} 失败: {e}")
                continue
        
        # 如果没有找到现有数据书，创建新的
        if not storybook_file:
            storybook_file = storybooks_dir / f'{character_name}的数据卡.json'
            storybook_data = {
                '总结词': [character_name],
                '关键词': [],
                '属性': {},
                '标签': [],
                '描述': f'{character_name}的数据卡',
                '捆绑角色': [character_name] if character_type == 'role' else [],
                '捆绑玩家': [character_name] if character_type == 'player' else [],
                '创建时间': str(Path().absolute().stat().st_ctime),
                '更新时间': str(Path().absolute().stat().st_mtime)
            }
        
        # 应用更改
        def apply_changes_to_dict(target_dict, changes_dict):
            """递归应用更改到目标字典"""
            for key, value in changes_dict.items():
                if isinstance(value, dict):
                    if key not in target_dict:
                        target_dict[key] = {}
                    apply_changes_to_dict(target_dict[key], value)
                else:
                    target_dict[key] = value
        
        def set_nested_value(obj, path, value):
            """根据路径设置嵌套值"""
            keys = path.split('.')
            current = obj
            
            # 处理路径到倒数第二层
            for key in keys[:-1]:
                if key not in current:
                    current[key] = {}
                current = current[key]
            
            # 设置最终值
            final_key = keys[-1]
            if value == '__DELETE__':
                if final_key in current:
                    del current[final_key]
            else:
                current[final_key] = value
        
        # 确保数据书结构存在
        if '属性' not in storybook_data:
            storybook_data['属性'] = {}
        
        # 处理路径格式的更改
        for change_path, change_value in changes.items():
            # 解析路径格式：sectionId.key 或 sectionId.parentKey.childKey
            path_parts = change_path.split('.')
            
            if len(path_parts) >= 2:
                section_id = path_parts[0]
                remaining_path = '.'.join(path_parts[1:])
                
                if section_id == 'basic_info':
                    # 基本信息直接存储在角色配置中，这里暂不处理
                    # 因为基本信息通常存储在角色yml文件中
                    continue
                elif section_id == 'storybook_attributes':
                    # 数据书属性存储在 storybook_data.属性 中
                    set_nested_value(storybook_data['属性'], remaining_path, change_value)
                elif section_id == 'other_info':
                    # 其他信息存储在 storybook_data 的根级别
                    set_nested_value(storybook_data, remaining_path, change_value)
                else:
                    # 兜底：尝试存储在属性中
                    set_nested_value(storybook_data['属性'], change_path, change_value)
        
        # 更新时间戳
        import time
        storybook_data['更新时间'] = str(time.time())
        
        # 保存文件
        with open(storybook_file, 'w', encoding='utf-8') as f:
            json.dump(storybook_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({
            'success': True,
            'message': f'成功保存 {character_name} 的属性',
            'storybook_file': str(storybook_file)
        })
        
    except Exception as e:
        print(f"保存角色属性失败: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'保存失败: {str(e)}'
        }), 500

@user_attributes_bp.route('/api/character/<character_name>/create-storybook', methods=['POST'])
def create_character_storybook(character_name):
    """为角色创建新的数据书"""
    try:
        data = request.get_json()
        character_type = data.get('character_type', 'player')
        
        # 检查角色是否存在
        if character_type == 'player':
            char_file = PathManager.get_players_dir() / f'{character_name}.yml'
        else:
            char_file = PathManager.get_roles_dir() / f'{character_name}.yml'
        
        if not char_file.exists():
            return jsonify({
                'success': False,
                'error': f'角色 {character_name} 不存在'
            }), 404
        
        # 创建数据书
        storybooks_dir = PathManager.get_storybook_dir()
        storybooks_dir.mkdir(exist_ok=True)
        
        storybook_file = storybooks_dir / f'{character_name}的数据卡.json'
        
        if storybook_file.exists():
            return jsonify({
                'success': False,
                'error': f'数据书 "{character_name}的数据卡" 已存在'
            }), 400
        
        # 创建基础数据书结构
        import datetime
        
        storybook_data = {
            '总结词': [character_name],
            '关键词': [],
            '属性': {
                '基本信息': {
                    '姓名': character_name,
                    '类型': '玩家' if character_type == 'player' else '角色'
                }
            },
            '标签': [],
            '描述': f'{character_name}的数据卡',
            '捆绑角色': [character_name] if character_type == 'role' else [],
            '捆绑玩家': [character_name] if character_type == 'player' else [],
            '创建时间': datetime.datetime.now().isoformat(),
            '更新时间': datetime.datetime.now().isoformat()
        }
        
        # 保存文件
        with open(storybook_file, 'w', encoding='utf-8') as f:
            json.dump(storybook_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({
            'success': True,
            'message': f'成功为 {character_name} 创建数据书',
            'storybook_file': str(storybook_file)
        })
        
    except Exception as e:
        print(f"创建数据书失败: {e}")
        return jsonify({
            'success': False,
            'error': f'创建失败: {str(e)}'
        }), 500

@user_attributes_bp.route('/api/current-player')
def get_current_player():
    """获取当前选中的玩家"""
    try:
        current_player_file = PathManager.get_players_dir() / '当前挑选玩家.json'
        
        if not current_player_file.exists():
            return jsonify({
                'success': True,
                'current_player': None
            })
        
        with open(current_player_file, 'r', encoding='utf-8') as f:
            current_player_data = json.load(f)
        
        selected_player = current_player_data.get('selected_player')
        
        return jsonify({
            'success': True,
            'current_player': selected_player
        })
        
    except Exception as e:
        print(f"获取当前玩家失败: {e}")
        return jsonify({
            'success': False,
            'error': f'获取当前玩家失败: {str(e)}'
        }), 500

@user_attributes_bp.route('/api/check-binding-status/<name>')
def check_binding_status(name):
    """检查角色/玩家的数据书绑定状态 - 向后兼容的端点"""
    try:
        # 重定向到新的角色属性API
        response = get_character_attributes(name)
        data = response.get_json()
        
        if data['success']:
            return jsonify({
                'name': name,
                'type': data['character_type'],
                'has_binding': data['has_storybook'],
                'bound_storybooks': [f"{name}的数据卡"] if data['has_storybook'] else [],
                'exists': True
            })
        else:
            return jsonify({
                'error': data['error']
            }), 404
            
    except Exception as e:
        print(f"检查绑定状态失败: {e}")
        return jsonify({
            'error': f'检查绑定状态失败: {str(e)}'
        }), 500

@user_attributes_bp.route('/api/character/<character_name>/storybooks')
def get_character_storybooks(character_name):
    """获取角色绑定的数据书 - 直接查找同名数据书文件"""
    try:
        storybooks_dir = PathManager.get_storybook_dir()
        if not storybooks_dir.exists():
            return jsonify({
                'success': True,
                'storybooks': []
            })
        
        # 确定角色类型
        character_type = 'player'  # 默认为玩家
        
        # 检查是否为角色
        roles_dir = PathManager.get_roles_dir()
        role_file = roles_dir / f'{character_name}.yml'
        if role_file.exists():
            character_type = 'role'
        
        bound_storybooks = []
        
        # 直接查找同名数据书文件
        storybook_file = storybooks_dir / f'{character_name}.json'
        
        if storybook_file.exists():
            try:
                with open(storybook_file, 'r', encoding='utf-8') as f:
                    storybook_data = json.load(f)
                
                storybook_info = {
                    'name': storybook_file.stem,
                    'file_path': str(storybook_file),
                    'description': storybook_data.get('描述', ''),
                    'summary_words': storybook_data.get('总结词', []),
                    'keywords': storybook_data.get('关键词', []),
                    'tags': storybook_data.get('标签', []),
                    'create_time': storybook_data.get('创建时间', ''),
                    'update_time': storybook_data.get('更新时间', ''),
                    'attributes_count': len(storybook_data.get('属性', {}))
                }
                bound_storybooks.append(storybook_info)
                print(f"找到角色 {character_name} 的数据书文件: {storybook_file}")
                    
            except Exception as e:
                print(f"读取数据书文件 {storybook_file} 失败: {e}")
        
        return jsonify({
            'success': True,
            'storybooks': bound_storybooks,
            'character_type': character_type
        })
        
    except Exception as e:
        print(f"获取角色数据书列表失败: {e}")
        return jsonify({
            'success': False,
            'error': f'获取失败: {str(e)}'
        }), 500

@user_attributes_bp.route('/api/character/<character_name>/storybook/<storybook_name>/attributes')
def get_storybook_attributes(character_name, storybook_name):
    """获取指定数据书的属性"""
    try:
        storybooks_dir = PathManager.get_storybook_dir()
        storybook_file = storybooks_dir / f'{storybook_name}.json'
        
        if not storybook_file.exists():
            return jsonify({
                'success': False,
                'error': f'数据书 "{storybook_name}" 不存在'
            }), 404
        
        with open(storybook_file, 'r', encoding='utf-8') as f:
            storybook_data = json.load(f)
        
        # 确定角色类型
        character_type = 'player'
        roles_dir = PathManager.get_roles_dir()
        role_file = roles_dir / f'{character_name}.yml'
        if role_file.exists():
            character_type = 'role'
        
        # 检查角色是否绑定到该数据书
        binding_key = '捆绑玩家' if character_type == 'player' else '捆绑角色'
        if binding_key not in storybook_data or character_name not in storybook_data[binding_key]:
            return jsonify({
                'success': False,
                'error': f'角色 "{character_name}" 未绑定到数据书 "{storybook_name}"'
            }), 403
        
        # 获取基本信息（如果是玩家）
        basic_info = {}
        if character_type == 'player':
            players_dir = PathManager.get_players_dir()
            player_file = players_dir / f'{character_name}.yml'
            if player_file.exists():
                try:
                    import yaml
                    with open(player_file, 'r', encoding='utf-8') as f:
                        player_data = yaml.safe_load(f) or {}
                        basic_info = {
                            '姓名': player_data.get('name', character_name),
                            '类型': '玩家',
                            '介绍': player_data.get('介绍', ''),
                            '开场白': player_data.get('开场白', ''),
                            '语音ID': player_data.get('voice_id', '')
                        }
                except Exception as e:
                    print(f"读取玩家文件失败: {e}")
        
        return jsonify({
            'success': True,
            'character_name': character_name,
            'character_type': character_type,
            'storybook_name': storybook_name,
            'has_storybook': True,
            'basic_info': basic_info,
            'storybook_data': storybook_data
        })
        
    except Exception as e:
        print(f"获取数据书属性失败: {e}")
        return jsonify({
            'success': False,
            'error': f'获取失败: {str(e)}'
        }), 500

@user_attributes_bp.route('/api/character/<character_name>/storybook/<storybook_name>/save', methods=['POST'])
def save_storybook_attributes(character_name, storybook_name):
    """保存角色属性到指定数据书

    DEPRECATED: 同 save_character_attributes，仅由旧版内联编辑代码调用。
    新版统一走 PUT /api/stories/<storybook_name>。
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': '请求数据为空'}), 400
        
        character_type = data.get('character_type')
        changes = data.get('changes', {})
        
        if not character_type:
            return jsonify({'success': False, 'error': '未指定角色类型'}), 400
        
        if not changes:
            return jsonify({'success': False, 'error': '没有检测到任何更改'}), 400
        
        # 查找指定的数据书
        storybooks_dir = PathManager.get_storybook_dir()
        storybook_file = storybooks_dir / f'{storybook_name}.json'
        
        if not storybook_file.exists():
            return jsonify({
                'success': False, 
                'error': f'数据书 "{storybook_name}" 不存在'
            }), 404
        
        # 加载数据书数据
        with open(storybook_file, 'r', encoding='utf-8') as f:
            storybook_data = json.load(f)
        
        # 验证角色是否绑定到该数据书
        binding_key = '捆绑玩家' if character_type == 'player' else '捆绑角色'
        if binding_key not in storybook_data or character_name not in storybook_data[binding_key]:
            return jsonify({
                'success': False,
                'error': f'角色 "{character_name}" 未绑定到数据书 "{storybook_name}"'
            }), 403
        
        # 应用更改的函数
        def set_nested_value(obj, path, value):
            """根据路径设置嵌套值"""
            keys = path.split('.')
            current = obj
            
            # 处理路径到倒数第二层
            for key in keys[:-1]:
                if key not in current:
                    current[key] = {}
                current = current[key]
            
            # 设置最终值
            final_key = keys[-1]
            if value == '__DELETE__':
                if final_key in current:
                    del current[final_key]
            else:
                current[final_key] = value
        
        # 确保数据书结构存在
        if '属性' not in storybook_data:
            storybook_data['属性'] = {}
        
        # 处理路径格式的更改
        for change_path, change_value in changes.items():
            # 解析路径格式：sectionId.key 或 sectionId.parentKey.childKey
            path_parts = change_path.split('.')
            
            if len(path_parts) >= 2:
                section_id = path_parts[0]
                remaining_path = '.'.join(path_parts[1:])
                
                if section_id == 'basic_info':
                    # 基本信息直接存储在角色配置中，这里暂不处理
                    continue
                elif section_id == 'storybook_attributes':
                    # 数据书属性存储在 storybook_data.属性 中
                    set_nested_value(storybook_data['属性'], remaining_path, change_value)
                elif section_id == 'other_info':
                    # 其他信息存储在 storybook_data 的根级别
                    set_nested_value(storybook_data, remaining_path, change_value)
                else:
                    # 兜底：尝试存储在属性中
                    set_nested_value(storybook_data['属性'], change_path, change_value)
        
        # 更新时间戳
        import time
        storybook_data['更新时间'] = str(time.time())
        
        # 保存文件
        with open(storybook_file, 'w', encoding='utf-8') as f:
            json.dump(storybook_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({
            'success': True,
            'message': f'成功保存 {character_name} 的属性到数据书 {storybook_name}',
            'storybook_file': str(storybook_file)
        })
        
    except Exception as e:
        print(f"保存数据书属性失败: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'保存失败: {str(e)}'
        }), 500
