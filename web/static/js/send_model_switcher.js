/**
 * 发送按钮长按模型切换器
 *
 * 功能：
 *  - 长按发送按钮（移动端 + 桌面端）弹出模型选择面板
 *  - 选择模型后，先通过 /api/chat_models/current 切换全局当前模型，
 *    再调用 window.sendMessage() 用新模型回复
 *  - 长按触发后阻止单击的 sendMessage，避免重复发送
 */
(function () {
    const LONG_PRESS_DURATION = 500;       // 长按触发阈值（毫秒）
    const MOVE_CANCEL_THRESHOLD = 12;      // 滑动多少像素取消长按

    let popup = null;
    let pressTimer = null;
    let longPressFired = false;
    let pressStartPos = null;
    let suppressNextClick = false;
    let modelsCache = null;
    let currentModelKey = "";
    let outsideHandler = null;

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function notify(message, type) {
        if (typeof window.showToast === "function") {
            window.showToast(message, type);
        } else {
            console[type === "error" ? "error" : "log"](message);
        }
    }

    async function fetchJson(url, options = {}) {
        const response = await fetch(url, options);
        const contentType = response.headers.get("content-type") || "";
        const data = contentType.includes("application/json")
            ? await response.json()
            : { success: false, error: await response.text() };

        if (response.status === 401 && data.requires_login) {
            window.location.href = "/login?module=chat";
            throw new Error("会话已过期，请重新登录");
        }
        if (!response.ok || data.success === false) {
            throw new Error(data.error || `请求失败: ${response.status}`);
        }
        return data;
    }

    async function loadModels(forceRefresh = false) {
        if (modelsCache && !forceRefresh) {
            return modelsCache;
        }
        const data = await fetchJson("/api/model_config");
        modelsCache = data.models || {};
        currentModelKey = data.current_model || "";
        return modelsCache;
    }

    function ensurePopup() {
        if (popup) return popup;

        popup = document.createElement("div");
        popup.className = "send-model-popup";
        popup.setAttribute("role", "menu");
        popup.addEventListener("click", (e) => e.stopPropagation());
        document.body.appendChild(popup);
        return popup;
    }

    function renderPopup(models) {
        const node = ensurePopup();
        const entries = Object.entries(models || {});

        let html = '<div class="send-model-popup-title">选择模型回复</div>';

        if (!entries.length) {
            html += '<div class="send-model-popup-empty">暂无可用模型，请先在模型配置中添加。</div>';
        } else {
            html += '<ul class="send-model-popup-list">';
            for (const [key, model] of entries) {
                const isActive = key === currentModelKey;
                const name = escapeHtml(model.name || model.model || key);
                const provider = escapeHtml(model.provider_name || "");
                html += `
                    <li class="send-model-popup-item ${isActive ? "active" : ""}" data-model-key="${escapeHtml(key)}" role="menuitem">
                        <span class="model-name">${name}</span>
                        ${provider ? `<span class="model-provider">${provider}</span>` : ""}
                    </li>
                `;
            }
            html += "</ul>";
            html += '<div class="send-model-popup-hint">长按发送按钮唤起 · 点击即用</div>';
        }

        node.innerHTML = html;

        node.querySelectorAll(".send-model-popup-item").forEach((item) => {
            item.addEventListener("click", () => {
                const modelKey = item.getAttribute("data-model-key");
                handleModelChosen(modelKey, item);
            });
        });
    }

    function positionPopup(triggerEl) {
        const node = ensurePopup();
        const rect = triggerEl.getBoundingClientRect();
        const margin = 8;

        // 先显示用于测量
        node.style.visibility = "hidden";
        node.classList.add("show");

        const popupRect = node.getBoundingClientRect();
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;

        // 默认显示在按钮上方
        let top = rect.top - popupRect.height - margin;
        let left = rect.left + rect.width / 2 - popupRect.width / 2;

        // 上方放不下则放下方
        if (top < margin) {
            top = rect.bottom + margin;
        }
        // 仍然超出，再贴回视口顶部
        if (top + popupRect.height > viewportH - margin) {
            top = Math.max(margin, viewportH - popupRect.height - margin);
        }

        // 水平方向边界限制
        if (left < margin) left = margin;
        if (left + popupRect.width > viewportW - margin) {
            left = viewportW - popupRect.width - margin;
        }

        node.style.top = `${top}px`;
        node.style.left = `${left}px`;
        node.style.visibility = "";
    }

    async function openPopup(triggerEl) {
        try {
            const models = await loadModels(true);
            renderPopup(models);
            positionPopup(triggerEl);
            ensurePopup().classList.add("show");
            bindOutside();
        } catch (err) {
            notify(`加载模型列表失败: ${err.message}`, "error");
        }
    }

    function closePopup() {
        if (!popup) return;
        popup.classList.remove("show");
        unbindOutside();
    }

    function bindOutside() {
        if (outsideHandler) return;
        outsideHandler = (e) => {
            if (!popup) return;
            if (popup.contains(e.target)) return;
            // 点击发送按钮本身不视为外部
            const sendBtn = document.querySelector(".send-btn");
            if (sendBtn && sendBtn.contains(e.target)) return;
            closePopup();
        };
        document.addEventListener("pointerdown", outsideHandler, true);
        document.addEventListener("keydown", onEscape, true);
        window.addEventListener("resize", closePopup);
        window.addEventListener("scroll", closePopup, true);
    }

    function unbindOutside() {
        if (!outsideHandler) return;
        document.removeEventListener("pointerdown", outsideHandler, true);
        document.removeEventListener("keydown", onEscape, true);
        window.removeEventListener("resize", closePopup);
        window.removeEventListener("scroll", closePopup, true);
        outsideHandler = null;
    }

    function onEscape(e) {
        if (e.key === "Escape") closePopup();
    }

    async function handleModelChosen(modelKey) {
        if (!modelKey) return;
        closePopup();

        // 同当前模型则直接发送
        if (modelKey === currentModelKey) {
            triggerSend();
            return;
        }

        try {
            await fetchJson("/api/chat_models/current", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ model_key: modelKey }),
            });

            currentModelKey = modelKey;
            const modelInfo = (modelsCache || {})[modelKey] || {};
            notify(`已切换到 ${modelInfo.name || modelKey}`, "success");

            // 同步更新 header 的快速切换下拉框（如果存在）
            if (typeof window.loadChatModelQuickSwitcher === "function") {
                try { window.loadChatModelQuickSwitcher(); } catch (_) { /* ignore */ }
            }

            triggerSend();
        } catch (err) {
            notify(`切换模型失败: ${err.message}`, "error");
        }
    }

    function triggerSend() {
        if (typeof window.sendMessage === "function") {
            try {
                window.sendMessage();
            } catch (err) {
                console.error("调用 sendMessage 失败:", err);
            }
        }
    }

    // ====== 长按事件处理 ======
    function onPointerDown(e) {
        // 仅左键 / 主指针
        if (e.pointerType === "mouse" && e.button !== 0) return;

        longPressFired = false;
        pressStartPos = { x: e.clientX, y: e.clientY };
        clearTimeout(pressTimer);

        const target = e.currentTarget;
        target.classList.add("long-press-active");

        pressTimer = setTimeout(() => {
            longPressFired = true;
            suppressNextClick = true;
            target.classList.remove("long-press-active");

            // 触感反馈（移动端）
            if (navigator.vibrate) {
                try { navigator.vibrate(15); } catch (_) { /* ignore */ }
            }
            openPopup(target);
        }, LONG_PRESS_DURATION);
    }

    function onPointerMove(e) {
        if (!pressTimer || !pressStartPos) return;
        const dx = e.clientX - pressStartPos.x;
        const dy = e.clientY - pressStartPos.y;
        if (Math.hypot(dx, dy) > MOVE_CANCEL_THRESHOLD) {
            cancelPress(e.currentTarget);
        }
    }

    function onPointerUp(e) {
        cancelPress(e.currentTarget);
    }

    function cancelPress(target) {
        clearTimeout(pressTimer);
        pressTimer = null;
        pressStartPos = null;
        if (target && target.classList) {
            target.classList.remove("long-press-active");
        }
    }

    function onContextMenu(e) {
        // 长按触发后阻止系统右键菜单 / 长按选择菜单
        if (longPressFired) {
            e.preventDefault();
        }
    }

    function onClick(e) {
        // 长按触发的点击不触发原 sendMessage
        if (suppressNextClick) {
            suppressNextClick = false;
            longPressFired = false;
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    }

    function bindSendButton(btn) {
        if (!btn || btn.dataset.modelSwitcherBound === "1") return;
        btn.dataset.modelSwitcherBound = "1";

        // 使用 capture 阶段监听 click，避免被原 onclick 提前触发后我们再阻止失败
        btn.addEventListener("click", onClick, true);
        btn.addEventListener("contextmenu", onContextMenu);

        if (window.PointerEvent) {
            btn.addEventListener("pointerdown", onPointerDown);
            btn.addEventListener("pointermove", onPointerMove);
            btn.addEventListener("pointerup", onPointerUp);
            btn.addEventListener("pointercancel", () => cancelPress(btn));
            btn.addEventListener("pointerleave", () => cancelPress(btn));
        } else {
            // 兜底：老旧浏览器
            btn.addEventListener("mousedown", onPointerDown);
            btn.addEventListener("mouseup", onPointerUp);
            btn.addEventListener("mouseleave", () => cancelPress(btn));
            btn.addEventListener("touchstart", onPointerDown, { passive: true });
            btn.addEventListener("touchend", onPointerUp);
            btn.addEventListener("touchcancel", () => cancelPress(btn));
        }

        // 防止移动端长按弹出系统菜单 / 选中文本
        btn.style.userSelect = "none";
        btn.style.webkitUserSelect = "none";
        btn.style.webkitTouchCallout = "none";
    }

    function init() {
        const sendBtn = document.querySelector(".send-btn");
        if (sendBtn) {
            bindSendButton(sendBtn);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    // 暴露给外部使用（例如菜单按钮再次打开）
    window.openSendModelPicker = function () {
        const sendBtn = document.querySelector(".send-btn");
        if (sendBtn) openPopup(sendBtn);
    };
})();
