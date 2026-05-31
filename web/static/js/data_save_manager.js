// 数据保存管理器
// 处理数据保存相关的功能，包括两种保存方式：总结保存、聊天消息减负

class DataSaveManager {
    constructor() {
        this.currentRole = null;
        this.tempData = null;
    }

    // 初始化管理器
    init(roleSelect) {
        this.roleSelect = roleSelect;
        // 监听临时数据更新事件
        window.addEventListener('tempDataUpdated', (event) => {
            this.tempData = event.detail;
        });
    }

    // 显示数据保存选择对话框
    showDataSaveDialog() {
        const role = this.roleSelect?.value;
        if (!role) {
            showToast('请先选择一个角色', 'error');
            return;
        }

        this.currentRole = role;

        const dialogHTML = `
            <div class="dialog-overlay" id="data-save-dialog">
                <div class="dialog-content" style="max-width: 600px;">
                    <div class="dialog-header">
                        <h3>🚀 数据保存选择</h3>
                        <button class="dialog-close" onclick="dataSaveManager.closeDataSaveDialog()">&times;</button>
                    </div>
                    <div class="dialog-body">
                        <div class="save-options-container">
                            <div class="save-option" onclick="dataSaveManager.selectSaveOption('summary')">
                                <div class="option-icon">📊</div>
                                <div class="option-content">
                                    <h4>总结保存</h4>
                                    <p>准确可修改，使用原始总结功能</p>
                                    <small>适合需要细致检查和修改的情况</small>
                                </div>
                                <div class="option-arrow">→</div>
                            </div>


                            <div class="save-option" onclick="dataSaveManager.selectSaveOption('chat-reduce')">
                                <div class="option-icon">🧹</div>
                                <div class="option-content">
                                    <h4>聊天消息减负</h4>
                                    <p>智能减负，保留最近重要消息</p>
                                    <small>使用AI智能压缩聊天记录，节省空间</small>
                                </div>
                                <div class="option-arrow">→</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', dialogHTML);
    }

    // 关闭数据保存对话框
    closeDataSaveDialog() {
        const dialog = document.getElementById('data-save-dialog');
        if (dialog) {
            dialog.remove();
        }
    }

    // 选择保存选项
    selectSaveOption(option) {
        this.closeDataSaveDialog();

        switch (option) {
            case 'summary':
                this.openSummaryMode();
                break;
            case 'chat-reduce':
                this.executeChatReduction();
                break;
            default:
                showToast('未知的保存选项', 'error');
        }
    }

    // 总结保存模式（原始功能）
    openSummaryMode() {
        showToast('正在打开总结保存功能...', 'info');
        window.open(`/summary?role=${encodeURIComponent(this.currentRole)}`, '_blank');
    }

    // 执行聊天记录减负
    executeChatReduction() {
        const roleName = this.currentRole;
        
        if (!confirm(`确定要对角色"${roleName}"的聊天记录进行减负吗？\n\n此操作将保留最近的重要消息，其余消息将被AI智能总结压缩。`)) {
            return;
        }

        showToast('🧹 正在进行聊天记录减负...', 'info');

        // 调用完整聊天记录减负API
        fetch('/api/full_chat_history_reduction', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                role_name: roleName
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                let message = `✅ ${data.message || '聊天记录减负完成'}`;
                
                // 如果有显示记录数变化的信息，添加到消息中
                if (data.original_count && data.new_count) {
                    message += `\n\n📊 记录数：${data.original_count} → ${data.new_count}`;
                }
                
                alert(message);
                showToast('聊天记录减负完成！', 'success');
                
                // 刷新聊天界面以显示更新后的记录
                if (typeof loadChatHistory === 'function') {
                    setTimeout(() => {
                        loadChatHistory();
                    }, 1000);
                }
            } else {
                showToast(`减负失败: ${data.error || '未知错误'}`, 'error');
            }
        })
        .catch(error => {
            console.error('聊天记录减负失败:', error);
            showToast(`减负失败: ${error.message}`, 'error');
        });
    }


    // 检查临时数据并继续操作
    checkTempDataAndProceed(callback) {
        // 先获取当前角色的临时数据
        fetch('/api/temp_data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                role_name: this.currentRole
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.temp_data && Object.keys(data.temp_data).length > 0) {
                this.tempData = data.temp_data;
                callback();
            } else {
                showToast('当前角色没有临时数据可以保存', 'warning');
            }
        })
        .catch(error => {
            console.error('获取临时数据失败:', error);
            showToast('获取临时数据失败: ' + error.message, 'error');
        });
    }


    // 显示AI事件模拟对话框
    showAIModifyDialog() {
        const dialogHTML = `
            <div class="dialog-overlay" id="ai-modify-dialog">
                <div class="dialog-content" style="max-width: 600px;">
                    <div class="dialog-header">
                        <h3>🧹 AI事件模拟</h3>
                        <button class="dialog-close" onclick="dataSaveManager.closeAIModifyDialog()">&times;</button>
                    </div>
                    <div class="dialog-body">
                        <div class="form-group">
                            <label for="ai-modify-instruction">事件描述：</label>
                        <textarea id="ai-modify-instruction" rows="4" placeholder="你可以输入类似的话来让AI创造事件，比如给所有角色设置一个宿敌，模拟游戏时长过了一个月，更新所有角色的状态。模拟所有角色收到了天灾的打击，更新他们的状态。" 
                                  style="width: 100%; padding: 8px; border: 1px solid var(--border-gold); border-radius: 4px; background: var(--card-bg); color: var(--text-color); resize: vertical; font-family: 'Crimson Text', serif;"></textarea>
                        </div>
                        
                        <div class="form-group">
                            <div style="background: rgba(255, 165, 0, 0.1); border: 1px solid #FFA500; border-radius: 6px; padding: 12px; margin: 10px 0;">
                                <div style="color: #FFA500; font-weight: bold; margin-bottom: 8px;">🤖 AI事件模拟功能</div>
                                <div style="font-size: 0.9em; color: var(--text-color); line-height: 1.4;">
                                    利用AI来模拟各种事件对角色的影响<br>
                                    描述想要模拟的事件，AI会自动更新相关角色的状态和数据。
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="dialog-footer">
                        <button class="dialog-btn cancel-btn" onclick="dataSaveManager.closeAIModifyDialog()">取消</button>
                        <button class="dialog-btn confirm-btn" onclick="dataSaveManager.executeAIModify()">🤖 开始模拟</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', dialogHTML);
    }

    // 关闭AI事件模拟对话框
    closeAIModifyDialog() {
        const dialog = document.getElementById('ai-modify-dialog');
        if (dialog) {
            dialog.remove();
        }
    }

    // 执行AI事件模拟
    executeAIModify() {
        const instruction = document.getElementById('ai-modify-instruction').value.trim();
        
        if (!instruction) {
            showToast('请输入事件模拟要求', 'warning');
            return;
        }

        this.closeAIModifyDialog();
        showToast('🤖 AI正在进行事件模拟...', 'info');

        // 使用新版AI智能整理的API
        fetch('/ai_new/organize_stories', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                instruction: instruction,
                role_name: this.currentRole,  // 指定角色，以便处理临时数据
                include_temp_data: true       // 包含临时数据
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showToast('🎉 AI事件模拟完成！', 'success');
                
                let resultMessage = `🤖 AI事件模拟完成！\n\n${data.summary}\n\n📊 统计信息：\n• 处理了 ${data.processed_count} 个数据书\n• 执行了 ${data.instructions_count} 条编辑指令\n• 预计修改 ${data.estimated_changes} 项内容\n• 📝 临时数据已保留，可继续使用`;
                
                alert(resultMessage);
                
                // 刷新数据书列表（如果有的话）
                if (typeof loadStories === 'function') {
                    loadStories();
                }
            } else {
                showToast('AI事件模拟失败: ' + data.error, 'error');
            }
        })
        .catch(error => {
            console.error('AI事件模拟失败:', error);
            showToast('AI事件模拟失败: ' + error.message, 'error');
        });
    }

    // 保存后清理临时数据
    clearTempDataAfterSave() {
        if (confirm('保存完成！是否清理临时数据？')) {
            fetch('/api/clear_temp_data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    role_name: this.currentRole
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showToast('临时数据已清理', 'success');
                    this.tempData = null;
                }
            })
            .catch(error => {
                console.error('清理临时数据失败:', error);
            });
        }
    }
}

// 创建全局实例
const dataSaveManager = new DataSaveManager();
