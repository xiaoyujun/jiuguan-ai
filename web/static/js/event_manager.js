/**
 * 事件管理器
 * 用于管理数据书中事件的查看、编辑、添加和清理操作
 */

class EventManager {
    constructor() {
        this.storiesWithEvents = [];
        this.selectedStories = new Set();
        this.selectedEvents = new Set();
        this.searchTerm = '';
        this.isLoading = false;
        this.currentMode = 'view';
        this.pendingChanges = new Map(); // 存储待保存的更改
        
        this.initializeEventListeners();
    }

    /**
     * 初始化事件监听器
     */
    initializeEventListeners() {
        // 搜索输入框
        const searchInput = document.getElementById('event-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value.toLowerCase();
                this.filterAndDisplayStories();
            });
        }

        // 全选/取消全选按钮
        const selectAllBtn = document.getElementById('select-all-stories');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => this.toggleSelectAll());
        }

        // 操作模式选择
        const operationModeRadios = document.querySelectorAll('input[name="operation-mode"]');
        operationModeRadios.forEach(radio => {
            radio.addEventListener('change', () => this.handleOperationModeChange());
        });

        // 操作按钮
        const scanBtn = document.getElementById('scan-events-btn');
        if (scanBtn) {
            scanBtn.addEventListener('click', () => this.scanEvents());
        }

        const previewBtn = document.getElementById('preview-cleanup-btn');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => this.previewCleanup());
        }

        const executeBtn = document.getElementById('execute-cleanup-btn');
        if (executeBtn) {
            executeBtn.addEventListener('click', () => this.executeCleanup());
        }

        // 编辑相关按钮
        const saveChangesBtn = document.getElementById('save-changes-btn');
        if (saveChangesBtn) {
            saveChangesBtn.addEventListener('click', () => this.saveAllChanges());
        }

        const addEventBtn = document.getElementById('add-event-btn');
        if (addEventBtn) {
            addEventBtn.addEventListener('click', () => this.showAddEventDialog());
        }

        // 编辑对话框事件
        this.initializeEditDialogs();
    }

    /**
     * 扫描所有数据书中的事件
     */
    async scanEvents() {
        if (this.isLoading) return;

        this.setLoading(true);
        this.showStatus('正在扫描数据书中的事件...', 'info');

        try {
            const response = await fetch('/api/event-manager/scan');
            const result = await response.json();

            if (result.success) {
                this.storiesWithEvents = result.data;
                this.selectedStories.clear();
                this.selectedEvents.clear();
                
                this.displayStories();
                this.showStatus(`扫描完成，找到 ${result.total_stories} 个包含事件的数据书`, 'success');
                
                console.log('扫描结果:', result);
                console.log('包含事件的数据书:', result.data);
            } else {
                throw new Error(result.error || '扫描失败');
            }
        } catch (error) {
            console.error('扫描事件失败:', error);
            this.showStatus(`扫描失败: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * 显示数据书列表
     */
    displayStories() {
        const container = document.getElementById('stories-with-events-list');
        if (!container) return;

        if (this.storiesWithEvents.length === 0) {
            container.innerHTML = `
                <div class="no-events-message">
                    <h3>📝 暂无事件数据</h3>
                    <p>当前没有包含事件的数据书，或者还未进行扫描</p>
                </div>
            `;
            return;
        }

        this.filterAndDisplayStories();
    }

    /**
     * 过滤并显示数据书
     */
    filterAndDisplayStories() {
        const container = document.getElementById('stories-with-events-list');
        if (!container) return;

        // 过滤数据书
        const filteredStories = this.storiesWithEvents.filter(story => {
            if (!this.searchTerm) return true;
            
            return (
                story.name.toLowerCase().includes(this.searchTerm) ||
                story.description.toLowerCase().includes(this.searchTerm) ||
                story.tags.some(tag => tag.toLowerCase().includes(this.searchTerm)) ||
                story.events.some(event => event.toLowerCase().includes(this.searchTerm))
            );
        });

        if (filteredStories.length === 0) {
            container.innerHTML = `
                <div class="no-results-message">
                    <h3>🔍 未找到匹配结果</h3>
                    <p>没有找到与 "${this.searchTerm}" 匹配的数据书</p>
                </div>
            `;
            return;
        }

        // 生成HTML
        const html = filteredStories.map(story => this.generateStoryCard(story)).join('');
        container.innerHTML = html;

        // 更新统计信息
        this.updateStatistics(filteredStories);
    }

    /**
     * 生成数据书卡片HTML
     */
    generateStoryCard(story) {
        const isSelected = this.selectedStories.has(story.filename);
        
        return `
            <div class="story-event-card ${isSelected ? 'selected' : ''}">
                <div class="story-card-header">
                    <label class="story-checkbox-container">
                        <input type="checkbox" 
                               class="story-checkbox" 
                               data-filename="${story.filename}"
                               ${isSelected ? 'checked' : ''}
                               onchange="eventManager.toggleStorySelection('${story.filename}')">
                        <span class="checkmark"></span>
                    </label>
                    <div class="story-info">
                        <h3 class="story-name">${story.name}</h3>
                        <div class="story-meta">
                            <span class="event-count">📋 ${story.event_count} 个事件</span>
                            <span class="update-time">🕒 ${this.formatTime(story.update_time)}</span>
                        </div>
                    </div>
                </div>
                
                ${story.description ? `
                    <div class="story-description">
                        <p>${this.truncateText(story.description, 150)}</p>
                    </div>
                ` : ''}
                
                ${story.tags.length > 0 ? `
                    <div class="story-tags">
                        ${story.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                ` : ''}
                
                <div class="events-section">
                    <h4>事件列表:</h4>
                    <div class="events-list ${this.getEventListClass()}">
                        ${story.events.map((event, index) => this.generateEventItem(event, story.filename, index)).join('')}
                    </div>
                    ${this.currentMode === 'edit' ? this.generateAddEventSection(story.filename) : ''}
                </div>
            </div>
        `;
    }

    /**
     * 生成事件项HTML
     */
    generateEventItem(event, storyFilename, eventIndex) {
        const eventKey = `${storyFilename}:${eventIndex}`;
        
        switch (this.currentMode) {
            case 'edit':
                return `
                    <div class="event-item editable edit-mode" 
                         onclick="eventManager.showEditDialog('${storyFilename}', ${eventIndex}, '${this.escapeHtml(event)}')">
                        <span class="event-text">${event}</span>
                        <button class="event-edit-btn" onclick="event.stopPropagation(); eventManager.showEditDialog('${storyFilename}', ${eventIndex}, '${this.escapeHtml(event)}')">
                            ✏️
                        </button>
                    </div>
                `;
                
            case 'clear-selected':
                const isSelected = this.selectedEvents.has(eventKey);
                return `
                    <label class="event-item selectable ${isSelected ? 'selected' : ''}">
                        <input type="checkbox" 
                               class="event-checkbox"
                               data-story="${storyFilename}"
                               data-event-index="${eventIndex}"
                               ${isSelected ? 'checked' : ''}
                               onchange="eventManager.toggleEventSelection('${storyFilename}', ${eventIndex})">
                        <span class="event-text">${event}</span>
                    </label>
                `;
                
            default:
                return `<div class="event-item">${event}</div>`;
        }
    }

    /**
     * 切换数据书选择状态
     */
    toggleStorySelection(filename) {
        if (this.selectedStories.has(filename)) {
            this.selectedStories.delete(filename);
        } else {
            this.selectedStories.add(filename);
        }
        
        this.updateSelectionUI();
        this.updateActionButtons();
    }

    /**
     * 切换事件选择状态
     */
    toggleEventSelection(storyFilename, eventIndex) {
        const eventKey = `${storyFilename}:${eventIndex}`;
        
        if (this.selectedEvents.has(eventKey)) {
            this.selectedEvents.delete(eventKey);
        } else {
            this.selectedEvents.add(eventKey);
        }
        
        this.updateSelectionUI();
        this.updateActionButtons();
    }

    /**
     * 全选/取消全选
     */
    toggleSelectAll() {
        const filteredStories = this.getFilteredStories();
        const allSelected = filteredStories.every(story => this.selectedStories.has(story.filename));
        
        if (allSelected) {
            // 取消全选
            filteredStories.forEach(story => this.selectedStories.delete(story.filename));
        } else {
            // 全选
            filteredStories.forEach(story => this.selectedStories.add(story.filename));
        }
        
        this.filterAndDisplayStories();
        this.updateActionButtons();
    }

    /**
     * 处理操作模式变化
     */
    handleOperationModeChange() {
        const checkedMode = document.querySelector('input[name="operation-mode"]:checked');
        if (checkedMode) {
            this.currentMode = checkedMode.value;
            console.log('操作模式切换为:', this.currentMode);
        }
        
        this.selectedEvents.clear();
        this.pendingChanges.clear();
        this.filterAndDisplayStories();
        this.updateActionButtons();
    }

    /**
     * 预览清理操作
     */
    async previewCleanup() {
        if (this.selectedStories.size === 0) {
            this.showStatus('请先选择要清理的数据书', 'warning');
            return;
        }

        const selectedStoryList = Array.from(this.selectedStories);
        const selectedEventList = this.getSelectedEventTexts();

        try {
            const response = await fetch('/api/event-manager/preview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    stories: selectedStoryList,
                    clear_type: this.currentMode.startsWith('clear-') ? this.currentMode.replace('clear-', '') : 'all',
                    selected_events: selectedEventList
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showPreviewDialog(result.preview_data);
            } else {
                throw new Error(result.error || '预览失败');
            }
        } catch (error) {
            console.error('预览失败:', error);
            this.showStatus(`预览失败: ${error.message}`, 'error');
        }
    }

    /**
     * 执行清理操作
     */
    async executeCleanup() {
        if (this.selectedStories.size === 0) {
            this.showStatus('请先选择要清理的数据书', 'warning');
            return;
        }

        const clearType = this.currentMode.startsWith('clear-') ? this.currentMode.replace('clear-', '') : 'all';
        const selectedStoryList = Array.from(this.selectedStories);
        const selectedEventList = this.getSelectedEventTexts();

        // 确认对话框
        const confirmMessage = `确定要清理 ${selectedStoryList.length} 个数据书中的事件吗？\n\n清理模式: ${clearType === 'all' ? '清空所有事件' : '清空选定事件'}\n\n此操作不可撤销！`;
        
        if (!confirm(confirmMessage)) {
            return;
        }

        this.setLoading(true);
        this.showStatus('正在执行清理操作...', 'info');

        try {
            const response = await fetch('/api/event-manager/clear', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    stories: selectedStoryList,
                    clear_type: clearType,
                    selected_events: selectedEventList
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showStatus(result.message, 'success');
                
                // 显示详细结果
                if (result.failed_count > 0) {
                    console.warn('部分清理失败:', result.failed_stories);
                }
                
                // 重新扫描以更新数据
                setTimeout(() => {
                    this.scanEvents();
                }, 1000);
                
            } else {
                throw new Error(result.error || '清理失败');
            }
        } catch (error) {
            console.error('执行清理失败:', error);
            this.showStatus(`清理失败: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * 显示预览对话框
     */
    showPreviewDialog(previewData) {
        const dialog = document.getElementById('preview-dialog');
        const content = document.getElementById('preview-content');
        
        if (!dialog || !content) return;

        let html = '<div class="preview-summary">';
        html += `<h3>清理预览</h3>`;
        html += `<p>将要处理 ${previewData.length} 个数据书</p>`;
        html += '</div>';

        html += '<div class="preview-details">';
        previewData.forEach(item => {
            html += `
                <div class="preview-item ${item.will_be_cleared ? 'will-change' : 'no-change'}">
                    <h4>${item.name}</h4>
                    <div class="preview-events">
                        <div class="events-section">
                            <strong>原有事件:</strong>
                            <ul>
                                ${item.original_events.map(event => `<li>${event}</li>`).join('')}
                            </ul>
                        </div>
                        <div class="events-section">
                            <strong>将被移除:</strong>
                            <ul>
                                ${item.events_to_remove.map(event => `<li class="remove">${event}</li>`).join('')}
                            </ul>
                        </div>
                        <div class="events-section">
                            <strong>保留事件:</strong>
                            <ul>
                                ${item.remaining_events.map(event => `<li class="keep">${event}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        content.innerHTML = html;
        dialog.style.display = 'block';
    }

    /**
     * 获取选定的事件文本列表
     */
    getSelectedEventTexts() {
        const selectedTexts = [];
        for (const eventKey of this.selectedEvents) {
            const [storyFilename, eventIndexStr] = eventKey.split(':');
            const eventIndex = parseInt(eventIndexStr);
            
            // 找到对应的数据书和事件
            const story = this.storiesWithEvents.find(s => s.filename === storyFilename);
            if (story && story.events[eventIndex]) {
                selectedTexts.push(story.events[eventIndex]);
            }
        }
        return selectedTexts;
    }

    /**
     * 获取过滤后的数据书列表
     */
    getFilteredStories() {
        return this.storiesWithEvents.filter(story => {
            if (!this.searchTerm) return true;
            
            return (
                story.name.toLowerCase().includes(this.searchTerm) ||
                story.description.toLowerCase().includes(this.searchTerm) ||
                story.tags.some(tag => tag.toLowerCase().includes(this.searchTerm)) ||
                story.events.some(event => event.toLowerCase().includes(this.searchTerm))
            );
        });
    }

    /**
     * 更新选择相关的UI
     */
    updateSelectionUI() {
        // 更新数据书复选框状态
        document.querySelectorAll('.story-checkbox').forEach(checkbox => {
            const filename = checkbox.dataset.filename;
            checkbox.checked = this.selectedStories.has(filename);
            
            const card = checkbox.closest('.story-event-card');
            if (card) {
                card.classList.toggle('selected', checkbox.checked);
            }
        });

        // 更新事件复选框状态
        document.querySelectorAll('.event-checkbox').forEach(checkbox => {
            const story = checkbox.dataset.story;
            const eventIndex = checkbox.dataset.eventIndex;
            const eventKey = `${story}:${eventIndex}`;
            checkbox.checked = this.selectedEvents.has(eventKey);
            
            const item = checkbox.closest('.event-item');
            if (item) {
                item.classList.toggle('selected', checkbox.checked);
            }
        });

        // 更新全选按钮状态
        const selectAllBtn = document.getElementById('select-all-stories');
        if (selectAllBtn) {
            const filteredStories = this.getFilteredStories();
            const allSelected = filteredStories.length > 0 && 
                               filteredStories.every(story => this.selectedStories.has(story.filename));
            selectAllBtn.textContent = allSelected ? '取消全选' : '全选';
        }
    }

    /**
     * 更新操作按钮状态
     */
    updateActionButtons() {
        const previewBtn = document.getElementById('preview-cleanup-btn');
        const executeBtn = document.getElementById('execute-cleanup-btn');
        const saveChangesBtn = document.getElementById('save-changes-btn');
        const addEventBtn = document.getElementById('add-event-btn');
        
        const hasSelection = this.selectedStories.size > 0;
        
        // 根据当前模式显示/隐藏按钮
        switch (this.currentMode) {
            case 'view':
                this.hideButton(previewBtn);
                this.hideButton(executeBtn);
                this.hideButton(saveChangesBtn);
                this.hideButton(addEventBtn);
                break;
                
            case 'edit':
                this.hideButton(previewBtn);
                this.hideButton(executeBtn);
                this.showButton(saveChangesBtn, !hasSelection);
                this.showButton(addEventBtn, !hasSelection);
                break;
                
            case 'clear-all':
            case 'clear-selected':
                this.showButton(previewBtn, !hasSelection);
                this.showButton(executeBtn, !hasSelection);
                this.hideButton(saveChangesBtn);
                this.hideButton(addEventBtn);
                break;
        }
    }

    /**
     * 显示按钮
     */
    showButton(button, disabled = false) {
        if (button) {
            button.style.display = 'flex';
            button.disabled = disabled;
        }
    }

    /**
     * 隐藏按钮
     */
    hideButton(button) {
        if (button) {
            button.style.display = 'none';
        }
    }

    /**
     * 更新统计信息
     */
    updateStatistics(stories) {
        const statsContainer = document.getElementById('cleanup-statistics');
        if (!statsContainer) return;

        const totalEvents = stories.reduce((sum, story) => sum + story.event_count, 0);
        const selectedCount = this.selectedStories.size;
        
        statsContainer.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">数据书总数:</span>
                <span class="stat-value">${stories.length}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">事件总数:</span>
                <span class="stat-value">${totalEvents}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">已选择:</span>
                <span class="stat-value">${selectedCount}</span>
            </div>
        `;
    }

    /**
     * 设置加载状态
     */
    setLoading(loading) {
        this.isLoading = loading;
        
        const loadingOverlay = document.getElementById('cleanup-loading');
        if (loadingOverlay) {
            loadingOverlay.style.display = loading ? 'flex' : 'none';
        }
        
        // 禁用/启用按钮
        const buttons = document.querySelectorAll('.cleanup-btn');
        buttons.forEach(btn => {
            btn.disabled = loading;
        });
    }

    /**
     * 显示状态消息
     */
    showStatus(message, type = 'info') {
        const statusContainer = document.getElementById('cleanup-status');
        if (!statusContainer) return;

        statusContainer.className = `status-message ${type}`;
        statusContainer.textContent = message;
        statusContainer.style.display = 'block';

        // 自动隐藏成功和信息消息
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                statusContainer.style.display = 'none';
            }, 3000);
        }
    }

    /**
     * 格式化时间
     */
    formatTime(timeString) {
        if (!timeString) return '未知';
        
        try {
            const date = new Date(timeString);
            return date.toLocaleString('zh-CN');
        } catch (error) {
            return '未知';
        }
    }

    /**
     * 截断文本
     */
    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    /**
     * 获取事件列表的CSS类
     */
    getEventListClass() {
        switch (this.currentMode) {
            case 'edit': return 'editable';
            case 'clear-selected': return 'selectable';
            default: return '';
        }
    }

    /**
     * 生成添加事件区域
     */
    generateAddEventSection(storyFilename) {
        return `
            <div class="add-event-section" onclick="eventManager.showAddEventDialog('${storyFilename}')">
                <span class="add-event-text">➕ 点击添加新事件</span>
            </div>
        `;
    }

    /**
     * 初始化编辑对话框
     */
    initializeEditDialogs() {
        // 事件编辑对话框
        const closeEditBtn = document.getElementById('close-event-edit-dialog');
        if (closeEditBtn) {
            closeEditBtn.addEventListener('click', () => this.hideEditDialog());
        }

        const saveEventBtn = document.getElementById('save-event-btn');
        if (saveEventBtn) {
            saveEventBtn.addEventListener('click', () => this.saveEventEdit());
        }

        const deleteEventBtn = document.getElementById('delete-event-btn');
        if (deleteEventBtn) {
            deleteEventBtn.addEventListener('click', () => this.deleteEvent());
        }

        const cancelEditBtn = document.getElementById('cancel-edit-btn');
        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', () => this.hideEditDialog());
        }

        // 添加事件对话框
        const closeAddBtn = document.getElementById('close-add-event-dialog');
        if (closeAddBtn) {
            closeAddBtn.addEventListener('click', () => this.hideAddEventDialog());
        }

        const confirmAddBtn = document.getElementById('confirm-add-event-btn');
        if (confirmAddBtn) {
            confirmAddBtn.addEventListener('click', () => this.addNewEvent());
        }

        const cancelAddBtn = document.getElementById('cancel-add-btn');
        if (cancelAddBtn) {
            cancelAddBtn.addEventListener('click', () => this.hideAddEventDialog());
        }
    }

    /**
     * 显示编辑对话框
     */
    showEditDialog(storyFilename, eventIndex, eventText) {
        console.log('显示编辑对话框:', storyFilename, eventIndex, eventText);
        
        document.getElementById('edit-story-filename').value = storyFilename;
        document.getElementById('edit-event-index').value = eventIndex;
        document.getElementById('edit-event-text').value = this.unescapeHtml(eventText);
        
        const dialog = document.getElementById('event-edit-dialog');
        if (dialog) {
            dialog.style.display = 'block';
        }
    }

    /**
     * 隐藏编辑对话框
     */
    hideEditDialog() {
        const dialog = document.getElementById('event-edit-dialog');
        if (dialog) {
            dialog.style.display = 'none';
        }
    }

    /**
     * 保存事件编辑
     */
    async saveEventEdit() {
        const filename = document.getElementById('edit-story-filename').value;
        const eventIndex = parseInt(document.getElementById('edit-event-index').value);
        const newEventText = document.getElementById('edit-event-text').value.trim();

        if (!newEventText) {
            this.showStatus('事件内容不能为空', 'warning');
            return;
        }

        try {
            const response = await fetch('/api/event-manager/edit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filename: filename,
                    event_index: eventIndex,
                    new_event_text: newEventText
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showStatus('事件编辑成功', 'success');
                this.hideEditDialog();
                
                // 重新扫描以更新数据
                await this.scanEvents();
            } else {
                throw new Error(result.error || '编辑失败');
            }
        } catch (error) {
            console.error('编辑事件失败:', error);
            this.showStatus(`编辑失败: ${error.message}`, 'error');
        }
    }

    /**
     * 删除事件
     */
    async deleteEvent() {
        const filename = document.getElementById('edit-story-filename').value;
        const eventIndex = parseInt(document.getElementById('edit-event-index').value);

        if (!confirm('确定要删除这个事件吗？此操作不可撤销！')) {
            return;
        }

        try {
            const response = await fetch('/api/event-manager/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filename: filename,
                    event_index: eventIndex
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showStatus('事件删除成功', 'success');
                this.hideEditDialog();
                
                // 重新扫描以更新数据
                await this.scanEvents();
            } else {
                throw new Error(result.error || '删除失败');
            }
        } catch (error) {
            console.error('删除事件失败:', error);
            this.showStatus(`删除失败: ${error.message}`, 'error');
        }
    }

    /**
     * 显示添加事件对话框
     */
    showAddEventDialog(storyFilename) {
        console.log('显示添加事件对话框:', storyFilename);
        
        document.getElementById('add-story-filename').value = storyFilename;
        document.getElementById('add-event-text').value = '';
        
        const dialog = document.getElementById('add-event-dialog');
        if (dialog) {
            dialog.style.display = 'block';
        }
    }

    /**
     * 隐藏添加事件对话框
     */
    hideAddEventDialog() {
        const dialog = document.getElementById('add-event-dialog');
        if (dialog) {
            dialog.style.display = 'none';
        }
    }

    /**
     * 添加新事件
     */
    async addNewEvent() {
        const filename = document.getElementById('add-story-filename').value;
        const eventText = document.getElementById('add-event-text').value.trim();

        if (!eventText) {
            this.showStatus('事件内容不能为空', 'warning');
            return;
        }

        try {
            const response = await fetch('/api/event-manager/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filename: filename,
                    event_text: eventText
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showStatus('事件添加成功', 'success');
                this.hideAddEventDialog();
                
                // 重新扫描以更新数据
                await this.scanEvents();
            } else {
                throw new Error(result.error || '添加失败');
            }
        } catch (error) {
            console.error('添加事件失败:', error);
            this.showStatus(`添加失败: ${error.message}`, 'error');
        }
    }

    /**
     * 转义HTML字符
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 反转义HTML字符
     */
    unescapeHtml(text) {
        const div = document.createElement('div');
        div.innerHTML = text;
        return div.textContent || div.innerText || '';
    }

    /**
     * 保存所有更改
     */
    async saveAllChanges() {
        // 实现批量保存逻辑
        this.showStatus('批量保存功能开发中...', 'info');
    }
}

// 全局事件管理器实例
let eventManager;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    eventManager = new EventManager();
    
    // 关闭预览对话框
    const closePreviewBtn = document.getElementById('close-preview-dialog');
    if (closePreviewBtn) {
        closePreviewBtn.addEventListener('click', () => {
            const dialog = document.getElementById('preview-dialog');
            if (dialog) {
                dialog.style.display = 'none';
            }
        });
    }
    
    // 点击对话框外部关闭
    const previewDialog = document.getElementById('preview-dialog');
    if (previewDialog) {
        previewDialog.addEventListener('click', (e) => {
            if (e.target === previewDialog) {
                previewDialog.style.display = 'none';
            }
        });
    }
});

// 导出到全局作用域供HTML调用
window.eventManager = eventManager;