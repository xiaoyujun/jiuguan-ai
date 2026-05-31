/**
 * 聊天背景管理
 * - 支持"全局"与"按当前角色"两种作用域
 * - 半透明叠暗色蒙版以保证可读性
 * - 未设置自定义背景时回落到当前角色头像 /avatar/{name}
 * - 数据保存在 localStorage（图片做缩放压缩避免超额）
 */
(function () {
    'use strict';

    const STORAGE_KEYS = {
        scope: 'chatBg:scope',          // 'global' | 'role'
        global: 'chatBg:global',
        rolePrefix: 'chatBg:role:'
    };

    const DEFAULT_SETTINGS = {
        image: '',
        opacity: 0.35,
        blur: 4
    };

    const MAX_IMAGE_DIMENSION = 1600;

    const state = {
        scope: localStorage.getItem(STORAGE_KEYS.scope) || 'global',
        currentRole: '',
        layer: null,
        modal: null,
        previewImageEl: null,
        previewEmptyEl: null,
        previewTagEl: null,
        opacityInput: null,
        blurInput: null,
        opacityValueEl: null,
        blurValueEl: null,
        scopeButtons: {},
        fileInput: null
    };

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        ensureLayer();
        ensureModal();
        bindRoleListener();
        applyBackground();
    }

    /* ---------------- 背景层 ---------------- */
    function ensureLayer() {
        const container = document.querySelector('.chat-container');
        if (!container) return;

        let layer = container.querySelector('.chat-bg-layer');
        if (!layer) {
            layer = document.createElement('div');
            layer.className = 'chat-bg-layer';
            container.insertBefore(layer, container.firstChild);
        }
        state.layer = layer;
    }

    function bindRoleListener() {
        const roleSelect = document.getElementById('role');
        if (!roleSelect) return;

        const sync = () => {
            state.currentRole = roleSelect.value || '';
            applyBackground();
        };

        roleSelect.addEventListener('change', sync);
        // 角色可能由其它代码异步赋值，监听属性变化
        const observer = new MutationObserver(sync);
        observer.observe(roleSelect, { attributes: true, attributeFilter: ['value'] });

        // 兜一份轮询，覆盖 select.value 直接赋值不触发事件的场景
        setInterval(() => {
            if (state.currentRole !== (roleSelect.value || '')) {
                sync();
            }
        }, 800);

        sync();
    }

    function getActiveSettings() {
        if (state.scope === 'role' && state.currentRole) {
            const stored = readSettings(STORAGE_KEYS.rolePrefix + state.currentRole);
            if (stored) return stored;
        }
        const globalStored = readSettings(STORAGE_KEYS.global);
        if (globalStored) return globalStored;
        return { ...DEFAULT_SETTINGS, customized: false };
    }

    function getActiveImageUrl(settings) {
        if (settings && settings.image) return settings.image;
        if (state.currentRole) return `/avatar/${encodeURIComponent(state.currentRole)}`;
        return '';
    }

    function applyBackground() {
        if (!state.layer) return;
        const settings = getActiveSettings();
        const imageUrl = getActiveImageUrl(settings);

        if (imageUrl) {
            // 头像兜底时，只有在用户从未主动保存过设置的情况下才降低不透明度，
            // 防止首次使用就被角色头像糊一屏；用户一旦动过滑块就完全尊重其选择
            const isFallback = !settings.image && state.currentRole && !settings.customized;
            const opacity = isFallback ? Math.min(settings.opacity, 0.28) : settings.opacity;
            state.layer.style.setProperty('--chat-bg-image', `url("${imageUrl}")`);
            state.layer.style.setProperty('--chat-bg-opacity', String(opacity));
            state.layer.style.setProperty('--chat-bg-blur', `${settings.blur}px`);
            state.layer.style.display = '';
        } else {
            state.layer.style.setProperty('--chat-bg-image', 'none');
            state.layer.style.setProperty('--chat-bg-opacity', '0');
        }
    }

    function readSettings(key) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return {
                image: parsed.image || '',
                opacity: typeof parsed.opacity === 'number' ? parsed.opacity : DEFAULT_SETTINGS.opacity,
                blur: typeof parsed.blur === 'number' ? parsed.blur : DEFAULT_SETTINGS.blur,
                customized: true
            };
        } catch (_) {
            return null;
        }
    }

    function writeSettings(key, settings) {
        try {
            localStorage.setItem(key, JSON.stringify(settings));
            return true;
        } catch (err) {
            showToast('图片过大，已超出本地存储上限', 'error');
            return false;
        }
    }

    function clearSettings(key) {
        localStorage.removeItem(key);
    }

    function getScopeKey() {
        if (state.scope === 'role') {
            if (!state.currentRole) return null;
            return STORAGE_KEYS.rolePrefix + state.currentRole;
        }
        return STORAGE_KEYS.global;
    }

    /* ---------------- 弹窗 ---------------- */
    function ensureModal() {
        if (state.modal) return;

        const modal = document.createElement('div');
        modal.className = 'chat-bg-modal';
        modal.id = 'chat-bg-modal';
        modal.innerHTML = `
            <div class="chat-bg-modal__card" role="dialog" aria-labelledby="chat-bg-modal-title">
                <div class="chat-bg-modal__header">
                    <h2 class="chat-bg-modal__title" id="chat-bg-modal-title">聊天背景</h2>
                    <button type="button" class="chat-bg-modal__close" data-chat-bg-action="close" aria-label="关闭">×</button>
                </div>

                <div class="chat-bg-modal__scope" role="tablist">
                    <button type="button" class="chat-bg-scope-btn" data-chat-bg-scope="global">
                        全局背景
                        <small>所有角色共享，未单独配置时使用</small>
                    </button>
                    <button type="button" class="chat-bg-scope-btn" data-chat-bg-scope="role">
                        当前角色
                        <small id="chat-bg-role-hint">需要先选择一个角色</small>
                    </button>
                </div>

                <div class="chat-bg-modal__preview">
                    <div class="chat-bg-modal__preview-image" id="chat-bg-preview-image"></div>
                    <div class="chat-bg-modal__preview-mask"></div>
                    <div class="chat-bg-modal__preview-empty" id="chat-bg-preview-empty">尚未设置背景，将使用角色头像作为背景</div>
                    <span class="chat-bg-modal__preview-tag" id="chat-bg-preview-tag">实时预览</span>
                </div>

                <div class="chat-bg-field">
                    <label class="chat-bg-field__label" for="chat-bg-opacity">
                        透明度
                        <span class="value" id="chat-bg-opacity-value">35%</span>
                    </label>
                    <input class="chat-bg-slider" id="chat-bg-opacity" type="range" min="0" max="100" step="1">
                    <div class="chat-bg-presets" role="group" aria-label="透明度预设">
                        <button type="button" class="chat-bg-preset" data-chat-bg-preset="10">隐约 10%</button>
                        <button type="button" class="chat-bg-preset" data-chat-bg-preset="35">默认 35%</button>
                        <button type="button" class="chat-bg-preset" data-chat-bg-preset="70">清晰 70%</button>
                        <button type="button" class="chat-bg-preset" data-chat-bg-preset="100">完全清晰 100%</button>
                    </div>
                    <div class="chat-bg-modal__hint">0% 完全隐藏背景，100% 显示原图；阅读时推荐 25% - 45%</div>
                </div>

                <div class="chat-bg-field">
                    <label class="chat-bg-field__label" for="chat-bg-blur">
                        模糊程度
                        <span class="value" id="chat-bg-blur-value">4px</span>
                    </label>
                    <input class="chat-bg-slider" id="chat-bg-blur" type="range" min="0" max="20" step="1">
                </div>

                <div class="chat-bg-actions">
                    <button type="button" class="chat-bg-btn chat-bg-btn--primary" data-chat-bg-action="upload">
                        上传背景图
                    </button>
                    <button type="button" class="chat-bg-btn chat-bg-btn--ghost" data-chat-bg-action="use-avatar">
                        使用角色头像
                    </button>
                    <button type="button" class="chat-bg-btn chat-bg-btn--danger" data-chat-bg-action="clear">
                        清除背景
                    </button>
                </div>

                <input type="file" id="chat-bg-file" accept="image/*" hidden>

                <div class="chat-bg-modal__footer">
                    <button type="button" class="chat-bg-btn chat-bg-btn--ghost" data-chat-bg-action="close">取消</button>
                    <button type="button" class="chat-bg-btn chat-bg-btn--primary" data-chat-bg-action="save">保存</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        state.modal = modal;

        state.previewImageEl = modal.querySelector('#chat-bg-preview-image');
        state.previewEmptyEl = modal.querySelector('#chat-bg-preview-empty');
        state.previewTagEl = modal.querySelector('#chat-bg-preview-tag');
        state.opacityInput = modal.querySelector('#chat-bg-opacity');
        state.blurInput = modal.querySelector('#chat-bg-blur');
        state.opacityValueEl = modal.querySelector('#chat-bg-opacity-value');
        state.blurValueEl = modal.querySelector('#chat-bg-blur-value');
        state.fileInput = modal.querySelector('#chat-bg-file');

        modal.querySelectorAll('[data-chat-bg-scope]').forEach((btn) => {
            state.scopeButtons[btn.dataset.chatBgScope] = btn;
            btn.addEventListener('click', () => switchScopeInModal(btn.dataset.chatBgScope));
        });

        modal.querySelectorAll('[data-chat-bg-action]').forEach((btn) => {
            btn.addEventListener('click', (e) => handleAction(e.currentTarget.dataset.chatBgAction));
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        state.opacityInput.addEventListener('input', () => updatePreview(true));
        state.blurInput.addEventListener('input', () => updatePreview(true));

        modal.querySelectorAll('[data-chat-bg-preset]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const pct = parseInt(btn.dataset.chatBgPreset, 10);
                if (Number.isNaN(pct)) return;
                state.opacityInput.value = String(pct);
                updatePreview(true);
            });
        });

        state.fileInput.addEventListener('change', onFilePick);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('visible')) closeModal();
        });
    }

    let modalDraft = { ...DEFAULT_SETTINGS };

    function openModal() {
        ensureModal();
        modalDraft = { ...getActiveSettings() };
        renderScopeButtons();
        bindDraftToControls();
        updatePreview(false);
        state.modal.classList.add('visible');
    }

    function closeModal() {
        if (state.modal) state.modal.classList.remove('visible');
    }

    function renderScopeButtons() {
        const roleBtn = state.scopeButtons.role;
        const globalBtn = state.scopeButtons.global;
        const roleHint = state.modal.querySelector('#chat-bg-role-hint');

        if (roleBtn) {
            const disabled = !state.currentRole;
            roleBtn.disabled = disabled;
            roleBtn.toggleAttribute('disabled', disabled);
            if (state.scope === 'role' && disabled) state.scope = 'global';
            roleBtn.classList.toggle('active', state.scope === 'role' && !disabled);
            if (roleHint) {
                roleHint.textContent = state.currentRole
                    ? `当前：${state.currentRole}`
                    : '需要先选择一个角色';
            }
        }
        if (globalBtn) {
            globalBtn.classList.toggle('active', state.scope === 'global');
        }
    }

    function switchScopeInModal(scope) {
        if (scope === 'role' && !state.currentRole) return;
        state.scope = scope;
        localStorage.setItem(STORAGE_KEYS.scope, scope);
        modalDraft = { ...getActiveSettings() };
        renderScopeButtons();
        bindDraftToControls();
        updatePreview(false);
    }

    function bindDraftToControls() {
        state.opacityInput.value = String(Math.round(modalDraft.opacity * 100));
        state.blurInput.value = String(modalDraft.blur);
        state.opacityValueEl.textContent = `${Math.round(modalDraft.opacity * 100)}%`;
        state.blurValueEl.textContent = `${modalDraft.blur}px`;
    }

    function updatePreview(commitToDraft) {
        if (commitToDraft) {
            modalDraft.opacity = parseInt(state.opacityInput.value, 10) / 100;
            modalDraft.blur = parseInt(state.blurInput.value, 10);
            state.opacityValueEl.textContent = `${Math.round(modalDraft.opacity * 100)}%`;
            state.blurValueEl.textContent = `${modalDraft.blur}px`;
        }

        const url = modalDraft.image || (state.currentRole ? `/avatar/${encodeURIComponent(state.currentRole)}` : '');
        if (url) {
            state.previewImageEl.style.backgroundImage = `url("${url}")`;
            state.previewImageEl.style.opacity = String(modalDraft.opacity);
            state.previewImageEl.style.filter = `blur(${modalDraft.blur}px)`;
            state.previewEmptyEl.style.display = 'none';
            state.previewTagEl.textContent = modalDraft.image ? '自定义背景' : '使用角色头像';
        } else {
            state.previewImageEl.style.backgroundImage = 'none';
            state.previewImageEl.style.opacity = '0';
            state.previewEmptyEl.style.display = 'flex';
            state.previewTagEl.textContent = '尚未设置';
        }
    }

    function handleAction(action) {
        switch (action) {
            case 'close':
                closeModal();
                break;
            case 'upload':
                state.fileInput.click();
                break;
            case 'use-avatar':
                modalDraft.image = '';
                updatePreview(false);
                break;
            case 'clear': {
                const key = getScopeKey();
                if (key) clearSettings(key);
                modalDraft = { ...DEFAULT_SETTINGS };
                bindDraftToControls();
                updatePreview(false);
                applyBackground();
                showToast('已清除背景');
                break;
            }
            case 'save':
                save();
                break;
        }
    }

    async function onFilePick(event) {
        const file = event.target.files && event.target.files[0];
        event.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showToast('请选择图片文件', 'error');
            return;
        }
        try {
            const dataUrl = await loadAndCompressImage(file);
            modalDraft.image = dataUrl;
            updatePreview(false);
            showToast('已读取，记得点保存');
        } catch (err) {
            console.error('[chat-background] 读取图片失败', err);
            showToast('图片读取失败', 'error');
        }
    }

    function loadAndCompressImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(reader.error);
            reader.onload = () => {
                const img = new Image();
                img.onerror = () => reject(new Error('图片解析失败'));
                img.onload = () => {
                    try {
                        const { width, height } = img;
                        const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
                        const targetW = Math.round(width * scale);
                        const targetH = Math.round(height * scale);
                        const canvas = document.createElement('canvas');
                        canvas.width = targetW;
                        canvas.height = targetH;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, targetW, targetH);
                        resolve(canvas.toDataURL('image/jpeg', 0.85));
                    } catch (e) {
                        reject(e);
                    }
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    function save() {
        const key = getScopeKey();
        if (!key) {
            showToast('请先选择一个角色', 'error');
            return;
        }
        const payload = {
            image: modalDraft.image || '',
            opacity: typeof modalDraft.opacity === 'number' ? modalDraft.opacity : DEFAULT_SETTINGS.opacity,
            blur: typeof modalDraft.blur === 'number' ? modalDraft.blur : DEFAULT_SETTINGS.blur
        };
        const ok = writeSettings(key, payload);
        if (!ok) return;
        applyBackground();
        showToast('背景已保存');
        closeModal();
    }

    /* ---------------- Toast ---------------- */
    let toastTimer = null;
    function showToast(message, type = 'info') {
        let toast = document.getElementById('chat-bg-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'chat-bg-toast';
            toast.className = 'chat-bg-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.toggle('error', type === 'error');
        requestAnimationFrame(() => toast.classList.add('visible'));
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('visible'), 2000);
    }

    /* ---------------- 公开 API ---------------- */
    window.openChatBackgroundSettings = function () {
        ensureLayer();
        ensureModal();
        const roleSelect = document.getElementById('role');
        if (roleSelect) state.currentRole = roleSelect.value || '';
        openModal();
        if (typeof window.closeSettingsDropdown === 'function') {
            try { window.closeSettingsDropdown(); } catch (_) {}
        }
    };

    window.refreshChatBackground = applyBackground;
})();
