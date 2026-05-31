/**
 * shared/toast_manager.js
 * ----------------------------------------------------------------
 * 通用 toast 提示。如果页面已经存在全局 showToast，
 * 默认不接管，仅暴露 ToastManager.show 作为兜底实现。
 *
 * 用法：
 *   ToastManager.show('保存成功', 'success');
 *   ToastManager.show('网络错误', 'error', { duration: 5000 });
 *
 * 类型：success | warning | error | info
 *
 * 暴露：window.ToastManager；并在 window.showToast 不存在时自动赋值。
 */
(function (global) {
    'use strict';

    const CONTAINER_ID = '__shared_toast_container__';
    const KIND_CLASS = {
        success: 't--success',
        error: 't--error',
        warning: 't--warning',
        info: 't--info',
    };

    function ensureContainer() {
        let host = document.getElementById(CONTAINER_ID);
        if (host) return host;

        host = document.createElement('div');
        host.id = CONTAINER_ID;
        host.style.cssText = `
            position: fixed;
            top: 16px;
            right: 16px;
            z-index: 1100;
            display: flex;
            flex-direction: column;
            gap: 8px;
            pointer-events: none;
        `;
        document.body.appendChild(host);

        // 注入兜底样式（仅一次）
        if (!document.getElementById('__shared_toast_style__')) {
            const style = document.createElement('style');
            style.id = '__shared_toast_style__';
            style.textContent = `
                .__t__ {
                    pointer-events: auto;
                    background: #2a2a2e;
                    color: #f5f5f5;
                    border: 1px solid #3a3a3e;
                    border-radius: 8px;
                    padding: 10px 14px;
                    font-size: 14px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    opacity: 0;
                    transform: translateY(-6px);
                    transition: opacity .2s ease, transform .2s ease;
                    max-width: 360px;
                }
                .__t__.is-show { opacity: 1; transform: translateY(0); }
                .__t__.t--success { border-color: #5cb85c; }
                .__t__.t--error   { border-color: #d9534f; }
                .__t__.t--warning { border-color: #f0ad4e; }
                .__t__.t--info    { border-color: #5bc0de; }
            `;
            document.head.appendChild(style);
        }
        return host;
    }

    function show(message, kind = 'info', opts = {}) {
        const host = ensureContainer();
        const node = document.createElement('div');
        node.className = '__t__ ' + (KIND_CLASS[kind] || KIND_CLASS.info);
        node.textContent = String(message == null ? '' : message);
        host.appendChild(node);

        // 触发过渡
        requestAnimationFrame(() => node.classList.add('is-show'));

        const duration = Math.max(800, opts.duration || 2500);
        setTimeout(() => {
            node.classList.remove('is-show');
            setTimeout(() => node.remove(), 220);
        }, duration);
    }

    global.ToastManager = { show };
    if (typeof global.showToast !== 'function') {
        global.showToast = (message, kind, opts) => show(message, kind, opts);
    }
})(window);
