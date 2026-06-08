"""生图 provider 抽象层。

把不同上游平台（OpenAI / Gemini）的细节包在统一接口里：
输入是 ``ImageRequest``，输出是 ``ImageResult``。所有 provider
仅接收编码后的参考图，避免文件句柄在调用栈里到处传递。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from ..reference_images import ReferenceImage


class ImageProviderError(RuntimeError):
    """生图 provider 调用过程中发生的错误。"""


@dataclass
class ImageRequest:
    """供 provider 使用的统一请求载荷。"""

    prompt: str
    model: str
    base_url: str
    api_key: str
    references: List[ReferenceImage] = field(default_factory=list)
    negative_prompt: str = ""
    size: str = "1024x1024"
    n: int = 1
    extra_body: Optional[Dict[str, Any]] = None
    extra_headers: Optional[Dict[str, str]] = None
    timeout: int = 180


@dataclass
class ImageResult:
    """provider 返回的统一结果结构。"""

    images: List[Tuple[str, bytes]]  # [(mime_type, bytes)]
    response_text: str = ""
    raw_payload: Optional[Dict[str, Any]] = None


class ImageProvider:
    """所有生图 provider 的基类。"""

    name: str = "base"

    def __init__(self, request: ImageRequest):
        self.request = request

    def generate(self) -> ImageResult:
        raise NotImplementedError

    # ---------------------------------------------------------------
    # 工具方法
    # ---------------------------------------------------------------
    @staticmethod
    def _ensure(condition: bool, message: str) -> None:
        if not condition:
            raise ImageProviderError(message)
