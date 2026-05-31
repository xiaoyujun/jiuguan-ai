(function () {
    function getQuickSwitchSelects() {
        return Array.from(document.querySelectorAll("[data-chat-model-quick-switch]"));
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

    async function loadChatModelQuickSwitcher() {
        const selects = getQuickSwitchSelects();
        if (!selects.length) {
            return;
        }

        try {
            const data = await fetchJson("/api/model_config");
            const models = data.models || {};
            const currentModel = data.current_model || "";
            const entries = Object.entries(models);

            if (!entries.length) {
                selects.forEach((select) => {
                    select.innerHTML = '<option value="">暂无可用模型</option>';
                    select.disabled = true;
                });
                return;
            }

            const optionsHtml = entries
                .map(([modelKey, model]) => {
                    const label = `${model.name} · ${model.provider_name || ""}`;
                    return `<option value="${escapeHtml(modelKey)}">${escapeHtml(label)}</option>`;
                })
                .join("");

            selects.forEach((select) => {
                select.disabled = false;
                select.innerHTML = optionsHtml;
                select.value = currentModel;
            });

            updateQuickSwitchTitle(models[currentModel]);
        } catch (error) {
            selects.forEach((select) => {
                select.innerHTML = '<option value="">模型加载失败</option>';
                select.disabled = true;
            });
            notify(error.message, "error");
        }
    }

    async function handleChatModelQuickSwitch(modelKey) {
        if (!modelKey) {
            return;
        }

        try {
            await fetchJson("/api/chat_models/current", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ model_key: modelKey }),
            });

            notify("聊天模型已切换", "success");
            await loadChatModelQuickSwitcher();
        } catch (error) {
            notify(`切换模型失败: ${error.message}`, "error");
        }
    }

    function updateQuickSwitchTitle(model) {
        if (!model) {
            return;
        }

        getQuickSwitchSelects().forEach((select) => {
            select.title = `${model.name} (${model.model})`;
        });
    }

    function notify(message, type) {
        if (typeof window.showToast === "function") {
            window.showToast(message, type);
        } else {
            console[type === "error" ? "error" : "log"](message);
        }
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    document.addEventListener("DOMContentLoaded", loadChatModelQuickSwitcher);

    window.handleChatModelQuickSwitch = handleChatModelQuickSwitch;
    window.loadChatModelQuickSwitcher = loadChatModelQuickSwitcher;
})();
