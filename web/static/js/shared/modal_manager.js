/**
 * shared/modal_manager.js
 * ----------------------------------------------------------------
 * 极简 modal 管理器：开/关/绑定遮罩点击关闭/绑定 ESC 关闭。
 * 主要面向新代码（使用 .modal2.is-open 命名）。
 * 旧代码可以继续使用各自的 .show / .open 实现，本模块不强制接管。
 *
 * 用法：
 *   ModalManager.open('myModalId');
 *   ModalManager.close('myModalId');
 *   ModalManager.register('myModalId', { onClose: ..., closeOnOverlay: true });
 *
 * 暴露：window.ModalManager
 */
(function (global) {
    'use strict';

    const OPEN_CLASS = 'is-open';
    const stack = [];          // 当前打开的 modal id 栈，用于 ESC 关闭最上层
    const registry = new Map(); // id -> { onClose, closeOnOverlay }

    function getEl(id) {
        return typeof id === 'string' ? document.getElementById(id) : id;
    }

    function open(idOrEl) {
        const el = getEl(idOrEl);
        if (!el) return false;
        el.classList.add(OPEN_CLASS);
        const id = el.id || '';
        if (id && !stack.includes(id)) stack.push(id);
        document.body.style.overflow = 'hidden';
        return true;
    }

    function close(idOrEl) {
        const el = getEl(idOrEl);
        if (!el) return false;
        el.classList.remove(OPEN_CLASS);
        const id = el.id || '';
        const idx = stack.indexOf(id);
        if (idx !== -1) stack.splice(idx, 1);

        const reg = registry.get(id);
        if (reg && typeof reg.onClose === 'function') {
            try { reg.onClose(); } catch (e) { console.error('[ModalManager onClose]', e); }
        }
        if (stack.length === 0) document.body.style.overflow = '';
        return true;
    }

    function register(id, opts = {}) {
        registry.set(id, { closeOnOverlay: true, ...opts });
        const el = getEl(id);
        if (!el) return;

        if (registry.get(id).closeOnOverlay) {
            el.addEventListener('click', (e) => {
                if (e.target === el) close(id);
            });
        }
    }

    function isOpen(id) {
        const el = getEl(id);
        return !!el && el.classList.contains(OPEN_CLASS);
    }

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || stack.length === 0) return;
        const top = stack[stack.length - 1];
        close(top);
    });

    global.ModalManager = { open, close, register, isOpen };
})(window);
