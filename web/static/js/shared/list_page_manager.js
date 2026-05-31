/**
 * shared/list_page_manager.js
 * ----------------------------------------------------------------
 * 通用列表页（管理类页面）骨架管理器。
 * 把“加载 -> loading 切换 -> 渲染 -> empty 切换 -> 错误”这条
 * 在每个管理页都要写一遍的流程统一。
 *
 * 用法：
 *   const lpm = new ListPageManager({
 *     containerId: 'entries-grid',
 *     loadingId: 'loadingState',
 *     emptyId: 'emptyState',
 *     fetcher: async () => await fetch('/api/items').then(r => r.json()),
 *     renderer: (items, container) => { container.innerHTML = items.map(...).join(''); },
 *     onError: (err) => ToastManager.show(err.message, 'error'),
 *   });
 *   lpm.load();
 *
 * 暴露：window.ListPageManager
 */
(function (global) {
    'use strict';

    class ListPageManager {
        constructor(opts) {
            this.container = typeof opts.containerId === 'string'
                ? document.getElementById(opts.containerId)
                : opts.container;
            this.loadingEl = opts.loadingId ? document.getElementById(opts.loadingId) : null;
            this.emptyEl = opts.emptyId ? document.getElementById(opts.emptyId) : null;

            this.fetcher = opts.fetcher;       // () => Promise<Array>
            this.renderer = opts.renderer || ((items, c) => { c.textContent = JSON.stringify(items); });
            this.onError = opts.onError || ((err) => console.error(err));
            this.isEmpty = opts.isEmpty || ((items) => !items || items.length === 0);

            this.items = [];
        }

        async load() {
            this._setLoading(true);
            try {
                const items = await this.fetcher();
                this.items = Array.isArray(items) ? items : [];
                this._renderState();
            } catch (err) {
                this.onError(err);
                if (this.container) this.container.innerHTML = '';
                this._setEmpty(true);
            } finally {
                this._setLoading(false);
            }
        }

        setItems(items) {
            this.items = Array.isArray(items) ? items : [];
            this._renderState();
        }

        _renderState() {
            if (this.isEmpty(this.items)) {
                if (this.container) this.container.innerHTML = '';
                this._setEmpty(true);
            } else {
                this._setEmpty(false);
                if (this.container) this.renderer(this.items, this.container);
            }
        }

        _setLoading(on) {
            if (this.loadingEl) this.loadingEl.style.display = on ? '' : 'none';
            if (on && this.container) this.container.style.visibility = 'hidden';
            else if (this.container) this.container.style.visibility = '';
        }

        _setEmpty(on) {
            if (this.emptyEl) this.emptyEl.style.display = on ? '' : 'none';
        }
    }

    global.ListPageManager = ListPageManager;
})(window);
