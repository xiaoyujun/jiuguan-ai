/**
 * 玩家管理页面JavaScript功能
 */

class PlayerManagement {
    constructor() {
        this.players = [];
        this.currentPlayer = null;
        this.editingPlayer = null;
        this.filteredPlayers = [];
        this.init();
    }

    async init() {
        console.log('初始化玩家管理...');
        this.bindEvents();
        await this.loadPlayers();
        this.renderPlayers();
    }

    bindEvents() {
        // 搜索功能
        const searchInput = document.getElementById('playerSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }

        // 模态框关闭事件
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                this.closeAllModals();
            }
        });

        // ESC键关闭模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    async loadPlayers() {
        try {
            console.log('加载玩家列表...');
            this.showLoading(true);

            const response = await fetch('/api/players');
            const data = await response.json();

            if (data.success) {
                this.players = data.players || [];
                
                // 获取当前玩家信息
                const currentResponse = await fetch('/api/current_player');
                const currentData = await currentResponse.json();
                
                if (currentData.success) {
                    this.currentPlayer = currentData.selected_player;
                }
                
                this.filteredPlayers = [...this.players];
                console.log(`加载了 ${this.players.length} 个玩家`);
            } else {
                console.error('加载玩家失败:', data.error);
                this.showError('加载玩家列表失败: ' + data.error);
            }
        } catch (error) {
            console.error('加载玩家异常:', error);
            this.showError('网络错误，请稍后重试');
        } finally {
            this.showLoading(false);
        }
    }

    renderPlayers() {
        const grid = document.getElementById('playersGrid');
        const emptyState = document.getElementById('emptyState');
        
        if (!grid) return;

        if (this.filteredPlayers.length === 0) {
            grid.innerHTML = '';
            if (emptyState) {
                emptyState.style.display = 'flex';
            }
            return;
        }

        if (emptyState) {
            emptyState.style.display = 'none';
        }

        grid.innerHTML = this.filteredPlayers.map(player => this.renderPlayerCard(player)).join('');
    }

    renderPlayerCard(player) {
        const isCurrent = player.file_name === this.currentPlayer;
        const avatarUrl = player.avatar ? `/api/players/${player.file_name}/avatar` : null;
        
        return `
            <div class="player-card ${isCurrent ? 'current' : ''}" onclick="editPlayer('${player.file_name}')">
                <div class="player-avatar">
                    ${avatarUrl ? 
                        `<img src="${avatarUrl}" alt="${player.name}">` : 
                        '👤'
                    }
                </div>
                <div class="player-info">
                    <h3>${this.escapeHtml(player.name)}</h3>
                    <div class="description">
                        ${this.escapeHtml(player.description || '暂无介绍')}
                    </div>
                </div>
                <div class="player-actions" onclick="event.stopPropagation()">
                    <button class="btn-edit" onclick="editPlayer('${player.file_name}')">编辑</button>
                    ${!isCurrent ? 
                        `<button class="btn-select" onclick="selectPlayer('${player.file_name}')">选择</button>` :
                        '<span style="color: var(--gold-color); font-size: 0.8rem;">当前玩家</span>'
                    }
                    <button class="btn-delete" onclick="confirmDelete('${player.file_name}')">删除</button>
                </div>
            </div>
        `;
    }

    handleSearch(query) {
        const searchTerm = query.toLowerCase().trim();
        
        if (!searchTerm) {
            this.filteredPlayers = [...this.players];
        } else {
            this.filteredPlayers = this.players.filter(player => 
                player.name.toLowerCase().includes(searchTerm) ||
                (player.description && player.description.toLowerCase().includes(searchTerm))
            );
        }
        
        this.renderPlayers();
    }

    async selectPlayer(playerName) {
        try {
            console.log('选择玩家:', playerName);
            
            const response = await fetch('/api/players/select', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    player_name: playerName
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.currentPlayer = playerName;
                this.renderPlayers();
                this.showSuccess('已切换到玩家: ' + playerName);
            } else {
                this.showError('切换玩家失败: ' + data.error);
            }
        } catch (error) {
            console.error('选择玩家异常:', error);
            this.showError('网络错误，请稍后重试');
        }
    }

    openPlayerEditModal(player = null) {
        const modal = document.getElementById('playerEditModal');
        const modalTitle = document.getElementById('modalTitle');
        const deleteBtn = document.getElementById('deletePlayerBtn');
        
        if (!modal) return;

        this.editingPlayer = player;
        
        if (player) {
            modalTitle.textContent = '编辑玩家';
            deleteBtn.style.display = 'inline-flex';
            this.fillPlayerForm(player);
        } else {
            modalTitle.textContent = '新建玩家';
            deleteBtn.style.display = 'none';
            this.clearPlayerForm();
        }
        
        modal.classList.add('show');
    }

    fillPlayerForm(player) {
        document.getElementById('playerName').value = player.name || '';
        document.getElementById('playerDescription').value = player.description || '';
        document.getElementById('playerVoiceId').value = player.voice_id || '';
        document.getElementById('isCurrentPlayer').checked = player.file_name === this.currentPlayer;
        
        // 设置头像
        this.setAvatarPreview(player.file_name, player.avatar);
    }

    clearPlayerForm() {
        document.getElementById('playerName').value = '';
        document.getElementById('playerDescription').value = '';
        document.getElementById('playerVoiceId').value = '';
        document.getElementById('isCurrentPlayer').checked = false;
        
        // 清除头像预览
        this.clearAvatarPreview();
    }

    async savePlayer() {
        const form = document.getElementById('playerEditForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const playerName = document.getElementById('playerName').value.trim();
        const playerDescription = document.getElementById('playerDescription').value.trim();
        const isCurrentPlayer = document.getElementById('isCurrentPlayer').checked;

        if (!playerName) {
            this.showError('玩家名称不能为空');
            return;
        }

        try {
            const isEditing = !!this.editingPlayer;
            const url = isEditing ? `/api/players/${this.editingPlayer.file_name}` : '/api/players';
            const method = isEditing ? 'PUT' : 'POST';

            const playerVoiceId = document.getElementById('playerVoiceId').value.trim();

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    名字: playerName,
                    介绍: playerDescription,
                    voice_id: playerVoiceId,
                    set_as_current: isCurrentPlayer
                })
            });

            const data = await response.json();
            
            if (data.success) {
                // 如果有选择新头像，上传头像
                const avatarInput = document.getElementById('avatarInput');
                if (avatarInput && avatarInput.files.length > 0) {
                    // 对于新建玩家，使用输入的玩家名称作为文件名
                    // 对于编辑玩家，使用原有的文件名
                    const fileNameForUpload = isEditing ? this.editingPlayer.file_name : playerName;
                    const uploadSuccess = await this.uploadAvatar(fileNameForUpload, avatarInput.files[0]);
                    if (!uploadSuccess) {
                        // 头像上传失败，但玩家已创建/更新
                        this.showError('玩家保存成功，但头像上传失败');
                    }
                }
                
                this.closePlayerEditModal();
                await this.loadPlayers();
                this.renderPlayers();
                this.showSuccess(isEditing ? '玩家更新成功' : '玩家创建成功');
            } else {
                this.showError((isEditing ? '更新' : '创建') + '玩家失败: ' + data.error);
            }
        } catch (error) {
            console.error('保存玩家异常:', error);
            this.showError('网络错误，请稍后重试');
        }
    }

    confirmDelete(playerName) {
        const player = this.players.find(p => p.file_name === playerName);
        if (!player) return;

        const modal = document.getElementById('confirmDeleteModal');
        const playerNameSpan = document.getElementById('deletePlayerName');
        
        if (modal && playerNameSpan) {
            playerNameSpan.textContent = player.name;
            modal.classList.add('show');
            modal.dataset.playerName = playerName;
        }
    }

    async confirmDeletePlayer() {
        const modal = document.getElementById('confirmDeleteModal');
        const playerName = modal.dataset.playerName;
        
        if (!playerName) return;

        try {
            const response = await fetch(`/api/players/${playerName}`, {
                method: 'DELETE'
            });

            const data = await response.json();
            
            if (data.success) {
                this.closeConfirmDeleteModal();
                await this.loadPlayers();
                this.renderPlayers();
                this.showSuccess('玩家删除成功');
            } else {
                this.showError('删除玩家失败: ' + data.error);
            }
        } catch (error) {
            console.error('删除玩家异常:', error);
            this.showError('网络错误，请稍后重试');
        }
    }

    closePlayerEditModal() {
        const modal = document.getElementById('playerEditModal');
        if (modal) {
            modal.classList.remove('show');
        }
        this.editingPlayer = null;
    }

    closeConfirmDeleteModal() {
        const modal = document.getElementById('confirmDeleteModal');
        if (modal) {
            modal.classList.remove('show');
            delete modal.dataset.playerName;
        }
    }

    closeAllModals() {
        this.closePlayerEditModal();
        this.closeConfirmDeleteModal();
    }

    showLoading(show) {
        const loadingState = document.getElementById('loadingState');
        if (loadingState) {
            loadingState.style.display = show ? 'flex' : 'none';
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // 添加样式
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '15px 20px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '500',
            zIndex: '10000',
            maxWidth: '400px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            transform: 'translateX(400px)',
            transition: 'transform 0.3s ease'
        });

        // 设置背景色
        switch (type) {
            case 'success':
                notification.style.background = '#4caf50';
                break;
            case 'error':
                notification.style.background = '#f44336';
                break;
            default:
                notification.style.background = '#2196f3';
        }

        document.body.appendChild(notification);

        // 显示动画
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // 自动移除
        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 头像相关方法
    setAvatarPreview(playerName, hasAvatar) {
        const avatarImage = document.getElementById('avatarImage');
        const avatarPlaceholder = document.getElementById('avatarPlaceholder');
        const removeBtn = document.getElementById('removeAvatarBtn');
        
        if (hasAvatar) {
            avatarImage.src = `/api/players/${playerName}/avatar?t=${Date.now()}`;
            avatarImage.style.display = 'block';
            avatarPlaceholder.style.display = 'none';
            removeBtn.style.display = 'inline-flex';
        } else {
            avatarImage.style.display = 'none';
            avatarPlaceholder.style.display = 'flex';
            removeBtn.style.display = 'none';
        }
    }

    clearAvatarPreview() {
        const avatarImage = document.getElementById('avatarImage');
        const avatarPlaceholder = document.getElementById('avatarPlaceholder');
        const removeBtn = document.getElementById('removeAvatarBtn');
        const avatarInput = document.getElementById('avatarInput');
        
        avatarImage.style.display = 'none';
        avatarImage.src = '';
        avatarPlaceholder.style.display = 'flex';
        removeBtn.style.display = 'none';
        if (avatarInput) avatarInput.value = '';
    }

    async uploadAvatar(playerName, file) {
        try {
            const formData = new FormData();
            formData.append('avatar', file);
            
            const response = await fetch(`/api/players/${playerName}/avatar`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showSuccess('头像上传成功');
                return true;
            } else {
                this.showError('头像上传失败: ' + data.error);
                return false;
            }
        } catch (error) {
            console.error('上传头像异常:', error);
            this.showError('网络错误，请稍后重试');
            return false;
        }
    }

    async deleteAvatar(playerName) {
        try {
            const response = await fetch(`/api/players/${playerName}/avatar`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.clearAvatarPreview();
                this.showSuccess('头像删除成功');
                return true;
            } else {
                this.showError('头像删除失败: ' + data.error);
                return false;
            }
        } catch (error) {
            console.error('删除头像异常:', error);
            this.showError('网络错误，请稍后重试');
            return false;
        }
    }

    async savePlayerAndCreateStorybook() {
        try {
            const playerData = this.collectPlayerFormData();
            
            if (!playerData.名字 && !playerData.name) {
                this.showError('请输入玩家名称');
                return;
            }
            
            const playerName = playerData.名字 || playerData.name;
            
            // 检查名称冲突（编辑时如果名字没变则不检查）
            const isNameChanged = this.editingPlayer && this.editingPlayer.name !== playerName;
            if (!this.editingPlayer || isNameChanged) {
                if (this.players.some(p => p.name === playerName)) {
                    this.showError('玩家名称已存在');
                    return;
                }
            }
            
            // 更新按钮状态为"正在创建"
            const saveBtn = document.getElementById('saveAndCreateStorybookBtn');
            const originalText = saveBtn.innerHTML;
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在保存...';
            
            const isEdit = !!this.editingPlayer;
            const endpoint = isEdit ? 
                `/api/players/${encodeURIComponent(this.editingPlayer.name)}` : 
                '/api/players';
            
            const method = isEdit ? 'PUT' : 'POST';
            
            // 首先保存玩家
            const response = await fetch(endpoint, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(playerData)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '保存失败');
            }
            
            // 处理头像上传
            await this.uploadAvatarIfNeeded(playerName);
            
            // 玩家保存成功，显示成功消息
            this.showSuccess(`✅ 玩家"${playerName}"保存成功！`);
            
            // 更新按钮状态为"正在创建数据书"
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在创建数据书...';
            
            // 创建AI数据书
            const storybookName = `${playerName}的数据卡`;
            
            const storybookResponse = await fetch('/ai_new/generate_character_for_player', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    player_name: playerName,
                    player_config: playerData
                })
            });
            
            const storybookResult = await storybookResponse.json();
            
            if (storybookResult.success) {
                // 数据书创建成功，清除玩家简介
                await this.clearPlayerIntro(playerName);
                
                // 更新玩家的绑定数据书列表
                // 注意：后端生成的数据书文件名是玩家名，不是包含"的数据卡"的完整名称
                await this.updatePlayerStoryBookBinding(playerName, playerName);
                
                this.showSuccess(`✨ 数据书"${playerName}"创建成功，已自动设置双向绑定！`);
            } else {
                this.showError(`AI创建数据书失败: ${storybookResult.error || '未知错误'}`);
            }
            
            // 重新加载数据
            await this.loadPlayers();
            this.renderPlayers();
            
            this.closePlayerEditModal();
            
        } catch (error) {
            console.error('保存玩家或创建数据书失败:', error);
            this.showError('操作失败: ' + error.message);
        } finally {
            // 恢复按钮状态
            const saveBtn = document.getElementById('saveAndCreateStorybookBtn');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-magic"></i> 保存并AI创建数据书';
            }
        }
    }

    async clearPlayerIntro(playerName) {
        try {
            // 获取当前玩家数据
            const response = await fetch(`/api/players/${encodeURIComponent(playerName)}`);
            if (!response.ok) {
                console.warn('获取玩家数据失败，无法清除简介');
                return;
            }
            
            const playerData = await response.json();
            
            // 清除简介内容
            playerData.介绍 = '';
            playerData.description = '';
            
            // 更新玩家数据
            const updateResponse = await fetch(`/api/players/${encodeURIComponent(playerName)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(playerData)
            });
            
            if (!updateResponse.ok) {
                console.warn('清除玩家简介失败');
            } else {
                console.log(`已清除玩家"${playerName}"的简介内容`);
            }
            
        } catch (error) {
            console.warn('清除玩家简介失败:', error);
        }
    }

    async updatePlayerStoryBookBinding(playerName, storybookName) {
        try {
            // 获取当前玩家数据
            const response = await fetch(`/api/players/${encodeURIComponent(playerName)}`);
            if (!response.ok) {
                console.error(`获取玩家 ${playerName} 数据失败`);
                return;
            }
            
            const playerData = await response.json();
            
            // 确保绑定数据书字段存在
            if (!playerData.绑定数据书) {
                playerData.绑定数据书 = [];
            }
            
            // 添加新数据书到绑定列表（如果不存在）
            if (!playerData.绑定数据书.includes(storybookName)) {
                playerData.绑定数据书.push(storybookName);
                
                // 更新玩家数据
                const updateResponse = await fetch(`/api/players/${encodeURIComponent(playerName)}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(playerData)
                });
                
                if (updateResponse.ok) {
                    console.log(`🔗 [双向绑定] 已将数据书 "${storybookName}" 添加到玩家 "${playerName}" 的绑定列表`);
                } else {
                    console.error(`更新玩家 ${playerName} 的绑定数据书失败`);
                }
            } else {
                console.log(`🔗 [双向绑定] 数据书 "${storybookName}" 已在玩家 "${playerName}" 的绑定列表中`);
            }
        } catch (error) {
            console.error('更新玩家绑定数据书时发生错误:', error);
        }
    }

    async uploadAvatarIfNeeded(playerName) {
        const avatarInput = document.getElementById('avatarInput');
        if (avatarInput && avatarInput.files && avatarInput.files[0]) {
            return await this.uploadAvatar(playerName, avatarInput.files[0]);
        }
        return true;
    }

    collectPlayerFormData() {
        const form = document.getElementById('playerEditForm');
        const formData = new FormData(form);
        
        return {
            名字: formData.get('playerName'),  // 使用后端期望的字段名
            name: formData.get('playerName'),  // 保持兼容性
            介绍: formData.get('playerDescription') || '',
            description: formData.get('playerDescription') || '',
            voice_id: formData.get('playerVoiceId') || '',
            is_current: document.getElementById('isCurrentPlayer').checked
        };
    }
}

// 全局函数
let playerManagement;

document.addEventListener('DOMContentLoaded', () => {
    playerManagement = new PlayerManagement();
});

function createNewPlayer() {
    if (playerManagement) {
        playerManagement.openPlayerEditModal();
    }
}

function editPlayer(playerName) {
    if (playerManagement) {
        const player = playerManagement.players.find(p => p.file_name === playerName);
        if (player) {
            playerManagement.openPlayerEditModal(player);
        }
    }
}

function selectPlayer(playerName) {
    if (playerManagement) {
        playerManagement.selectPlayer(playerName);
    }
}

function confirmDelete(playerName) {
    if (playerManagement) {
        playerManagement.confirmDelete(playerName);
    }
}

function deletePlayer() {
    if (playerManagement && playerManagement.editingPlayer) {
        playerManagement.confirmDelete(playerManagement.editingPlayer.file_name);
        playerManagement.closePlayerEditModal();
    }
}

function savePlayer() {
    if (playerManagement) {
        playerManagement.savePlayer();
    }
}

function closePlayerEditModal() {
    if (playerManagement) {
        playerManagement.closePlayerEditModal();
    }
}

function closeConfirmDeleteModal() {
    if (playerManagement) {
        playerManagement.closeConfirmDeleteModal();
    }
}

function confirmDeletePlayer() {
    if (playerManagement) {
        playerManagement.confirmDeletePlayer();
    }
}

function goBack() {
    if (document.referrer) {
        window.history.back();
    } else {
        window.location.href = '/';
    }
}

async function savePlayerAndCreateStorybook() {
    if (playerManagement) {
        await playerManagement.savePlayerAndCreateStorybook();
    }
}

// 头像相关全局函数
function selectAvatar() {
    const avatarInput = document.getElementById('avatarInput');
    if (avatarInput) {
        avatarInput.click();
    }
}

function removeAvatar() {
    if (playerManagement && playerManagement.editingPlayer) {
        playerManagement.deleteAvatar(playerManagement.editingPlayer.file_name);
    } else {
        // 如果是新建玩家，直接清除预览
        if (playerManagement) {
            playerManagement.clearAvatarPreview();
        }
    }
}

// 初始化头像相关事件
document.addEventListener('DOMContentLoaded', () => {
    // 头像文件选择事件
    const avatarInput = document.getElementById('avatarInput');
    if (avatarInput) {
        avatarInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                // 验证文件类型
                const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
                if (!allowedTypes.includes(file.type)) {
                    if (playerManagement) {
                        playerManagement.showError('请选择图片文件 (PNG, JPG, GIF, WebP)');
                    }
                    e.target.value = '';
                    return;
                }
                
                // 验证文件大小 (50MB)
                if (file.size > 50 * 1024 * 1024) {
                    if (playerManagement) {
                        playerManagement.showError('文件大小不能超过 50MB');
                    }
                    e.target.value = '';
                    return;
                }
                
                // 显示预览
                const reader = new FileReader();
                reader.onload = (event) => {
                    const avatarImage = document.getElementById('avatarImage');
                    const avatarPlaceholder = document.getElementById('avatarPlaceholder');
                    const removeBtn = document.getElementById('removeAvatarBtn');
                    
                    if (avatarImage && avatarPlaceholder && removeBtn) {
                        avatarImage.src = event.target.result;
                        avatarImage.style.display = 'block';
                        avatarPlaceholder.style.display = 'none';
                        removeBtn.style.display = 'inline-flex';
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }
});
