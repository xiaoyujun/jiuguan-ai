"""
静态资源巡检脚本 / static_asset_audit.py
------------------------------------------------------------
扫描 web/templates/ 下所有 HTML 模板，检查：
    1. 模板中通过 {{ url_for('static', filename='...') }} 或 /static/...
       直接引用但实际不存在的 css/js 文件。
    2. web/static/ 下存在但没有任何模板引用的文件（疑似废弃）。

设计要点：
    - 不依赖 Flask 运行时，纯文件扫描。
    - 通过正则识别两种引用形式：
        a) url_for('static', filename='css/foo.css')
        b) /static/css/foo.css   （绝对路径写死）
    - 输出两类报告，便于后续清理。

用法：
    python web/static_asset_audit.py
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent           # web/
TEMPLATES_DIR = ROOT / 'templates'
STATIC_DIR = ROOT / 'static'

# 静态资源里我们关注的扩展名（其他扩展名用得少不强制扫描）
WATCH_EXT = {'.css', '.js'}

# 主动忽略的子目录（归档、临时、第三方库等）
IGNORE_STATIC_SUBDIRS = {'_archive'}

URL_FOR_RE = re.compile(
    r"""url_for\(\s*['"]static['"]\s*,\s*filename\s*=\s*['"]([^'"]+)['"]"""
)
ABS_STATIC_RE = re.compile(r"""/static/([^"'<>\s)]+)""")


def collect_template_refs() -> dict[str, list[Path]]:
    """返回 {static_relpath: [tpl1, tpl2]}。"""
    refs: dict[str, list[Path]] = {}
    if not TEMPLATES_DIR.exists():
        return refs

    for tpl in TEMPLATES_DIR.rglob('*.html'):
        try:
            text = tpl.read_text(encoding='utf-8')
        except UnicodeDecodeError:
            text = tpl.read_text(encoding='gbk', errors='ignore')

        for m in URL_FOR_RE.finditer(text):
            refs.setdefault(m.group(1), []).append(tpl)
        for m in ABS_STATIC_RE.finditer(text):
            refs.setdefault(m.group(1), []).append(tpl)
    return refs


def collect_static_files() -> set[str]:
    """返回 STATIC_DIR 下所有受关注扩展名的相对路径集合。"""
    found: set[str] = set()
    if not STATIC_DIR.exists():
        return found

    for path in STATIC_DIR.rglob('*'):
        if not path.is_file():
            continue
        if path.suffix.lower() not in WATCH_EXT:
            continue
        rel = path.relative_to(STATIC_DIR).as_posix()
        # 跳过归档目录
        head = rel.split('/', 1)[0]
        if head in IGNORE_STATIC_SUBDIRS:
            continue
        found.add(rel)
    return found


def main() -> int:
    refs = collect_template_refs()
    static_files = collect_static_files()

    referenced = {r for r in refs if Path(r).suffix.lower() in WATCH_EXT}

    # 1) 模板引用但缺失的文件
    missing = sorted(r for r in referenced if not (STATIC_DIR / r).exists())
    # 2) 存在但未被引用的文件
    unused = sorted(static_files - referenced)

    print('=== 静态资源巡检 ===')
    print(f'扫描目录 templates: {TEMPLATES_DIR}')
    print(f'扫描目录 static:    {STATIC_DIR}')
    print()

    if missing:
        print(f'[缺失] {len(missing)} 个模板引用了不存在的资源：')
        for m in missing:
            tpls = refs.get(m, [])
            print(f'  - {m}')
            for t in tpls[:3]:
                print(f'      引用自: {t.relative_to(ROOT)}')
            if len(tpls) > 3:
                print(f'      ... 共 {len(tpls)} 处引用')
    else:
        print('[缺失] 无')
    print()

    if unused:
        print(f'[未引用] {len(unused)} 个 static 文件在所有模板中都未被引用：')
        for u in unused:
            print(f'  - {u}')
        print('  注：可能被 JS 动态加载或其他静态资源 @import，删除前需人工确认。')
    else:
        print('[未引用] 无')

    print()
    if missing:
        print('结果：发现缺失引用，建议修复。')
        return 1
    print('结果：无缺失引用。')
    return 0


if __name__ == '__main__':
    sys.exit(main())
