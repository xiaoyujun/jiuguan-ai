#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
密码重置脚本
将所有模块的密码重置为指定密码
"""

import json
from werkzeug.security import generate_password_hash
from pathlib import Path
from web.utils import PathManager

def reset_passwords(new_password="majiaoyu666"):
    """重置所有密码"""
    config_path = PathManager.get_config_path()
    
    if not config_path.exists():
        print("错误：config.json 文件不存在")
        return False
    
    try:
        # 读取配置文件
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        print(f"正在重置密码为: {new_password}")
        
        # 生成新的密码哈希
        new_password_hash = generate_password_hash(new_password)
        
        # 更新所有模块的密码
        if 'passwords' not in config:
            config['passwords'] = {}
        
        config['passwords']['chat'] = new_password_hash
        config['passwords']['storybook'] = new_password_hash
        config['passwords']['admin'] = new_password_hash
        
        # 同时更新旧格式的密码字段（如果存在）
        config['password'] = new_password
        
        # 保存配置文件
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=4)
        
        print("密码重置成功！")
        print("已更新的模块:")
        print("- chat (聊天模块)")
        print("- storybook (数据书模块)")
        print("- admin (管理员模块)")
        print(f"新密码: {new_password}")
        
        return True
        
    except Exception as e:
        print(f"密码重置失败: {str(e)}")
        return False

if __name__ == "__main__":
    print("=== 密码重置工具 ===")
    print("此工具将重置所有模块的密码")
    
    # 可以在这里修改密码
    password = "majiaoyu666"
    
    success = reset_passwords(password)
    
    if success:
        print("\n密码重置完成！请重新启动应用程序以使更改生效。")
    else:
        print("\n密码重置失败，请检查错误信息。")
