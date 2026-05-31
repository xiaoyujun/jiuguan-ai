/**
 * shared/confirm_dialog.js
 * ----------------------------------------------------------------
 * 通用确认弹窗。可在任何页面调用，无需提前在 HTML 中预埋。
 *
 * 用法：
 *   ConfirmDialog.show({
 *     title: '确认删除',
 *     message: '确定要删除“xxx”吗？',
 *     warning: '此操作无法撤销',
 *     confirmText: '删除',
 *     confirmKind: 'danger', // primary | danger
 *     onConfirm: async () => { ... },
 *   });
 *
 * 暴露：window.ConfirmDialog
 *
 * 依赖：components.css 中的 .modal2 / .btn 类
 */
(function (global) {
    'use strict';

    const HOST_ID = '__shared_confirm_dialog__';

    function ensureHost() {
        let host = document.getElementById(HOST_ID);
        if (host) return host;

        host = document.createElement('div');
        host.id = HOST_ID;
        host.className = 'modal2';
        host.innerHTML = `
            <div class="modal2__container modal2__container--sm">
                <div class="modal2__header">
                    <h2 class="modal2__title" data-cd="title">请确认</h2>
                </div>
                <div class="modal2__body">
                    <p data-cd="message"></p>
                    <p class="u-text-danger" data-cd="warning" style="display:none;"></p>
                </div>
                <div class="modal2__footer">
                    <div class="modal2__footer-actions">
                        <button type="button" class="btn btn--secondary" data-cd="cancel">取消</button>
                        <button type="button" class="btn btn--danger" data-cd="confirm">确认</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(host);

        host.addEventListener('click', (e) => {
            if (e.target === host) hide();
        });
        host.querySelector('[data-cd="cancel"]').addEventListener('click', hide);

        return host;
    }

    function escapeText(t) { return (t == null ? '' : String(t)); }

    let currentResolver = null;

    function hide() {
        const host = document.getElementById(HOST_ID);
        if (host) host.classList.remove('is-open');
        if (currentResolver) {
            const r = currentResolver;
            currentResolver = null;
            r(false);
        }
    }

    function show(opts = {}) {
        return new Promise((resolve) => {
            const host = ensureHost();
            host.querySelector('[data-cd="title"]').textContent = escapeText(opts.title || '请确认');
            host.querySelector('[data-cd="message"]').textContent = escapeText(opts.message || '确定执行此操作吗？');

            const warnEl = host.querySelector('[data-cd="warning"]');
            if (opts.warning) {
                warnEl.textContent = escapeText(opts.warning);
                warnEl.style.display = '';
            } else {
                warnEl.style.display = 'none';
            }

            const cancelBtn = host.querySelector('[data-cd="cancel"]');
            cancelBtn.textContent = escapeText(opts.cancelText || '取消');

            const okBtn = host.querySelector('[data-cd="confirm"]');
            okBtn.textContent = escapeText(opts.confirmText || '确认');
            okBtn.className = 'btn btn--' + (opts.confirmKind === 'primary' ? 'primary' : 'danger');

            const onClick = async () => {
                okBtn.disabled = true;
                try {
                    if (typeof opts.onConfirm === 'function') {
                        await opts.onConfirm();
                    }
                    okBtn.removeEventListener('click', onClick);
                    okBtn.disabled = false;
                    host.classList.remove('is-open');
                    currentResolver = null;
                    resolve(true);
                } catch (err) {
                    console.error('[ConfirmDialog onConfirm]', err);
                    okBtn.disabled = false;
                    if (typeof opts.onError === 'function') opts.onError(err);
                    okBtn.removeEventListener('click', onClick);
                    host.classList.remove('is-open');
                    currentResolver = null;
                    resolve(false);
                }
            };

            // 重新绑定，避免重复
            okBtn.replaceWith(okBtn.cloneNode(true));
            const fresh = host.querySelector('[data-cd="confirm"]');
            fresh.addEventListener('click', onClick);

            currentResolver = resolve;
            host.classList.add('is-open');
        });
    }

    global.ConfirmDialog = { show, hide };
})(window);
