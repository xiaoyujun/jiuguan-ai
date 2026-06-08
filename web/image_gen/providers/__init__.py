"""生图 provider 注册表。"""

from typing import Dict, Type

from .base import ImageProvider, ImageProviderError, ImageRequest, ImageResult
from .gemini import GeminiImageProvider
from .openai_image import OpenAIImageProvider


_PROVIDER_REGISTRY: Dict[str, Type[ImageProvider]] = {
    "openai": OpenAIImageProvider,
    "gemini": GeminiImageProvider,
}


def get_provider(api_format: str) -> Type[ImageProvider]:
    key = (api_format or "openai").strip().lower()
    if key not in _PROVIDER_REGISTRY:
        raise ImageProviderError(f"未知的生图 API 格式: {api_format}")
    return _PROVIDER_REGISTRY[key]


def available_formats() -> tuple:
    return tuple(_PROVIDER_REGISTRY.keys())


__all__ = [
    "ImageProvider",
    "ImageProviderError",
    "ImageRequest",
    "ImageResult",
    "GeminiImageProvider",
    "OpenAIImageProvider",
    "get_provider",
    "available_formats",
]
