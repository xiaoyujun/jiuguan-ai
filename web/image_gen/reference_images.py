"""
参考图查找。

`/生图` 与 `/生成图片第一人称` 都需要在调用上游模型时附上一组
参考图，强约束最终成图的角色相貌。这里集中处理「角色名 → 头像
文件」的查找、读取与 base64 化。
"""

from __future__ import annotations

import base64
import mimetypes
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional, Sequence

from web.utils import PathManager


# 与 `/avatar/<name>` 路由保持一致的扩展名顺序
_AVATAR_EXTENSIONS: Sequence[str] = ("png", "jpg", "jpeg", "webp", "gif")

# `@角色名` 解析：和前端 character_reply_handler 的解析口径保持一致，
# 仅识别非空白、非标点的连续字符
_MENTION_PATTERN = re.compile(r"@([^\s,，。.!！?？:：;；@]+)")


@dataclass(frozen=True)
class ReferenceImage:
    """供生图 provider 使用的参考图载荷。"""

    name: str
    path: Path
    mime_type: str
    data_base64: str

    @property
    def data_bytes(self) -> bytes:
        return base64.b64decode(self.data_base64)


def _detect_mime(path: Path) -> str:
    mime, _ = mimetypes.guess_type(str(path))
    if mime:
        return mime
    suffix = path.suffix.lower().lstrip(".")
    if suffix in {"jpg", "jpeg"}:
        return "image/jpeg"
    if suffix == "png":
        return "image/png"
    if suffix == "webp":
        return "image/webp"
    if suffix == "gif":
        return "image/gif"
    # 兜底：用 PNG，多数 vision 模型对 PNG 的兼容性最好
    return "image/png"


def _find_avatar_file(name: str) -> Optional[Path]:
    """在角色目录、玩家目录中按扩展名顺序查找头像。"""
    if not name:
        return None

    cleaned = name.strip()
    if not cleaned:
        return None

    candidates: Iterable[Path] = (
        PathManager.get_roles_dir(),
        PathManager.get_players_dir(),
    )
    for base_dir in candidates:
        for ext in _AVATAR_EXTENSIONS:
            candidate = base_dir / f"{cleaned}.{ext}"
            if candidate.exists():
                return candidate
    return None


def load_reference_image(name: str) -> Optional[ReferenceImage]:
    """读取一个角色 / 玩家的头像作为参考图。"""
    avatar = _find_avatar_file(name)
    if avatar is None:
        return None

    try:
        raw = avatar.read_bytes()
    except OSError as exc:
        print(f"⚠️ 读取参考图失败 {avatar}: {exc}")
        return None

    return ReferenceImage(
        name=name.strip(),
        path=avatar,
        mime_type=_detect_mime(avatar),
        data_base64=base64.b64encode(raw).decode("ascii"),
    )


def extract_mentioned_names(text: str) -> List[str]:
    """从一段文本里抽取 `@xxx` 形式的角色名，按出现顺序去重。"""
    if not text:
        return []
    seen: List[str] = []
    for match in _MENTION_PATTERN.finditer(text):
        candidate = match.group(1).strip()
        if candidate and candidate not in seen:
            seen.append(candidate)
    return seen


def collect_reference_images(
    *,
    primary_name: Optional[str],
    extra_names: Sequence[str] = (),
    max_images: int = 4,
) -> List[ReferenceImage]:
    """
    汇总参考图。

    Args:
        primary_name: 主角色 / 玩家名，最高优先级
        extra_names: 其他需要纳入的名字（例如显式 @ 提及）
        max_images: 上限，避免一次塞太多图把请求体撑爆

    Returns:
        去重后的参考图列表，按「主角色 → 提及顺序」排列
    """
    if max_images <= 0:
        return []

    ordered: List[str] = []
    if primary_name:
        ordered.append(primary_name.strip())
    for name in extra_names:
        cleaned = (name or "").strip()
        if cleaned and cleaned not in ordered:
            ordered.append(cleaned)

    references: List[ReferenceImage] = []
    seen_paths = set()
    for name in ordered:
        if len(references) >= max_images:
            break
        image = load_reference_image(name)
        if image is None:
            continue
        if image.path in seen_paths:
            continue
        seen_paths.add(image.path)
        references.append(image)
    return references
