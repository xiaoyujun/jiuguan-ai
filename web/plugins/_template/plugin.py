"""
插件模板
复制此目录并重命名为你的插件名称，然后修改内容
"""
from flask import jsonify, request
from pathlib import Path
import sys

# 添加父目录到路径
sys.path.append(str(Path(__file__).parent.parent.parent))

from web.plugins.plugin_base import PluginBase


class TemplatePlugin(PluginBase):
    """插件模板类"""
    
    def get_plugin_info(self):
        """返回插件信息"""
        return {
            'id': 'template-plugin',           # TODO: 修改为你的插件ID
            'name': '模板插件',                 # TODO: 修改为你的插件名称
            'version': '1.0.0',
            'description': '这是一个插件模板',  # TODO: 修改描述
            'author': '你的名字',               # TODO: 修改作者
            'icon': '🔧'                       # TODO: 选择合适的emoji
        }
    
    def initialize(self):
        """初始化插件"""
        try:
            # 1. 创建蓝图
            bp = self.create_blueprint('template_plugin', __name__)
            
            # 2. 注册路由
            self.register_routes(bp)
            
            # 3. 注册斜杠命令
            self.register_command({
                'id': 'template-command',
                'name': '模板命令',
                'description': '执行模板操作',
                'icon': '⚡',
                'category': 'plugin',
                'action': 'executeTemplateCommand'
            })
            
            # 4. 注册静态文件
            plugin_dir = Path(__file__).parent
            js_file = plugin_dir / 'static' / 'script.js'
            css_file = plugin_dir / 'static' / 'style.css'
            
            if js_file.exists():
                self.register_static_file('js', str(js_file), 'body')
            if css_file.exists():
                self.register_static_file('css', str(css_file), 'head')
            
            print("✅ 模板插件初始化成功")
            return True
            
        except Exception as e:
            print(f"❌ 模板插件初始化失败: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def register_routes(self, bp):
        """注册Flask路由"""
        
        @bp.route('/hello', methods=['GET'])
        def hello():
            """示例：Hello World API"""
            return jsonify({
                'success': True,
                'message': 'Hello from template plugin!'
            })
        
        @bp.route('/process', methods=['POST'])
        def process():
            """示例：处理POST请求"""
            try:
                data = request.json
                role_name = data.get('role_name')
                
                # TODO: 在这里实现你的逻辑
                
                return jsonify({
                    'success': True,
                    'message': f'处理完成: {role_name}'
                })
                
            except Exception as e:
                return jsonify({
                    'success': False,
                    'error': str(e)
                }), 500
    
    def on_enable(self):
        """插件启用时的回调"""
        print("🔧 模板插件已启用")
    
    def on_disable(self):
        """插件禁用时的回调"""
        print("🔧 模板插件已禁用")

