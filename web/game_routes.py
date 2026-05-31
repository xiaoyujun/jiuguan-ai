"""
游戏路由模块
提供游戏工具的路由管理和自动发现功能
支持通过/指令访问游戏，自动扫描game_Tools目录
"""

from flask import Blueprint, render_template, jsonify, request, send_from_directory
import os
import json
from pathlib import Path
from web.utils import PathManager

# 创建游戏蓝图
game_bp = Blueprint('game', __name__)

class GameManager:
    """游戏管理器，负责游戏的发现和管理"""
    
    def __init__(self):
        self.games_dir = Path(__file__).parent / 'game_Tools'
        self._games_cache = None
    
    def discover_games(self):
        """自动发现游戏工具目录中的所有游戏"""
        if self._games_cache is not None:
            return self._games_cache
            
        games = []
        
        try:
            # 扫描game_Tools目录
            if not self.games_dir.exists():
                print(f"⚠️ 游戏目录不存在: {self.games_dir}")
                return []
            
            for item in self.games_dir.iterdir():
                if item.is_dir() and not item.name.startswith('_'):
                    game_info = self._extract_game_info(item)
                    if game_info:
                        games.append(game_info)
                        print(f"✅ 发现游戏: {game_info['name']} ({game_info['id']})")
            
            # 按名称排序
            games.sort(key=lambda x: x['name'])
            self._games_cache = games
            
        except Exception as e:
            print(f"❌ 扫描游戏目录失败: {e}")
            return []
        
        return games
    
    def _extract_game_info(self, game_dir):
        """从游戏目录提取游戏信息"""
        try:
            game_id = game_dir.name
            index_file = game_dir / 'index.html'
            readme_file = game_dir / 'README.md'
            
            # 检查是否有index.html文件
            if not index_file.exists():
                print(f"⚠️ 游戏 {game_id} 缺少 index.html，跳过")
                return None
            
            # 默认游戏信息
            game_info = {
                'id': game_id,
                'name': game_id,
                'description': f'{game_id}小游戏',
                'icon': '🎮',
                'category': 'game',
                'path': f'/games/{game_id}',
                'has_score_processor': False
            }
            
            # 从README.md读取详细信息
            if readme_file.exists():
                try:
                    readme_content = readme_file.read_text(encoding='utf-8')
                    game_info.update(self._parse_readme(readme_content, game_id))
                except Exception as e:
                    print(f"⚠️ 读取 {game_id}/README.md 失败: {e}")
            
            # 从index.html读取标题
            try:
                index_content = index_file.read_text(encoding='utf-8')
                title = self._extract_title_from_html(index_content)
                if title:
                    game_info['name'] = title
            except Exception as e:
                print(f"⚠️ 读取 {game_id}/index.html 标题失败: {e}")
            
            # 检查是否集成了分数处理器
            script_file = game_dir / 'script.js'
            if script_file.exists():
                try:
                    script_content = script_file.read_text(encoding='utf-8')
                    if 'sendScoreToChat' in script_content or 'game_score_processor' in script_content:
                        game_info['has_score_processor'] = True
                except Exception as e:
                    print(f"⚠️ 检查 {game_id}/script.js 失败: {e}")
            
            return game_info
            
        except Exception as e:
            print(f"❌ 提取游戏信息失败 ({game_dir.name}): {e}")
            return None
    
    def _parse_readme(self, content, game_id):
        """从README内容中解析游戏信息"""
        info = {}
        
        lines = content.split('\n')
        for i, line in enumerate(lines):
            line = line.strip()
            
            # 提取标题（第一个#标题）
            if line.startswith('# ') and 'name' not in info:
                info['name'] = line[2:].strip()
            
            # 提取描述（## 描述或## 概述下的内容）
            elif line.startswith('## ') and ('描述' in line or '概述' in line or 'Description' in line):
                desc_lines = []
                for j in range(i + 1, len(lines)):
                    next_line = lines[j].strip()
                    if next_line.startswith('#'):
                        break
                    if next_line:
                        desc_lines.append(next_line)
                if desc_lines:
                    info['description'] = ' '.join(desc_lines)
            
            # 提取图标（寻找emoji）
            elif any(emoji in line for emoji in ['🎯', '🎮', '🎲', '🏹', '🔫', '⚡', '🎊']):
                for char in line:
                    if ord(char) > 127:  # 简单的emoji检测
                        info['icon'] = char
                        break
        
        # 根据游戏ID设置默认图标
        if 'icon' not in info:
            icon_map = {
                'D100': '🎲',
                'FPS': '🎯', 
                'FC': '🎮',
                'FlappyBird': '🐦',
                'Minesweeper': '💣'
            }
            info['icon'] = icon_map.get(game_id, '🎮')
        
        return info
    
    def _extract_title_from_html(self, content):
        """从HTML内容中提取标题"""
        import re
        
        # 提取<title>标签内容
        title_match = re.search(r'<title[^>]*>([^<]+)</title>', content, re.IGNORECASE)
        if title_match:
            title = title_match.group(1).strip()
            # 清理标题，移除常见后缀
            title = re.sub(r'\s*[·•\-]\s*.*$', '', title)
            return title
        
        # 提取第一个h1标签内容
        h1_match = re.search(r'<h1[^>]*>([^<]+)</h1>', content, re.IGNORECASE)
        if h1_match:
            return h1_match.group(1).strip()
        
        return None
    
    def get_game_by_id(self, game_id):
        """根据ID获取游戏信息"""
        games = self.discover_games()
        for game in games:
            if game['id'].lower() == game_id.lower():
                return game
        return None
    
    def refresh_cache(self):
        """刷新游戏缓存"""
        self._games_cache = None
        return self.discover_games()

# 创建全局游戏管理器实例
game_manager = GameManager()

@game_bp.route('/games')
def games_index():
    """游戏列表页面"""
    games = game_manager.discover_games()
    return render_template('games_index.html', games=games)

@game_bp.route('/games/<game_id>')
def game_page(game_id):
    """游戏页面"""
    game = game_manager.get_game_by_id(game_id)
    if not game:
        return f"游戏 '{game_id}' 不存在", 404
    
    # 直接返回游戏的index.html文件
    game_dir = game_manager.games_dir / game_id
    index_file = game_dir / 'index.html'
    
    if not index_file.exists():
        return f"游戏 '{game_id}' 的文件不存在", 404
    
    try:
        # 读取并返回HTML内容
        html_content = index_file.read_text(encoding='utf-8')
        
        # 修改资源路径，使其相对于game_Tools目录
        html_content = html_content.replace('href="style.css"', f'href="/game_Tools/{game_id}/style.css"')
        html_content = html_content.replace('src="script.js"', f'src="/game_Tools/{game_id}/script.js"')
        
        # 添加关闭游戏的功能
        close_script = """
        <script>
        function closeGame() {
            if (window.parent && window.parent !== window) {
                // 如果在iframe中，通知父窗口关闭
                window.parent.postMessage({action: 'closeGame'}, '*');
            } else {
                // 如果在独立窗口中，返回游戏列表
                window.location.href = '/games';
            }
        }
        </script>
        """
        
        # 在</body>前插入关闭脚本
        html_content = html_content.replace('</body>', close_script + '</body>')
        
        from flask import Response
        return Response(html_content, mimetype='text/html')
        
    except Exception as e:
        print(f"❌ 读取游戏文件失败: {e}")
        return f"加载游戏失败: {str(e)}", 500

@game_bp.route('/api/games')
def api_games_list():
    """API: 获取游戏列表"""
    try:
        games = game_manager.discover_games()
        return jsonify({
            'success': True,
            'games': games,
            'count': len(games)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@game_bp.route('/api/games/refresh')
def api_refresh_games():
    """API: 刷新游戏列表"""
    try:
        games = game_manager.refresh_cache()
        return jsonify({
            'success': True,
            'message': '游戏列表已刷新',
            'games': games,
            'count': len(games)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@game_bp.route('/api/games/<game_id>')
def api_game_info(game_id):
    """API: 获取指定游戏信息"""
    try:
        game = game_manager.get_game_by_id(game_id)
        if not game:
            return jsonify({
                'success': False,
                'error': f'游戏 {game_id} 不存在'
            }), 404
        
        return jsonify({
            'success': True,
            'game': game
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@game_bp.route('/api/games/<game_id>/launch')
def api_launch_game(game_id):
    """API: 启动游戏（返回游戏URL）"""
    try:
        game = game_manager.get_game_by_id(game_id)
        if not game:
            return jsonify({
                'success': False,
                'error': f'游戏 {game_id} 不存在'
            }), 404
        
        return jsonify({
            'success': True,
            'game': game,
            'url': f'/games/{game_id}',
            'message': f'游戏 {game["name"]} 准备就绪'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
