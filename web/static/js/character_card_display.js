/**
 * /user-attributes 页面控制器
 *
 * 流程：
 *   - 拉取角色列表，填充 #characterSelect
 *   - 选择角色 → GET /api/character/<name>/attributes
 *       - 有数据书：在 .edit-panel 里挂 StorybookEditor，Save 走 PUT /api/stories/<storybookName>
 *       - 没数据书：在内容区显示"创建数据书"按钮
 *   - URL 支持 ?character=<name> 与 ?user=<name>，自动选中
 *
 * 设计：使用与 /storybook 相同的 .edit-panel 全屏模态结构 + StorybookEditor，
 *       让两个页面的编辑体验完全一致。
 */
class CharacterCardManager {
    constructor() {
        this.currentCharacter = null;     // {character_name, character_type, basic_info, storybook_data, has_storybook}
        this.currentStorybookName = null; // 当前数据书文件名（不含扩展名）
        this.editor = null;
        this.pendingCharacterSelection = null;
        this.rolesData = {};
        this.playersData = {};

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this._init());
        } else {
            this._init();
        }
    }

    _init() {
        this.characterSelect = document.getElementById('characterSelect');
        this.viewStorybookBtn = document.getElementById('viewStorybookBtn');
        this.editBtn = document.getElementById('editBtn');
        this.closeBtn = document.getElementById('closeBtn');
        this.loadingState = document.getElementById('loadingState');
        this.errorState = document.getElementById('errorState');
        this.errorMessage = document.getElementById('errorMessage');
        this.characterInfo = document.getElementById('characterInfo');
        this.editPanel = document.getElementById('edit-panel');
        this.editForm = document.getElementById('edit-form');
        this.editTitle = document.getElementById('edit-title');

        if (!this.characterSelect || !this.editPanel || !this.editForm) {
            console.warn('CharacterCardManager: 关键 DOM 缺失，跳过初始化');
            return;
        }

        this._bindEvents();
        this._loadAuxData();
        this._loadCharacterList();
    }

    _bindEvents() {
        this.characterSelect.addEventListener('change', e => {
            const name = e.target.value;
            if (name) {
                this._loadCharacter(name);
            } else {
                this._showEmpty();
            }
        });

        if (this.viewStorybookBtn) {
            this.viewStorybookBtn.addEventListener('click', () => this._goToStorybookPage());
        }
        if (this.editBtn) {
            this.editBtn.addEventListener('click', () => this._openEditor());
        }
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this._closeWindow());
        }

        const closeEditBtn = this.editPanel.querySelector('.edit-panel-close');
        if (closeEditBtn) {
            closeEditBtn.addEventListener('click', () => this._closeEditor());
        }

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && this.editPanel.classList.contains('open')) {
                this._closeEditor();
            }
        });
    }

    async _loadAuxData() {
        // 加载角色与玩家字典，供编辑器中"绑定角色/玩家"下拉选项使用
        try {
            const r = await fetch('/api/roles').then(res => res.json());
            this.rolesData = r || {};
            window.rolesData = this.rolesData;
        } catch (e) {
            console.warn('加载角色数据失败:', e);
        }
        try {
            const p = await fetch('/api/players').then(res => res.json());
            if (p && p.success && Array.isArray(p.players)) {
                const obj = {};
                p.players.forEach(player => {
                    const name = player.file_name || player.name;
                    obj[name] = player;
                });
                this.playersData = obj;
                window.playersData = obj;
            }
        } catch (e) {
            console.warn('加载玩家数据失败:', e);
        }
        if (this.editor) {
            this.editor.refreshSelectors(this.rolesData, this.playersData);
        }
    }

    async _loadCharacterList() {
        try {
            const data = await fetch('/api/characters/list').then(r => r.json());
            if (!data.success) {
                this._showError(data.error || '获取角色列表失败');
                return;
            }
            this._populateCharacterSelect(data.characters || []);
            await this._resolveInitialSelection(data.characters || []);
        } catch (e) {
            this._showError('获取角色列表错误: ' + e.message);
        }
    }

    _populateCharacterSelect(characters) {
        while (this.characterSelect.children.length > 1) {
            this.characterSelect.removeChild(this.characterSelect.lastChild);
        }
        characters.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            opt.textContent = c.display_name;
            this.characterSelect.appendChild(opt);
        });
    }

    async _resolveInitialSelection(characters) {
        const params = new URLSearchParams(window.location.search);
        const requested = params.get('character') || params.get('user');
        if (requested && characters.some(c => c.name === requested)) {
            this.characterSelect.value = requested;
            this._loadCharacter(requested);
            return;
        }
        try {
            const cur = await fetch('/api/current-player').then(r => r.json());
            if (cur.success && cur.current_player && characters.some(c => c.name === cur.current_player)) {
                this.characterSelect.value = cur.current_player;
                this._loadCharacter(cur.current_player);
            }
        } catch {
            /* ignore */
        }
    }

    async _loadCharacter(name) {
        this._showLoading();
        try {
            const data = await fetch(`/api/character/${encodeURIComponent(name)}/attributes`).then(r => r.json());
            if (!data.success) {
                this._showError(data.error || '获取角色数据失败');
                return;
            }
            this.currentCharacter = data;
            this.currentStorybookName = data.has_storybook ? name : null;
            this._hideLoading();
            this._renderInlinePreview();
        } catch (e) {
            this._showError('加载错误: ' + e.message);
        }
    }

    _renderInlinePreview() {
        const data = this.currentCharacter;
        if (!data) return;
        const basic = data.basic_info || {};
        const desc = basic.介绍 || basic.介紹 || basic.description || '';
        const traits = (data.storybook_data && data.storybook_data.标签) || [];
        const hasBook = data.has_storybook;

        const traitTags = traits.map(t => `<span class="trait-tag">${this._esc(t)}</span>`).join('');

        const actionHtml = hasBook
            ? `<button class="action-btn edit-mode" id="inlineEditBtn">✏️ 编辑数据书</button>`
            : `<button class="action-btn edit-mode" id="inlineCreateBtn">➕ 创建数据书</button>`;

        this.characterInfo.classList.add('show');
        this.characterInfo.innerHTML = `
            <div class="basic-info-card">
                <div class="character-name">${this._esc(data.character_name)}</div>
                ${desc ? `<div class="character-description">${this._esc(desc)}</div>` : ''}
                ${traitTags ? `<div class="character-traits">${traitTags}</div>` : ''}
                <div style="text-align:center; margin-top: 20px;">
                    ${actionHtml}
                </div>
                ${!hasBook ? `<p style="text-align:center; color:#a0aec0; margin-top:12px;">该角色尚未绑定数据书。</p>` : ''}
            </div>
        `;

        const inlineEdit = document.getElementById('inlineEditBtn');
        if (inlineEdit) inlineEdit.addEventListener('click', () => this._openEditor());
        const inlineCreate = document.getElementById('inlineCreateBtn');
        if (inlineCreate) inlineCreate.addEventListener('click', () => this._createStorybook());
    }

    _openEditor() {
        if (!this.currentCharacter) {
            alert('请先选择角色');
            return;
        }
        if (!this.currentCharacter.has_storybook) {
            const yes = confirm('该角色还没有数据书，是否创建？');
            if (yes) this._createStorybook();
            return;
        }
        if (typeof window.StorybookEditor !== 'function') {
            alert('编辑器未加载');
            return;
        }

        const storybookName = this.currentStorybookName;
        const storyData = this.currentCharacter.storybook_data || {};

        if (this.editor) {
            this.editor.destroy();
            this.editor = null;
        }

        if (this.editTitle) this.editTitle.textContent = `编辑数据书 — ${storybookName}`;

        this.editor = new window.StorybookEditor(this.editForm, {
            name: storybookName,
            data: storyData,
            isNew: false,
            rolesData: this.rolesData,
            playersData: this.playersData,
            submitLabel: '保存',
            onSave: ({ name: updatedName, doc }) => this._saveStorybook(storybookName, updatedName, doc),
            onCancel: () => this._closeEditor()
        });
        this.editor.mount();
        this.editPanel.classList.add('open');
    }

    _closeEditor() {
        this.editPanel.classList.remove('open');
        if (this.editor) {
            this.editor.destroy();
            this.editor = null;
        }
    }

    async _saveStorybook(originalName, newName, doc) {
        try {
            const url = `/api/stories/${encodeURIComponent(originalName)}`;
            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(doc)
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            if (!result.success) {
                alert('保存失败: ' + (result.error || '未知错误'));
                return;
            }
            // 重新拉取以获取最新内容
            await this._loadCharacter(this.currentCharacter.character_name);
            this._closeEditor();
            this._toast('数据书保存成功');
        } catch (e) {
            console.error('保存失败:', e);
            alert('保存失败: ' + e.message);
        }
    }

    async _createStorybook() {
        if (!this.currentCharacter) return;
        try {
            const response = await fetch(
                `/api/character/${encodeURIComponent(this.currentCharacter.character_name)}/create-storybook`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ character_type: this.currentCharacter.character_type })
                }
            );
            const result = await response.json();
            if (!result.success) {
                alert('创建失败: ' + (result.error || '未知错误'));
                return;
            }
            this._toast('数据书创建成功');
            await this._loadCharacter(this.currentCharacter.character_name);
            this._openEditor();
        } catch (e) {
            alert('创建错误: ' + e.message);
        }
    }

    _goToStorybookPage() {
        if (!this.currentCharacter) {
            window.open('/storybook', '_blank');
            return;
        }
        const storyName = this.currentStorybookName;
        const url = storyName
            ? `/storybook?name=${encodeURIComponent(storyName)}`
            : '/storybook';
        window.open(url, '_blank');
    }

    _closeWindow() {
        if (window.opener && window.opener !== window) {
            window.close();
        } else {
            window.location.href = '/';
        }
    }

    _showLoading() {
        if (this.loadingState) this.loadingState.style.display = 'block';
        if (this.errorState) this.errorState.style.display = 'none';
        if (this.characterInfo) {
            this.characterInfo.classList.remove('show');
            this.characterInfo.innerHTML = '';
        }
    }

    _hideLoading() {
        if (this.loadingState) this.loadingState.style.display = 'none';
    }

    _showEmpty() {
        if (this.characterInfo) {
            this.characterInfo.classList.remove('show');
            this.characterInfo.innerHTML = '';
        }
        if (this.errorState) this.errorState.style.display = 'none';
        this._hideLoading();
        this.currentCharacter = null;
        this.currentStorybookName = null;
        this._closeEditor();
    }

    _showError(msg) {
        this._hideLoading();
        if (this.errorMessage) this.errorMessage.textContent = msg;
        if (this.errorState) this.errorState.style.display = 'block';
        if (this.characterInfo) this.characterInfo.classList.remove('show');
    }

    _toast(message) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 10000;
            background: #28a745; color: white; padding: 10px 20px;
            border-radius: 8px; font-family: 'Cinzel', serif;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 2500);
    }

    _esc(s) {
        const div = document.createElement('div');
        div.textContent = s == null ? '' : String(s);
        return div.innerHTML;
    }
}

window.characterCardManager = new CharacterCardManager();
