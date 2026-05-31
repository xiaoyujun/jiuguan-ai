/**
 * shared/search_filter_manager.js
 * ----------------------------------------------------------------
 * 通用搜索/筛选工具：
 *   - 监听输入框 input/keydown
 *   - 监听清除按钮
 *   - 在指定数组上根据匹配函数过滤
 *   - 通过回调通知调用方更新视图
 *
 * 用法：
 *   const sf = new SearchFilterManager({
 *     inputId: 'search',
 *     clearBtnId: 'searchClear',
 *     getSource: () => allItems,
 *     match: (item, term) => item.name.toLowerCase().includes(term),
 *     onChange: (filtered) => render(filtered),
 *     debounce: 120,
 *   });
 *
 * 暴露：window.SearchFilterManager
 */
(function (global) {
    'use strict';

    class SearchFilterManager {
        constructor(opts) {
            this.input = typeof opts.inputId === 'string'
                ? document.getElementById(opts.inputId)
                : opts.input;
            this.clearBtn = opts.clearBtnId
                ? document.getElementById(opts.clearBtnId)
                : (opts.clearBtn || null);
            this.getSource = opts.getSource || (() => []);
            this.match = opts.match || ((item, term) => String(item).toLowerCase().includes(term));
            this.onChange = opts.onChange || (() => {});
            this.debounceMs = typeof opts.debounce === 'number' ? opts.debounce : 0;
            this.clearShowClass = opts.clearShowClass || 'is-visible';

            this._timer = null;
            this._lastTerm = '';

            this._bind();
        }

        _bind() {
            if (this.input) {
                this.input.addEventListener('input', () => this._scheduleApply());
                this.input.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        this.clear();
                    }
                });
            }
            if (this.clearBtn) {
                this.clearBtn.addEventListener('click', () => this.clear());
            }
        }

        _scheduleApply() {
            if (this.debounceMs <= 0) {
                this.apply();
                return;
            }
            clearTimeout(this._timer);
            this._timer = setTimeout(() => this.apply(), this.debounceMs);
        }

        apply() {
            const raw = this.input ? this.input.value : '';
            const term = raw.toLowerCase().trim();
            this._lastTerm = term;

            const source = this.getSource() || [];
            const filtered = !term ? [...source] : source.filter(it => this.match(it, term));

            if (this.clearBtn) {
                this.clearBtn.classList.toggle(this.clearShowClass, !!term);
            }
            this.onChange(filtered, term);
        }

        clear() {
            if (this.input) this.input.value = '';
            if (this.clearBtn) this.clearBtn.classList.remove(this.clearShowClass);
            this.apply();
            if (this.input) this.input.focus();
        }

        get term() { return this._lastTerm; }
    }

    global.SearchFilterManager = SearchFilterManager;
})(window);
