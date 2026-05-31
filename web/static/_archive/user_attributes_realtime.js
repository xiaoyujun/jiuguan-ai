/**
 * 实时属性编辑管理器
 * 负责处理用户属性的实时编辑和自动保存功能
 */
class RealtimeAttributesManager {
    constructor() {
        this.isEditMode = false;
        this.currentCharacter = null;
        this.originalData = null;
        this.currentStorybooks = []; // 当前角色绑定的数据书列表
        this.currentStorybookName = null; // 当前选中的数据书名称
        this.pendingChanges = new Map(); // 使用 Map 来跟踪待保存的更改
        this.saveTimeouts = new Map(); // 防抖定时器
        this.saveStates = new Map(); // 保存状态跟踪
        
        // 配置参数
        this.debounceDelay = 1000; // 防抖延迟 1 秒
        this.maxRetries = 3; // 最大重试次数
        this.retryDelay = 2000; // 重试延迟 2 秒
        
        this.initializeElements();
        this.loadCharacterList();
        this.loadCurrentPlayer();
        this.createStatusIndicator();
    }
    
    initializeElements() {
        // 等待DOM完全加载
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.doInitializeElements();
            });
        } else {
            this.doInitializeElements();
        }
    }
    
    doInitializeElements() {
        this.characterSelect = document.getElementById('characterSelect');
        this.storybookSelector = document.getElementById('storybookSelector');
        this.storybookSelect = document.getElementById('storybookSelect');
        this.storybookInfo = document.getElementById('storybookInfo');
        this.viewStorybookBtn = document.getElementById('viewStorybookBtn');
        this.editBtn = document.getElementById('editBtn');
        this.closeBtn = document.getElementById('closeBtn');
        this.loadingState = document.getElementById('loadingState');
        this.errorState = document.getElementById('errorState');
        this.errorMessage = document.getElementById('errorMessage');
        this.characterInfo = document.getElementById('characterInfo');
        this.confirmDialog = document.getElementById('confirmDialog');
        this.confirmTitle = document.getElementById('confirmTitle');
        this.confirmMessage = document.getElementById('confirmMessage');
        this.confirmYes = document.getElementById('confirmYes');
        this.confirmNo = document.getElementById('confirmNo');
        
        // 隐藏原有的保存区域，因为我们使用实时保存
        const saveSection = document.getElementById('saveSection');
        if (saveSection) {
            saveSection.style.display = 'none';
        }
        
        // 验证关键元素是否存在
        if (!this.characterSelect) {
            console.error('characterSelect element not found - DOM可能未完全加载');
            // 延迟重试
            setTimeout(() => {
                this.doInitializeElements();
            }, 500);
            return;
        }
        
        // 现在可以安全地绑定事件
        this.bindEvents();
    }
    
    bindEvents() {
        if (this.characterSelect) {
            this.characterSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.loadCharacterStorybooks(e.target.value);
                } else {
                    this.hideCharacterInfo();
                    this.hideStorybookSelector();
                }
            });
        }
        
        if (this.storybookSelect) {
            this.storybookSelect.addEventListener('change', (e) => {
                if (e.target.value && this.characterSelect.value) {
                    this.currentStorybookName = e.target.value;
                    this.loadStorybookAttributes(this.characterSelect.value, e.target.value);
                    this.updateStorybookInfo();
                } else {
                    this.hideCharacterInfo();
                }
            });
        }
        
        if (this.viewStorybookBtn) {
            this.viewStorybookBtn.addEventListener('click', () => {
                this.openStorybookEditor();
            });
        }
        
        if (this.editBtn) {
            this.editBtn.addEventListener('click', () => {
                this.toggleEditMode();
            });
        }
        
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => {
                this.handleCloseWindow();
            });
        }

        if (this.confirmNo) {
            this.confirmNo.addEventListener('click', () => {
                this.hideConfirmDialog();
            });
        }
        
        // 按键事件
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.confirmDialog && this.confirmDialog.style.display === 'flex') {
                    this.hideConfirmDialog();
                } else if (this.isEditMode) {
                    this.exitEditMode();
                }
            }
        });
        
        // 页面离开前检查未保存的更改
        window.addEventListener('beforeunload', (e) => {
            if (this.pendingChanges.size > 0) {
                e.preventDefault();
                e.returnValue = '您有未保存的更改，确定要离开吗？';
                return e.returnValue;
            }
        });
    }
    
    /**
     * 创建状态指示器
     */
    createStatusIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'saveStatusIndicator';
        indicator.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #28a745;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            display: none;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: 'Cinzel', serif;
            transition: all 0.3s ease;
        `;
        document.body.appendChild(indicator);
        this.statusIndicator = indicator;
    }
    
    /**
     * 显示状态指示器
     */
    showStatus(message, type = 'info', duration = 3000) {
        if (!this.statusIndicator) return;
        
        const colors = {
            info: '#17a2b8',
            success: '#28a745',
            warning: '#ffc107',
            error: '#dc3545',
            saving: '#6f42c1'
        };
        
        this.statusIndicator.style.background = colors[type] || colors.info;
        this.statusIndicator.textContent = message;
        this.statusIndicator.style.display = 'block';
        
        // 如果有现有的隐藏定时器，清除它
        if (this.statusHideTimeout) {
            clearTimeout(this.statusHideTimeout);
        }
        
        // 如果是持续状态（如 saving），不自动隐藏
        if (duration > 0) {
            this.statusHideTimeout = setTimeout(() => {
                this.hideStatus();
            }, duration);
        }
    }
    
    /**
     * 隐藏状态指示器
     */
    hideStatus() {
        if (this.statusIndicator) {
            this.statusIndicator.style.display = 'none';
        }
        if (this.statusHideTimeout) {
            clearTimeout(this.statusHideTimeout);
            this.statusHideTimeout = null;
        }
    }
    
    async loadCharacterList() {
        try {
            const response = await fetch('/api/characters/list');
            const data = await response.json();
            
            if (data.success) {
                this.populateCharacterSelect(data.characters);
            } else {
                console.error('获取角色列表失败:', data.error);
            }
        } catch (error) {
            console.error('获取角色列表错误:', error);
        }
    }
    
    populateCharacterSelect(characters) {
        if (!this.characterSelect) {
            console.error('characterSelect element not found');
            return;
        }
        
        // 清空现有选项（保留第一个默认选项）
        while (this.characterSelect.children.length > 1) {
            this.characterSelect.removeChild(this.characterSelect.lastChild);
        }
        
        // 添加角色选项
        characters.forEach(char => {
            const option = document.createElement('option');
            option.value = char.name;
            option.textContent = char.display_name;
            this.characterSelect.appendChild(option);
        });
        
        // 如果有待选择的角色（来自URL参数），现在选择它
        if (this.pendingCharacterSelection) {
            const characterName = this.pendingCharacterSelection;
            this.pendingCharacterSelection = null;
            
            // 检查角色是否存在于列表中
            const characterExists = characters.some(char => char.name === characterName);
            if (characterExists) {
                this.characterSelect.value = characterName;
                this.loadCharacterAttributes(characterName);
            } else {
                console.warn(`URL中指定的角色 "${characterName}" 不存在`);
            }
        }
    }
    
    async loadCurrentPlayer() {
        try {
            // 首先检查URL参数是否指定了角色
            const urlParams = new URLSearchParams(window.location.search);
            const characterFromUrl = urlParams.get('character') || urlParams.get('user');
            
            if (characterFromUrl) {
                // 如果URL中指定了角色，等待角色列表加载完成后选择该角色
                this.pendingCharacterSelection = characterFromUrl;
                return;
            }
            
            // 否则尝试加载当前玩家
            const response = await fetch('/api/current-player');
            const data = await response.json();
            
            if (data.success && data.current_player && this.characterSelect) {
                // 自动选择当前玩家
                this.characterSelect.value = data.current_player;
                this.loadCharacterAttributes(data.current_player);
            }
        } catch (error) {
            console.error('获取当前玩家错误:', error);
        }
    }
    
    async loadCharacterStorybooks(characterName) {
        this.showLoading();
        this.hideError();
        this.hideCharacterInfo();
        this.hideStorybookSelector();
        
        // 清理之前的状态
        this.clearAllPendingChanges();
        this.currentStorybooks = [];
        this.currentStorybookName = null;
        
        try {
            const response = await fetch(`/api/character/${characterName}/storybooks`);
            const data = await response.json();
            
            if (data.success) {
                this.currentStorybooks = data.storybooks;
                
                if (data.storybooks.length === 0) {
                    // 没有数据书，加载默认属性
                    this.loadCharacterAttributes(characterName);
                } else if (data.storybooks.length === 1) {
                    // 只有一个数据书，直接加载
                    this.currentStorybookName = data.storybooks[0].name;
                    this.loadStorybookAttributes(characterName, this.currentStorybookName);
                } else {
                    // 多个数据书，显示选择器
                    this.populateStorybookSelect(data.storybooks);
                    this.showStorybookSelector();
                    this.hideLoading();
                }
            } else {
                this.showError(data.error);
                this.hideLoading();
            }
        } catch (error) {
            this.showError('网络错误: ' + error.message);
            this.hideLoading();
        }
    }
    
    async loadCharacterAttributes(characterName) {
        this.showLoading();
        this.hideError();
        this.hideCharacterInfo();
        
        // 清理之前的状态
        this.clearAllPendingChanges();
        
        try {
            const response = await fetch(`/api/character/${characterName}/attributes`);
            const data = await response.json();
            
            if (data.success) {
                this.currentCharacter = data;
                this.originalData = JSON.parse(JSON.stringify(data));
                this.displayCharacterAttributes(data);
                this.hideLoading();
                this.showCharacterInfo();
            } else {
                this.showError(data.error);
                this.hideLoading();
            }
        } catch (error) {
            this.showError('网络错误: ' + error.message);
            this.hideLoading();
        }
    }
    
    async loadStorybookAttributes(characterName, storybookName) {
        this.showLoading();
        this.hideError();
        this.hideCharacterInfo();
        
        // 清理之前的状态
        this.clearAllPendingChanges();
        
        try {
            const response = await fetch(`/api/character/${characterName}/storybook/${storybookName}/attributes`);
            const data = await response.json();
            
            if (data.success) {
                this.currentCharacter = data;
                this.originalData = JSON.parse(JSON.stringify(data));
                this.displayCharacterAttributes(data);
                this.hideLoading();
                this.showCharacterInfo();
            } else {
                this.showError(data.error);
                this.hideLoading();
            }
        } catch (error) {
            this.showError('网络错误: ' + error.message);
            this.hideLoading();
        }
    }
    
    populateStorybookSelect(storybooks) {
        if (!this.storybookSelect) {
            console.error('storybookSelect element not found');
            return;
        }
        
        // 清空现有选项（保留第一个默认选项）
        while (this.storybookSelect.children.length > 1) {
            this.storybookSelect.removeChild(this.storybookSelect.lastChild);
        }
        
        // 添加数据书选项
        storybooks.forEach(storybook => {
            const option = document.createElement('option');
            option.value = storybook.name;
            option.textContent = `${storybook.name} (${storybook.attributes_count}个属性)`;
            this.storybookSelect.appendChild(option);
        });
        
        // 默认选择第一个数据书
        if (storybooks.length > 0) {
            this.storybookSelect.value = storybooks[0].name;
            this.currentStorybookName = storybooks[0].name;
            this.loadStorybookAttributes(this.characterSelect.value, this.currentStorybookName);
            this.updateStorybookInfo();
        }
    }
    
    updateStorybookInfo() {
        if (!this.storybookInfo || !this.currentStorybookName) return;
        
        const currentStorybook = this.currentStorybooks.find(sb => sb.name === this.currentStorybookName);
        if (currentStorybook) {
            const updateTime = currentStorybook.update_time ? 
                new Date(parseFloat(currentStorybook.update_time) * 1000).toLocaleString() : 
                '未知';
            this.storybookInfo.textContent = `最后更新: ${updateTime}`;
        }
    }
    
    showStorybookSelector() {
        if (this.storybookSelector) {
            this.storybookSelector.style.display = 'block';
        }
    }
    
    hideStorybookSelector() {
        if (this.storybookSelector) {
            this.storybookSelector.style.display = 'none';
        }
        if (this.storybookSelect) {
            this.storybookSelect.value = '';
        }
        if (this.storybookInfo) {
            this.storybookInfo.textContent = '';
        }
    }
    
    displayCharacterAttributes(data) {
        if (!this.characterInfo) {
            console.error('characterInfo element not found');
            return;
        }
        this.characterInfo.innerHTML = '';
        
        // 显示基本信息
        if (data.basic_info && Object.keys(data.basic_info).length > 0) {
            this.createSection('基本信息', data.basic_info, 'basic_info');
        }
        
        // 显示数据书属性
        if (data.storybook_data && data.storybook_data.属性) {
            this.createSection('数据书属性', data.storybook_data.属性, 'storybook_attributes');
        } else if (data.has_storybook) {
            this.createEmptySection('数据书属性', '该角色已绑定数据书，但暂无属性数据');
        } else {
            this.createCreateStorybookSection();
        }
        
        // 显示其他数据书字段
        if (data.storybook_data) {
            const otherFields = { ...data.storybook_data };
            delete otherFields.属性;
            delete otherFields.捆绑角色;
            delete otherFields.捆绑玩家;
            delete otherFields.创建时间;
            delete otherFields.更新时间;
            
            if (Object.keys(otherFields).length > 0) {
                this.createSection('其他信息', otherFields, 'other_info');
            }
        }
    }
    
    createSection(title, data, sectionId) {
        const section = document.createElement('div');
        const isBasicInfo = sectionId === 'basic_info';
        section.className = `info-section ${isBasicInfo ? 'basic-info' : ''}`;
        
        // 基本信息默认折叠，其他部分默认展开
        const defaultExpanded = !isBasicInfo;
        const arrowText = defaultExpanded ? '▼' : '▶';
        const expandedClass = defaultExpanded ? 'expanded' : '';
        
        section.innerHTML = `
            <div class="section-header" onclick="toggleSection('${sectionId}')">
                <span>${title}</span>
                <span class="section-arrow ${expandedClass}" id="${sectionId}_arrow">${arrowText}</span>
            </div>
            <div class="section-content ${expandedClass}" id="${sectionId}_content">
                ${this.renderObject(data, sectionId)}
                ${this.renderAddAttributeSection(sectionId)}
            </div>
        `;
        
        if (this.characterInfo) {
            this.characterInfo.appendChild(section);
        }
    }
    
    createEmptySection(title, message) {
        const section = document.createElement('div');
        section.className = 'info-section';
        section.innerHTML = `
            <div class="section-header" onclick="toggleSection('empty_${title}')">
                <span>${title}</span>
                <span class="section-arrow" id="empty_${title}_arrow">▶</span>
            </div>
            <div class="section-content" id="empty_${title}_content">
                <div style="padding: 20px; text-align: center; color: #999;">
                    ${message}
                </div>
            </div>
        `;
        
        if (this.characterInfo) {
            this.characterInfo.appendChild(section);
        }
    }
    
    createCreateStorybookSection() {
        const section = document.createElement('div');
        section.className = 'info-section';
        section.innerHTML = `
            <div class="section-header" onclick="toggleSection('create_storybook')">
                <span>数据书</span>
                <span class="section-arrow" id="create_storybook_arrow">▶</span>
            </div>
            <div class="section-content" id="create_storybook_content">
                <div style="padding: 20px; text-align: center;">
                    <p style="color: #999; margin-bottom: 15px;">该角色尚未绑定数据书</p>
                    <button onclick="realtimeAttributesManager.createStorybook()" 
                            style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); 
                                   border: 2px solid #28a745; color: white; padding: 8px 20px; 
                                   border-radius: 15px; cursor: pointer; font-family: 'Cinzel', serif;">
                        创建数据书
                    </button>
                </div>
            </div>
        `;
        
        if (this.characterInfo) {
            this.characterInfo.appendChild(section);
        }
    }
    
    renderObject(obj, sectionId = '') {
        let html = '';
        
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
                // 嵌套对象
                html += this.renderNestedAttribute(key, value, sectionId);
            } else if (Array.isArray(value)) {
                // 数组属性
                html += this.renderArrayAttribute(key, value, sectionId);
            } else {
                // 简单属性
                html += this.renderSimpleAttribute(key, value, sectionId);
            }
        }
        
        return `<div class="attributes-grid">${html}</div>`;
    }
    
    /**
     * 渲染简单属性
     */
    renderSimpleAttribute(key, value, sectionId) {
        const displayValue = value === '' ? '(空)' : String(value);
        const editableClass = this.isEditMode ? 'editable' : '';
        const contentEditable = this.isEditMode ? 'contenteditable="true"' : '';
        const attributePath = `${sectionId}.${key}`;
        
        // 判断是否为长文本
        const isLongText = displayValue.length > 50 || displayValue.includes('\n');
        const fullWidthClass = isLongText ? 'full-width' : '';
        
        return `
            <div class="attribute-item ${fullWidthClass}" data-section="${sectionId}" data-key="${key}" data-path="${attributePath}">
                <div class="attribute-path">
                    ${key}
                    <span class="save-indicator" style="display: none; margin-left: 8px; font-size: 12px;"></span>
                </div>
                <div class="attribute-value ${editableClass}" 
                     ${contentEditable}
                     data-original-value="${displayValue}"
                     data-path="${attributePath}">
                    ${displayValue}
                </div>
                <div class="attribute-actions">
                    <button class="attr-btn delete-btn" onclick="realtimeAttributesManager.confirmDeleteSimpleAttribute('${sectionId}', '${key}')" title="删除属性">
                        🗑️ 删除
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 渲染嵌套属性（对象）
     */
    renderNestedAttribute(key, value, sectionId) {
        const nestedItems = Object.entries(value).map(([nestedKey, nestedValue]) => {
            const nestedPath = `${sectionId}.${key}.${nestedKey}`;
            const displayValue = nestedValue === '' ? '(空)' : String(nestedValue);
            
            return `
                <div class="nested-attr-item" data-nested-key="${nestedKey}" data-path="${nestedPath}">
                    <div class="nested-attr-key">${nestedKey}</div>
                    <div class="nested-attr-value ${this.isEditMode ? 'editable' : ''}" 
                         ${this.isEditMode ? 'contenteditable="true"' : ''}
                         data-original-value="${displayValue}"
                         data-path="${nestedPath}">
                        ${displayValue}
                    </div>
                    <div class="nested-actions">
                        <span class="save-indicator" style="display: none; margin-right: 5px; font-size: 10px;"></span>
                        <button class="attr-btn delete-btn" onclick="realtimeAttributesManager.confirmDeleteNestedAttribute('${sectionId}', '${key}', '${nestedKey}')" title="删除子属性">
                            ×
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="nested-object" data-section="${sectionId}" data-key="${key}">
                <div style="font-weight: bold; color: var(--text-gold); margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <span>${key}</span>
                    <button class="attr-btn delete-btn" onclick="realtimeAttributesManager.confirmDeleteSimpleAttribute('${sectionId}', '${key}')" title="删除整个属性">
                        🗑️删除
                    </button>
                </div>
                <div class="nested-attributes">
                    ${nestedItems}
                </div>
                <div class="nested-controls">
                    <button class="add-btn small" onclick="realtimeAttributesManager.addNestedAttribute('${sectionId}', '${key}')">
                        + 添加子属性
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 渲染数组属性
     */
    renderArrayAttribute(key, value, sectionId) {
        const displayValue = value.length > 0 ? value.join(', ') : '(空数组)';
        
        return `
            <div class="array-value" data-section="${sectionId}" data-key="${key}">
                <div style="font-weight: bold; color: var(--text-gold); margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <span>${key}</span>
                    <button class="attr-btn delete-btn" onclick="realtimeAttributesManager.confirmDeleteSimpleAttribute('${sectionId}', '${key}')" title="删除属性">
                        🗑️ 删除
                    </button>
                </div>
                <div style="color: var(--text-color);">
                    ${displayValue}
                </div>
            </div>
        `;
    }
    
    /**
     * 切换编辑模式
     */
    toggleEditMode() {
        this.isEditMode = !this.isEditMode;
        
        if (this.isEditMode) {
            this.enterEditMode();
        } else {
            this.exitEditMode();
        }
    }
    
    /**
     * 进入编辑模式
     */
    enterEditMode() {
        this.editBtn.classList.add('edit-mode');
        this.editBtn.querySelector('.btn-text').textContent = '退出编辑';
        this.refreshDisplay();
        this.bindEditEvents();
        this.showStatus('已进入编辑模式，修改将自动保存', 'info');
    }
    
    /**
     * 退出编辑模式
     */
    exitEditMode() {
        this.isEditMode = false;
        this.editBtn.classList.remove('edit-mode');
        this.editBtn.querySelector('.btn-text').textContent = '编辑';
        this.unbindEditEvents();
        this.refreshDisplay();
        this.showStatus('已退出编辑模式', 'info');
    }
    
    /**
     * 绑定编辑事件
     */
    bindEditEvents() {
        // 为所有可编辑元素绑定事件
        const editableElements = document.querySelectorAll('.attribute-value.editable, .nested-attr-value.editable');
        
        editableElements.forEach(element => {
            // 输入事件 - 实时检测更改
            element.addEventListener('input', (e) => {
                this.handleValueChange(e.target);
            });
            
            // 失去焦点时也触发保存
            element.addEventListener('blur', (e) => {
                this.handleValueChange(e.target);
            });
            
            // 回车键触发保存
            element.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    e.target.blur();
                }
            });
        });
    }
    
    /**
     * 解绑编辑事件
     */
    unbindEditEvents() {
        // 移除所有编辑相关的事件监听器
        const editableElements = document.querySelectorAll('.attribute-value, .nested-attr-value');
        editableElements.forEach(element => {
            // 克隆元素来移除所有事件监听器
            const newElement = element.cloneNode(true);
            element.parentNode.replaceChild(newElement, element);
        });
    }
    
    /**
     * 处理值变化
     */
    handleValueChange(element) {
        const path = element.dataset.path;
        const originalValue = element.dataset.originalValue || '';
        const currentValue = element.textContent.trim();
        
        if (!path) {
            console.error('找不到元素路径');
            return;
        }
        
        // 如果值没有变化，不需要保存
        if (currentValue === originalValue) {
            this.removePendingChange(path);
            return;
        }
        
        // 添加到待保存列表
        this.addPendingChange(path, currentValue === '(空)' ? '' : currentValue);
        
        // 显示保存指示器
        this.showSaveIndicator(element, 'saving');
        
        // 防抖保存
        this.debouncedSave(path);
    }
    
    /**
     * 添加待保存的更改
     */
    addPendingChange(path, value) {
        this.pendingChanges.set(path, value);
    }
    
    /**
     * 移除待保存的更改
     */
    removePendingChange(path) {
        this.pendingChanges.delete(path);
        this.clearSaveTimeout(path);
        this.clearSaveState(path);
    }
    
    /**
     * 清理所有待保存的更改
     */
    clearAllPendingChanges() {
        this.pendingChanges.clear();
        this.saveTimeouts.forEach(timeout => clearTimeout(timeout));
        this.saveTimeouts.clear();
        this.saveStates.clear();
    }
    
    /**
     * 防抖保存
     */
    debouncedSave(path) {
        // 清除现有的定时器
        this.clearSaveTimeout(path);
        
        // 设置新的定时器
        const timeout = setTimeout(() => {
            this.saveAttribute(path);
        }, this.debounceDelay);
        
        this.saveTimeouts.set(path, timeout);
    }
    
    /**
     * 清除保存定时器
     */
    clearSaveTimeout(path) {
        const timeout = this.saveTimeouts.get(path);
        if (timeout) {
            clearTimeout(timeout);
            this.saveTimeouts.delete(path);
        }
    }
    
    /**
     * 保存单个属性
     */
    async saveAttribute(path, retryCount = 0) {
        if (!this.currentCharacter || !this.pendingChanges.has(path)) {
            return;
        }
        
        const value = this.pendingChanges.get(path);
        this.setSaveState(path, 'saving');
        
        try {
            // 选择保存URL：如果有选中的数据书，保存到该数据书；否则使用默认保存
            const saveUrl = this.currentStorybookName ? 
                `/api/character/${this.currentCharacter.character_name}/storybook/${this.currentStorybookName}/save` :
                `/api/character/${this.currentCharacter.character_name}/save`;
            
            const response = await fetch(saveUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    character_type: this.currentCharacter.character_type,
                    changes: { [path]: value }
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // 保存成功
                this.pendingChanges.delete(path);
                this.setSaveState(path, 'success');
                this.updateOriginalValue(path, value);
                
                // 如果所有更改都已保存，隐藏状态指示器
                if (this.pendingChanges.size === 0) {
                    setTimeout(() => {
                        this.hideStatus();
                    }, 1000);
                }
            } else {
                throw new Error(data.error || '保存失败');
            }
        } catch (error) {
            console.error(`保存属性 ${path} 失败:`, error);
            
            // 重试机制
            if (retryCount < this.maxRetries) {
                this.setSaveState(path, 'retrying');
                setTimeout(() => {
                    this.saveAttribute(path, retryCount + 1);
                }, this.retryDelay);
            } else {
                this.setSaveState(path, 'error');
                this.showStatus(`保存 ${path} 失败: ${error.message}`, 'error', 5000);
            }
        }
    }
    
    /**
     * 设置保存状态
     */
    setSaveState(path, state) {
        this.saveStates.set(path, state);
        
        // 更新UI指示器
        const element = document.querySelector(`[data-path="${path}"]`);
        if (element) {
            this.showSaveIndicator(element, state);
        }
        
        // 更新全局状态
        this.updateGlobalStatus();
    }
    
    /**
     * 清除保存状态
     */
    clearSaveState(path) {
        this.saveStates.delete(path);
        
        // 清除UI指示器
        const element = document.querySelector(`[data-path="${path}"]`);
        if (element) {
            this.hideSaveIndicator(element);
        }
    }
    
    /**
     * 显示保存指示器
     */
    showSaveIndicator(element, state) {
        let indicator = element.parentElement.querySelector('.save-indicator');
        if (!indicator) {
            // 查找嵌套属性的指示器
            indicator = element.parentElement.parentElement.querySelector('.save-indicator');
        }
        
        if (!indicator) return;
        
        const states = {
            saving: { text: '💾', color: '#6f42c1', title: '保存中...' },
            success: { text: '✅', color: '#28a745', title: '已保存' },
            error: { text: '❌', color: '#dc3545', title: '保存失败' },
            retrying: { text: '🔄', color: '#ffc107', title: '重试中...' }
        };
        
        const config = states[state];
        if (config) {
            indicator.textContent = config.text;
            indicator.style.color = config.color;
            indicator.title = config.title;
            indicator.style.display = 'inline';
            
            // 成功状态2秒后隐藏
            if (state === 'success') {
                setTimeout(() => {
                    indicator.style.display = 'none';
                }, 2000);
            }
        }
    }
    
    /**
     * 隐藏保存指示器
     */
    hideSaveIndicator(element) {
        const indicator = element.parentElement.querySelector('.save-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }
    
    /**
     * 更新全局状态
     */
    updateGlobalStatus() {
        const savingCount = Array.from(this.saveStates.values()).filter(state => state === 'saving').length;
        const errorCount = Array.from(this.saveStates.values()).filter(state => state === 'error').length;
        const retryingCount = Array.from(this.saveStates.values()).filter(state => state === 'retrying').length;
        
        if (savingCount > 0) {
            this.showStatus(`正在保存 ${savingCount} 个更改...`, 'saving', 0);
        } else if (retryingCount > 0) {
            this.showStatus(`重试保存 ${retryingCount} 个更改...`, 'warning', 0);
        } else if (errorCount > 0) {
            this.showStatus(`${errorCount} 个更改保存失败`, 'error', 5000);
        } else if (this.pendingChanges.size === 0 && this.saveStates.size === 0) {
            this.hideStatus();
        }
    }
    
    /**
     * 更新原始值
     */
    updateOriginalValue(path, newValue) {
        const element = document.querySelector(`[data-path="${path}"]`);
        if (element) {
            element.dataset.originalValue = newValue;
        }
    }
    
    /**
     * 刷新显示
     */
    refreshDisplay() {
        if (this.currentCharacter) {
            this.displayCharacterAttributes(this.currentCharacter);
        }
    }
    
    /**
     * 渲染添加属性区域
     */
    renderAddAttributeSection(sectionId) {
        return `
            <div class="add-attribute-section">
                <div class="add-attribute-form">
                    <div class="add-attribute-inputs">
                        <input type="text" 
                               class="add-attribute-input" 
                               id="new_attr_key_${sectionId}" 
                               placeholder="属性名称">
                        <input type="text" 
                               class="add-attribute-input" 
                               id="new_attr_value_${sectionId}" 
                               placeholder="属性值">
                    </div>
                    <button class="add-btn" onclick="realtimeAttributesManager.addAttribute('${sectionId}')">
                        ➕ 添加属性
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 添加新属性
     */
    async addAttribute(sectionId) {
        const keyInput = document.getElementById(`new_attr_key_${sectionId}`);
        const valueInput = document.getElementById(`new_attr_value_${sectionId}`);
        
        if (!keyInput || !valueInput) {
            console.error('找不到输入元素');
            return;
        }
        
        const key = keyInput.value.trim();
        const value = valueInput.value.trim();
        
        if (!key) {
            alert('请输入属性名称');
            keyInput.focus();
            return;
        }
        
        const path = `${sectionId}.${key}`;
        
        try {
            // 立即保存新属性
            const saveUrl = this.currentStorybookName ? 
                `/api/character/${this.currentCharacter.character_name}/storybook/${this.currentStorybookName}/save` :
                `/api/character/${this.currentCharacter.character_name}/save`;
            
            const response = await fetch(saveUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    character_type: this.currentCharacter.character_type,
                    changes: { [path]: value }
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // 清空输入框
                keyInput.value = '';
                valueInput.value = '';
                
                // 重新加载数据以显示新属性
                await this.loadCharacterAttributes(this.currentCharacter.character_name);
                
                this.showStatus(`已添加属性 "${key}"`, 'success');
            } else {
                throw new Error(data.error || '添加失败');
            }
        } catch (error) {
            this.showStatus(`添加属性失败: ${error.message}`, 'error');
        }
    }

    /**
     * 确认删除简单属性
     */
    confirmDeleteSimpleAttribute(sectionId, key) {
        this.pendingDeleteInfo = { sectionId, key, type: 'simple' };
        this.confirmTitle.textContent = '确认删除属性';
        this.confirmMessage.textContent = `确定要删除属性 "${key}" 吗？此操作不可撤销。`;
        
        this.confirmYes.onclick = () => {
            this.deleteSimpleAttribute(this.pendingDeleteInfo.sectionId, this.pendingDeleteInfo.key);
            this.hideConfirmDialog();
        };
        
        this.showConfirmDialog();
    }

    /**
     * 确认删除嵌套属性
     */
    confirmDeleteNestedAttribute(sectionId, parentKey, nestedKey) {
        this.pendingDeleteInfo = { sectionId, parentKey, nestedKey, type: 'nested' };
        this.confirmTitle.textContent = '确认删除子属性';
        this.confirmMessage.textContent = `确定要删除子属性 "${nestedKey}" 吗？此操作不可撤销。`;
        
        this.confirmYes.onclick = () => {
            this.deleteNestedAttribute(this.pendingDeleteInfo.sectionId, this.pendingDeleteInfo.parentKey, this.pendingDeleteInfo.nestedKey);
            this.hideConfirmDialog();
        };
        
        this.showConfirmDialog();
    }

    /**
     * 删除简单属性
     */
    async deleteSimpleAttribute(sectionId, key) {
        const path = `${sectionId}.${key}`;
        
        try {
            const saveUrl = this.currentStorybookName ? 
                `/api/character/${this.currentCharacter.character_name}/storybook/${this.currentStorybookName}/save` :
                `/api/character/${this.currentCharacter.character_name}/save`;
            
            const response = await fetch(saveUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    character_type: this.currentCharacter.character_type,
                    changes: { [path]: '__DELETE__' }
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // 重新加载数据
                if (this.currentStorybookName) {
                    await this.loadStorybookAttributes(this.currentCharacter.character_name, this.currentStorybookName);
                } else {
                    await this.loadCharacterAttributes(this.currentCharacter.character_name);
                }
                this.showStatus(`属性 "${key}" 已删除`, 'success');
            } else {
                throw new Error(data.error || '删除失败');
            }
        } catch (error) {
            this.showStatus(`删除属性失败: ${error.message}`, 'error');
        }
    }

    /**
     * 删除嵌套属性
     */
    async deleteNestedAttribute(sectionId, parentKey, nestedKey) {
        const path = `${sectionId}.${parentKey}.${nestedKey}`;
        
        try {
            const saveUrl = this.currentStorybookName ? 
                `/api/character/${this.currentCharacter.character_name}/storybook/${this.currentStorybookName}/save` :
                `/api/character/${this.currentCharacter.character_name}/save`;
            
            const response = await fetch(saveUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    character_type: this.currentCharacter.character_type,
                    changes: { [path]: '__DELETE__' }
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // 重新加载数据
                if (this.currentStorybookName) {
                    await this.loadStorybookAttributes(this.currentCharacter.character_name, this.currentStorybookName);
                } else {
                    await this.loadCharacterAttributes(this.currentCharacter.character_name);
                }
                this.showStatus(`子属性 "${nestedKey}" 已删除`, 'success');
            } else {
                throw new Error(data.error || '删除失败');
            }
        } catch (error) {
            this.showStatus(`删除子属性失败: ${error.message}`, 'error');
        }
    }

    /**
     * 添加嵌套属性
     */
    async addNestedAttribute(sectionId, parentKey) {
        const nestedKey = prompt('请输入子属性名称:');
        if (!nestedKey || !nestedKey.trim()) return;
        
        const nestedValue = prompt('请输入子属性值:') || '';
        const path = `${sectionId}.${parentKey}.${nestedKey}`;
        
        try {
            const saveUrl = this.currentStorybookName ? 
                `/api/character/${this.currentCharacter.character_name}/storybook/${this.currentStorybookName}/save` :
                `/api/character/${this.currentCharacter.character_name}/save`;
            
            const response = await fetch(saveUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    character_type: this.currentCharacter.character_type,
                    changes: { [path]: nestedValue }
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // 重新加载数据
                if (this.currentStorybookName) {
                    await this.loadStorybookAttributes(this.currentCharacter.character_name, this.currentStorybookName);
                } else {
                    await this.loadCharacterAttributes(this.currentCharacter.character_name);
                }
                this.showStatus(`已添加子属性 "${nestedKey}"`, 'success');
            } else {
                throw new Error(data.error || '添加失败');
            }
        } catch (error) {
            this.showStatus(`添加子属性失败: ${error.message}`, 'error');
        }
    }

    /**
     * 创建数据书
     */
    async createStorybook() {
        if (!this.currentCharacter) {
            alert('请先选择角色');
            return;
        }
        
        try {
            const response = await fetch(`/api/character/${this.currentCharacter.character_name}/create-storybook`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    character_type: this.currentCharacter.character_type
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showStatus('数据书创建成功！', 'success');
                // 重新加载数据
                if (this.currentStorybookName) {
                    await this.loadStorybookAttributes(this.currentCharacter.character_name, this.currentStorybookName);
                } else {
                    await this.loadCharacterAttributes(this.currentCharacter.character_name);
                }
            } else {
                throw new Error(data.error || '创建失败');
            }
        } catch (error) {
            this.showStatus(`创建数据书失败: ${error.message}`, 'error');
        }
    }
    
    /**
     * 打开数据书编辑器
     */
    openStorybookEditor() {
        if (!this.currentCharacter) {
            alert('请先选择角色');
            return;
        }
        
        // 检查是否有数据书
        if (!this.currentCharacter.has_storybook) {
            const create = confirm('该角色还没有数据书，是否要创建一个？');
            if (create) {
                this.createStorybook();
            }
            return;
        }
        
        // 跳转到数据书编辑页面
        const storybookName = this.currentCharacter.storybook_name || this.currentCharacter.character_name + '的数据卡';
        const url = `/storybook?name=${encodeURIComponent(storybookName)}`;
        
        // 在新窗口中打开数据书编辑器
        const width = 1200;
        const height = 800;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;
        
        window.open(
            url,
            'storybook_' + storybookName.replace(/[^a-zA-Z0-9]/g, '_'),
            `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
        );
    }
    
    // 工具方法
    showLoading() {
        if (this.loadingState) {
            this.loadingState.style.display = 'block';
        }
    }
    
    hideLoading() {
        if (this.loadingState) {
            this.loadingState.style.display = 'none';
        }
    }
    
    showError(message) {
        if (this.errorMessage) {
            this.errorMessage.textContent = message;
        }
        if (this.errorState) {
            this.errorState.style.display = 'block';
        }
    }
    
    hideError() {
        if (this.errorState) {
            this.errorState.style.display = 'none';
        }
    }
    
    showCharacterInfo() {
        if (this.characterInfo) {
            this.characterInfo.classList.add('show');
        }
    }
    
    hideCharacterInfo() {
        if (this.characterInfo) {
            this.characterInfo.classList.remove('show');
        }
    }

    showConfirmDialog() {
        this.confirmDialog.classList.add('show');
    }

    hideConfirmDialog() {
        this.confirmDialog.classList.remove('show');
        this.pendingDeleteInfo = null;
    }
    
    /**
     * 安全地处理窗口关闭
     */
    handleCloseWindow() {
        try {
            // 检查是否有未保存的更改
            if (this.pendingChanges.size > 0) {
                const shouldClose = confirm('您有未保存的更改，确定要关闭吗？');
                if (!shouldClose) {
                    return;
                }
            }
            
            // 检查是否在弹窗中打开
            if (window.opener && window.opener !== window) {
                // 如果是从其他窗口打开的弹窗，直接关闭
                window.close();
            } else {
                // 如果是直接在浏览器标签页中打开的，尝试关闭
                if (window.history.length > 1) {
                    // 有历史记录，返回上一页
                    window.history.back();
                } else {
                    // 没有历史记录，尝试关闭窗口
                    window.close();
                    
                    // 如果无法关闭，提供跳转选项
                    setTimeout(() => {
                        if (!window.closed) {
                            const shouldNavigate = confirm('无法关闭窗口，是否返回主页面？');
                            if (shouldNavigate) {
                                window.location.href = '/';
                            } else {
                                this.showStatus('请手动关闭浏览器标签页', 'info', 3000);
                            }
                        }
                    }, 100);
                }
            }
        } catch (error) {
            console.error('关闭窗口时出错:', error);
            this.showStatus('关闭窗口失败，请手动关闭浏览器标签页', 'error', 5000);
        }
    }
}

// 全局函数保持不变
function toggleSection(sectionId) {
    const content = document.getElementById(`${sectionId}_content`);
    const arrow = document.getElementById(`${sectionId}_arrow`);
    
    if (content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        arrow.classList.remove('expanded');
        arrow.textContent = '▶';
    } else {
        content.classList.add('expanded');
        arrow.classList.add('expanded');
        arrow.textContent = '▼';
    }
}

// 全局头像交互管理器（保持不变）
class AvatarInteractionManager {
    constructor() {
        this.longPressTimeout = null;
        this.longPressDelay = 300;
        this.isLongPressing = false;
    }
    
    addRoleAvatarClickHandler(avatarElement, roleName) {
        if (!avatarElement || !roleName) return;
        
        const bindEventsToElement = (element) => {
            let startTime = 0;
            let isMouseDown = false;
            let longPressTimer = null;
            
            const startHandler = (e) => {
                isMouseDown = true;
                startTime = Date.now();
                this.isLongPressing = false;
                
                longPressTimer = setTimeout(() => {
                    if (isMouseDown) {
                        this.isLongPressing = true;
                        this.handleLongPress(roleName);
                        if (navigator.vibrate) {
                            navigator.vibrate(50);
                        }
                    }
                }, this.longPressDelay);
            };
            
            const endHandler = (e) => {
                if (!isMouseDown) return;
                
                isMouseDown = false;
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
                
                if (!this.isLongPressing && duration < this.longPressDelay) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleClick(roleName);
                }
                
                this.isLongPressing = false;
            };
            
            const leaveHandler = () => {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
                isMouseDown = false;
                this.isLongPressing = false;
            };
            
            const mouseEnterHandler = function() {
                this.style.opacity = '0.8';
                this.style.transform = 'scale(1.05)';
                this.style.transition = 'all 0.2s ease';
            };
            
            const mouseLeaveHandler = function() {
                this.style.opacity = '1';
                this.style.transform = 'scale(1)';
            };
            
            element.addEventListener('mousedown', startHandler);
            element.addEventListener('touchstart', startHandler, { passive: true });
            element.addEventListener('mouseup', endHandler);
            element.addEventListener('touchend', endHandler, { passive: true });
            element.addEventListener('mouseleave', leaveHandler);
            element.addEventListener('touchcancel', leaveHandler, { passive: true });
            element.addEventListener('mouseenter', mouseEnterHandler);
            element.addEventListener('mouseleave', mouseLeaveHandler);
            element.addEventListener('dragstart', (e) => e.preventDefault());
            
            element.style.cursor = 'pointer';
            element.title = `点击查看 ${roleName} 属性，长按0.3秒进行@`;
        };
        
        if (avatarElement.tagName === 'IMG') {
            bindEventsToElement(avatarElement);
            
            const fallbackElement = avatarElement.nextElementSibling;
            if (fallbackElement && fallbackElement.classList.contains('avatar-fallback')) {
                bindEventsToElement(fallbackElement);
            }
        } else {
            bindEventsToElement(avatarElement);
        }
    }
    
    addUserAvatarClickHandler(avatarElement, userName) {
        if (!avatarElement || !userName) return;
        
        const clickHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handleClick(userName);
        };
        
        const mouseEnterHandler = function() {
            this.style.opacity = '0.8';
            this.style.transform = 'scale(1.05)';
            this.style.transition = 'all 0.2s ease';
        };
        
        const mouseLeaveHandler = function() {
            this.style.opacity = '1';
            this.style.transform = 'scale(1)';
        };
        
        if (avatarElement.tagName === 'IMG') {
            avatarElement.addEventListener('click', clickHandler);
            avatarElement.addEventListener('mouseenter', mouseEnterHandler);
            avatarElement.addEventListener('mouseleave', mouseLeaveHandler);
            avatarElement.style.cursor = 'pointer';
            avatarElement.title = `点击查看 ${userName} 的属性信息`;
            
            const fallbackElement = avatarElement.nextElementSibling;
            if (fallbackElement && fallbackElement.classList.contains('avatar-fallback')) {
                fallbackElement.addEventListener('click', clickHandler);
                fallbackElement.addEventListener('mouseenter', mouseEnterHandler);
                fallbackElement.addEventListener('mouseleave', mouseLeaveHandler);
                fallbackElement.style.cursor = 'pointer';
                fallbackElement.title = `点击查看 ${userName} 的属性信息`;
            }
        } else {
            avatarElement.addEventListener('click', clickHandler);
            avatarElement.addEventListener('mouseenter', mouseEnterHandler);
            avatarElement.addEventListener('mouseleave', mouseLeaveHandler);
            avatarElement.style.cursor = 'pointer';
            avatarElement.title = `点击查看 ${userName} 的属性信息`;
        }
    }
    
    handleClick(characterName) {
        // 使用新的数据卡模态框显示角色信息
        if (typeof characterDataCardModal !== 'undefined' && characterDataCardModal) {
            characterDataCardModal.show(characterName);
        } else {
            // 备用方案：打开用户属性页面
            const url = `/user-attributes?user=${encodeURIComponent(characterName)}`;
            const width = 900;
            const height = 700;
            const left = (screen.width - width) / 2;
            const top = (screen.height - height) / 2;
            
            window.open(
                url,
                'attributes_' + characterName.replace(/[^a-zA-Z0-9]/g, '_'),
                `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
            );
        }
    }
    
    handleLongPress(roleName) {
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            const cursorPos = messageInput.selectionStart;
            const textBefore = messageInput.value.substring(0, cursorPos);
            const textAfter = messageInput.value.substring(cursorPos);
            
            const needSpaceBefore = textBefore.length > 0 && !textBefore.endsWith(' ');
            const atText = (needSpaceBefore ? ' ' : '') + `@${roleName} `;
            
            messageInput.value = textBefore + atText + textAfter;
            messageInput.focus();
            
            const newCursorPos = cursorPos + atText.length;
            messageInput.setSelectionRange(newCursorPos, newCursorPos);
            
            this.showToast(`已@${roleName}`, 'success');
        }
    }
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#28a745' : '#17a2b8'};
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 10000;
            font-family: 'Cinzel', serif;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideInRight 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }
        }, 3000);
    }
}

// 全局变量和队列管理（保持不变）
window.avatarBindingQueue = window.avatarBindingQueue || [];

window.queueAvatarBinding = function(avatarElement, characterName, isUser = false) {
    if (window.UserAttributes) {
        if (isUser) {
            window.UserAttributes.addUserAvatarClickHandler(avatarElement, characterName);
        } else {
            window.UserAttributes.addRoleAvatarClickHandler(avatarElement, characterName);
        }
    } else {
        window.avatarBindingQueue.push({
            element: avatarElement,
            name: characterName,
            isUser: isUser
        });
    }
};

function processAvatarBindingQueue() {
    if (window.avatarBindingQueue && window.UserAttributes) {
        window.avatarBindingQueue.forEach(item => {
            if (item.isUser) {
                window.UserAttributes.addUserAvatarClickHandler(item.element, item.name);
            } else {
                window.UserAttributes.addRoleAvatarClickHandler(item.element, item.name);
            }
        });
        window.avatarBindingQueue = [];
    }
}

// 全局变量
let realtimeAttributesManager;
let avatarManager;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    realtimeAttributesManager = new RealtimeAttributesManager();
    avatarManager = new AvatarInteractionManager();
    
    window.UserAttributes = avatarManager;
    
    processAvatarBindingQueue();
});

// CSS 动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
