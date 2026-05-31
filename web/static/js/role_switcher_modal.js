/**
 * 角色切换弹窗（已基于 SwitcherModalBase 重构）
 * 保留对外的全局变量与函数：
 *   - roleSwitcherModal
 *   - openRoleSwitcherModal()
 *   - closeRoleSwitcherModal()
 *   - clearSearch()
 *   - openCharacterManagement()
 *
 * 依赖：switcher_modal_base.js（必须先加载）
 */
class RoleSwitcherModal extends SwitcherModalBase {
    constructor() {
        super({
            modalId: 'roleSwitcherModal',
            gridId: 'rolesGrid',
            inputId: 'roleSearchInput',
            clearBtnId: 'searchClearBtn',
            loadingId: 'loadingState',
            emptyId: 'emptyState',
            countId: 'roleCount',
            instanceVar: 'roleSwitcherModal',
            itemClass: 'role-item',
            statusClass: 'role-status',
            avatarClass: 'role-avatar',
            fallbackClass: 'role-fallback',
            nameClass: 'role-name',
            fallbackEmoji: '🎭',
            countLabel: (total, filtered) => filtered === total
                ? `共 ${total} 个角色`
                : `显示 ${filtered} / ${total} 个角色`,

            getCurrent: async () => {
                const select = document.getElementById('role');
                if (select && select.value) return select.value;
                const url = new URLSearchParams(window.location.search).get('role');
                return url || null;
            },

            fetchList: async () => {
                const response = await fetch('/api/roles');
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                const data = await response.json();

                if (data && data.success === false) {
                    if (data.requires_login) {
                        console.log('需要重新登录，关闭弹窗');
                        if (typeof showToast === 'function') {
                            showToast('会话已过期，请重新登录', 'warning');
                        }
                        setTimeout(() => { window.location.href = '/login?module=chat'; }, 2000);
                        // 通知 base 终止后续渲染
                        return Object.assign([], { __abort: true });
                    }
                    throw new Error(data.error || '获取角色列表失败');
                }

                if (Array.isArray(data)) return data;
                if (typeof data === 'object' && data !== null) {
                    return Object.keys(data).map(name => ({
                        name,
                        avatar: true,
                        data: data[name],
                        intro: data[name]?.介绍 || '',
                        tags: data[name]?.tags || [],
                        '角色类别': data[name]?.['角色类别'],
                        '角色捆绑配置': data[name]?.['角色捆绑配置'],
                    }));
                }
                return [];
            },

            renderItemExtras: (role) => {
                const isNarrator = role['角色类别'] === 'narrator';
                if (!isNarrator) return null;
                const bound = role['角色捆绑配置']?.boundRoles;
                const info = (bound && bound.length)
                    ? `<div class="narrator-info" title="捆绑角色: ${bound.join(', ')}">
                           <span class="bound-count">${bound.length}</span>
                       </div>`
                    : '';
                return {
                    extraClass: 'narrator-role',
                    badgeHTML: '<div class="narrator-badge" title="旁白角色"><i class="fas fa-theater-masks"></i></div>',
                    infoHTML: info,
                    titleSuffix: ' (旁白角色)',
                };
            },

            onSelect: async (roleName) => {
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage({ type: 'selectRole', roleName }, '*');
                    return;
                }
                const select = document.getElementById('role');
                if (!select) return;
                select.value = roleName;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                if (typeof saveLastChatRole === 'function') saveLastChatRole(roleName);
                if (typeof loadHistory === 'function') loadHistory();
                if (typeof showToast === 'function') {
                    showToast(`🎭 已切换到角色: ${roleName}`, 'success');
                }
            },
        });
    }

    /**
     * 兼容旧 API：检查角色的捆绑配置并自动启用多人聊天模式。
     * 与基类无关，保留原实现。
     */
    async checkAndEnableRoleBinding(roleName) {
        try {
            console.log(`🔍 检查角色 ${roleName} 的捆绑配置...`);
            const response = await fetch(`/api/roles/${encodeURIComponent(roleName)}`);
            if (!response.ok) {
                console.warn(`无法获取角色 ${roleName} 的数据:`, response.status);
                return;
            }
            const roleData = await response.json();
            const cfg = roleData['角色捆绑配置'] || roleData.role_binding_config;
            if (!cfg || !cfg.enabled) return;

            const boundRoles = cfg.boundRoles || [];
            if (!boundRoles.length) return;

            const isSceneRole = cfg.isSceneRole || cfg.scene_role || false;
            let allRoles, sceneContext = null;

            if (isSceneRole) {
                allRoles = [...boundRoles];
                sceneContext = {
                    sceneName: roleName,
                    sceneDescription: roleData.介绍 || roleData.description || '',
                    isActive: true,
                };
            } else {
                allRoles = [...new Set([roleName, ...boundRoles])];
            }

            if (typeof window.isMultiChatModeActive === 'undefined') {
                console.warn('⚠️ 多人聊天模式变量未初始化');
                return;
            }
            if (window.isMultiChatModeActive) {
                window.isMultiChatModeActive = false;
                window.selectedMultiChatRoles?.clear();
            }
            window.selectedMultiChatRoles = new Set(allRoles);
            window.isMultiChatModeActive = true;
            window.currentSceneContext = sceneContext;

            if (typeof updateMultiChatModeUI === 'function') updateMultiChatModeUI(true);
            if (typeof showToast === 'function') {
                showToast(isSceneRole
                    ? `🏛️ 已激活场景"${roleName}"，参与角色: ${allRoles.join(', ')}`
                    : `🔗 已自动启用多人聊天模式，参与角色: ${allRoles.join(', ')}`, 'success');
            }
        } catch (err) {
            console.error(`检查角色 ${roleName} 捆绑配置失败:`, err);
        }
    }

    // 兼容旧 API：handleClose / loadRoles 委托
    handleClose() { this.close(); }
    loadRoles() { return this.load(); }
    selectRole(name) { return this.select(name); }
}

// 全局实例
let roleSwitcherModal;

document.addEventListener('DOMContentLoaded', () => {
    roleSwitcherModal = new RoleSwitcherModal();
});

function openRoleSwitcherModal() {
    if (roleSwitcherModal) roleSwitcherModal.open();
}

function closeRoleSwitcherModal() {
    if (roleSwitcherModal) roleSwitcherModal.close();
}

function clearSearch() {
    if (roleSwitcherModal) roleSwitcherModal.clearSearch();
}

function openCharacterManagement() {
    window.open('/character-management', '_blank');
    closeRoleSwitcherModal();
}
