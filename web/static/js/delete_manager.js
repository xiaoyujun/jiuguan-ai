/**
 * 统一删除功能管理器
 * 整合所有删除相关的功能，减少重复代码
 */
class DeleteManager {
    constructor() {
        this.defaultOptions = {
            confirmMessage: '确定要删除吗？此操作不可撤销。',
            successMessage: '删除成功',
            errorMessage: '删除失败',
            showToast: true
        };
    }

    /**
     * 通用删除确认对话框
     */
    showConfirmDialog(message, callback) {
        if (confirm(message)) {
            callback();
        }
    }

    /**
     * 显示提示消息
     */
    showToast(message, type = 'info') {
        if (typeof showToast === 'function') {
            showToast(message, type);
        } else {
            alert(message);
        }
    }

    /**
     * 通用删除请求
     */
    async deleteRequest(url, options = {}) {
        try {
            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            const data = await response.json();
            return { success: response.ok, data, status: response.status };
        } catch (error) {
            console.error('删除请求失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 删除消息
     */
    deleteMessage(messageDiv, messageIndex, role = 'biabia') {
        this.showConfirmDialog('确定要删除这条消息吗？此操作不可撤销。', async () => {
            try {
                const response = await fetch('/delete_message', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        role: role,
                        message_index: messageIndex
                    })
                });

                const data = await response.json();
                
                if (data.success) {
                    this.showToast('消息已删除', 'success');
                    // 重新加载历史以确保索引正确
                    setTimeout(() => {
                        loadHistory();
                    }, 500);
                } else {
                    this.showToast('删除失败: ' + (data.error || '未知错误'), 'error');
                }
            } catch (error) {
                this.showToast('删除失败: ' + error.message, 'error');
            }
        });
    }

    /**
     * 删除角色
     */
    deleteRole(roleName) {
        this.showConfirmDialog(`确定要删除角色 "${roleName}" 吗？此操作不可撤销。`, async () => {
            const result = await this.deleteRequest(`/api/roles/${encodeURIComponent(roleName)}`);
            
            if (result.success && result.data.success) {
                this.showToast(`已删除角色 "${roleName}"`, 'success');
                if (typeof loadRoles === 'function') {
                    loadRoles(); // 重新加载角色列表
                }
            } else {
                this.showToast('删除角色失败: ' + (result.data?.error || result.error || '未知错误'), 'error');
            }
        });
    }

    /**
     * 删除玩家
     */
    deletePlayer(playerName) {
        this.showConfirmDialog(`确定要删除玩家 "${playerName}" 吗？此操作不可撤销。`, async () => {
            const result = await this.deleteRequest(`/api/players/${playerName}`);
            
            if (result.success && result.data.success) {
                this.showToast(`已删除玩家 "${playerName}"`, 'success');
                if (typeof loadPlayers === 'function') {
                    loadPlayers(); // 重新加载玩家列表
                }
            } else {
                this.showToast('删除玩家失败: ' + (result.data?.error || result.error || '未知错误'), 'error');
            }
        });
    }

    /**
     * 删除数据书
     */
    deleteStory(storyName) {
        this.showConfirmDialog(`确定要删除数据书 "${storyName}" 吗？此操作不可撤销。`, async () => {
            const result = await this.deleteRequest(`/api/stories/${storyName}`);
            
            if (result.success && result.data.success) {
                this.showToast(`已删除数据书 "${storyName}"`, 'success');
                if (typeof loadStories === 'function') {
                    loadStories(); // 重新加载数据书列表
                }
            } else {
                this.showToast('删除数据书失败: ' + (result.data?.error || result.error || '未知错误'), 'error');
            }
        });
    }

    /**
     * 删除世界书条目
     */
    deleteWorldbookEntry(entryName) {
        this.showConfirmDialog(`确定要删除世界书条目 "${entryName}" 吗？此操作不可撤销。`, async () => {
            const result = await this.deleteRequest(`/api/global_worldbook/${entryName}`);
            
            if (result.success && result.data.success) {
                this.showToast(`已删除世界书条目 "${entryName}"`, 'success');
                if (typeof loadGlobalWorldbookEntries === 'function') {
                    loadGlobalWorldbookEntries(); // 重新加载世界书条目列表
                }
            } else {
                this.showToast('删除世界书条目失败: ' + (result.data?.error || result.error || '未知错误'), 'error');
            }
        });
    }

    /**
     * 清除聊天记录
     */
    clearChatHistory(roleName) {
        this.showConfirmDialog(`确定要清除角色 "${roleName}" 的聊天记录吗？此操作不可撤销。`, async () => {
            try {
                const response = await fetch(`/clear_chat_history/${encodeURIComponent(roleName)}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                const data = await response.json();
                
                if (data.success) {
                    this.showToast('聊天记录已清除', 'success');
                    if (typeof loadHistory === 'function') {
                        loadHistory(); // 重新加载聊天历史
                    }
                } else {
                    this.showToast('清除聊天记录失败: ' + (data.error || '未知错误'), 'error');
                }
            } catch (error) {
                console.error('清除聊天记录失败:', error);
                this.showToast('清除聊天记录失败: ' + error.message, 'error');
            }
        });
    }

    /**
     * 清除数据书临时数据
     */
    clearStoryTempData(roleName) {
        const confirmMessage = `⚠️ 确认删除临时数据？\n\n这将删除角色 "${roleName}" 的所有临时数据，包括：\n• 数据书中记录的临时状态\n• 角色的动态属性变化\n• 对话过程中产生的数据\n• 其他临时存储的JSON数据\n\n此操作不可恢复！`;
        
        this.showConfirmDialog(confirmMessage, async () => {
            this.showToast('正在删除临时数据...', 'info');
            
            try {
                const response = await fetch(`/clear_story_temp_data/${encodeURIComponent(roleName)}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                const data = await response.json();
                
                if (data.success) {
                    this.showToast('临时数据已成功删除', 'success');
                } else {
                    this.showToast('删除失败: ' + (data.error || '未知错误'), 'error');
                }
            } catch (error) {
                this.showToast('删除失败: ' + error.message, 'error');
            }
        });
    }
}

// 创建全局删除管理器实例
const deleteManager = new DeleteManager();

// 为了向后兼容，保留原有的函数名
function deleteMessage(messageDiv, messageIndex, role = 'biabia') {
    deleteManager.deleteMessage(messageDiv, messageIndex, role);
}

function deleteRole(roleName) {
    deleteManager.deleteRole(roleName);
}

function deletePlayer(playerName) {
    deleteManager.deletePlayer(playerName);
}

function deleteStory(storyName) {
    deleteManager.deleteStory(storyName);
}

function deleteWorldbookEntry(entryName) {
    deleteManager.deleteWorldbookEntry(entryName);
}
