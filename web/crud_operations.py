"""
通用CRUD操作模块
提供统一的数据访问接口，减少重复代码
"""
from flask import Blueprint, request, jsonify
from pathlib import Path
import json
import yaml
from web.utils import DataManager, PathManager, FileManager
from typing import Dict, Any, List, Optional

class BaseCRUD:
    """基础CRUD操作类"""
    
    def __init__(self, data_type: str, file_extension: str = 'json'):
        self.data_type = data_type
        self.file_extension = file_extension
        self.data_dir = self._get_data_dir()
    
    def _get_data_dir(self) -> Path:
        """获取数据目录"""
        if self.data_type == 'role':
            return PathManager.get_roles_dir()
        elif self.data_type == 'storybook':
            return PathManager.get_storybook_dir()
        elif self.data_type == 'player':
            return PathManager.get_players_dir()
        elif self.data_type == 'global_worldbook':
            return PathManager.get_global_world_book_dir()
        else:
            raise ValueError(f"不支持的数据类型: {self.data_type}")
    
    def get_all(self) -> Dict[str, Any]:
        """获取所有数据"""
        data = {}
        if self.data_dir.exists():
            for file_path in self.data_dir.glob(f"*.{self.file_extension}"):
                item_name = file_path.stem
                try:
                    if self.file_extension == 'json':
                        item_data = FileManager.load_json_file(file_path)
                    else:
                        item_data = FileManager.load_yaml_file(file_path)
                    
                    if item_data:
                        data[item_name] = item_data
                except Exception as e:
                    print(f"加载{self.data_type} {item_name} 时出错: {e}")
                    continue
        return data
    
    def get_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """根据名称获取数据"""
        file_path = self.data_dir / f"{name}.{self.file_extension}"
        if file_path.exists():
            if self.file_extension == 'json':
                return FileManager.load_json_file(file_path)
            else:
                return FileManager.load_yaml_file(file_path)
        return None
    
    def create(self, name: str, data: Dict[str, Any]) -> bool:
        """创建新数据"""
        if not name:
            print(f"❌ [CRUD] 创建{self.data_type}失败: 名称为空")
            return False
        
        # 检查是否已存在
        file_path = self.data_dir / f"{name}.{self.file_extension}"
        if file_path.exists():
            print(f"❌ [CRUD] 创建{self.data_type}失败: {name} 已存在")
            return False
        
        print(f"💾 [CRUD] 创建{self.data_type}: {name}")
        print(f"📁 [CRUD] 文件路径: {file_path}")
        print(f"📄 [CRUD] 数据内容: {data}")
        
        # 确保目录存在
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        # 保存数据
        result = False
        if self.file_extension == 'json':
            result = FileManager.save_json_file(file_path, data)
        else:
            result = FileManager.save_yaml_file(file_path, data)
        
        if result:
            print(f"✅ [CRUD] {self.data_type} {name} 创建成功")
        else:
            print(f"❌ [CRUD] {self.data_type} {name} 创建失败")
        
        return result
    
    def update(self, name: str, data: Dict[str, Any]) -> bool:
        """更新数据"""
        if not name:
            print(f"❌ [CRUD] 更新{self.data_type}失败: 名称为空")
            return False
        
        file_path = self.data_dir / f"{name}.{self.file_extension}"
        
        print(f"🔄 [CRUD] 更新{self.data_type}: {name}")
        print(f"📁 [CRUD] 文件路径: {file_path}")
        print(f"📄 [CRUD] 数据内容: {data}")
        
        # 如果文件不存在，创建新文件
        if not file_path.exists():
            print(f"⚠️ [CRUD] 文件不存在，将创建新文件: {file_path}")
            self.data_dir.mkdir(parents=True, exist_ok=True)
        
        # 保存数据
        result = False
        if self.file_extension == 'json':
            result = FileManager.save_json_file(file_path, data)
        else:
            result = FileManager.save_yaml_file(file_path, data)
        
        if result:
            print(f"✅ [CRUD] {self.data_type} {name} 更新成功")
        else:
            print(f"❌ [CRUD] {self.data_type} {name} 更新失败")
        
        return result
    
    def delete(self, name: str) -> bool:
        """删除数据"""
        if not name:
            return False
        
        file_path = self.data_dir / f"{name}.{self.file_extension}"
        if file_path.exists():
            try:
                file_path.unlink()
                return True
            except Exception as e:
                print(f"删除{self.data_type} {name} 时出错: {e}")
                return False
        return False
    
    def exists(self, name: str) -> bool:
        """检查数据是否存在"""
        file_path = self.data_dir / f"{name}.{self.file_extension}"
        return file_path.exists()

# 创建各种数据类型的CRUD实例
role_crud = BaseCRUD('role', 'yml')
storybook_crud = BaseCRUD('storybook', 'json')
player_crud = BaseCRUD('player', 'yml')
global_worldbook_crud = BaseCRUD('global_worldbook', 'yml')

def create_crud_routes(bp: Blueprint, crud: BaseCRUD, route_prefix: str):
    """为蓝图创建CRUD路由"""
    
    @bp.route(f'{route_prefix}')
    def get_all():
        """获取所有数据"""
        try:
            data = crud.get_all()
            return jsonify(data)
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500
    
    @bp.route(f'{route_prefix}', methods=['POST'])
    def create():
        """创建新数据"""
        try:
            data = request.json
            name = data.get('name') or data.get(f'{crud.data_type}_name')
            
            if not name:
                return jsonify({'success': False, 'error': f'{crud.data_type}名称不能为空'}), 400
            
            if crud.exists(name):
                return jsonify({'success': False, 'error': f'{crud.data_type}已存在'}), 400
            
            # 移除名称字段，避免重复
            item_data = {k: v for k, v in data.items() if k not in ['name', f'{crud.data_type}_name']}
            
            if crud.create(name, item_data):
                return jsonify({'success': True})
            else:
                return jsonify({'success': False, 'error': f'创建{crud.data_type}失败'}), 500
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500
    
    @bp.route(f'{route_prefix}/<path:name>', methods=['PUT'])
    def update(name):
        """更新数据"""
        try:
            data = request.json
            
            # 移除名称字段，避免重复
            item_data = {k: v for k, v in data.items() if k not in ['name', f'{crud.data_type}_name']}
            
            if crud.update(name, item_data):
                return jsonify({'success': True})
            else:
                return jsonify({'success': False, 'error': f'更新{crud.data_type}失败'}), 500
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500
    
    @bp.route(f'{route_prefix}/<path:name>', methods=['DELETE'])
    def delete(name):
        """删除数据"""
        try:
            if crud.delete(name):
                return jsonify({'success': True})
            else:
                return jsonify({'success': False, 'error': f'删除{crud.data_type}失败'}), 500
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500
