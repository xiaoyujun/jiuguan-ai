"""OpenAI 风格的生图 provider。

使用 ``/v1/images/edits`` (multipart) 调用 gpt-image-1 等支持
图像编辑接口的模型，从而把角色头像作为强参考图传入；如果用户
未传任何参考图，则降级走 ``/v1/images/generations``。

尽量沿用上游通用的 OpenAI 接口契约，因此自建网关、第三方代理
（poxian / SiliconFlow 等）都能直接对接。
"""

from __future__ import annotations

import base64
import io
import json
import mimetypes
from typing import Any, Dict, List, Optional, Tuple

import requests

from .base import ImageProvider, ImageProviderError, ImageResult


class OpenAIImageProvider(ImageProvider):
    name = "openai"

    def generate(self) -> ImageResult:
        req = self.request
        self._ensure(bool(req.base_url), "供应商基础 URL 不能为空")
        self._ensure(bool(req.model), "模型 ID 不能为空")

        endpoint, payload, files = self._build_request()
        headers = self._build_headers()

        response = requests.post(
            endpoint,
            data=payload,
            files=files,
            headers=headers,
            timeout=req.timeout,
        )

        if response.status_code >= 400:
            raise ImageProviderError(
                f"OpenAI 生图接口返回 HTTP {response.status_code}: {response.text[:500]}"
            )

        try:
            body = response.json()
        except ValueError as exc:
            raise ImageProviderError(f"OpenAI 生图返回非 JSON: {exc}: {response.text[:200]}") from exc

        images = self._parse_images(body)
        if not images:
            raise ImageProviderError(f"OpenAI 生图未返回任何图像: {body!r}")

        return ImageResult(images=images, response_text="", raw_payload=body)

    # ---------------------------------------------------------------
    def _build_headers(self) -> Dict[str, str]:
        headers = {"Accept": "application/json"}
        if self.request.api_key:
            headers["Authorization"] = f"Bearer {self.request.api_key}"
        if self.request.extra_headers:
            headers.update(self.request.extra_headers)
        return headers

    def _build_request(self) -> Tuple[str, Dict[str, Any], Optional[List[Tuple[str, Tuple[str, io.BytesIO, str]]]]]:
        req = self.request
        base = req.base_url.rstrip("/")

        prompt = req.prompt
        if req.negative_prompt:
            prompt = f"{prompt}\n\n[negative prompt] {req.negative_prompt}"

        common: Dict[str, Any] = {
            "model": req.model,
            "prompt": prompt,
            "n": str(max(1, req.n)),
            "size": req.size,
        }
        if req.extra_body:
            for key, value in req.extra_body.items():
                # 仅写入字符串化值，OpenAI multipart 不接受嵌套结构
                if value is None:
                    continue
                common[key] = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)

        if req.references:
            files: List[Tuple[str, Tuple[str, io.BytesIO, str]]] = []
            for index, image in enumerate(req.references):
                # OpenAI image edits 支持多张参考图，多次传同名字段即可
                filename = self._reference_filename(image.path.name, image.mime_type, index)
                files.append(
                    (
                        "image[]",
                        (filename, io.BytesIO(image.data_bytes), image.mime_type),
                    )
                )
            return f"{base}/images/edits", common, files

        return f"{base}/images/generations", common, None

    def _reference_filename(self, original: str, mime: str, index: int) -> str:
        if "." in original:
            return original
        ext = mimetypes.guess_extension(mime) or ".png"
        return f"reference_{index}{ext}"

    def _parse_images(self, body: Dict[str, Any]) -> List[Tuple[str, bytes]]:
        data = body.get("data") or []
        images: List[Tuple[str, bytes]] = []
        for item in data:
            if not isinstance(item, dict):
                continue
            b64 = item.get("b64_json") or item.get("b64Json")
            if b64:
                try:
                    images.append(("image/png", base64.b64decode(b64)))
                except (TypeError, ValueError) as exc:
                    raise ImageProviderError(f"解析 b64_json 失败: {exc}") from exc
                continue

            url = item.get("url")
            if url:
                downloaded = self._download(url)
                if downloaded is not None:
                    images.append(downloaded)
        return images

    def _download(self, url: str) -> Optional[Tuple[str, bytes]]:
        try:
            resp = requests.get(url, timeout=self.request.timeout)
        except requests.RequestException as exc:
            raise ImageProviderError(f"下载图片失败 {url}: {exc}") from exc

        if resp.status_code >= 400:
            raise ImageProviderError(f"下载图片失败 {url}: HTTP {resp.status_code}")

        mime = resp.headers.get("Content-Type", "image/png").split(";")[0].strip() or "image/png"
        return mime, resp.content
