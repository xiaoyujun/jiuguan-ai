/**
 * 玩家切换弹窗（已基于 SwitcherModalBase 重构）
 * 保留对外的全局变量与函数：
 *   - playerSwitcherModal
 *   - openPlayerSwitcherModal()
 *   - closePlayerSwitcherModal()
 *   - clearPlayerSearch()
 *   - openPlayerManagement()
 *
 * 依赖：switcher_modal_base.js（必须先加载）
 */
class PlayerSwitcherModal extends SwitcherModalBase {
    constructor() {
        super({
            modalId: 'playerSwitcherModal',
            gridId: 'playersGrid',
            inputId: 'playerSearchInput',
            clearBtnId: 'playerSearchClearBtn',
            loadingId: 'playerLoadingState',
            emptyId: 'playerEmptyState',
            countId: 'playerCount',
            instanceVar: 'playerSwitcherModal',
            itemClass: 'player-item',
            statusClass: 'player-status',
            avatarClass: 'player-avatar',
            fallbackClass: 'player-fallback',
            nameClass: 'player-name',
            fallbackEmoji: '👤',
            countLabel: (total, filtered) => filtered === total
                ? `共 ${total} 个玩家`
                : `显示 ${filtered} / ${total} 个玩家`,

            getCurrent: async () => {
                try {
                    const response = await fetch('/api/current_player');
                    const data = await response.json();
                    return (data.success && data.selected_player) ? data.selected_player : null;
                } catch (err) {
                    console.error('获取当前玩家失败:', err);
                    return null;
                }
            },

            fetchList: async () => {
                const response = await fetch('/api/players');
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                const data = await response.json();
                if (data.success) return data.players || [];
                if (data.requires_login) {
                    if (typeof showToast === 'function') {
                        showToast('会话已过期，请重新登录', 'warning');
                    }
                    setTimeout(() => { window.location.href = '/login?module=chat'; }, 2000);
                    return Object.assign([], { __abort: true });
                }
                throw new Error(data.error || '获取玩家列表失败');
            },

            onSelect: async (playerName) => {
                const response = await fetch('/api/players/select', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ player_name: playerName }),
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                const ct = response.headers.get('content-type');
                if (!ct || !ct.includes('application/json')) {
                    const text = await response.text();
                    throw new Error(`服务器返回了非JSON响应: ${text.substring(0, 100)}`);
                }
                const data = await response.json();

                if (data.success) {
                    if (typeof showToast === 'function') {
                        showToast(`👤 已切换到玩家: ${playerName}`, 'success');
                    }
                    document.dispatchEvent(new CustomEvent('playerChanged', { detail: playerName }));
                    setTimeout(() => window.location.reload(), 1000);
                    return;
                }
                if (data.requires_login) {
                    if (typeof showToast === 'function') {
                        showToast('会话已过期，请重新登录', 'warning');
                    }
                    setTimeout(() => { window.location.href = '/login?module=chat'; }, 2000);
                    return;
                }
                throw new Error(data.error || '切换玩家失败');
            },
        });
    }

    // 兼容旧 API
    loadPlayers() { return this.load(); }
    selectPlayer(name) { return this.select(name); }
}

let playerSwitcherModal;

document.addEventListener('DOMContentLoaded', () => {
    playerSwitcherModal = new PlayerSwitcherModal();
});

function openPlayerSwitcherModal() {
    if (playerSwitcherModal) playerSwitcherModal.open();
}

function closePlayerSwitcherModal() {
    if (playerSwitcherModal) playerSwitcherModal.close();
}

function clearPlayerSearch() {
    if (playerSwitcherModal) playerSwitcherModal.clearSearch();
}

function openPlayerManagement(playerName = null) {
    if (playerName) {
        const url = `/user-attributes?user=${encodeURIComponent(playerName)}`;
        const width = 900, height = 700;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;
        window.open(
            url,
            'attributes_' + playerName.replace(/[^a-zA-Z0-9]/g, '_'),
            `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`,
        );
    } else {
        window.location.href = '/player-management';
    }
}
