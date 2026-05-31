#!/usr/bin/env python3
"""
全局世界书数据迁移脚本
将现有的全局世界书文件转换为新的关键词世界书格式
"""

import yaml
import sys
from pathlib import Path
from web.utils import PathManager
from web.core.keyword_world_book import keyword_worldbook

def migrate_old_worldbook():
    """迁移旧的全局世界书数据"""
    old_worldbook_dir = PathManager.get_global_world_book_dir()
    
    if not old_worldbook_dir.exists():
        print("❌ 未找到全局世界书目录")
        return False
    
    success_count = 0
    error_count = 0
    
    print(f"🔄 开始迁移全局世界书数据...")
    print(f"📁 源目录: {old_worldbook_dir}")
    
    for yml_file in old_worldbook_dir.glob("*.yml"):
        try:
            print(f"\n📄 处理文件: {yml_file.name}")
            
            with open(yml_file, 'r', encoding='utf-8') as f:
                old_data = yaml.safe_load(f)
            
            if not old_data:
                print(f"⚠️  文件 {yml_file.name} 为空，跳过")
                continue
            
            # 提取条目名称
            entry_name = yml_file.stem
            
            # 解析旧格式数据
            description = ""
            keywords = [entry_name]  # 默认使用文件名作为关键词
            category = "迁移数据"
            
            if isinstance(old_data, dict):
                # 尝试提取描述信息
                if '介绍' in old_data:
                    description = str(old_data['介绍'])
                elif '描述' in old_data:
                    description = str(old_data['描述'])
                elif '世界观' in old_data:
                    description = str(old_data['世界观'])
                elif '背景' in old_data:
                    description = str(old_data['背景'])
                else:
                    # 将整个数据结构转换为描述
                    description = yaml.dump(old_data, default_flow_style=False, allow_unicode=True)
                
                # 尝试提取关键词
                if '关键词' in old_data and isinstance(old_data['关键词'], list):
                    keywords = old_data['关键词']
                elif '名字' in old_data:
                    keywords = [old_data['名字']]
                
                # 提取分类
                if '分类' in old_data:
                    category = str(old_data['分类'])
            
            elif isinstance(old_data, str):
                description = old_data
            
            else:
                description = yaml.dump(old_data, default_flow_style=False, allow_unicode=True)
            
            # 创建新的关键词世界书条目
            if not description:
                description = f"从旧世界书文件 {yml_file.name} 迁移的数据"
            
            success = keyword_worldbook.create_entry(
                name=entry_name,
                description=description,
                keywords=keywords,
                category=category,
                priority=2  # 中等优先级
            )
            
            if success:
                print(f"✅ 成功迁移: {entry_name}")
                print(f"   📝 描述: {description[:100]}{'...' if len(description) > 100 else ''}")
                print(f"   🏷️  关键词: {', '.join(keywords)}")
                print(f"   📂 分类: {category}")
                success_count += 1
            else:
                print(f"❌ 迁移失败: {entry_name} (可能已存在)")
                error_count += 1
                
        except Exception as e:
            print(f"❌ 处理文件 {yml_file.name} 时出错: {e}")
            error_count += 1
    
    print(f"\n🎯 迁移完成!")
    print(f"   ✅ 成功: {success_count} 个条目")
    print(f"   ❌ 失败: {error_count} 个条目")
    
    if success_count > 0:
        print(f"\n💡 提示:")
        print(f"   - 已将旧数据迁移到新的智能世界书系统")
        print(f"   - 可以在 Web 界面中进一步编辑关键词和分类")
        print(f"   - 建议备份原有的全局世界书目录")
    
    return success_count > 0


if __name__ == "__main__":
    print("🚀 全局世界书数据迁移工具")
    print("=" * 50)
    
    try:
        if migrate_old_worldbook():
            print("\n🎉 迁移成功! 现在可以使用新的智能世界书功能了。")
        else:
            print("\n⚠️  没有数据被迁移。")
    except Exception as e:
        print(f"\n💥 迁移过程中发生错误: {e}")
        sys.exit(1)
