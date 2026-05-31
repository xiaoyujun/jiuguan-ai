/**
 * 角色导出功能模块 - 统一的角色导出解决方案
 * 支持旁白角色和NPC角色的导出，将角色数据嵌入到图片中
 * 位于 character_features 文件夹中，与导入功能保持一致
 */

class CharacterExporter {
    constructor(characterManagement) {
        this.characterManagement = characterManagement;
        this.canvas = null;
        this.ctx = null;
        
        this.init();
    }

    init() {
        this.setupExportEvents();
        console.log('CharacterExporter: 初始化完成');
    }

    /**
     * 设置导出相关事件
     */
    setupExportEvents() {
        const exportBtn = document.getElementById('export-character-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.showExportModal();
            });
        }
    }

    /**
     * 显示用户友好的错误消息
     */
    showUserFriendlyError(error) {
        let message = '导出失败：';
        
        if (error.message.includes('会话已过期') || error.message.includes('401')) {
            message += '登录会话已过期，请刷新页面重新登录后再试。';
        } else if (error.message.includes('网络')) {
            message += '网络连接异常，请检查网络后重试。';
        } else if (error.message.includes('角色数据')) {
            message += '无法获取角色数据，请检查角色是否存在。';
        } else {
            message += error.message;
        }
        
        // 显示错误消息
        alert(message);
        console.error('导出详细错误:', error);
    }

    /**
     * 显示导出选择模态框
     */
    showExportModal() {
        if (!this.characterManagement.characters || this.characterManagement.characters.length === 0) {
            this.characterManagement.showNotification('没有可导出的角色', 'warning');
            return;
        }

        // 创建导出模态框HTML
        const modalHTML = this.createExportModalHTML();
        
        // 插入到页面中
        let existingModal = document.getElementById('export-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // 绑定事件
        this.bindExportModalEvents();
        
        // 加载角色列表
        this.loadCharactersForExport();
        
        // 显示模态框
        const modal = document.getElementById('export-modal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    /**
     * 创建导出模态框HTML
     */
    createExportModalHTML() {
        return `
        <div id="export-modal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">
                        <i class="fas fa-download"></i>
                        导出角色
                    </h3>
                    <button class="close-btn" id="close-export-modal-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="modal-body">
                    <div class="export-tabs">
                        <button class="export-tab-btn active" data-tab="single">
                            <i class="fas fa-user"></i>
                            单个导出
                        </button>
                        <button class="export-tab-btn" data-tab="batch">
                            <i class="fas fa-users"></i>
                            批量导出
                        </button>
                    </div>
                    
                    <!-- 单个导出标签页 -->
                    <div class="export-tab-content active" data-tab="single">
                        <div class="form-group">
                            <label class="form-label">搜索角色</label>
                            <div class="search-container">
                                <input type="text" id="single-export-search" class="form-input search-input" 
                                       placeholder="输入角色名称进行搜索...">
                                <i class="fas fa-search search-icon"></i>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">选择要导出的角色</label>
                            <select id="single-export-select" class="form-select">
                                <option value="">请选择角色...</option>
                            </select>
                        </div>
                        
                        <div id="single-export-info" class="export-info" style="display: none;">
                            <div class="character-preview">
                                <div class="preview-avatar">
                                    <img id="export-preview-avatar" src="" alt="角色头像">
                                </div>
                                <div class="preview-details">
                                    <h5 id="export-preview-name">角色名称</h5>
                                    <p id="export-preview-type">角色类型</p>
                                    <div id="export-preview-storybook" class="storybook-status">
                                        <i class="fas fa-book"></i>
                                        <span>检查数据书状态中...</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 批量导出标签页 -->
                    <div class="export-tab-content" data-tab="batch">
                        <div class="form-group">
                            <label class="form-label">搜索角色</label>
                            <div class="search-container">
                                <input type="text" id="batch-export-search" class="form-input search-input" 
                                       placeholder="输入角色名称进行搜索...">
                                <i class="fas fa-search search-icon"></i>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">选择要导出的角色</label>
                            <div class="batch-selection-controls" style="margin: 10px 0; display: flex; gap: 10px; align-items: center;">
                                <button type="button" id="select-all-characters-btn" class="btn btn-secondary btn-sm">
                                    <i class="fas fa-check-square"></i>
                                    全选
                                </button>
                                <button type="button" id="deselect-all-characters-btn" class="btn btn-secondary btn-sm">
                                    <i class="fas fa-square"></i>
                                    取消全选
                                </button>
                                <span id="batch-selection-info" class="text-muted" style="font-size: 12px;">
                                    已选择 0 个角色
                                </span>
                            </div>
                            <div class="batch-character-list" id="batch-character-list">
                                <!-- 角色复选框列表 -->
                            </div>
                        </div>
                        
                        <div class="batch-export-options">
                            <div class="form-group">
                                <label class="form-label">
                                    <input type="checkbox" id="batch-zip-export" class="form-checkbox" checked>
                                    <i class="fas fa-file-archive"></i>
                                    打包为ZIP文件
                                </label>
                                <p class="form-help-text">将所有导出的角色图片打包为一个ZIP文件下载</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="export-format-info">
                        <h5><i class="fas fa-info-circle"></i> 导出格式说明</h5>
                        <div class="format-details">
                            <div class="format-item">
                                <i class="fas fa-user"></i>
                                <strong>NPC角色：</strong>包含角色配置和数据书数据（如有），嵌入到图片的元数据中
                            </div>
                            <div class="format-item">
                                <i class="fas fa-theater-masks"></i>
                                <strong>旁白角色：</strong>包含角色配置和捆绑角色信息，嵌入到图片的元数据中
                            </div>
                            <div class="format-item">
                                <i class="fas fa-exclamation-triangle"></i>
                                <strong>注意：</strong>导入时如果角色有数据书，会提示必须生成相应的数据书
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-actions">
                    <button class="btn btn-secondary" id="export-cancel-btn">取消</button>
                    <button class="btn btn-primary" id="export-confirm-btn" disabled>
                        <i class="fas fa-download"></i>
                        开始导出
                    </button>
                </div>
            </div>
        </div>
        `;
    }

    /**
     * 绑定导出模态框事件
     */
    bindExportModalEvents() {
        const modal = document.getElementById('export-modal');
        const closeBtn = document.getElementById('close-export-modal-btn');
        const cancelBtn = document.getElementById('export-cancel-btn');
        const confirmBtn = document.getElementById('export-confirm-btn');
        const singleSelect = document.getElementById('single-export-select');
        
        // 关闭事件
        [closeBtn, cancelBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => {
                    this.closeExportModal();
                });
            }
        });
        
        // 点击模态框外部关闭
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeExportModal();
                }
            });
        }
        
        // 标签页切换
        document.querySelectorAll('.export-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchExportTab(e.target.dataset.tab);
            });
        });
        
        // 单个角色选择
        if (singleSelect) {
            singleSelect.addEventListener('change', (e) => {
                this.onSingleCharacterSelect(e.target.value);
            });
        }
        
        // 确认导出
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                this.startExport();
            });
        }
        
        // 批量选择按钮事件
        const selectAllBtn = document.getElementById('select-all-characters-btn');
        const deselectAllBtn = document.getElementById('deselect-all-characters-btn');
        
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                this.selectAllCharacters();
            });
        }
        
        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', () => {
                this.deselectAllCharacters();
            });
        }
    }

    /**
     * 切换导出标签页
     */
    switchExportTab(tabName) {
        // 切换标签按钮状态
        document.querySelectorAll('.export-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // 切换标签内容
        document.querySelectorAll('.export-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.querySelector(`.export-tab-content[data-tab="${tabName}"]`).classList.add('active');
        
        // 重置确认按钮状态
        const confirmBtn = document.getElementById('export-confirm-btn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
        }
    }

    /**
     * 加载角色列表用于导出
     */
    loadCharactersForExport() {
        // 存储所有角色数据供搜索使用
        this.allCharacters = [...this.characterManagement.characters];
        
        // 初始加载所有角色
        this.updateSingleExportList(this.allCharacters);
        this.updateBatchExportList(this.allCharacters);
        
        // 绑定搜索事件
        this.bindSearchEvents();
    }
    
    /**
     * 更新单个导出的角色列表
     */
    updateSingleExportList(characters) {
        const singleSelect = document.getElementById('single-export-select');
        if (singleSelect) {
            const currentValue = singleSelect.value;
            singleSelect.innerHTML = '<option value="">请选择角色...</option>';
            
            characters.forEach(character => {
                const option = document.createElement('option');
                option.value = character.name;
                option.textContent = `${character.name} (${character.category === 'narrator' ? '旁白' : 'NPC'})`;
                singleSelect.appendChild(option);
            });
            
            // 如果之前有选中的值，尝试恢复
            if (currentValue && characters.some(c => c.name === currentValue)) {
                singleSelect.value = currentValue;
            }
        }
    }
    
    /**
     * 更新批量导出的角色列表
     */
    updateBatchExportList(characters) {
        const batchList = document.getElementById('batch-character-list');
        if (batchList) {
            // 保存当前选中状态
            const selectedCharacters = new Set();
            const checkboxes = batchList.querySelectorAll('.batch-character-checkbox:checked');
            checkboxes.forEach(cb => selectedCharacters.add(cb.value));
            
            batchList.innerHTML = '';
            characters.forEach(character => {
                const isSelected = selectedCharacters.has(character.name);
                const checkboxHTML = `
                    <div class="batch-character-item" data-character-name="${character.name.toLowerCase()}" data-character-type="${character.category === 'narrator' ? '旁白' : 'npc'}">
                        <label class="character-checkbox-label">
                            <input type="checkbox" class="batch-character-checkbox" value="${character.name}" ${isSelected ? 'checked' : ''}>
                            <div class="character-checkbox-content">
                                <img src="/api/roles/${encodeURIComponent(character.name)}/avatar" 
                                     alt="${character.name}" class="character-mini-avatar"
                                     onerror="this.src='/static/images/default-avatar.svg'">
                                <div class="character-checkbox-info">
                                    <div class="character-checkbox-name">${character.name}</div>
                                    <div class="character-checkbox-type">${character.category === 'narrator' ? '旁白角色' : 'NPC角色'}</div>
                                </div>
                            </div>
                        </label>
                    </div>
                `;
                batchList.insertAdjacentHTML('beforeend', checkboxHTML);
            });
            
            // 绑定批量选择事件
            this.bindBatchSelectEvents();
            
            // 初始化UI状态
            this.updateBatchSelectionUI();
        }
    }
    
    /**
     * 绑定搜索事件
     */
    bindSearchEvents() {
        // 单个导出搜索
        const singleSearchInput = document.getElementById('single-export-search');
        if (singleSearchInput) {
            singleSearchInput.addEventListener('input', (e) => {
                this.filterCharacters(e.target.value, 'single');
            });
        }
        
        // 批量导出搜索
        const batchSearchInput = document.getElementById('batch-export-search');
        if (batchSearchInput) {
            batchSearchInput.addEventListener('input', (e) => {
                this.filterCharacters(e.target.value, 'batch');
            });
        }
    }
    
    /**
     * 根据搜索词过滤角色
     */
    filterCharacters(searchTerm, type) {
        if (!this.allCharacters) return;
        
        // 如果搜索词为空，显示所有角色
        let filteredCharacters;
        if (!searchTerm.trim()) {
            filteredCharacters = this.allCharacters;
        } else {
            filteredCharacters = this.allCharacters.filter(character => {
                const nameMatch = character.name.toLowerCase().includes(searchTerm.toLowerCase());
                const typeMatch = (character.category === 'narrator' ? '旁白' : 'npc').toLowerCase().includes(searchTerm.toLowerCase());
                return nameMatch || typeMatch;
            });
        }
        
        if (type === 'single') {
            this.updateSingleExportList(filteredCharacters);
        } else if (type === 'batch') {
            this.updateBatchExportList(filteredCharacters);
            // 搜索后更新批量选择UI状态
            setTimeout(() => this.updateBatchSelectionUI(), 100);
        }
        
        // 更新搜索结果提示
        this.updateSearchResultHint(filteredCharacters.length, this.allCharacters.length, type);
    }
    
    /**
     * 更新搜索结果提示
     */
    updateSearchResultHint(filteredCount, totalCount, type) {
        const hintId = type === 'single' ? 'single-search-hint' : 'batch-search-hint';
        let hintElement = document.getElementById(hintId);
        
        // 如果提示元素不存在，创建它
        if (!hintElement) {
            hintElement = document.createElement('div');
            hintElement.id = hintId;
            hintElement.className = 'search-result-hint';
            
            const searchInput = document.getElementById(type === 'single' ? 'single-export-search' : 'batch-export-search');
            if (searchInput && searchInput.parentNode) {
                searchInput.parentNode.insertAdjacentElement('afterend', hintElement);
            }
        }
        
        // 更新提示内容
        if (filteredCount === totalCount) {
            hintElement.style.display = 'none';
        } else {
            hintElement.style.display = 'block';
            hintElement.innerHTML = `<i class="fas fa-info-circle"></i> 找到 ${filteredCount} 个角色（共 ${totalCount} 个）`;
        }
    }

    /**
     * 绑定批量选择事件
     */
    bindBatchSelectEvents() {
        const checkboxes = document.querySelectorAll('.batch-character-checkbox');
        const confirmBtn = document.getElementById('export-confirm-btn');
        
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateBatchSelectionUI();
            });
        });
    }

    /**
     * 更新批量选择UI状态
     */
    updateBatchSelectionUI() {
        const allCheckboxes = document.querySelectorAll('.batch-character-checkbox');
        const visibleCheckboxes = Array.from(allCheckboxes).filter(cb => {
            const item = cb.closest('.batch-character-item');
            return item && item.style.display !== 'none';
        });
        const selectedCheckboxes = visibleCheckboxes.filter(cb => cb.checked);
        
        const confirmBtn = document.getElementById('export-confirm-btn');
        const selectionInfo = document.getElementById('batch-selection-info');
        const selectAllBtn = document.getElementById('select-all-characters-btn');
        const deselectAllBtn = document.getElementById('deselect-all-characters-btn');
        
        // 更新确认按钮状态
        if (confirmBtn) {
            confirmBtn.disabled = selectedCheckboxes.length === 0;
        }
        
        // 更新选择信息
        if (selectionInfo) {
            selectionInfo.textContent = `已选择 ${selectedCheckboxes.length} 个角色`;
            if (visibleCheckboxes.length > 0) {
                selectionInfo.textContent += ` (共 ${visibleCheckboxes.length} 个可见)`;
            }
        }
        
        // 更新按钮状态
        const allSelected = visibleCheckboxes.length > 0 && selectedCheckboxes.length === visibleCheckboxes.length;
        if (selectAllBtn) {
            selectAllBtn.disabled = allSelected || visibleCheckboxes.length === 0;
        }
        if (deselectAllBtn) {
            deselectAllBtn.disabled = selectedCheckboxes.length === 0;
        }
    }

    /**
     * 全选当前可见的角色
     */
    selectAllCharacters() {
        const allCheckboxes = document.querySelectorAll('.batch-character-checkbox');
        const visibleCheckboxes = Array.from(allCheckboxes).filter(cb => {
            const item = cb.closest('.batch-character-item');
            return item && item.style.display !== 'none';
        });
        
        visibleCheckboxes.forEach(checkbox => {
            checkbox.checked = true;
        });
        
        this.updateBatchSelectionUI();
    }

    /**
     * 取消全选
     */
    deselectAllCharacters() {
        const checkboxes = document.querySelectorAll('.batch-character-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        
        this.updateBatchSelectionUI();
    }

    /**
     * 单个角色选择事件
     */
    async onSingleCharacterSelect(characterName) {
        const infoDiv = document.getElementById('single-export-info');
        const confirmBtn = document.getElementById('export-confirm-btn');
        
        if (!characterName) {
            if (infoDiv) infoDiv.style.display = 'none';
            if (confirmBtn) confirmBtn.disabled = true;
            return;
        }
        
        // 查找角色数据
        const character = this.characterManagement.characters.find(c => c.name === characterName);
        if (!character) return;
        
        // 显示角色预览
        this.updateCharacterPreview(character);
        
        // 检查数据书状态
        await this.checkStorybookStatus(characterName);
        
        if (infoDiv) infoDiv.style.display = 'block';
        if (confirmBtn) confirmBtn.disabled = false;
    }

    /**
     * 更新角色预览
     */
    updateCharacterPreview(character) {
        const avatarEl = document.getElementById('export-preview-avatar');
        const nameEl = document.getElementById('export-preview-name');
        const typeEl = document.getElementById('export-preview-type');
        
        if (avatarEl) {
            avatarEl.src = `/api/roles/${encodeURIComponent(character.name)}/avatar`;
            avatarEl.onerror = () => {
                avatarEl.src = '/static/images/default-avatar.svg';
            };
        }
        
        if (nameEl) nameEl.textContent = character.name;
        if (typeEl) typeEl.textContent = character.category === 'narrator' ? '旁白角色' : 'NPC角色';
    }

    /**
     * 检查数据书状态
     */
    async checkStorybookStatus(characterName) {
        const statusEl = document.getElementById('export-preview-storybook');
        if (!statusEl) return;
        
        try {
            statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>检查数据书状态...</span>';
            
            let hasStorybook = false;
            
            // 方法1: 检查角色绑定状态
            try {
                const response = await fetch(`/api/check_role_storybook_binding/${encodeURIComponent(characterName)}`);
                
                if (response.ok) {
                    const result = await response.json();
                    if (result.success && result.has_binding) {
                        hasStorybook = true;
                        console.log(`✅ 方法1: 角色 "${characterName}" 已绑定数据书: ${result.bound_storybook}`);
                    }
                }
            } catch (error) {
                console.log(`方法1检查失败: ${error.message}`);
            }
            
            // 方法2: 如果没有绑定，检查同名数据书文件
            if (!hasStorybook) {
                try {
                    const response = await fetch(`/api/storybook/${encodeURIComponent(characterName)}`);
                    if (response.ok) {
                        const result = await response.json();
                        if (result.success && result.data) {
                            hasStorybook = true;
                            console.log(`✅ 方法2: 角色 "${characterName}" 有同名数据书文件`);
                        }
                    }
                } catch (error) {
                    console.log(`方法2检查失败: ${error.message}`);
                }
            }
            
            // 更新UI
            if (hasStorybook) {
                statusEl.innerHTML = '<i class="fas fa-book text-success"></i> <span>含有数据书</span>';
                statusEl.className = 'storybook-status has-storybook';
            } else {
                statusEl.innerHTML = '<i class="fas fa-book-open text-muted"></i> <span>无数据书</span>';
                statusEl.className = 'storybook-status no-storybook';
                console.log(`ℹ️ 角色 "${characterName}" 无数据书`);
            }
            
        } catch (error) {
            console.error('检查数据书状态失败:', error);
            statusEl.innerHTML = '<i class="fas fa-exclamation-triangle text-warning"></i> <span>检查失败</span>';
            statusEl.className = 'storybook-status error';
        }
    }

    /**
     * 备用的数据书状态检查方法
     */
    async checkStorybookStatusFallback(characterName, statusEl) {
        try {
            // 方法1: 尝试直接访问数据书文件
            const storybookResponse = await fetch(`/api/storybook/${encodeURIComponent(characterName)}`);
            
            if (storybookResponse.ok) {
                statusEl.innerHTML = '<i class="fas fa-book text-success"></i> <span>含有数据书</span>';
                statusEl.className = 'storybook-status has-storybook';
                console.log(`✅ 通过备用方法确认角色 "${characterName}" 有数据书`);
                return;
            }
            
            // 方法2: 尝试v2 API
            const v2Response = await fetch(`/api/v2/storybooks/${encodeURIComponent(characterName)}`);
            
            if (v2Response.ok) {
                const v2Result = await v2Response.json();
                if (v2Result.success && v2Result.data) {
                    statusEl.innerHTML = '<i class="fas fa-book text-success"></i> <span>含有数据书</span>';
                    statusEl.className = 'storybook-status has-storybook';
                    console.log(`✅ 通过v2 API确认角色 "${characterName}" 有数据书`);
                    return;
                }
            }
            
            // 所有方法都失败，显示无数据书
            statusEl.innerHTML = '<i class="fas fa-book-open text-muted"></i> <span>无数据书</span>';
            statusEl.className = 'storybook-status no-storybook';
            console.log(`ℹ️ 所有检查方法都确认角色 "${characterName}" 无数据书`);
            
        } catch (fallbackError) {
            console.error('备用数据书状态检查也失败:', fallbackError);
            statusEl.innerHTML = '<i class="fas fa-exclamation-triangle text-warning"></i> <span>状态未知</span>';
            statusEl.className = 'storybook-status unknown';
        }
    }

    /**
     * 开始导出
     */
    async startExport() {
        const activeTab = document.querySelector('.export-tab-btn.active');
        const tabType = activeTab ? activeTab.dataset.tab : 'single';
        
        if (tabType === 'single') {
            await this.exportSingleCharacter();
        } else {
            await this.exportBatchCharacters();
        }
    }

    /**
     * 导出单个角色
     */
    async exportSingleCharacter() {
        const selectEl = document.getElementById('single-export-select');
        const characterName = selectEl ? selectEl.value : '';
        
        if (!characterName) {
            this.characterManagement.showNotification('请选择要导出的角色', 'warning');
            return;
        }
        
        try {
            this.characterManagement.showNotification('开始导出角色...', 'info');
            await this.exportCharacter(characterName);
            this.closeExportModal();
            this.characterManagement.showNotification(`角色 "${characterName}" 导出成功`, 'success');
            
            // 单个角色导出成功后刷新页面
            setTimeout(() => {
                this.characterManagement.showNotification('正在刷新页面...', 'info');
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }, 2000);
        } catch (error) {
            console.error('导出角色失败:', error);
            this.showUserFriendlyError(error);
            this.characterManagement.showNotification(`导出失败: ${error.message}`, 'error');
        }
    }

    /**
     * 批量导出角色
     */
    async exportBatchCharacters() {
        const checkboxes = document.querySelectorAll('.batch-character-checkbox:checked');
        const selectedCharacters = Array.from(checkboxes).map(cb => cb.value);
        
        if (selectedCharacters.length === 0) {
            this.characterManagement.showNotification('请选择要导出的角色', 'warning');
            return;
        }
        
        const zipExport = document.getElementById('batch-zip-export');
        const useZip = zipExport ? zipExport.checked : true;
        
        try {
            this.characterManagement.showNotification(`开始批量导出 ${selectedCharacters.length} 个角色...`, 'info');
            
            if (useZip) {
                await this.exportCharactersAsZip(selectedCharacters);
            } else {
                // 逐个导出
                for (const characterName of selectedCharacters) {
                    await this.exportCharacter(characterName);
                }
            }
            
            this.closeExportModal();
            this.characterManagement.showNotification(`成功导出 ${selectedCharacters.length} 个角色`, 'success');
            
            // 导出成功后刷新页面
            setTimeout(() => {
                this.characterManagement.showNotification('正在刷新页面...', 'info');
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }, 2000);
        } catch (error) {
            console.error('批量导出失败:', error);
            this.showUserFriendlyError(error);
            this.characterManagement.showNotification(`批量导出失败: ${error.message}`, 'error');
        }
    }

    /**
     * 导出单个角色的核心逻辑
     */
    async exportCharacter(characterName) {
        try {
            // 获取角色数据
            const characterData = await this.getCharacterData(characterName);
            
            // 获取角色头像
            const avatarBlob = await this.getCharacterAvatar(characterName);
            
            // 将数据嵌入图片
            const imageBlob = await this.embedDataInImage(avatarBlob, characterData);
            
            // 下载图片
            await this.downloadBlob(imageBlob, `${characterName}_exported.png`);
            
        } catch (error) {
            console.error(`导出角色 ${characterName} 失败:`, error);
            throw error;
        }
    }

    /**
     * 获取角色完整数据
     */
    async getCharacterData(characterName) {
        try {
            // 获取角色基本信息
            const roleResponse = await fetch(`/api/roles/${encodeURIComponent(characterName)}`);
            if (!roleResponse.ok) {
                throw new Error(`获取角色信息失败: ${roleResponse.status}`);
            }
            const roleData = await roleResponse.json();
            
            // 构建符合导入器要求的标准导出数据格式
            const exportData = {
                // 保留原始角色数据的所有字段
                ...roleData,
                
                // 标准化角色名称字段（兼容不同命名）
                名字: roleData.名字 || roleData.name || roleData.role_name,
                role_name: roleData.名字 || roleData.name || roleData.role_name,
                
                // 确保角色类别字段存在
                category: roleData.角色类别 || roleData.category || 'npc',
                角色类别: roleData.角色类别 || roleData.category || 'npc',
                
                // 初始化数据书相关字段
                has_storybook: false,
                storybook_data: null,
                
                // 导出元数据 - 导入器会检查这个标识
                export_metadata: {
                    export_version: '1.0',
                    export_time: new Date().toISOString(),
                    exporter: 'character_exporter_v1',
                    character_name: roleData.名字 || roleData.name || roleData.role_name
                }
            };
            
            // 尝试获取数据书数据 (仅对NPC角色)
            const isNarrator = roleData.category === 'narrator' || roleData.角色类别 === 'narrator';
            if (!isNarrator) {
                try {
                    // 首先检查角色是否绑定了数据书
                    const bindingResponse = await fetch(`/api/check_role_storybook_binding/${encodeURIComponent(characterName)}`);
                    
                    if (bindingResponse.ok) {
                        const bindingResult = await bindingResponse.json();
                        
                        if (bindingResult.success && bindingResult.has_binding) {
                            // 角色有绑定，尝试获取数据书内容
                            const storybookName = bindingResult.bound_storybook;
                            const storybookResponse = await fetch(`/api/storybook/${encodeURIComponent(storybookName)}`);
                            
                            if (storybookResponse.ok) {
                                const storybookResult = await storybookResponse.json();
                                if (storybookResult.success && storybookResult.data) {
                                    // 设置数据书相关字段，严格按照导入器期望的格式
                                    exportData.has_storybook = true;
                                    exportData.storybook_data = storybookResult.data;
                                    exportData.bound_storybook = storybookName;
                                    
                                    console.log(`✅ 角色 ${characterName} 包含数据书数据:`, storybookResult.data);
                                    console.log(`✅ 数据书字段数量: ${Object.keys(storybookResult.data).length}`);
                                } else {
                                    console.log(`⚠️ 角色 ${characterName} 绑定了数据书但读取数据失败`);
                                }
                            } else {
                                console.log(`⚠️ 角色 ${characterName} 绑定了数据书但API调用失败: ${storybookResponse.status}`);
                            }
                        } else {
                            console.log(`ℹ️ 角色 ${characterName} 没有在YAML中绑定数据书，尝试检查同名数据书文件`);
                            // 即使没有绑定，也尝试检查同名数据书文件
                            const storybookResponse = await fetch(`/api/storybook/${encodeURIComponent(characterName)}`);
                            if (storybookResponse.ok) {
                                const storybookResult = await storybookResponse.json();
                                if (storybookResult.success && storybookResult.data) {
                                    // 设置数据书相关字段
                                    exportData.has_storybook = true;
                                    exportData.storybook_data = storybookResult.data;
                                    exportData.bound_storybook = characterName;
                                    console.log(`✅ 角色 ${characterName} 有同名数据书文件:`, storybookResult.data);
                                    console.log(`✅ 数据书字段数量: ${Object.keys(storybookResult.data).length}`);
                                } else {
                                    exportData.has_storybook = false;
                                    console.log(`ℹ️ 角色 ${characterName} 同名数据书文件为空或格式错误`);
                                }
                            } else {
                                exportData.has_storybook = false;
                                console.log(`ℹ️ 角色 ${characterName} 没有同名数据书文件`);
                            }
                        }
                    } else {
                        // 绑定检查失败，尝试直接访问同名数据书
                        const storybookResponse = await fetch(`/api/storybook/${encodeURIComponent(characterName)}`);
                        if (storybookResponse.ok) {
                            const storybookResult = await storybookResponse.json();
                            if (storybookResult.success && storybookResult.data) {
                                // 设置数据书相关字段
                                exportData.has_storybook = true;
                                exportData.storybook_data = storybookResult.data;
                                console.log(`✅ 角色 ${characterName} 有同名数据书文件:`, storybookResult.data);
                                console.log(`✅ 数据书字段数量: ${Object.keys(storybookResult.data).length}`);
                            } else {
                                console.log(`ℹ️ 角色 ${characterName} 同名数据书文件为空或格式错误`);
                            }
                        } else {
                            console.log(`ℹ️ 角色 ${characterName} 没有同名数据书文件`);
                        }
                    }
                } catch (storybookError) {
                    console.warn(`获取角色 ${characterName} 数据书失败:`, storybookError);
                    exportData.has_storybook = false;
                }
            } else {
                // 旁白角色不需要数据书，确保字段清晰
                exportData.has_storybook = false;
                exportData.storybook_data = null;
                console.log(`ℹ️ 旁白角色 ${characterName} 不需要数据书`);
            }
            
            // 最终验证导出数据格式
            console.log(`📋 角色 ${characterName} 最终导出数据检查:`);
            console.log(`   - 角色名称: ${exportData.名字}`);
            console.log(`   - 角色类别: ${exportData.category}`);
            console.log(`   - 有数据书: ${exportData.has_storybook}`);
            if (exportData.has_storybook && exportData.storybook_data) {
                console.log(`   - 数据书字段: ${Object.keys(exportData.storybook_data).length}个`);
                console.log(`   - 数据书内容预览:`, Object.keys(exportData.storybook_data));
            }
            console.log(`   - 导出标识: ${exportData.export_metadata.exporter}`);
            console.log(`   - 数据总大小: ${JSON.stringify(exportData).length} 字符`);
            
            return exportData;
            
        } catch (error) {
            console.error(`获取角色 ${characterName} 数据失败:`, error);
            
            // 检查是否是认证错误
            if (error.message && error.message.includes('401')) {
                throw new Error('会话已过期，请刷新页面重新登录后再试');
            }
            
            throw error;
        }
    }

    /**
     * 获取角色头像
     */
    async getCharacterAvatar(characterName) {
        try {
            const response = await fetch(`/api/roles/${encodeURIComponent(characterName)}/avatar`);
            if (!response.ok) {
                // 如果没有头像，创建一个默认的PNG图片用于数据嵌入
                console.log(`角色 ${characterName} 没有头像，创建默认PNG图片`);
                return await this.createDefaultPNGAvatar(characterName);
            }
            
            const avatarBlob = await response.blob();
            
            // 检查图片格式，如果是JPG则转换为PNG
            if (avatarBlob.type === 'image/jpeg' || avatarBlob.type === 'image/jpg') {
                console.log(`角色 ${characterName} 的头像是JPG格式，转换为PNG格式`);
                return await this.convertImageToPNG(avatarBlob, characterName);
            }
            
            // 如果已经是PNG或其他格式，直接返回
            return avatarBlob;
        } catch (error) {
            console.error(`获取角色 ${characterName} 头像失败:`, error);
            
            // 检查是否是认证错误
            if (error.message && error.message.includes('401')) {
                throw new Error('会话已过期，请刷新页面重新登录后再试');
            }
            
            // 对于其他错误，创建默认PNG作为备用
            return await this.createDefaultPNGAvatar(characterName);
        }
    }

    /**
     * 将图片转换为PNG格式
     */
    async convertImageToPNG(imageBlob, characterName) {
        try {
            console.log(`🔄 开始转换 ${characterName} 的头像从 ${imageBlob.type} 到 PNG 格式`);
            
            // 创建Canvas元素
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // 加载原始图片
            const img = await this.loadImage(imageBlob);
            
            // 设置Canvas尺寸为原图尺寸
            canvas.width = img.width;
            canvas.height = img.height;
            
            // 填充白色背景（处理透明度）
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // 绘制原图到Canvas
            ctx.drawImage(img, 0, 0);
            
            // 转换为PNG格式的Blob
            return new Promise((resolve, reject) => {
                canvas.toBlob((pngBlob) => {
                    if (pngBlob) {
                        console.log(`✅ 成功转换 ${characterName} 的头像为PNG格式:`);
                        console.log(`   原格式: ${imageBlob.type}, 大小: ${(imageBlob.size / 1024).toFixed(2)} KB`);
                        console.log(`   新格式: ${pngBlob.type}, 大小: ${(pngBlob.size / 1024).toFixed(2)} KB`);
                        console.log(`   尺寸: ${img.width}x${img.height}`);
                        resolve(pngBlob);
                    } else {
                        reject(new Error('PNG转换失败'));
                    }
                }, 'image/png', 1.0); // 最高质量
            });
            
        } catch (error) {
            console.error(`转换 ${characterName} 头像为PNG失败:`, error);
            
            // 转换失败时，尝试创建默认PNG头像
            console.log(`转换失败，为 ${characterName} 创建默认PNG头像`);
            return await this.createDefaultPNGAvatar(characterName);
        }
    }

    /**
     * 创建默认的PNG头像用于数据嵌入
     */
    async createDefaultPNGAvatar(characterName) {
        try {
            // 创建一个简单的PNG图片
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            
            // 绘制渐变背景
            const gradient = ctx.createLinearGradient(0, 0, 256, 256);
            gradient.addColorStop(0, '#6366f1');
            gradient.addColorStop(1, '#8b5cf6');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 256, 256);
            
            // 绘制角色名称首字母
            const firstLetter = characterName.charAt(0).toUpperCase();
            ctx.fillStyle = 'white';
            ctx.font = 'bold 120px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(firstLetter, 128, 128);
            
            // 转换为blob
            return new Promise((resolve) => {
                canvas.toBlob(resolve, 'image/png', 1.0);
            });
        } catch (error) {
            console.error('创建默认PNG头像失败:', error);
            throw error;
        }
    }

    /**
     * 将角色数据嵌入到图片中 (使用酒馆角色卡格式)
     */
    async embedDataInImage(imageBlob, characterData) {
        try {
            console.log(`📝 使用酒馆角色卡格式导出角色: ${characterData.名字}`);
            console.log(`📊 角色数据大小: ${JSON.stringify(characterData).length} 字符`);
            
            // 使用酒馆角色卡格式嵌入数据
            return await this.embedDataAsTavernCard(imageBlob, characterData);
            
        } catch (error) {
            console.error('嵌入数据到图片失败:', error);
            throw error;
        }
    }

    /**
     * 加载图片
     */
    loadImage(blob) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = URL.createObjectURL(blob);
        });
    }

    /**
     * 使用酒馆角色卡格式嵌入数据到PNG图片中
     */
    async embedDataAsTavernCard(imageBlob, characterData) {
        try {
            // 转换角色数据为酒馆角色卡格式
            const tavernData = this.convertToTavernFormat(characterData);
            
            // 将数据转换为Base64编码的JSON (支持UTF-8字符)
            const jsonString = JSON.stringify(tavernData);
            const base64Data = this.utf8ToBase64(jsonString);
            
            console.log(`📦 酒馆格式数据长度: ${jsonString.length} 字符`);
            console.log(`📦 Base64数据长度: ${base64Data.length} 字符`);
            
            // 使用PNG tEXt块嵌入数据
            return await this.embedDataToPNGText(imageBlob, base64Data);
            
        } catch (error) {
            console.error('酒馆格式嵌入失败:', error);
            throw error;
        }
    }

    /**
     * 转换角色数据为酒馆角色卡格式
     */
    convertToTavernFormat(characterData) {
        // 处理描述：如果有数据书，将整个数据书内容整合到简介中
        let description = characterData.介绍 || characterData.description || '';
        
        // 如果有数据书，将整个数据书内容格式化后放入简介
        if (characterData.has_storybook && characterData.storybook_data) {
            console.log(`📚 将完整数据书内容整合到角色简介中`);
            description = this.formatStorybookAsDescription(characterData.storybook_data, description);
        }
        
        // 基本的酒馆角色卡格式
        const tavernData = {
            name: characterData.名字 || characterData.name,
            description: description,
            personality: characterData.性格 || '',
            scenario: characterData.场景 || '',
            first_mes: characterData.开场白 || '',
            mes_example: characterData.对话示例 || '',
            creatorcomment: '',
            avatar: 'none',
            chat: characterData.名字 || characterData.name,
            talkativeness: '0.5',
            fav: false,
            tags: characterData.tags || [],
            spec: 'chara_card_v2',
            spec_version: '2.0',
            data: {
                name: characterData.名字 || characterData.name,
                description: description,
                personality: characterData.性格 || '',
                scenario: characterData.场景 || '',
                first_mes: characterData.开场白 || '',
                mes_example: characterData.对话示例 || '',
                creator_notes: '',
                system_prompt: '',
                post_history_instructions: '',
                tags: characterData.tags || [],
                creator: '',
                character_version: '1.0.0',
                alternate_greetings: [],
                extensions: {}
            }
        };

        // 如果包含数据书，添加到extensions中
        if (characterData.has_storybook && characterData.storybook_data) {
            tavernData.data.extensions.storybook = characterData.storybook_data;
            console.log(`📚 包含完整数据书信息到酒馆格式:`);
            console.log(`📦 数据书大小: ${JSON.stringify(characterData.storybook_data).length} 字符`);
            console.log(`📋 数据书字段:`, Object.keys(characterData.storybook_data));
            console.log(`📄 完整数据书内容:`, characterData.storybook_data);
            
            // 验证数据书完整性
            const expectedFields = ['总结词', '关键词', '属性', '标签', '描述'];
            const missingFields = expectedFields.filter(field => !(field in characterData.storybook_data));
            if (missingFields.length > 0) {
                console.warn(`⚠️ 数据书缺少字段:`, missingFields);
            } else {
                console.log(`✅ 数据书字段完整`);
            }
        } else {
            console.log(`ℹ️ 角色没有数据书数据，导出基本信息`);
        }

        return tavernData;
    }

    /**
     * 将数据书内容格式化为描述文本
     */
    formatStorybookAsDescription(storybookData, originalDescription = '') {
        let formattedDescription = [];
        
        // 如果有原始简介，先添加
        if (originalDescription && originalDescription.trim()) {
            formattedDescription.push(originalDescription.trim());
            formattedDescription.push(''); // 空行分隔
        }
        
        // 总结词和关键词
        if (storybookData.总结词 && Array.isArray(storybookData.总结词) && storybookData.总结词.length > 0) {
            formattedDescription.push(`**总结词**: ${storybookData.总结词.join(', ')}`);
        }
        
        if (storybookData.关键词 && Array.isArray(storybookData.关键词) && storybookData.关键词.length > 0) {
            formattedDescription.push(`**关键词**: ${storybookData.关键词.join(', ')}`);
        }
        
        // 基本描述
        if (storybookData.描述) {
            formattedDescription.push('');
            formattedDescription.push(`**角色描述**: ${storybookData.描述}`);
        }
        
        // 属性信息
        if (storybookData.属性) {
            formattedDescription.push('');
            formattedDescription.push('## 角色属性');
            
            // 状态信息
            if (storybookData.属性.状态) {
                const status = storybookData.属性.状态;
                if (status.描述) {
                    formattedDescription.push(`**详细描述**: ${status.描述}`);
                }
                if (status.性格特点) {
                    formattedDescription.push(`**性格特点**: ${status.性格特点}`);
                }
            }
            
            // 外貌特征
            if (storybookData.属性.外貌特征) {
                formattedDescription.push('');
                formattedDescription.push('**外貌特征**:');
                const appearance = storybookData.属性.外貌特征;
                Object.entries(appearance).forEach(([key, value]) => {
                    formattedDescription.push(`- ${key}: ${value}`);
                });
            }
            
            // 能力值
            if (storybookData.属性.能力值) {
                formattedDescription.push('');
                formattedDescription.push('**能力值**:');
                const abilities = storybookData.属性.能力值;
                Object.entries(abilities).forEach(([key, value]) => {
                    formattedDescription.push(`- ${key}: ${value}`);
                });
            }
            
            // 社交关系
            if (storybookData.属性.社交关系) {
                formattedDescription.push('');
                formattedDescription.push('**社交关系**:');
                const relations = storybookData.属性.社交关系;
                Object.entries(relations).forEach(([key, value]) => {
                    if (Array.isArray(value)) {
                        formattedDescription.push(`- ${key}: ${value.join(', ')}`);
                    } else {
                        formattedDescription.push(`- ${key}: ${value}`);
                    }
                });
            }
            
            // 背包/物品
            if (storybookData.属性.背包) {
                formattedDescription.push('');
                formattedDescription.push('**背包物品**:');
                const inventory = storybookData.属性.背包;
                Object.entries(inventory).forEach(([item, count]) => {
                    formattedDescription.push(`- ${item}: ${count}`);
                });
            }
        }
        
        // 标签
        if (storybookData.标签 && Array.isArray(storybookData.标签) && storybookData.标签.length > 0) {
            formattedDescription.push('');
            formattedDescription.push(`**标签**: ${storybookData.标签.join(', ')}`);
        }
        
        // 其他字段（捆绑信息等）
        if (storybookData.捆绑角色 && Array.isArray(storybookData.捆绑角色) && storybookData.捆绑角色.length > 0) {
            formattedDescription.push('');
            formattedDescription.push(`**关联角色**: ${storybookData.捆绑角色.join(', ')}`);
        }
        
        const result = formattedDescription.join('\n');
        console.log(`📋 数据书格式化完成，长度: ${result.length} 字符`);
        return result;
    }

    /**
     * 将UTF-8字符串转换为Base64编码 (支持中文等Unicode字符)
     */
    utf8ToBase64(str) {
        try {
            // 方法1: 使用TextEncoder + btoa
            const bytes = new TextEncoder().encode(str);
            const binaryString = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
            return btoa(binaryString);
        } catch (error) {
            console.warn('TextEncoder方法失败，尝试备用方法:', error);
            
            // 方法2: 使用encodeURIComponent + escape (备用方法)
            try {
                return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
                    return String.fromCharCode(parseInt(p1, 16));
                }));
            } catch (fallbackError) {
                console.error('UTF-8 to Base64转换失败:', fallbackError);
                throw new Error('角色数据包含无法编码的字符');
            }
        }
    }

    /**
     * 将Base64编码转换为UTF-8字符串 (支持中文等Unicode字符)
     */
    base64ToUtf8(base64Str) {
        try {
            // 方法1: 使用atob + TextDecoder
            const binaryString = atob(base64Str);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return new TextDecoder().decode(bytes);
        } catch (error) {
            console.warn('TextDecoder方法失败，尝试备用方法:', error);
            
            // 方法2: 使用atob + decodeURIComponent (备用方法)
            try {
                return decodeURIComponent(Array.prototype.map.call(atob(base64Str), c => {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
            } catch (fallbackError) {
                console.error('Base64 to UTF-8转换失败:', fallbackError);
                throw new Error('无法解码角色数据');
            }
        }
    }

    /**
     * 将数据嵌入到PNG的tEXt块中 (正确实现版本)
     */
    async embedDataToPNGText(imageBlob, base64Data) {
        try {
            console.log(`🔧 开始PNG tEXt块嵌入，数据长度: ${base64Data.length}`);
            
            const arrayBuffer = await imageBlob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // 创建角色数据的tEXt块
            const textKey = 'chara';
            const textValue = base64Data;
            
            // 构建tEXt块数据 (key + null分隔符 + value)
            const keyBytes = new Uint8Array(textKey.length);
            for (let i = 0; i < textKey.length; i++) {
                keyBytes[i] = textKey.charCodeAt(i);
            }
            
            const valueBytes = new Uint8Array(textValue.length);
            for (let i = 0; i < textValue.length; i++) {
                valueBytes[i] = textValue.charCodeAt(i);
            }
            
            // 组合数据 (key + null + value)
            const chunkData = new Uint8Array(keyBytes.length + 1 + valueBytes.length);
            chunkData.set(keyBytes, 0);
            chunkData[keyBytes.length] = 0; // null分隔符
            chunkData.set(valueBytes, keyBytes.length + 1);
            
            console.log(`📝 tEXt块数据: key="${textKey}", value长度=${textValue.length}, 总长度=${chunkData.length}`);
            
            // 创建chunk类型 "tEXt"
            const chunkType = new Uint8Array([0x74, 0x45, 0x58, 0x74]); // "tEXt"
            
            // 计算CRC32校验和 (对 chunkType + chunkData)
            const crcData = new Uint8Array(chunkType.length + chunkData.length);
            crcData.set(chunkType, 0);
            crcData.set(chunkData, chunkType.length);
            const crc32Value = this.calculateCRC32(crcData);
            
            console.log(`🔒 CRC32校验和: 0x${crc32Value.toString(16).padStart(8, '0')}`);
            
            // 查找IEND块的位置
            let iendPos = -1;
            for (let i = uint8Array.length - 12; i >= 8; i--) {
                if (uint8Array[i+4] === 0x49 && uint8Array[i+5] === 0x45 && 
                    uint8Array[i+6] === 0x4E && uint8Array[i+7] === 0x44) { // "IEND"
                    iendPos = i; // 长度字段的位置
                    break;
                }
            }
            
            if (iendPos === -1) {
                throw new Error('无法找到PNG的IEND块');
            }
            
            console.log(`📍 IEND块位置: ${iendPos}`);
            
            // 计算新PNG的大小
            const tEXtChunkSize = 4 + 4 + chunkData.length + 4; // 长度+类型+数据+CRC
            const newPngSize = uint8Array.length + tEXtChunkSize;
            const newPngData = new Uint8Array(newPngSize);
            
            // 拷贝IEND之前的所有数据
            newPngData.set(uint8Array.subarray(0, iendPos), 0);
            
            // 插入新的tEXt块
            let offset = iendPos;
            
            // 1. 写入块长度 (big-endian)
            const lengthView = new DataView(newPngData.buffer, offset, 4);
            lengthView.setUint32(0, chunkData.length, false); // false = big-endian
            offset += 4;
            
            // 2. 写入块类型 "tEXt"
            newPngData.set(chunkType, offset);
            offset += 4;
            
            // 3. 写入块数据
            newPngData.set(chunkData, offset);
            offset += chunkData.length;
            
            // 4. 写入CRC32 (big-endian)
            const crcView = new DataView(newPngData.buffer, offset, 4);
            crcView.setUint32(0, crc32Value, false); // false = big-endian
            offset += 4;
            
            // 拷贝IEND块及其后的所有数据
            newPngData.set(uint8Array.subarray(iendPos), offset);
            
            console.log(`✅ PNG tEXt块嵌入成功:`);
            console.log(`   原始大小: ${(uint8Array.length / 1024).toFixed(2)} KB`);
            console.log(`   新大小: ${(newPngData.length / 1024).toFixed(2)} KB`);
            console.log(`   增加: ${(tEXtChunkSize / 1024).toFixed(2)} KB`);
            
            // 创建新的blob
            return new Blob([newPngData], { type: 'image/png' });
            
        } catch (error) {
            console.error('PNG tEXt块嵌入失败:', error);
            throw error; // 不再回退，直接报错以便调试
        }
    }
    
    /**
     * 备用的Canvas处理方法
     */
    async fallbackCanvasProcess(imageBlob, base64Data) {
        // 创建画布
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.ctx = this.canvas.getContext('2d');
        }
        
        // 加载图片
        const img = await this.loadImage(imageBlob);
        
        // 设置画布尺寸
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        
        // 绘制原图
        this.ctx.drawImage(img, 0, 0);
        
        // 转换为blob
        return new Promise((resolve) => {
            this.canvas.toBlob((blob) => {
                console.log(`📸 备用Canvas处理完成: ${(blob.size / 1024).toFixed(2)} KB`);
                console.log(`⚠️ 注意：数据可能未正确嵌入到PNG中`);
                resolve(blob);
            }, 'image/png', 1.0);
        });
    }

    /**
     * 计算CRC32校验和 (PNG标准实现)
     */
    calculateCRC32(data) {
        // CRC32多项式表 (IEEE 802.3标准)
        if (!this.crcTable) {
            this.crcTable = new Uint32Array(256);
            for (let i = 0; i < 256; i++) {
                let crc = i;
                for (let j = 0; j < 8; j++) {
                    if (crc & 1) {
                        crc = 0xEDB88320 ^ (crc >>> 1);
                    } else {
                        crc = crc >>> 1;
                    }
                }
                this.crcTable[i] = crc;
            }
        }
        
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < data.length; i++) {
            const byte = data[i];
            crc = this.crcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
        }
        
        return (crc ^ 0xFFFFFFFF) >>> 0; // 确保返回无符号32位整数
    }

    /**
     * 批量导出为ZIP文件
     */
    async exportCharactersAsZip(characterNames) {
        // 检查是否支持JSZip
        if (typeof JSZip === 'undefined') {
            console.warn('JSZip库未加载，切换为逐个下载模式');
            this.characterManagement.showNotification('ZIP库未加载，将逐个下载角色图片', 'warning');
            
            // 如果没有JSZip，则逐个下载
            for (let i = 0; i < characterNames.length; i++) {
                const characterName = characterNames[i];
                try {
                    this.characterManagement.showNotification(`正在导出 ${i + 1}/${characterNames.length}: ${characterName}`, 'info');
                    await this.exportCharacter(characterName);
                    
                    // 添加延迟避免下载过快
                    if (i < characterNames.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                } catch (error) {
                    console.error(`导出角色 ${characterName} 失败:`, error);
                    this.characterManagement.showNotification(`导出 ${characterName} 失败: ${error.message}`, 'error');
                }
            }
            return;
        }
        
        try {
            const zip = new JSZip();
            let successCount = 0;
            let failCount = 0;
            
            // 创建进度提示
            this.characterManagement.showNotification(`开始批量导出，正在处理 ${characterNames.length} 个角色...`, 'info');
            
            for (let i = 0; i < characterNames.length; i++) {
                const characterName = characterNames[i];
                try {
                    console.log(`处理角色 ${i + 1}/${characterNames.length}: ${characterName}`);
                    
                    const characterData = await this.getCharacterData(characterName);
                    const avatarBlob = await this.getCharacterAvatar(characterName);
                    const imageBlob = await this.embedDataInImage(avatarBlob, characterData);
                    
                    // 安全的文件名处理
                    const safeFileName = characterName.replace(/[<>:"/\\|?*]/g, '_');
                    zip.file(`${safeFileName}_exported.png`, imageBlob);
                    
                    successCount++;
                    
                    // 更新进度
                    if (i % 3 === 0 || i === characterNames.length - 1) {
                        this.characterManagement.showNotification(`导出进度: ${i + 1}/${characterNames.length}`, 'info');
                    }
                    
                } catch (error) {
                    console.error(`处理角色 ${characterName} 失败:`, error);
                    failCount++;
                    
                    // 添加错误信息到ZIP中
                    const errorInfo = `导出失败: ${error.message}\n时间: ${new Date().toISOString()}`;
                    zip.file(`ERROR_${characterName.replace(/[<>:"/\\|?*]/g, '_')}.txt`, errorInfo);
                }
            }
            
            // 添加导出摘要
            const summary = {
                export_time: new Date().toISOString(),
                total_characters: characterNames.length,
                success_count: successCount,
                fail_count: failCount,
                exported_characters: characterNames,
                exporter_version: 'character_exporter_v1'
            };
            
            zip.file('EXPORT_SUMMARY.json', JSON.stringify(summary, null, 2));
            
            // 生成ZIP文件
            this.characterManagement.showNotification('正在生成ZIP文件...', 'info');
            const zipBlob = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: {
                    level: 6
                }
            });
            
            // 下载ZIP文件
            const timestamp = new Date().toISOString().split('T')[0];
            await this.downloadBlob(zipBlob, `characters_export_${timestamp}.zip`);
            
            // 显示结果摘要
            if (failCount === 0) {
                this.characterManagement.showNotification(`✅ 批量导出完成：成功导出 ${successCount} 个角色`, 'success');
                
                // ZIP导出成功后刷新页面
                setTimeout(() => {
                    this.characterManagement.showNotification('正在刷新页面...', 'info');
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                }, 2000);
            } else {
                this.characterManagement.showNotification(`⚠️ 批量导出完成：成功 ${successCount} 个，失败 ${failCount} 个`, 'warning');
                
                // 即使部分失败，如果有成功的也刷新页面
                if (successCount > 0) {
                    setTimeout(() => {
                        this.characterManagement.showNotification('正在刷新页面...', 'info');
                        setTimeout(() => {
                            window.location.reload();
                        }, 1000);
                    }, 3000);
                }
            }
            
        } catch (error) {
            console.error('创建ZIP文件失败:', error);
            this.characterManagement.showNotification(`ZIP文件创建失败: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * 下载Blob文件
     */
    async downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        
        // 清理URL对象
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 100);
    }

    /**
     * 关闭导出模态框
     */
    closeExportModal() {
        const modal = document.getElementById('export-modal');
        if (modal) {
            modal.style.display = 'none';
            modal.remove(); // 移除模态框以释放内存
        }
    }

}

// 导出类以供其他模块使用
window.CharacterExporter = CharacterExporter;
