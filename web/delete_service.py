"""
统一删除服务模块
整合所有删除相关的功能，减少重复代码
"""
from flask import Blueprint, request, jsonify
import sys
from pathlib import Path
import json
import urllib.parse
from web.history_manager import clear_chat_history, clear_story_temp_data, load_history, save_history
from web.crud_operations import role_crud, storybook_crud, player_crud, global_worldbook_crud
from web.utils import PathManager

delete_bp = Blueprint('delete', __name__)

class DeleteService:
    """统一删除服务类"""
    
    @staticmethod
    def delete_message(role_name, message_index):
        """删除聊天历史中的消息"""
        try:
            if message_index is None:
                return {'success': False, 'error': '缺少消息索引'}, 400
            
            # 加载当前历史
            history = load_history(role_name)
            
            # 检查索引是否有效
            if message_index < 0 or message_index >= len(history):
                return {'success': False, 'error': '消息索引无效'}, 400
            
            # 删除消息
            deleted_message = history.pop(message_index)
            
            # 保存更新后的历史
            save_history(history, role_name)
            
            return {
                'success': True, 
                'message': '消息已删除',
                'deleted_content': deleted_message
            }, 200
            
        except Exception as e:
            print(f"删除消息失败: {e}")
            return {'success': False, 'error': str(e)}, 500
    
    @staticmethod
    def clear_chat_history(role_name):
        """清除指定角色的聊天记录"""
        try:
            # URL解码角色名
            role_name = urllib.parse.unquote(role_name)
            
            # 调用清理函数
            clear_chat_history(role_name)
            
            return {
                'success': True, 
                'message': f'角色 {role_name} 的聊天记录已清除'
            }, 200
            
        except Exception as e:
            print(f"清除聊天记录失败: {e}")
            return {
                'success': False, 
                'error': f'清除聊天记录失败: {str(e)}'
            }, 500
    
    @staticmethod
    def clear_story_temp_data(role_name, player_info='用户'):
        """清除指定角色的数据书临时数据"""
        try:
            # URL解码角色名
            role_name = urllib.parse.unquote(role_name)
            
            # 调用清理函数
            clear_story_temp_data(role_name)
            
            return {
                'success': True, 
                'message': f'角色 {role_name} 的数据书临时数据已清除',
                'player': player_info
            }, 200
            
        except Exception as e:
            print(f"清除数据书临时数据失败: {e}")
            return {
                'success': False, 
                'error': f'清除数据书临时数据失败: {str(e)}'
            }, 500
    
    @staticmethod
    def delete_role(role_name):
        """删除角色（包括头像文件和绑定的数据书）"""
        try:
            print(f"尝试删除角色: {role_name}")
            
            if not role_crud.exists(role_name):
                return {'success': False, 'error': '角色不存在'}, 404
            
            deleted_files = []
            bound_storybooks = []
            
            # 使用自动绑定逻辑检查绑定的数据书
            bound_storybooks = []
            try:
                import sys
                from pathlib import Path
                parent_dir = Path(__file__).parent.parent
                if str(parent_dir) not in sys.path:
                    sys.path.insert(0, str(parent_dir))
                
                from auto_binding_utils import check_character_storybook_exists
                
                # 检查自动绑定
                if check_character_storybook_exists(role_name):
                    bound_storybooks.append(role_name)
                    print(f"角色 {role_name} 通过自动绑定绑定了同名数据书")
                        
            except Exception as e:
                print(f"检查角色绑定信息失败: {str(e)}")
                # 回退到检查同名数据书文件
                try:
                    storybook_dir = PathManager.get_storybook_dir()
                    same_name_storybook = storybook_dir / f"{role_name}.json"
                    if same_name_storybook.exists():
                        bound_storybooks.append(role_name)
                        print(f"发现同名数据书文件: {role_name}.json")
                except Exception as e2:
                    print(f"检查同名数据书文件失败: {str(e2)}")
            
            # 删除角色数据文件
            if role_crud.delete(role_name):
                deleted_files.append(f"{role_name}.yml")
                
                # 删除头像文件（如果存在）
                roles_dir = PathManager.get_roles_dir()
                for ext in ['png', 'jpg', 'jpeg', 'gif', 'webp']:
                    avatar_file = roles_dir / f"{role_name}.{ext}"
                    if avatar_file.exists():
                        avatar_file.unlink()
                        deleted_files.append(f"{role_name}.{ext}")
                        break
                
                # 删除绑定的数据书文件
                for storybook_name in bound_storybooks:
                    try:
                        if storybook_crud.exists(storybook_name):
                            if storybook_crud.delete(storybook_name):
                                deleted_files.append(f"{storybook_name}.json")
                                print(f"成功删除绑定的数据书: {storybook_name}")
                            else:
                                print(f"删除数据书失败: {storybook_name}")
                        else:
                            print(f"数据书不存在: {storybook_name}")
                    except Exception as e:
                        print(f"删除数据书 {storybook_name} 时出错: {str(e)}")
                
                print(f"成功删除文件: {deleted_files}")
                return {
                    'success': True, 
                    'deleted_files': deleted_files,
                    'deleted_storybooks': bound_storybooks
                }, 200
            else:
                return {'success': False, 'error': '删除角色失败'}, 500
        except Exception as e:
            print(f"删除角色失败: {str(e)}")
            return {'success': False, 'error': str(e)}, 500
    
    @staticmethod
    def delete_story(story_name):
        """删除数据书"""
        try:
            if storybook_crud.delete(story_name):
                return {'success': True}, 200
            else:
                return {'success': False, 'error': '数据书不存在或删除失败'}, 404
        except Exception as e:
            return {'success': False, 'error': str(e)}, 500
    
    @staticmethod
    def delete_player(player_name):
        """删除玩家"""
        try:
            if player_crud.delete(player_name):
                return {'success': True}, 200
            else:
                return {'success': False, 'error': '玩家不存在或删除失败'}, 404
        except Exception as e:
            return {'success': False, 'error': str(e)}, 500
    
    @staticmethod
    def delete_worldbook_entry(entry_name):
        """删除世界书条目"""
        try:
            if global_worldbook_crud.delete(entry_name):
                return {'success': True}, 200
            else:
                return {'success': False, 'error': '条目不存在或删除失败'}, 404
        except Exception as e:
            return {'success': False, 'error': str(e)}, 500

# 路由定义
@delete_bp.route('/delete_message', methods=['POST'])
def delete_message_route():
    """删除聊天历史中的消息"""
    data = request.json
    role_name = data.get('role', 'biabia')
    message_index = data.get('message_index')
    
    result, status_code = DeleteService.delete_message(role_name, message_index)
    return jsonify(result), status_code

@delete_bp.route('/clear_chat_history/<role>', methods=['POST'])
def clear_chat_history_route(role):
    """清除指定角色的聊天记录"""
    result, status_code = DeleteService.clear_chat_history(role)
    return jsonify(result), status_code

@delete_bp.route('/clear_story_temp_data/<role>', methods=['POST'])
def clear_story_temp_data_route(role):
    """清除指定角色的数据书临时数据"""
    player_info = request.json.get('player', '用户') if request.json else '用户'
    result, status_code = DeleteService.clear_story_temp_data(role, player_info)
    return jsonify(result), status_code

@delete_bp.route('/api/roles/<path:role_name>', methods=['DELETE'])
def delete_role_route(role_name):
    """删除角色"""
    result, status_code = DeleteService.delete_role(role_name)
    return jsonify(result), status_code

@delete_bp.route('/api/stories/<path:story_name>', methods=['DELETE'])
def delete_story_route(story_name):
    """删除数据书"""
    result, status_code = DeleteService.delete_story(story_name)
    return jsonify(result), status_code

@delete_bp.route('/api/players/<path:player_name>', methods=['DELETE'])
def delete_player_route(player_name):
    """删除玩家"""
    result, status_code = DeleteService.delete_player(player_name)
    return jsonify(result), status_code

@delete_bp.route('/api/global_worldbook/<path:entry_name>', methods=['DELETE'])
def delete_worldbook_entry_route(entry_name):
    """删除世界书条目"""
    result, status_code = DeleteService.delete_worldbook_entry(entry_name)
    return jsonify(result), status_code
