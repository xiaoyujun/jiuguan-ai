"""
玩家管理路由
"""
from flask import Blueprint, render_template, session, redirect, url_for

# 创建玩家管理蓝图
player_management_bp = Blueprint('player_management', __name__)

@player_management_bp.route('/player-management')
def player_management():
    """玩家管理页面"""
    # 沿用全局认证中间件，无需额外检查
    return render_template('player_management.html')
