/**
 * switcher_modal_base.js — 通用切换弹窗基类
 * --------------------------------------------------------
 * 抽象自 RoleSwitcherModal 与 PlayerSwitcherModal 的公共骨架。
 *
 * 子类通过 config 注入差异：
 *   - modalId / gridId / inputId / clearBtnId / loadingId / emptyId / countId
 *   - itemClass: 'role-item' | 'player-item'
 *   - statusClass / avatarClass / fallbackClass / nameClass
 *   - fallbackEmoji
 *   - countLabel(total, filtered): 文案
 *   - loadingText / errorIcon / errorRetryFn
 *   - fetchList(): Promise<Array<{name, ...}>>
 *   - getCurrent(): Promise<string|null>
 *   - onSelect(name): Promise<void>  // 真正切换逻辑
 *   - openManagementUrl(): 打开管理页（用于 footer 主按钮）
 *   - renderItemExtras(role): { extraClass, badgeHTML, infoHTML } | null
 *   - filterMatch(item, term): bool 默认按 name 精确包含
 *   - searchClearShowClass: 默认 'show'
 *
 * 兼容性：
 *   - 保留 .modal-overlay / .show / .modal-container 旧 DOM
 *   - 保留 .roles-grid / .players-grid 等列表容器命名
 *   - 现有 index.html 中的 onclick 全局函数继续可用
 */
class SwitcherModalBase {
    constructor(config) {
        this.config = Object.assign({
            itemClass: 'role-item',
            statusClass: 'role-status',
            avatarClass: 'role-avatar',
            fallbackClass: 'role-fallback',
            nameClass: 'role-name',
            fallbackEmoji: '🎭',
            errorIcon: '❌',
            loadingText: '正在加载...',
            searchClearShowClass: 'show',
            countLabel: (total, filtered) =>
                filtered === total ? `共 ${total} 项` : `显示 ${filtered} / ${total} 项`,
            filterMatch: (item, term) => (item.name || '').toLowerCase().includes(term),
            getAvatarUrl: (name) => `/avatar/${encodeURIComponent(name)}`,
            renderItemExtras: () => null,
        }, config);

        this.isOpen = false;
        this.items = [];
        this.filteredItems = [];
        this.currentName = null;
        this.selectedName = null;

        this._initElements();
        this._bindEvents();
        this._initCurrent();
    }

    _initElements() {
        const c = this.config;
        this.modal = document.getElementById(c.modalId);
        this.grid = document.getElementById(c.gridId);
        this.searchInput = document.getElementById(c.inputId);
        this.searchClearBtn = c.clearBtnId ? document.getElementById(c.clearBtnId) : null;
        this.loadingState = document.getElementById(c.loadingId);
        this.emptyState = document.getElementById(c.emptyId);
        this.countEl = c.countId ? document.getElementById(c.countId) : null;
    }

    _bindEvents() {
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
                this.updateSearchClearButton(e.target.value);
            });
            this.searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.selectFirstFiltered();
                else if (e.key === 'Escape') this.close();
            });
        }
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) this.close();
            });
        }
        document.addEventListener('keydown', (e) => {
            if (this.isOpen && e.key === 'Escape') this.close();
        });
    }

    async _initCurrent() {
        try {
            if (typeof this.config.getCurrent === 'function') {
                const name = await this.config.getCurrent();
                if (name) this.currentName = name;
            }
        } catch (err) {
            console.warn(`[${this.config.modalId}] 获取当前选项失败:`, err);
        }
    }

    /* ---------- 公开操作 ---------- */
    async open() {
        if (this.isOpen || !this.modal) return;
        this.isOpen = true;
        this.modal.classList.add('show');
        document.body.style.overflow = 'hidden';

        setTimeout(() => { if (this.searchInput) this.searchInput.focus(); }, 300);
        await this.load();
    }

    close() {
        if (!this.isOpen || !this.modal) return;
        this.isOpen = false;
        this.modal.classList.remove('show');
        document.body.style.overflow = '';
        this.clearSearch();
    }

    async load() {
        try {
            this.showLoading();
            const list = await this.config.fetchList();
            if (list && list.__abort) return;       // 子类可返回 abort 信号（如 requires_login）
            this.items = Array.isArray(list) ? list : [];
            this.filteredItems = [...this.items];
            this.render();
            this.updateCount();
        } catch (err) {
            console.error(`[${this.config.modalId}] 加载失败:`, err);
            this.showError('加载失败: ' + err.message);
        } finally {
            this.hideLoading();
        }
    }

    /* ---------- 渲染 ---------- */
    render() {
        if (!this.grid) return;

        if (this.filteredItems.length === 0) { this.showEmpty(); return; }
        this.hideEmpty();

        const c = this.config;
        const html = this.filteredItems.map(item => {
            const isCurrent = item.name === this.currentName;
            const avatarSrc = c.getAvatarUrl(item.name);
            const extras = c.renderItemExtras(item) || {};
            const extraClass = extras.extraClass || '';
            const badge = extras.badgeHTML || '';
            const info = extras.infoHTML || '';
            const titleSuffix = extras.titleSuffix || '';
            const escName = this.escapeHtml(item.name);

            return `
                <div class="${c.itemClass} ${isCurrent ? 'current' : ''} ${extraClass}"
                     data-name="${escName}"
                     onclick="${c.instanceVar}.select('${escName}')"
                     title="${escName}${titleSuffix}">
                    <div class="${c.statusClass}"></div>
                    ${badge}
                    <div class="${c.avatarClass}">
                        ${item.avatar !== false ?
                            `<img src="${avatarSrc}" alt="${escName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                             <div class="${c.fallbackClass}">${c.fallbackEmoji}</div>` :
                            c.fallbackEmoji
                        }
                    </div>
                    <div class="${c.nameClass}">${escName}</div>
                    ${info}
                </div>
            `;
        }).join('');

        this.grid.innerHTML = html;

        const items = this.grid.querySelectorAll('.' + c.itemClass);
        items.forEach((el, i) => { el.style.animationDelay = `${i * 0.05}s`; });
    }

    select(name) {
        if (!name) { this.close(); return; }
        if (name === this.currentName) { this.close(); return; }

        this.selectedName = name;
        const items = this.grid ? this.grid.querySelectorAll('.' + this.config.itemClass) : [];
        items.forEach(el => {
            el.classList.toggle('selected', el.dataset.name === name);
        });

        Promise.resolve(this.config.onSelect(name))
            .then(() => { this.currentName = name; this.close(); })
            .catch((err) => {
                console.error('切换失败:', err);
                if (typeof showToast === 'function') {
                    showToast('切换失败: ' + err.message, 'error');
                }
            });
    }

    /* ---------- 搜索 ---------- */
    handleSearch(query) {
        const term = query.toLowerCase().trim();
        this.filteredItems = !term
            ? [...this.items]
            : this.items.filter(it => this.config.filterMatch(it, term));
        this.render();
        this.updateCount();
    }

    selectFirstFiltered() {
        if (this.filteredItems.length > 0) this.select(this.filteredItems[0].name);
    }

    clearSearch() {
        if (this.searchInput) {
            this.searchInput.value = '';
            this.handleSearch('');
            this.updateSearchClearButton('');
        }
    }

    updateSearchClearButton(value) {
        if (!this.searchClearBtn) return;
        const cls = this.config.searchClearShowClass;
        this.searchClearBtn.classList.toggle(cls, !!value.trim());
    }

    /* ---------- 状态 ---------- */
    showLoading() {
        if (this.loadingState) this.loadingState.style.display = 'flex';
        if (this.grid) this.grid.style.display = 'none';
        this.hideEmpty();
    }

    hideLoading() {
        if (this.loadingState) this.loadingState.style.display = 'none';
        if (this.grid) this.grid.style.display = 'grid';
    }

    showEmpty() {
        if (this.emptyState) this.emptyState.style.display = 'flex';
        if (this.grid) this.grid.style.display = 'none';
    }

    hideEmpty() {
        if (this.emptyState) this.emptyState.style.display = 'none';
    }

    showError(message) {
        if (!this.emptyState) return;
        this.emptyState.innerHTML = `
            <div class="empty-icon">${this.config.errorIcon}</div>
            <p>加载失败</p>
            <small>${this.escapeHtml(message)}</small>
            <button onclick="${this.config.instanceVar}.load()" style="margin-top:16px;padding:8px 16px;border:none;background:#007bff;color:#fff;border-radius:6px;cursor:pointer;">重试</button>
        `;
        this.showEmpty();
    }

    updateCount() {
        if (!this.countEl) return;
        this.countEl.textContent = this.config.countLabel(
            this.items.length,
            this.filteredItems.length
        );
    }

    /* ---------- utils ---------- */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }
}

// 全局可见，供子类继承
window.SwitcherModalBase = SwitcherModalBase;
