(function () {
    const state = {
        providers: {},
        models: {},
        modelTiers: {},
        currentModel: null,
        editingProviderKey: null,
        editingModelKey: null,
        fetchedProviderModels: {},
        collapsedProviders: new Set(),
    };

    document.addEventListener("DOMContentLoaded", () => {
        const tierForm = document.getElementById("tierForm");
        if (tierForm) {
            tierForm.addEventListener("submit", saveTierConfig);
        }

        const providerSelect = document.getElementById("modelProviderKey");
        if (providerSelect) {
            providerSelect.addEventListener("change", (event) => {
                populateFetchedModelOptions(event.target.value);
            });
        }

        loadConfiguration();
    });

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

    async function loadConfiguration() {
        try {
            const data = await fetchJson("/api/model_config");
            state.providers = data.providers || {};
            state.models = data.models || {};
            state.modelTiers = data.model_tiers || {};
            state.currentModel = data.current_model || "";

            renderSummary();
            renderProviderList();
            renderTierOptions();
            populateProviderSelect();
        } catch (error) {
            showToast(`加载配置失败: ${error.message}`, "error");
        }
    }

    function renderSummary() {
        document.getElementById("providerCount").textContent = Object.keys(state.providers).length;
        document.getElementById("modelCount").textContent = Object.keys(state.models).length;

        const currentModel = state.models[state.currentModel];
        document.getElementById("currentModelName").textContent = currentModel ? currentModel.name : "未设置";
        document.getElementById("currentModelMeta").textContent = currentModel
            ? `${currentModel.provider_name || "—"} · ${currentModel.model || ""}`
            : "可在聊天页快速切换";
    }

    function groupModelsByProvider() {
        const grouped = {};
        Object.entries(state.providers).forEach(([providerKey]) => {
            grouped[providerKey] = [];
        });
        const orphans = [];

        Object.entries(state.models).forEach(([modelKey, model]) => {
            const providerKey = model.provider_key;
            if (providerKey && grouped[providerKey]) {
                grouped[providerKey].push([modelKey, model]);
            } else {
                orphans.push([modelKey, model]);
            }
        });
        return { grouped, orphans };
    }

    function renderProviderList() {
        const list = document.getElementById("providerList");
        if (!list) return;

        const providerEntries = Object.entries(state.providers);
        const { grouped, orphans } = groupModelsByProvider();

        if (!providerEntries.length && !orphans.length) {
            list.innerHTML = buildEmptyState(
                "还没有供应商",
                "先新增一个 OpenAI 兼容供应商，再去拉取模型或手动添加模型。"
            );
            return;
        }

        const providerHtml = providerEntries
            .map(([providerKey, provider]) => renderProviderCard(providerKey, provider, grouped[providerKey] || []))
            .join("");

        const orphanHtml = orphans.length
            ? renderOrphanGroup(orphans)
            : "";

        list.innerHTML = providerHtml + orphanHtml;
    }

    function renderProviderCard(providerKey, provider, modelsForProvider) {
        const collapsed = state.collapsedProviders.has(providerKey);
        const initial = (provider.name || providerKey || "?").charAt(0).toUpperCase();
        const modelsHtml = modelsForProvider.length
            ? `<div class="mc-model-list">${modelsForProvider.map(([k, m]) => renderModelCard(k, m)).join("")}</div>`
            : `<div class="mc-empty" style="margin: 0;">
                    <p>该供应商下还没有模型，<a href="javascript:void(0)" onclick="pullProviderModels('${escapeJs(providerKey)}', true)" style="color: var(--text-gold); text-decoration: underline;">从供应商读取</a> 或 <a href="javascript:void(0)" onclick="openModelModalForProvider('${escapeJs(providerKey)}')" style="color: var(--text-gold); text-decoration: underline;">手动添加</a>。</p>
               </div>`;

        return `
            <article class="mc-provider" data-provider="${escapeHtml(providerKey)}">
                <header class="mc-provider__head" onclick="toggleProvider('${escapeJs(providerKey)}')">
                    <div class="mc-provider__icon">${escapeHtml(initial)}</div>
                    <div class="mc-provider__info">
                        <h3 class="mc-provider__name">
                            ${escapeHtml(provider.name || providerKey)}
                            <span class="mc-provider__count">${modelsForProvider.length} 个模型</span>
                        </h3>
                        <div class="mc-provider__meta">
                            <span title="基础 URL"><i class="fas fa-link"></i><span class="mc-provider__url">${escapeHtml(provider.base_url || "未填写")}</span></span>
                            <span title="API Key"><i class="fas fa-key"></i>${escapeHtml(maskApiKey(provider.api_key))}</span>
                            <span title="标识"><i class="fas fa-fingerprint"></i>${escapeHtml(providerKey)}</span>
                        </div>
                    </div>
                    <div class="mc-provider__actions" onclick="event.stopPropagation()">
                        <button class="mc-icon-btn" type="button" title="新增模型" onclick="openModelModalForProvider('${escapeJs(providerKey)}')"><i class="fas fa-plus"></i></button>
                        <button class="mc-icon-btn" type="button" title="拉取模型" onclick="pullProviderModels('${escapeJs(providerKey)}', false)"><i class="fas fa-cloud-download-alt"></i></button>
                        <button class="mc-icon-btn" type="button" title="编辑供应商" onclick="openProviderModal('${escapeJs(providerKey)}')"><i class="fas fa-pen"></i></button>
                        <button class="mc-icon-btn mc-icon-btn--danger" type="button" title="删除供应商" onclick="deleteProvider('${escapeJs(providerKey)}')"><i class="fas fa-trash"></i></button>
                        <button class="mc-icon-btn" type="button" title="${collapsed ? "展开" : "折叠"}" onclick="toggleProvider('${escapeJs(providerKey)}')"><i class="fas fa-chevron-${collapsed ? "down" : "up"}"></i></button>
                    </div>
                </header>
                <div class="mc-provider__body" ${collapsed ? 'style="display:none;"' : ""}>
                    ${modelsHtml}
                </div>
            </article>
        `;
    }

    function renderOrphanGroup(orphans) {
        const modelsHtml = orphans.map(([k, m]) => renderModelCard(k, m)).join("");
        return `
            <article class="mc-provider" data-orphan="true">
                <header class="mc-provider__head" style="cursor: default;">
                    <div class="mc-provider__icon" style="background: linear-gradient(135deg, #555, #777);"><i class="fas fa-unlink"></i></div>
                    <div class="mc-provider__info">
                        <h3 class="mc-provider__name">未绑定供应商<span class="mc-provider__count">${orphans.length} 个模型</span></h3>
                        <div class="mc-provider__meta">
                            <span><i class="fas fa-info-circle"></i>这些模型的供应商已删除，请编辑后重新绑定</span>
                        </div>
                    </div>
                    <div class="mc-provider__actions"></div>
                </header>
                <div class="mc-provider__body">
                    <div class="mc-model-list">${modelsHtml}</div>
                </div>
            </article>
        `;
    }

    function renderModelCard(modelKey, model) {
        const isCurrent = state.currentModel === modelKey;
        const tags = [
            `<span class="mc-tag ${model.stream ? "mc-tag--stream" : "mc-tag--off"}">${model.stream ? "流式" : "非流式"}</span>`
        ];
        if (model.temperature !== null && model.temperature !== undefined) {
            tags.push(`<span class="mc-tag">T ${model.temperature}</span>`);
        }
        if (model.max_tokens !== null && model.max_tokens !== undefined) {
            tags.push(`<span class="mc-tag">max ${model.max_tokens}</span>`);
        }
        if (model.context_window !== null && model.context_window !== undefined) {
            tags.push(`<span class="mc-tag">ctx ${model.context_window}</span>`);
        }

        return `
            <div class="mc-model${isCurrent ? " is-current" : ""}">
                <div class="mc-model__head">
                    <div style="min-width: 0;">
                        <h4 class="mc-model__name">${escapeHtml(model.name || modelKey)}</h4>
                        <div class="mc-model__id">${escapeHtml(model.model || "")}</div>
                    </div>
                    ${isCurrent ? '<span class="mc-model__current-badge"><i class="fas fa-star"></i> 当前</span>' : ""}
                </div>
                <div class="mc-model__tags">${tags.join("")}</div>
                <div class="mc-model__actions">
                    ${isCurrent ? "" : `<button class="mc-icon-btn" type="button" title="设为当前聊天模型" onclick="activateModel('${escapeJs(modelKey)}')"><i class="fas fa-star"></i></button>`}
                    <button class="mc-icon-btn" type="button" title="测试" onclick="testSavedModel('${escapeJs(modelKey)}')"><i class="fas fa-vial"></i></button>
                    <button class="mc-icon-btn" type="button" title="编辑" onclick="openModelModal('${escapeJs(modelKey)}')"><i class="fas fa-pen"></i></button>
                    <button class="mc-icon-btn mc-icon-btn--danger" type="button" title="删除" onclick="deleteModel('${escapeJs(modelKey)}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    }

    function toggleProvider(providerKey) {
        if (state.collapsedProviders.has(providerKey)) {
            state.collapsedProviders.delete(providerKey);
        } else {
            state.collapsedProviders.add(providerKey);
        }
        renderProviderList();
    }

    function renderTierOptions() {
        const selectMapping = {
            highTierSelect: state.modelTiers.high_performance?.default_model || "",
            mediumTierSelect: state.modelTiers.medium_performance?.default_model || "",
            lowTierSelect: state.modelTiers.low_performance?.default_model || "",
        };

        Object.entries(selectMapping).forEach(([selectId, value]) => {
            const select = document.getElementById(selectId);
            if (!select) {
                return;
            }

            const options = ['<option value="">请选择模型</option>'].concat(
                Object.entries(state.models).map(
                    ([modelKey, model]) =>
                        `<option value="${escapeHtml(modelKey)}">${escapeHtml(model.name)} · ${escapeHtml(model.provider_name || "")}</option>`
                )
            );
            select.innerHTML = options.join("");
            select.value = value;
        });
    }

    function populateProviderSelect(selectedProviderKey = "") {
        const select = document.getElementById("modelProviderKey");
        if (!select) {
            return;
        }

        const options = ['<option value="">请选择供应商</option>'].concat(
            Object.entries(state.providers).map(
                ([providerKey, provider]) =>
                    `<option value="${escapeHtml(providerKey)}">${escapeHtml(provider.name || providerKey)}</option>`
            )
        );
        select.innerHTML = options.join("");
        select.value = selectedProviderKey;
        populateFetchedModelOptions(selectedProviderKey);
    }

    function buildEmptyState(title, description) {
        return `
            <div class="mc-empty">
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(description)}</p>
            </div>
        `;
    }

    function maskApiKey(apiKey) {
        if (!apiKey) {
            return "未填写 API Key";
        }
        if (apiKey.length <= 8) {
            return "已填写";
        }
        return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
    }

    function collectModelFormData() {
        const form = document.getElementById("modelForm");
        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());
        payload.stream = document.getElementById("modelStream").checked;

        [
            "temperature",
            "max_tokens",
            "context_window",
            "top_p",
            "presence_penalty",
            "frequency_penalty",
        ].forEach((field) => {
            if (!payload[field]) {
                delete payload[field];
            }
        });

        if (!payload.model_key) {
            delete payload.model_key;
        }
        if (!payload.name) {
            delete payload.name;
        }

        return payload;
    }

    function openProviderModal(providerKey = "") {
        state.editingProviderKey = providerKey || null;

        document.getElementById("providerModalTitle").textContent = providerKey ? "编辑供应商" : "添加供应商";
        document.getElementById("providerForm").reset();

        if (providerKey && state.providers[providerKey]) {
            const provider = state.providers[providerKey];
            document.getElementById("providerKey").value = providerKey;
            document.getElementById("providerKey").readOnly = true;
            document.getElementById("providerName").value = provider.name || "";
            document.getElementById("providerBaseUrl").value = provider.base_url || "";
            document.getElementById("providerApiKey").value = provider.api_key || "";
        } else {
            document.getElementById("providerKey").value = "";
            document.getElementById("providerKey").readOnly = false;
        }

        document.getElementById("providerModal").classList.add("visible");
    }

    function closeProviderModal() {
        state.editingProviderKey = null;
        document.getElementById("providerModal").classList.remove("visible");
    }

    async function saveProvider() {
        try {
            const formData = new FormData(document.getElementById("providerForm"));
            const payload = Object.fromEntries(formData.entries());
            const url = state.editingProviderKey
                ? `/api/model_providers/${encodeURIComponent(state.editingProviderKey)}`
                : "/api/model_providers";
            const method = state.editingProviderKey ? "PUT" : "POST";

            await fetchJson(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            showToast("供应商保存成功", "success");
            closeProviderModal();
            await loadConfiguration();
        } catch (error) {
            showToast(`保存供应商失败: ${error.message}`, "error");
        }
    }

    async function deleteProvider(providerKey) {
        const linkedModels = Object.entries(state.models || {})
            .filter(([, model]) => model && model.provider_key === providerKey)
            .map(([key]) => key);

        let confirmMessage = `确定删除供应商"${providerKey}"吗？`;
        if (linkedModels.length) {
            confirmMessage += `\n该供应商下还有 ${linkedModels.length} 个模型，将一并删除。`;
        }
        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            const result = await fetchJson(`/api/model_providers/${encodeURIComponent(providerKey)}`, {
                method: "DELETE",
            });

            const removed = (result && result.removed_models) || [];
            const tip = removed.length
                ? `供应商已删除，并移除了 ${removed.length} 个绑定模型`
                : "供应商删除成功";
            showToast(tip, "success");
            await loadConfiguration();
        } catch (error) {
            showToast(`删除供应商失败: ${error.message}`, "error");
        }
    }

    function openModelModal(modelKey = "", presetProviderKey = "") {
        if (!Object.keys(state.providers).length) {
            showToast("请先添加供应商", "info");
            openProviderModal();
            return;
        }

        state.editingModelKey = modelKey || null;
        document.getElementById("modelModalTitle").textContent = modelKey ? "编辑模型" : "添加模型";
        document.getElementById("modelForm").reset();
        document.getElementById("modelKey").readOnly = false;
        document.getElementById("modelStream").checked = true;
        document.getElementById("advancedFields").classList.add("hidden");
        const chevron = document.querySelector(".mc-advanced__chevron");
        if (chevron) chevron.classList.remove("is-open");

        populateProviderSelect(presetProviderKey);

        if (modelKey && state.models[modelKey]) {
            const model = state.models[modelKey];
            document.getElementById("modelKey").value = modelKey;
            document.getElementById("modelKey").readOnly = true;
            document.getElementById("modelName").value = model.name || "";
            document.getElementById("modelProviderKey").value = model.provider_key || "";
            document.getElementById("modelIdentifier").value = model.model || "";
            document.getElementById("modelStream").checked = Boolean(model.stream);
            document.getElementById("modelTemperature").value = model.temperature ?? "";
            document.getElementById("modelMaxTokens").value = model.max_tokens ?? "";
            document.getElementById("modelContextWindow").value = model.context_window ?? "";
            document.getElementById("modelTopP").value = model.top_p ?? "";
            document.getElementById("modelPresencePenalty").value = model.presence_penalty ?? "";
            document.getElementById("modelFrequencyPenalty").value = model.frequency_penalty ?? "";

            if (model.uses_advanced_settings) {
                document.getElementById("advancedFields").classList.remove("hidden");
                if (chevron) chevron.classList.add("is-open");
            }
            populateFetchedModelOptions(model.provider_key);
        }

        document.getElementById("modelModal").classList.add("visible");
    }

    function openModelModalForProvider(providerKey) {
        openModelModal("", providerKey);
    }

    function closeModelModal() {
        state.editingModelKey = null;
        document.getElementById("modelModal").classList.remove("visible");
    }

    function toggleAdvancedSettings() {
        const fields = document.getElementById("advancedFields");
        const chevron = document.querySelector(".mc-advanced__chevron");
        fields.classList.toggle("hidden");
        if (chevron) {
            chevron.classList.toggle("is-open", !fields.classList.contains("hidden"));
        }
    }

    function populateFetchedModelOptions(providerKey) {
        const optionsSelect = document.getElementById("providerModelOptions");
        const datalist = document.getElementById("providerModelDatalist");
        if (!optionsSelect || !datalist) {
            return;
        }

        const models = providerKey ? state.fetchedProviderModels[providerKey] || [] : [];
        const optionHtml = ['<option value="">读取后选择</option>'].concat(
            models.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.id)}</option>`)
        );
        optionsSelect.innerHTML = optionHtml.join("");
        datalist.innerHTML = models
            .map((item) => `<option value="${escapeHtml(item.id)}"></option>`)
            .join("");
    }

    async function pullProviderModels(providerKey, openAfterFetch = false) {
        try {
            const data = await fetchJson(
                `/api/model_providers/${encodeURIComponent(providerKey)}/fetch_models`,
                { method: "POST" }
            );
            state.fetchedProviderModels[providerKey] = data.models || [];
            populateFetchedModelOptions(providerKey);
            showToast(`读取到 ${data.models.length} 个模型`, "success");

            if (openAfterFetch) {
                openModelModal("", providerKey);
            }
        } catch (error) {
            showToast(`获取模型失败: ${error.message}`, "error");
        }
    }

    async function fetchModelsForSelectedProvider() {
        const providerKey = document.getElementById("modelProviderKey").value;
        if (!providerKey) {
            showToast("请先选择供应商", "info");
            return;
        }
        await pullProviderModels(providerKey, false);
    }

    function applyFetchedModel(modelId) {
        if (!modelId) {
            return;
        }
        document.getElementById("modelIdentifier").value = modelId;
        const nameInput = document.getElementById("modelName");
        if (!nameInput.value.trim()) {
            nameInput.value = modelId;
        }
    }

    async function saveModel() {
        try {
            const payload = collectModelFormData();
            const url = state.editingModelKey
                ? `/api/chat_models/${encodeURIComponent(state.editingModelKey)}`
                : "/api/chat_models";
            const method = state.editingModelKey ? "PUT" : "POST";

            await fetchJson(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            showToast("模型保存成功", "success");
            closeModelModal();
            await loadConfiguration();
        } catch (error) {
            showToast(`保存模型失败: ${error.message}`, "error");
        }
    }

    async function deleteModel(modelKey) {
        const model = state.models[modelKey];
        const isCurrent = state.currentModel === modelKey;
        let confirmMessage = `确定删除模型"${model?.name || modelKey}"吗？`;
        if (isCurrent) {
            confirmMessage += "\n该模型当前正在使用，删除后系统会自动切换到其他可用模型。";
        }
        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            await fetchJson(`/api/chat_models/${encodeURIComponent(modelKey)}`, {
                method: "DELETE",
            });
            showToast("模型删除成功", "success");
            await loadConfiguration();
        } catch (error) {
            showToast(`删除模型失败: ${error.message}`, "error");
        }
    }

    async function testSavedModel(modelKey) {
        try {
            const result = await fetchJson(
                `/api/chat_models/${encodeURIComponent(modelKey)}/test`,
                { method: "POST" }
            );
            showResult(result, true);
            showToast("模型测试成功", "success");
        } catch (error) {
            showResult({ error: error.message }, false);
            showToast(`模型测试失败: ${error.message}`, "error");
        }
    }

    async function testModelFromForm() {
        try {
            const payload = collectModelFormData();
            const provider = state.providers[payload.provider_key];
            if (!provider) {
                throw new Error("请先选择有效的供应商");
            }

            payload.base_url = provider.base_url;
            payload.api_key = provider.api_key;

            const result = await fetchJson("/api/test_model", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            showResult(result, true);
            showToast("模型测试成功", "success");
        } catch (error) {
            showResult({ error: error.message }, false);
            showToast(`模型测试失败: ${error.message}`, "error");
        }
    }

    async function activateModel(modelKey) {
        try {
            await fetchJson("/api/chat_models/current", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ model_key: modelKey }),
            });

            showToast("当前聊天模型已切换", "success");
            await loadConfiguration();
        } catch (error) {
            showToast(`切换模型失败: ${error.message}`, "error");
        }
    }

    async function saveTierConfig(event) {
        event.preventDefault();
        try {
            const payload = {
                high_performance: document.getElementById("highTierSelect").value || null,
                medium_performance: document.getElementById("mediumTierSelect").value || null,
                low_performance: document.getElementById("lowTierSelect").value || null,
            };

            await fetchJson("/api/model_tiers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            showToast("分层配置保存成功", "success");
            await loadConfiguration();
        } catch (error) {
            showToast(`保存分层配置失败: ${error.message}`, "error");
        }
    }

    function showResult(result, success) {
        const container = document.getElementById("resultContent");
        container.className = `mc-result ${success ? "success" : "error"}`;
        container.innerHTML = `
            <h4><i class="fas fa-${success ? "check-circle" : "times-circle"}"></i> ${success ? "测试成功" : "测试失败"}</h4>
            <p>${escapeHtml(result.message || result.error || "未知结果")}</p>
            ${result.response_time ? `<p><strong>响应时间:</strong> ${escapeHtml(String(result.response_time))} ms</p>` : ""}
            ${result.tokens_used ? `<p><strong>消耗 Token:</strong> ${escapeHtml(String(result.tokens_used))}</p>` : ""}
        `;
        document.getElementById("resultModal").classList.add("visible");
    }

    function closeResultModal() {
        document.getElementById("resultModal").classList.remove("visible");
    }

    function showToast(message, type = "info") {
        const toast = document.createElement("div");
        toast.className = `toast-notification ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add("visible"));

        setTimeout(() => {
            toast.classList.remove("visible");
            setTimeout(() => toast.remove(), 240);
        }, 2600);
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function escapeJs(value) {
        return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    }

    window.openProviderModal = openProviderModal;
    window.closeProviderModal = closeProviderModal;
    window.saveProvider = saveProvider;
    window.deleteProvider = deleteProvider;
    window.openModelModal = openModelModal;
    window.openModelModalForProvider = openModelModalForProvider;
    window.closeModelModal = closeModelModal;
    window.saveModel = saveModel;
    window.deleteModel = deleteModel;
    window.activateModel = activateModel;
    window.testSavedModel = testSavedModel;
    window.testModelFromForm = testModelFromForm;
    window.fetchModelsForSelectedProvider = fetchModelsForSelectedProvider;
    window.pullProviderModels = pullProviderModels;
    window.applyFetchedModel = applyFetchedModel;
    window.toggleAdvancedSettings = toggleAdvancedSettings;
    window.toggleProvider = toggleProvider;
    window.closeResultModal = closeResultModal;
})();
