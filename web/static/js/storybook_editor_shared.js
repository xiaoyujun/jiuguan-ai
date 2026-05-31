/**
 * 共用数据书编辑器组件 StorybookEditor
 *
 * 用途：在 /storybook 与 /user-attributes 两个页面之间共用同一套数据书表单。
 *
 * 用法：
 *   const editor = new StorybookEditor(rootEl, {
 *     name, data, isNew,
 *     rolesData, playersData,
 *     basicInfo,                       // 可选：来自角色 yml 的只读信息
 *     onSave: (updatedDoc) => {...},   // 必填：返回 Promise 或 truthy 表示保存成功
 *     onCancel: () => {...},           // 可选：取消按钮回调
 *     submitLabel: '保存',              // 可选：保存按钮文字
 *   });
 *   editor.mount();
 *   ...
 *   editor.destroy();
 *
 * 收集字段固定为：{描述, 标签, 总结词, 关键词, 捆绑角色, 捆绑玩家, 属性}
 * 与 PUT /api/stories/<name> 接收的 schema 一致；新建时 onSave 调用方负责加上 story_name。
 */
(function () {
    const STANDARD_FORMAT = {
        '状态': { '名称': '', '描述': '', '性格特点': '' },
        '外貌特征': { '身高': '', '体重': '', '发色': '', '瞳色': '', '特征': '' },
        '能力值': { '力量': '/100', '智力': '/100', '敏捷': '/100', '体质': '/100', '生命': '/100', '金币': '' },
        '社交关系': { '朋友': [], '恋人': '无', '敌人': [] },
        '背包': {}
    };

    function escapeAttr(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    class StorybookEditor {
        constructor(rootElement, options = {}) {
            if (!rootElement) {
                throw new Error('StorybookEditor: rootElement 必须提供');
            }
            this.root = rootElement;
            this.options = options;
            this.name = options.name || '';
            this.data = options.data || {};
            this.isNew = !!options.isNew;
            this.rolesData = options.rolesData || window.rolesData || {};
            this.playersData = options.playersData || window.playersData || {};
            this.basicInfo = options.basicInfo || null;
            this.onSave = typeof options.onSave === 'function' ? options.onSave : null;
            this.onCancel = typeof options.onCancel === 'function' ? options.onCancel : null;
            this.submitLabel = options.submitLabel || (this.isNew ? '创建' : '保存');
            this._mounted = false;
            this._isSaving = false;
        }

        mount() {
            this.root.innerHTML = this._buildHTML();
            this._bindEvents();
            this._mounted = true;
            this._applyMobileCollapse();
        }

        destroy() {
            if (!this._mounted) return;
            this.root.innerHTML = '';
            this._mounted = false;
        }

        // 收集表单 → 数据书 JSON（与现 saveEdit 字段一致）
        collect() {
            const root = this.root;

            const tags = [];
            root.querySelectorAll('.tag-item .tag-input').forEach(input => {
                const v = input.value.trim();
                if (v) tags.push(v);
            });

            const summaryWords = [];
            root.querySelectorAll('.summary-word-item .summary-word').forEach(input => {
                const v = input.value.trim();
                if (v) summaryWords.push(v);
            });

            const boundRoles = [];
            root.querySelectorAll('.bound-role-item .bound-role-select').forEach(sel => {
                const v = sel.value.trim();
                if (v) boundRoles.push(v);
            });

            const boundPlayers = [];
            root.querySelectorAll('.bound-player-item .bound-player-select').forEach(sel => {
                const v = sel.value.trim();
                if (v) boundPlayers.push(v);
            });

            const attributes = {};
            root.querySelectorAll('.attribute-item').forEach(item => {
                const nameInput = item.querySelector('.attr-name');
                if (!nameInput) return;
                const attrName = nameInput.value.trim();
                if (!attrName) return;

                const nestedAttrs = item.querySelector('.nested-attributes');
                if (nestedAttrs) {
                    const nestedObj = {};
                    nestedAttrs.querySelectorAll('.nested-attr-item').forEach(nestedItem => {
                        const keyEl = nestedItem.querySelector('.nested-attr-key');
                        const valEl = nestedItem.querySelector('.nested-attr-value');
                        if (!keyEl || !valEl) return;
                        const key = keyEl.value.trim();
                        if (!key) return;
                        nestedObj[key] = valEl.value.trim();
                    });
                    attributes[attrName] = nestedObj;
                } else {
                    const valueInput = item.querySelector('.attr-value');
                    if (!valueInput) return;
                    const raw = valueInput.value.trim();
                    if (attrName === '事件') {
                        if (!raw) {
                            attributes[attrName] = [];
                        } else {
                            try {
                                attributes[attrName] = JSON.parse(raw);
                            } catch {
                                attributes[attrName] = raw.split(',').map(s => s.trim()).filter(Boolean);
                            }
                        }
                    } else {
                        attributes[attrName] = raw;
                    }
                }
            });

            const nameInput = root.querySelector('#se-name');
            const descEl = root.querySelector('#se-description');
            const updatedName = nameInput ? nameInput.value.trim() : this.name;

            return {
                name: updatedName,
                doc: {
                    描述: descEl ? descEl.value : '',
                    标签: tags,
                    总结词: summaryWords,
                    关键词: [], // 关键词功能已移除，保留兼容
                    捆绑角色: boundRoles,
                    捆绑玩家: boundPlayers,
                    属性: attributes
                }
            };
        }

        async requestSave() {
            if (this._isSaving || !this.onSave) return;
            const collected = this.collect();
            if (!collected.name) {
                window.alert('数据名不能为空');
                return;
            }
            this._isSaving = true;
            const submitBtn = this.root.querySelector('.se-submit-btn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = '保存中...';
            }
            try {
                await this.onSave({ name: collected.name, doc: collected.doc, isNew: this.isNew });
            } finally {
                this._isSaving = false;
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = this.submitLabel;
                }
            }
        }

        // 刷新角色/玩家选择器选项（外部数据更新后调用）
        refreshSelectors(rolesData, playersData) {
            if (rolesData) this.rolesData = rolesData;
            if (playersData) this.playersData = playersData;
            this._refreshRoleSelects();
            this._refreshPlayerSelects();
        }

        _refreshRoleSelects() {
            const roles = Object.keys(this.rolesData || {});
            this.root.querySelectorAll('.bound-role-select').forEach(sel => {
                const cur = sel.value;
                const options = roles.map(r =>
                    `<option value="${escapeAttr(r)}" ${r === cur ? 'selected' : ''}>${escapeAttr(r)}</option>`
                ).join('');
                sel.innerHTML = `<option value="">请选择角色</option>${options}`;
            });
        }

        _refreshPlayerSelects() {
            const players = Object.keys(this.playersData || {});
            this.root.querySelectorAll('.bound-player-select').forEach(sel => {
                const cur = sel.value;
                const options = players.map(p =>
                    `<option value="${escapeAttr(p)}" ${p === cur ? 'selected' : ''}>${escapeAttr(p)}</option>`
                ).join('');
                sel.innerHTML = `<option value="">请选择玩家</option>${options}`;
            });
        }

        _buildHTML() {
            const data = this.data || {};
            const tags = data.标签 || [];
            const summaryWords = data.总结词 || [];
            const boundRoles = data.捆绑角色 || [];
            const boundPlayers = data.捆绑玩家 || [];
            const attributes = data.属性 || {};
            const hasEvents = !!(data.属性 && data.属性.事件);

            const tagsHtml = tags.map(tag => `
                <div class="tag-item">
                    <input type="text" class="tag-input" value="${escapeAttr(tag)}" placeholder="输入标签">
                    <button type="button" class="btn small se-remove-tag-btn">删除</button>
                </div>
            `).join('');

            const summaryWordsHtml = summaryWords.map(w => `
                <div class="summary-word-item">
                    <input type="text" class="summary-word" value="${escapeAttr(w)}" placeholder="输入总结词">
                    <button type="button" class="btn small se-remove-summary-btn">删除</button>
                </div>
            `).join('');

            const boundRolesHtml = boundRoles.map(role => this._renderBoundRoleItem(role)).join('');
            const boundPlayersHtml = boundPlayers.map(p => this._renderBoundPlayerItem(p)).join('');

            const attributesHtml = this._renderAttributesHtml(attributes, hasEvents);

            const basicInfoHtml = this.basicInfo ? this._renderBasicInfo(this.basicInfo) : '';

            return `
                ${basicInfoHtml}
                <div class="form-section">
                    <div class="form-section-header">
                        <h3 class="form-section-title">📝 基本信息</h3>
                        <span class="form-section-toggle">▼</span>
                    </div>
                    <div class="form-section-content">
                        <div class="form-group">
                            <label>数据名:</label>
                            <input type="text" id="se-name" value="${escapeAttr(this.name)}">
                        </div>
                        <div class="form-group">
                            <label>描述:</label>
                            <textarea id="se-description">${escapeAttr(data.描述 || '')}</textarea>
                        </div>
                    </div>
                </div>

                <div class="form-section">
                    <div class="form-section-header">
                        <h3 class="form-section-title">🔗 绑定设置</h3>
                        <span class="form-section-toggle">▼</span>
                    </div>
                    <div class="form-section-content">
                        <div class="form-group">
                            <label>捆绑角色:</label>
                            <input type="text" id="role-search" placeholder="搜索角色..." autocomplete="off">
                            <p class="help-text">选择与此数据书捆绑的角色，当与这些角色聊天时，数据书数据会自动添加到临时数据中</p>
                            <div class="se-bound-roles-container">${boundRolesHtml}</div>
                            <button type="button" class="btn secondary se-add-role-btn">+ 添加捆绑角色</button>
                        </div>
                        <div class="form-group">
                            <label>捆绑玩家:</label>
                            <p class="help-text">选择与此数据书捆绑的玩家，当使用这些玩家进行聊天时，数据书数据会自动添加到临时数据中</p>
                            <div class="se-bound-players-container">${boundPlayersHtml}</div>
                            <button type="button" class="btn secondary se-add-player-btn">+ 添加捆绑玩家</button>
                        </div>
                    </div>
                </div>

                <div class="form-section">
                    <div class="form-section-header">
                        <h3 class="form-section-title">🏷️ 标签分类</h3>
                        <span class="form-section-toggle">▼</span>
                    </div>
                    <div class="form-section-content">
                        <div class="form-group">
                            <label>标签:</label>
                            <div class="se-tags-container">${tagsHtml}</div>
                            <button type="button" class="btn secondary se-add-tag-btn">+ 添加标签</button>
                        </div>
                        <div class="form-group">
                            <label>总结词:</label>
                            <div class="se-summary-words-container">${summaryWordsHtml}</div>
                            <button type="button" class="btn secondary se-add-summary-btn">+ 添加总结词</button>
                        </div>
                    </div>
                </div>

                <div class="form-section full-width">
                    <div class="form-section-header">
                        <h3 class="form-section-title">📊 数据卡属性</h3>
                        <span class="form-section-toggle">▼</span>
                    </div>
                    <div class="form-section-content">
                        <div class="form-group">
                            <div class="standard-format-info">
                                <h4>📋 标准数据卡格式</h4>
                                <p class="help-text">系统会自动为每个数据书创建标准格式的属性结构，包括：状态、外貌特征、能力值、社交关系、背包等。您可以在标准格式的基础上添加自定义属性。</p>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" class="se-enable-events" ${hasEvents ? 'checked' : ''}>
                                启用事件属性
                            </label>
                            <p class="help-text">勾选后将在标准格式中添加"事件"属性，用于存储事件数组</p>
                        </div>
                        <div class="form-group">
                            <label>属性结构:</label>
                            <div class="se-attributes-container">${attributesHtml}</div>
                            <div class="attribute-controls">
                                <div class="standard-controls">
                                    <span class="controls-label">标准格式</span>
                                    <button type="button" class="btn secondary se-reset-standard-btn">🔄 重置为标准格式</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="btn-group">
                    <button class="btn se-submit-btn">${escapeAttr(this.submitLabel)}</button>
                    <button class="btn cancel se-cancel-btn">取消</button>
                </div>
            `;
        }

        _renderBasicInfo(info) {
            const entries = Object.entries(info).filter(([, v]) => v !== null && v !== undefined && v !== '');
            if (entries.length === 0) return '';
            const items = entries.map(([k, v]) => {
                let valHtml;
                if (typeof v === 'object') {
                    valHtml = `<pre class="se-basic-value-pre">${escapeAttr(JSON.stringify(v, null, 2))}</pre>`;
                } else {
                    valHtml = `<span class="se-basic-value">${escapeAttr(String(v))}</span>`;
                }
                return `<div class="se-basic-row"><span class="se-basic-key">${escapeAttr(k)}</span>${valHtml}</div>`;
            }).join('');
            return `
                <div class="form-section se-basic-info-section">
                    <div class="form-section-header">
                        <h3 class="form-section-title">👤 角色档案（只读）</h3>
                        <span class="form-section-toggle">▼</span>
                    </div>
                    <div class="form-section-content">
                        <p class="help-text">来自角色配置文件，编辑请到角色管理页面。</p>
                        ${items}
                    </div>
                </div>
            `;
        }

        _renderBoundRoleItem(selectedRole) {
            const roles = Object.keys(this.rolesData || {});
            const options = roles.map(r =>
                `<option value="${escapeAttr(r)}" ${r === selectedRole ? 'selected' : ''}>${escapeAttr(r)}</option>`
            ).join('');
            return `
                <div class="bound-role-item">
                    <select class="bound-role-select">
                        <option value="">请选择角色</option>
                        ${options}
                    </select>
                    <button type="button" class="btn small se-remove-role-btn">删除</button>
                </div>
            `;
        }

        _renderBoundPlayerItem(selectedPlayer) {
            const players = Object.keys(this.playersData || {});
            const options = players.map(p =>
                `<option value="${escapeAttr(p)}" ${p === selectedPlayer ? 'selected' : ''}>${escapeAttr(p)}</option>`
            ).join('');
            return `
                <div class="bound-player-item">
                    <select class="bound-player-select">
                        <option value="">请选择玩家</option>
                        ${options}
                    </select>
                    <button type="button" class="btn small se-remove-player-btn">删除</button>
                </div>
            `;
        }

        _renderAttributesHtml(attributes, includeEvents) {
            const standard = { ...STANDARD_FORMAT };
            if (includeEvents) standard['事件'] = [];

            let html = '';

            for (const [key, defaultVal] of Object.entries(standard)) {
                const val = (attributes && Object.prototype.hasOwnProperty.call(attributes, key)) ? attributes[key] : defaultVal;
                html += this._renderAttributeItem(key, val, true);
            }

            for (const [key, val] of Object.entries(attributes || {})) {
                if (Object.prototype.hasOwnProperty.call(standard, key)) continue;
                html += this._renderAttributeItem(key, val, false);
            }

            return html;
        }

        _renderAttributeItem(name, value, isStandard) {
            const labelHtml = isStandard
                ? `<span class="standard-format-label">标准格式</span>`
                : `<span class="custom-format-label">自定义</span>`;
            const stdAttr = isStandard ? `data-standard="${escapeAttr(name)}"` : '';
            const cls = `attribute-item ${isStandard ? 'standard-format' : 'custom-format'}`;
            const nameInput = isStandard
                ? `<input type="text" class="attr-name" value="${escapeAttr(name)}" placeholder="属性名" readonly>`
                : `<input type="text" class="attr-name" value="${escapeAttr(name)}" placeholder="属性名">`;

            const removeBtn = isStandard
                ? ''
                : `<button type="button" class="btn small se-remove-attr-btn">删除属性</button>`;

            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                const nestedItems = Object.entries(value).map(([k, v]) => `
                    <div class="nested-attr-item">
                        <input type="text" class="nested-attr-key" value="${escapeAttr(k)}" placeholder="键">
                        <input type="text" class="nested-attr-value" value="${escapeAttr(v)}" placeholder="值">
                        <button type="button" class="btn small se-remove-nested-btn">×</button>
                    </div>
                `).join('');
                return `
                    <div class="${cls}" ${stdAttr}>
                        ${nameInput}
                        <div class="nested-attributes">${nestedItems}</div>
                        <button type="button" class="btn small se-add-nested-btn">+ 添加子属性</button>
                        ${removeBtn}
                        ${labelHtml}
                    </div>
                `;
            }

            if (Array.isArray(value)) {
                const display = JSON.stringify(value);
                return `
                    <div class="${cls}" ${stdAttr}>
                        ${nameInput}
                        <input type="text" class="attr-value" value="${escapeAttr(display)}" placeholder="数组格式: []" title="输入JSON格式的数组">
                        ${removeBtn}
                        ${labelHtml}
                    </div>
                `;
            }

            return `
                <div class="${cls}" ${stdAttr}>
                    ${nameInput}
                    <input type="text" class="attr-value" value="${escapeAttr(value)}" placeholder="属性值">
                    ${removeBtn}
                    ${labelHtml}
                </div>
            `;
        }

        _bindEvents() {
            const root = this.root;

            // 折叠
            root.querySelectorAll('.form-section-header').forEach(header => {
                header.addEventListener('click', () => this._toggleFormSection(header));
            });

            // 标签
            const addTagBtn = root.querySelector('.se-add-tag-btn');
            if (addTagBtn) addTagBtn.addEventListener('click', () => this._addTag());
            root.addEventListener('click', e => {
                if (e.target.classList.contains('se-remove-tag-btn')) {
                    e.target.closest('.tag-item').remove();
                }
            });

            // 总结词
            const addSummaryBtn = root.querySelector('.se-add-summary-btn');
            if (addSummaryBtn) addSummaryBtn.addEventListener('click', () => this._addSummaryWord());
            root.addEventListener('click', e => {
                if (e.target.classList.contains('se-remove-summary-btn')) {
                    e.target.closest('.summary-word-item').remove();
                }
            });

            // 捆绑角色
            const addRoleBtn = root.querySelector('.se-add-role-btn');
            if (addRoleBtn) addRoleBtn.addEventListener('click', () => this._addBoundRole());
            root.addEventListener('click', e => {
                if (e.target.classList.contains('se-remove-role-btn')) {
                    e.target.closest('.bound-role-item').remove();
                }
            });

            // 捆绑玩家
            const addPlayerBtn = root.querySelector('.se-add-player-btn');
            if (addPlayerBtn) addPlayerBtn.addEventListener('click', () => this._addBoundPlayer());
            root.addEventListener('click', e => {
                if (e.target.classList.contains('se-remove-player-btn')) {
                    e.target.closest('.bound-player-item').remove();
                }
            });

            // 属性嵌套增删
            root.addEventListener('click', e => {
                if (e.target.classList.contains('se-add-nested-btn')) {
                    const container = e.target.previousElementSibling;
                    if (container && container.classList.contains('nested-attributes')) {
                        this._addNestedAttr(container);
                    }
                }
                if (e.target.classList.contains('se-remove-nested-btn')) {
                    e.target.closest('.nested-attr-item').remove();
                }
                if (e.target.classList.contains('se-remove-attr-btn')) {
                    e.target.closest('.attribute-item').remove();
                }
            });

            // 事件属性切换
            const enableEventsCb = root.querySelector('.se-enable-events');
            if (enableEventsCb) {
                enableEventsCb.addEventListener('change', () => this._toggleEventAttribute(enableEventsCb.checked));
            }

            // 重置标准格式
            const resetBtn = root.querySelector('.se-reset-standard-btn');
            if (resetBtn) resetBtn.addEventListener('click', () => this._resetToStandardFormat());

            // 提交/取消
            const submitBtn = root.querySelector('.se-submit-btn');
            if (submitBtn) submitBtn.addEventListener('click', () => this.requestSave());
            const cancelBtn = root.querySelector('.se-cancel-btn');
            if (cancelBtn) cancelBtn.addEventListener('click', () => {
                if (this.onCancel) this.onCancel();
            });
        }

        _toggleFormSection(header) {
            const section = header.parentElement;
            const toggle = header.querySelector('.form-section-toggle');
            section.classList.toggle('collapsed');
            if (toggle) toggle.textContent = section.classList.contains('collapsed') ? '▶' : '▼';
        }

        _addTag() {
            const container = this.root.querySelector('.se-tags-container');
            if (!container) return;
            const div = document.createElement('div');
            div.className = 'tag-item';
            div.innerHTML = `
                <input type="text" class="tag-input" placeholder="输入标签">
                <button type="button" class="btn small se-remove-tag-btn">删除</button>
            `;
            container.appendChild(div);
        }

        _addSummaryWord() {
            const container = this.root.querySelector('.se-summary-words-container');
            if (!container) return;
            const div = document.createElement('div');
            div.className = 'summary-word-item';
            div.innerHTML = `
                <input type="text" class="summary-word" placeholder="输入总结词">
                <button type="button" class="btn small se-remove-summary-btn">删除</button>
            `;
            container.appendChild(div);
        }

        _addBoundRole() {
            const container = this.root.querySelector('.se-bound-roles-container');
            if (!container) return;
            container.insertAdjacentHTML('beforeend', this._renderBoundRoleItem(''));
        }

        _addBoundPlayer() {
            const container = this.root.querySelector('.se-bound-players-container');
            if (!container) return;
            container.insertAdjacentHTML('beforeend', this._renderBoundPlayerItem(''));
        }

        _addNestedAttr(container) {
            const div = document.createElement('div');
            div.className = 'nested-attr-item';
            div.innerHTML = `
                <input type="text" class="nested-attr-key" placeholder="键">
                <input type="text" class="nested-attr-value" placeholder="值">
                <button type="button" class="btn small se-remove-nested-btn">×</button>
            `;
            container.appendChild(div);
        }

        _toggleEventAttribute(enabled) {
            const container = this.root.querySelector('.se-attributes-container');
            if (!container) return;
            const existing = Array.from(container.children).find(item => {
                const n = item.querySelector('.attr-name');
                return n && n.value === '事件';
            });
            if (enabled) {
                if (existing) return;
                const html = this._renderAttributeItem('事件', [], true);
                container.insertAdjacentHTML('beforeend', html);
            } else if (existing) {
                existing.remove();
            }
        }

        _resetToStandardFormat() {
            if (!window.confirm('确定要重置为标准格式吗？这将删除所有自定义属性，只保留标准格式的属性结构。')) return;

            const container = this.root.querySelector('.se-attributes-container');
            const enableEventsCb = this.root.querySelector('.se-enable-events');
            if (!container) return;

            // 保留标准属性当前值
            const currentValues = {};
            container.querySelectorAll('.attribute-item.standard-format').forEach(item => {
                const nameInput = item.querySelector('.attr-name');
                if (!nameInput) return;
                const name = nameInput.value;
                const nested = item.querySelector('.nested-attributes');
                if (nested) {
                    const obj = {};
                    nested.querySelectorAll('.nested-attr-item').forEach(ni => {
                        const k = ni.querySelector('.nested-attr-key');
                        const v = ni.querySelector('.nested-attr-value');
                        if (k && v && k.value.trim()) obj[k.value.trim()] = v.value.trim();
                    });
                    currentValues[name] = obj;
                } else {
                    const valEl = item.querySelector('.attr-value');
                    if (valEl) currentValues[name] = valEl.value.trim();
                }
            });

            const merged = {};
            for (const [k, def] of Object.entries(STANDARD_FORMAT)) {
                merged[k] = Object.prototype.hasOwnProperty.call(currentValues, k) ? currentValues[k] : def;
            }
            if (enableEventsCb && enableEventsCb.checked) {
                merged['事件'] = Array.isArray(currentValues['事件']) ? currentValues['事件'] : [];
            }

            container.innerHTML = this._renderAttributesHtml(merged, !!(enableEventsCb && enableEventsCb.checked));
        }

        _applyMobileCollapse() {
            if (window.innerWidth > 768) return;
            const collapseTitles = ['🔗 绑定设置'];
            this.root.querySelectorAll('.form-section-title').forEach(t => {
                if (collapseTitles.includes(t.textContent)) {
                    const section = t.closest('.form-section');
                    if (section && !section.classList.contains('collapsed')) {
                        this._toggleFormSection(t.parentElement);
                    }
                }
            });
        }
    }

    window.StorybookEditor = StorybookEditor;
})();
