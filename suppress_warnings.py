#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
全局警告抑制模块
在项目启动时导入此模块以抑制各种弃用警告
"""

import warnings

# 抑制 pkg_resources 弃用警告（来自 jieba 等库）
warnings.filterwarnings("ignore", category=UserWarning, message=".*pkg_resources.*")

# 抑制其他常见的弃用警告
warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", category=PendingDeprecationWarning)

print("警告抑制已启用")