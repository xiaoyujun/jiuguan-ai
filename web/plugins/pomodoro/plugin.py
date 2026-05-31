"""
番茄钟插件
提供专注计时功能，完成后可向角色发送消息
"""
from flask import jsonify, request
from pathlib import Path
import sys
import datetime

# 添加父目录到路径
sys.path.append(str(Path(__file__).parent.parent.parent))

from web.plugins.plugin_base import PluginBase


class PomodoroPlugin(PluginBase):
    """番茄钟插件类"""
    
    def get_plugin_info(self):
        """返回插件信息"""
        return {
            'id': 'pomodoro',
            'name': '炼金时钟',
            'version': '1.0.0',
            'description': '神秘学番茄钟计时器，专注时光的炼金术',
            'author': '密教大会',
            'icon': '⏳'
        }
    
    def initialize(self):
        """初始化插件"""
        try:
            # 1. 创建蓝图
            bp = self.create_blueprint('pomodoro', __name__)
            
            # 2. 注册路由
            self.register_routes(bp)
            
            # 3. 注册斜杠命令
            self.register_command({
                'id': 'pomodoro-start',
                'name': '炼金时钟',
                'description': '开启专注时光的炼金仪式',
                'icon': '⏳',
                'category': 'plugin',
                'action': 'executePomodoroCommand'
            })
            
            # 4. 注册静态文件
            plugin_dir = Path(__file__).parent
            js_file = plugin_dir / 'static' / 'script.js'
            css_file = plugin_dir / 'static' / 'style.css'
            
            if js_file.exists():
                self.register_static_file('js', str(js_file), 'body')
            if css_file.exists():
                self.register_static_file('css', str(css_file), 'head')
            
            print("✅ 炼金时钟插件初始化成功")
            return True
            
        except Exception as e:
            print(f"❌ 炼金时钟插件初始化失败: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def register_routes(self, bp):
        """注册Flask路由"""
        
        @bp.route('/complete', methods=['POST'])
        def complete_pomodoro():
            """番茄钟完成处理"""
            try:
                data = request.json
                role_name = data.get('role_name')
                duration = data.get('duration', 25)
                completed_count = data.get('completed_count', 1)
                
                # 记录完成时间
                timestamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                
                return jsonify({
                    'success': True,
                    'message': f'专注仪式完成！持续 {duration} 分钟',
                    'timestamp': timestamp,
                    'completed_count': completed_count
                })
                
            except Exception as e:
                return jsonify({
                    'success': False,
                    'error': str(e)
                }), 500
        
        @bp.route('/trigger-message', methods=['POST'])
        def trigger_message():
            """触发角色发送鼓励消息"""
            try:
                data = request.json
                role_name = data.get('role_name')
                duration = data.get('duration', 25)
                completed_count = data.get('completed_count', 1)
                custom_message = data.get('custom_message', '')
                
                # 构建系统提示
                if custom_message:
                    prompt = f"[系统提示] {custom_message}"
                else:
                    prompt = f"[系统提示] 用户刚刚完成了一个 {duration} 分钟的专注时段（今日第 {completed_count} 次），请鼓励并称赞用户的努力"
                
                return jsonify({
                    'success': True,
                    'prompt': prompt,
                    'role_name': role_name
                })
                
            except Exception as e:
                return jsonify({
                    'success': False,
                    'error': str(e)
                }), 500
        
        @bp.route('/stats', methods=['GET'])
        def get_stats():
            """获取统计信息（可扩展）"""
            try:
                # 未来可以添加数据库存储
                return jsonify({
                    'success': True,
                    'message': '统计功能开发中'
                })
            except Exception as e:
                return jsonify({
                    'success': False,
                    'error': str(e)
                }), 500
    
    def on_enable(self):
        """插件启用时的回调"""
        print("⏳ 炼金时钟插件已启用")
    
    def on_disable(self):
        """插件禁用时的回调"""
        print("⏳ 炼金时钟插件已禁用")

