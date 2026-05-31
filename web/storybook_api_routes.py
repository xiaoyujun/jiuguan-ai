"""
统一的数据书API路由管理
重构后的版本，提供一致的API接口和错误处理
"""

from flask import Blueprint, request, jsonify
import json
import datetime
from pathlib import Path
from web.utils import PathManager

storybook_api_bp = Blueprint('storybook_api', __name__)

class StorybookAPIManager:
    """数据书API管理器 - 统一处理所有数据书相关的API操作"""
    
    @staticmethod
    def validate_storybook_data(data):
        """验证数据书数据结构"""
        if not isinstance(data, dict):
            return False, "数据书必须是JSON对象"
        
        required_fields = ['总结词', '关键词', '属性']
        for field in required_fields:
            if field not in data:
                return False, f"缺少必需字段: {field}"
        
        return True, ""
    
    @staticmethod
    def get_storybook_file_path(storybook_name):
        """获取数据书文件路径"""
        storybooks_dir = PathManager.get_storybook_dir()
        return storybooks_dir / f"{storybook_name}.json"
    
    @staticmethod
    def load_storybook(storybook_name):
        """加载单个数据书"""
        try:
            storybook_file = StorybookAPIManager.get_storybook_file_path(storybook_name)
            if not storybook_file.exists():
                return None, f"数据书 '{storybook_name}' 不存在"
            
            with open(storybook_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return data, None
        except Exception as e:
            return None, f"加载数据书失败: {str(e)}"
    
    @staticmethod
    def save_storybook(storybook_name, data, create_if_not_exists=True):
        """保存数据书"""
        try:
            storybook_file = StorybookAPIManager.get_storybook_file_path(storybook_name)
            
            if not create_if_not_exists and not storybook_file.exists():
                return False, f"数据书 '{storybook_name}' 不存在"
            
            # 确保目录存在
            storybook_file.parent.mkdir(exist_ok=True)
            
            # 添加或更新时间戳
            now = datetime.datetime.now().isoformat()
            if '创建时间' not in data:
                data['创建时间'] = now
            data['更新时间'] = now
            
            with open(storybook_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            return True, ""
        except Exception as e:
            return False, f"保存数据书失败: {str(e)}"
    
    @staticmethod
    def delete_storybook(storybook_name):
        """删除数据书"""
        try:
            storybook_file = StorybookAPIManager.get_storybook_file_path(storybook_name)
            if storybook_file.exists():
                storybook_file.unlink()
                return True, ""
            return False, f"数据书 '{storybook_name}' 不存在"
        except Exception as e:
            return False, f"删除数据书失败: {str(e)}"
    
    @staticmethod
    def get_all_storybooks():
        """获取所有数据书"""
        try:
            storybooks_dir = PathManager.get_storybook_dir()
            storybooks = {}
            
            if storybooks_dir.exists():
                for json_file in storybooks_dir.glob("*.json"):
                    storybook_name = json_file.stem
                    try:
                        with open(json_file, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                        storybooks[storybook_name] = data
                    except Exception as e:
                        print(f"加载数据书 {storybook_name} 失败: {e}")
                        continue
            
            return storybooks, None
        except Exception as e:
            return {}, f"获取数据书列表失败: {str(e)}"
    
    @staticmethod
    def bind_storybook_to_character(storybook_name, character_name, character_type='role'):
        """绑定数据书到角色"""
        try:
            # 加载数据书
            data, error = StorybookAPIManager.load_storybook(storybook_name)
            if error:
                return False, error
            
            # 确保绑定字段存在
            binding_field = '捆绑角色' if character_type == 'role' else '捆绑玩家'
            if binding_field not in data:
                data[binding_field] = []
            
            # 添加角色到绑定列表（如果还未绑定）
            if character_name not in data[binding_field]:
                data[binding_field].append(character_name)
            
            # 保存数据书
            success, error = StorybookAPIManager.save_storybook(storybook_name, data, False)
            return success, error
        except Exception as e:
            return False, f"绑定数据书失败: {str(e)}"
    
    @staticmethod
    def unbind_storybook_from_character(storybook_name, character_name, character_type='role'):
        """从角色解绑数据书"""
        try:
            # 加载数据书
            data, error = StorybookAPIManager.load_storybook(storybook_name)
            if error:
                return False, error
            
            # 从绑定列表中移除角色
            binding_field = '捆绑角色' if character_type == 'role' else '捆绑玩家'
            if binding_field in data and character_name in data[binding_field]:
                data[binding_field].remove(character_name)
            
            # 保存数据书
            success, error = StorybookAPIManager.save_storybook(storybook_name, data, False)
            return success, error
        except Exception as e:
            return False, f"解绑数据书失败: {str(e)}"

# ========== 统一的数据书API路由 ==========

@storybook_api_bp.route('/api/v2/storybooks', methods=['GET'])
def get_storybooks():
    """获取所有数据书列表"""
    try:
        storybooks, error = StorybookAPIManager.get_all_storybooks()
        if error:
            return jsonify({'success': False, 'error': error}), 500
        
        # 转换为列表格式（兼容前端）
        storybooks_list = []
        for name, data in storybooks.items():
            storybook_info = {
                'name': name,
                'display_name': data.get('总结词', [name])[0] if data.get('总结词') else name,
                'summary': data.get('总结词', []),
                'keywords': data.get('关键词', []),
                'tags': data.get('标签', []),
                'description': data.get('描述', ''),
                'bound_roles': data.get('捆绑角色', []),
                'bound_players': data.get('捆绑玩家', []),
                'created_time': data.get('创建时间', ''),
                'updated_time': data.get('更新时间', '')
            }
            storybooks_list.append(storybook_info)
        
        return jsonify({
            'success': True,
            'storybooks': storybooks_list,
            'count': len(storybooks_list)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@storybook_api_bp.route('/api/v2/storybooks/<storybook_name>', methods=['GET'])
def get_storybook(storybook_name):
    """获取单个数据书内容"""
    try:
        data, error = StorybookAPIManager.load_storybook(storybook_name)
        if error:
            return jsonify({'success': False, 'error': error}), 404
        
        return jsonify({
            'success': True,
            'name': storybook_name,
            'data': data
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@storybook_api_bp.route('/api/v2/storybooks/<storybook_name>', methods=['POST', 'PUT'])
def save_storybook_v2(storybook_name):
    """创建或更新数据书"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': '请求数据为空'}), 400
        
        # 验证数据结构
        is_valid, validation_error = StorybookAPIManager.validate_storybook_data(data)
        if not is_valid:
            return jsonify({'success': False, 'error': validation_error}), 400
        
        # 检查是否为创建操作
        create_mode = request.method == 'POST'
        if create_mode:
            storybook_file = StorybookAPIManager.get_storybook_file_path(storybook_name)
            if storybook_file.exists():
                return jsonify({'success': False, 'error': '数据书已存在'}), 409
        
        # 保存数据书
        success, error = StorybookAPIManager.save_storybook(storybook_name, data, create_mode)
        if not success:
            return jsonify({'success': False, 'error': error}), 500
        
        return jsonify({
            'success': True,
            'message': '数据书保存成功',
            'name': storybook_name
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@storybook_api_bp.route('/api/v2/storybooks/<storybook_name>', methods=['DELETE'])
def delete_storybook_v2(storybook_name):
    """删除数据书"""
    try:
        success, error = StorybookAPIManager.delete_storybook(storybook_name)
        if not success:
            return jsonify({'success': False, 'error': error}), 404
        
        return jsonify({
            'success': True,
            'message': '数据书删除成功'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@storybook_api_bp.route('/api/v2/storybooks/<storybook_name>/bind', methods=['POST'])
def bind_storybook_v2(storybook_name):
    """绑定数据书到角色"""
    try:
        data = request.get_json()
        character_name = data.get('character_name')
        character_type = data.get('character_type', 'role')  # 'role' 或 'player'
        
        if not character_name:
            return jsonify({'success': False, 'error': '角色名称不能为空'}), 400
        
        success, error = StorybookAPIManager.bind_storybook_to_character(
            storybook_name, character_name, character_type
        )
        
        if not success:
            return jsonify({'success': False, 'error': error}), 500
        
        return jsonify({
            'success': True,
            'message': f'数据书已绑定到{character_type}：{character_name}'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@storybook_api_bp.route('/api/v2/storybooks/<storybook_name>/unbind', methods=['POST'])
def unbind_storybook_v2(storybook_name):
    """从角色解绑数据书"""
    try:
        data = request.get_json()
        character_name = data.get('character_name')
        character_type = data.get('character_type', 'role')
        
        if not character_name:
            return jsonify({'success': False, 'error': '角色名称不能为空'}), 400
        
        success, error = StorybookAPIManager.unbind_storybook_from_character(
            storybook_name, character_name, character_type
        )
        
        if not success:
            return jsonify({'success': False, 'error': error}), 500
        
        return jsonify({
            'success': True,
            'message': f'数据书已从{character_type}：{character_name}解绑'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@storybook_api_bp.route('/api/v2/storybooks/generate', methods=['POST'])
def generate_storybook_v2():
    """通过AI生成数据书"""
    try:
        data = request.get_json()
        character_name = data.get('character_name')
        description = data.get('description')
        bind_to_character = data.get('bind_to_character', True)
        character_type = data.get('character_type', 'role')
        
        if not character_name or not description:
            return jsonify({'success': False, 'error': '角色名称和描述不能为空'}), 400
        
        # 这里应该调用AI生成逻辑
        # 暂时返回一个基础模板
        generated_data = {
            "总结词": [character_name],
            "关键词": [],
            "属性": {
                "基本信息": {
                    "姓名": character_name,
                    "描述": description
                }
            },
            "标签": [],
            "描述": description,
            "捆绑角色": [character_name] if character_type == 'role' and bind_to_character else [],
            "捆绑玩家": [character_name] if character_type == 'player' and bind_to_character else []
        }
        
        # 保存生成的数据书
        success, error = StorybookAPIManager.save_storybook(character_name, generated_data)
        if not success:
            return jsonify({'success': False, 'error': error}), 500
        
        return jsonify({
            'success': True,
            'message': 'AI数据书生成成功',
            'name': character_name,
            'data': generated_data
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ========== 兼容性路由（向后兼容） ==========

@storybook_api_bp.route('/api/storybook/<storybook_name>', methods=['GET'])
def get_storybook_legacy(storybook_name):
    """兼容旧版API"""
    return get_storybook(storybook_name)

@storybook_api_bp.route('/api/storybook/save', methods=['POST'])
def save_storybook_legacy():
    """兼容旧版保存API"""
    try:
        data = request.get_json()
        storybook_name = data.get('name')
        storybook_data = data.get('data')
        bind_to_role = data.get('bind_to_role')
        
        if not storybook_name or not storybook_data:
            return jsonify({'success': False, 'error': '数据书名称和内容不能为空'}), 400
        
        # 保存数据书
        success, error = StorybookAPIManager.save_storybook(storybook_name, storybook_data)
        if not success:
            return jsonify({'success': False, 'error': error}), 500
        
        # 如果需要绑定到角色
        if bind_to_role:
            bind_success, bind_error = StorybookAPIManager.bind_storybook_to_character(
                storybook_name, bind_to_role, 'role'
            )
            if not bind_success:
                print(f"绑定警告: {bind_error}")
        
        return jsonify({
            'success': True,
            'message': '数据书保存成功'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@storybook_api_bp.route('/api/storybook/unbind', methods=['POST'])
def unbind_storybook_legacy():
    """兼容旧版解绑API"""
    try:
        data = request.get_json()
        storybook_name = data.get('storybook_name')
        role_name = data.get('role_name')
        
        if not storybook_name or not role_name:
            return jsonify({'success': False, 'error': '数据书名称和角色名称不能为空'}), 400
        
        success, error = StorybookAPIManager.unbind_storybook_from_character(
            storybook_name, role_name, 'role'
        )
        
        if not success:
            return jsonify({'success': False, 'error': error}), 500
        
        return jsonify({
            'success': True,
            'message': '数据书解绑成功'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@storybook_api_bp.route('/api/storybook/generate-from-description', methods=['POST'])
def generate_storybook_legacy():
    """兼容旧版AI生成API"""
    try:
        data = request.get_json()
        character_name = data.get('character_name')
        description = data.get('description')
        
        if not character_name or not description:
            return jsonify({'success': False, 'error': '角色名称和描述不能为空'}), 400
        
        # 调用新版生成API
        return generate_storybook_v2()
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
