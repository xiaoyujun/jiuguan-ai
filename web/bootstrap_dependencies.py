"""
启动期依赖自检与自动补齐。

在 ``web/app_new.py`` 真正导入第三方依赖之前调用
``ensure_dependencies()``，缺什么就按"国内镜像优先"的顺序去拉。

镜像顺序（出现下载失败时依次回退）：
1. 清华 TUNA
2. 阿里云
3. 腾讯云
4. 华为云
5. 豆瓣
6. PyPI 官方

只要任意一个镜像装成功就停止，不会重复下载。
"""

from __future__ import annotations

import importlib
import os
import subprocess
import sys
from typing import Iterable, List, Tuple
from urllib.parse import urlparse

# 镜像列表：None 表示使用 PyPI 默认源（最后兜底）
PIP_MIRRORS: List[str | None] = [
    "https://pypi.tuna.tsinghua.edu.cn/simple/",
    "https://mirrors.aliyun.com/pypi/simple/",
    "https://mirrors.cloud.tencent.com/pypi/simple/",
    "https://repo.huaweicloud.com/repository/pypi/simple/",
    "https://pypi.douban.com/simple/",
    None,
]

# (pip 安装规格, 用于 import 的模块名, 是否关键依赖)
# 关键依赖装失败会终止启动；非关键依赖只警告。
REQUIRED_PACKAGES: List[Tuple[str, str, bool]] = [
    ("flask>=2.3.0", "flask", True),
    ("requests>=2.31.0", "requests", True),
    ("pyyaml>=6.0", "yaml", True),
    ("werkzeug>=2.3.0", "werkzeug", True),
    ("openai>=1.0.0", "openai", True),
    ("numpy>=1.21.0", "numpy", True),
    ("jieba>=0.42.1", "jieba", True),
    ("fuzzywuzzy>=0.18.0", "fuzzywuzzy", True),
    # python-levenshtein 在部分 Windows 环境需要编译，缺失时 fuzzywuzzy 仍能用，
    # 因此降级为非关键依赖，安装失败仅警告。
    ("python-levenshtein>=0.12.0", "Levenshtein", False),
]


def _is_installed(import_name: str) -> bool:
    if not import_name:
        return True
    try:
        importlib.import_module(import_name)
        return True
    except Exception:
        return False


def _format_mirror(mirror: str | None) -> str:
    return mirror if mirror else "PyPI 官方源"


def _pip_install(spec: str, mirror: str | None) -> bool:
    cmd = [
        sys.executable,
        "-m",
        "pip",
        "install",
        "--disable-pip-version-check",
        "--no-input",
        spec,
    ]
    if mirror:
        cmd += ["-i", mirror]
        host = urlparse(mirror).hostname
        if host:
            cmd += ["--trusted-host", host]

    print(f"  -> pip install {spec}  [{_format_mirror(mirror)}]")
    try:
        subprocess.check_call(cmd)
        return True
    except subprocess.CalledProcessError as exc:
        print(f"     × 安装失败 (exit={exc.returncode})")
        return False
    except FileNotFoundError as exc:
        print(f"     × 无法调用 pip: {exc}")
        return False


def _install_with_fallback(spec: str) -> bool:
    for mirror in PIP_MIRRORS:
        if _pip_install(spec, mirror):
            return True
    return False


def ensure_dependencies(packages: Iterable[Tuple[str, str, bool]] | None = None) -> bool:
    """
    检查并自动安装缺失的依赖。

    返回:
        bool: 所有关键依赖是否齐备。
    """
    # 允许通过环境变量跳过自动安装（CI / 离线场景）
    if os.environ.get("DISABLE_AUTO_INSTALL", "").strip().lower() in {"1", "true", "yes"}:
        return True

    package_list = list(packages) if packages is not None else REQUIRED_PACKAGES
    missing = [(spec, name, critical) for spec, name, critical in package_list if not _is_installed(name)]
    if not missing:
        return True

    print("=" * 60)
    print("⚠ 检测到缺少以下依赖，开始自动补齐（优先使用国内镜像）：")
    for spec, _, critical in missing:
        tag = "[关键]" if critical else "[可选]"
        print(f"  {tag} {spec}")
    print("=" * 60)

    failed_critical: List[str] = []
    failed_optional: List[str] = []

    for spec, name, critical in missing:
        ok = _install_with_fallback(spec)
        if ok:
            importlib.invalidate_caches()
            try:
                importlib.import_module(name)
                print(f"✅ {spec} 已就绪")
                continue
            except Exception as exc:
                print(f"⚠ {spec} 安装成功但仍无法 import: {exc}")
                ok = False

        if not ok:
            (failed_critical if critical else failed_optional).append(spec)
            level = "❌" if critical else "⚠"
            print(f"{level} {spec} 在所有镜像下都未能安装")

    if failed_optional:
        print("\n以下可选依赖未能自动安装（不影响启动，但可能影响相关功能）：")
        for spec in failed_optional:
            print(f"  - {spec}")

    if failed_critical:
        print("\n以下关键依赖未能自动安装，应用将无法启动：")
        for spec in failed_critical:
            print(f"  - {spec}")
        print("请检查网络连接，或手动执行：")
        print(f"  {sys.executable} -m pip install " + " ".join(failed_critical))
        return False

    return True


if __name__ == "__main__":
    success = ensure_dependencies()
    sys.exit(0 if success else 1)
