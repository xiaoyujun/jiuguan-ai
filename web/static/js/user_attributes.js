class UserAttributesManager {
    constructor() {
        this.isEditMode = false;
        this.currentCharacter = null;
        this.originalData = null;
        this.changes = {};
        
        // 检查是否已经有其他管理器在控制元素
        if (window.characterCardManager) {
            console.info('CharacterCardManager already exists, UserAttributesManager will not initialize');
            return;
        }
        
        this.initializeElements();
        this.bindEvents();
        this.loadCharacterList();
        this.loadCurrentPlayer();
    }
    
    initializeElements() {
        this.characterSelect = document.getElementById('characterSelect');
        this.viewStorybookBtn = document.getElementById('viewStorybookBtn');
        this.editBtn = document.getElementById('editBtn');
        this.closeBtn = document.getElementById('closeBtn');
        this.saveBtn = document.getElementById('saveBtn');
        this.cancelBtn = document.getElementById('cancelBtn');
        this.loadingState = document.getElementById('loadingState');
        this.errorState = document.getElementById('errorState');
        this.errorMessage = document.getElementById('errorMessage');
        this.characterInfo = document.getElementById('characterInfo');
        this.saveSection = document.getElementById('saveSection');
        this.confirmDialog = document.getElementById('confirmDialog');
        this.confirmTitle = document.getElementById('confirmTitle');
        this.confirmMessage = document.getElementById('confirmMessage');
        this.confirmYes = document.getElementById('confirmYes');
        this.confirmNo = document.getElementById('confirmNo');
        
        // 如果关键元素不存在，说明不是合适的页面
        if (!this.characterSelect && !this.characterInfo) {
            console.info('UserAttributesManager: Required elements not found, skipping initialization');
            this.isValidPage = false;
            return;
        }
        
        this.isValidPage = true;
    }
    
    bindEvents() {
        // 如果页面无效，跳过事件绑定
        if (!this.isValidPage) {
            return;
        }
        
        // 添加null检查防护
        if (this.characterSelect) {
            this.characterSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.loadCharacterAttributes(e.target.value);
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
        
        if (this.saveBtn) {
            this.saveBtn.addEventListener('click', () => {
                this.saveChanges();
            });
        }
        
        if (this.cancelBtn) {
            this.cancelBtn.addEventListener('click', () => {
                this.cancelEdit();
            });
        }

        // 确认对话框事件
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
                    this.cancelEdit();
                }
            }
        });
    }
    
    async loadCharacterList() {
        if (!this.isValidPage) {
            return;
        }
        
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
            console.warn('characterSelect element not found - may be controlled by another manager');
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
        if (!this.isValidPage) {
            return;
        }
        
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
    
    async loadCharacterAttributes(characterName) {
        this.showLoading();
        this.hideError();
        this.hideCharacterInfo();
        
        try {
            const response = await fetch(`/api/character/${characterName}/attributes`);
            const data = await response.json();
            
            if (data.success) {
                this.currentCharacter = data;
                this.originalData = JSON.parse(JSON.stringify(data));
                this.changes = {};
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
                ${this.renderObject(data, '', sectionId)}
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
                    <button onclick="attributesManager.createStorybook()" 
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
        
        // 根据数据书编辑器的逻辑，直接渲染属性
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
                // 嵌套对象 - 类似数据书编辑器的 nested attributes
                html += this.renderNestedAttribute(key, value, sectionId);
            } else if (Array.isArray(value)) {
                // 数组属性
                html += this.renderArrayAttribute(key, value, sectionId);
            } else {
                // 简单属性
                html += this.renderSimpleAttribute(key, value, sectionId);
            }
        }
        
        // 使用网格布局包装
        return `<div class="attributes-grid">${html}</div>`;
    }
    
    // 渲染简单属性
    renderSimpleAttribute(key, value, sectionId) {
        const displayValue = value === '' ? '(空)' : String(value);
        const editableClass = this.isEditMode ? 'editable' : '';
        const contentEditable = this.isEditMode ? 'contenteditable="true"' : '';
        const attributeId = `${sectionId}_${key}`;
        
        // 判断是否为长文本（超过50个字符或包含换行）
        const isLongText = displayValue.length > 50 || displayValue.includes('\n');
        const fullWidthClass = isLongText ? 'full-width' : '';
        
        return `
            <div class="attribute-item ${fullWidthClass}" data-section="${sectionId}" data-key="${key}">
                <div class="attribute-path">${key}</div>
                <div class="attribute-value ${editableClass}" 
                     ${contentEditable}
                     ondblclick="attributesManager.startInlineEdit(this, '${sectionId}', '${key}')"
                     ${this.isEditMode ? `oninput="attributesManager.handleSimpleValueChange('${sectionId}', '${key}', this.textContent)"` : ''}>
                    ${displayValue}
                </div>
                <div class="attribute-actions ${this.isEditMode ? 'show' : ''}">
                    <button class="attr-btn delete-btn" onclick="attributesManager.confirmDeleteSimpleAttribute('${sectionId}', '${key}')" title="删除属性">
                        🗑️ 删除
                    </button>
                </div>
            </div>
        `;
    }

    // 渲染嵌套属性（对象）
    renderNestedAttribute(key, value, sectionId) {
        const nestedItems = Object.entries(value).map(([nestedKey, nestedValue]) => `
            <div class="nested-attr-item" data-nested-key="${nestedKey}">
                <div class="nested-attr-key ${this.isEditMode ? 'editable' : ''}" 
                     ${this.isEditMode ? 'contenteditable="true"' : ''}
                     ondblclick="attributesManager.startInlineEditNestedKey(this, '${sectionId}', '${key}', '${nestedKey}')"
                     ${this.isEditMode ? `oninput="attributesManager.handleNestedKeyChange('${sectionId}', '${key}', '${nestedKey}', this.textContent)"` : ''}>
                    ${nestedKey}
                </div>
                <div class="nested-attr-value ${this.isEditMode ? 'editable' : ''}" 
                     ${this.isEditMode ? 'contenteditable="true"' : ''}
                     ondblclick="attributesManager.startInlineEditNestedValue(this, '${sectionId}', '${key}', '${nestedKey}')"
                     ${this.isEditMode ? `oninput="attributesManager.handleNestedValueChange('${sectionId}', '${key}', '${nestedKey}', this.textContent)"` : ''}>
                    ${nestedValue === '' ? '(空)' : String(nestedValue)}
                </div>
                <div class="nested-actions ${this.isEditMode ? 'show' : ''}">
                    <button class="attr-btn delete-btn" onclick="attributesManager.confirmDeleteNestedAttribute('${sectionId}', '${key}', '${nestedKey}')" title="删除子属性">
                        ×
                    </button>
                </div>
            </div>
        `).join('');

        return `
            <div class="nested-object" data-section="${sectionId}" data-key="${key}">
                <div class="nested-object-header">
                    <span class="nested-object-title">${key}</span>
                    <div class="nested-object-actions ${this.isEditMode ? 'show' : ''}">
                        <button class="attr-btn add-btn" onclick="attributesManager.addNestedAttribute('${sectionId}', '${key}')" title="添加子属性">
                            ➕ 添加
                        </button>
                        <button class="attr-btn delete-btn" onclick="attributesManager.confirmDeleteSimpleAttribute('${sectionId}', '${key}')" title="删除整个属性">
                            🗑️ 删除
                        </button>
                    </div>
                </div>
                <div class="nested-attributes">
                    ${nestedItems}
                </div>
                <div class="nested-controls ${this.isEditMode ? 'show' : ''}">
                    <button class="add-btn small" onclick="attributesManager.addNestedAttribute('${sectionId}', '${key}')">
                        + 添加子属性
                    </button>
                </div>
            </div>
        `;
    }

    // 渲染数组属性
    renderArrayAttribute(key, value, sectionId) {
        const displayValue = value.length > 0 ? value.join(', ') : '(空数组)';
        
        return `
            <div class="array-value" data-section="${sectionId}" data-key="${key}">
                <div style="font-weight: bold; color: var(--text-gold); margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <span>${key}</span>
                    <button class="attr-btn delete-btn" onclick="attributesManager.confirmDeleteSimpleAttribute('${sectionId}', '${key}')" title="删除属性">
                        🗑️ 删除
                    </button>
                </div>
                <div style="color: var(--text-color);">
                    ${displayValue}
                </div>
            </div>
        `;
    }
    
    // 处理简单属性值变化
    handleSimpleValueChange(sectionId, key, newValue) {
        const changeKey = `${sectionId}.${key}`;
        this.changes[changeKey] = newValue === '(空)' ? '' : newValue;
        this.showSaveSection();
    }

    // 处理嵌套属性值变化
    handleNestedValueChange(sectionId, parentKey, nestedKey, newValue) {
        const changeKey = `${sectionId}.${parentKey}.${nestedKey}`;
        this.changes[changeKey] = newValue === '(空)' ? '' : newValue;
        this.showSaveSection();
    }

    // 处理嵌套属性键变化
    handleNestedKeyChange(sectionId, parentKey, oldNestedKey, newNestedKey) {
        // 如果键名没有变化，直接返回
        if (oldNestedKey === newNestedKey) return;
        
        // 获取原有的值
        const oldChangeKey = `${sectionId}.${parentKey}.${oldNestedKey}`;
        const newChangeKey = `${sectionId}.${parentKey}.${newNestedKey}`;
        
        // 如果在变更记录中有这个键，需要迁移
        if (this.changes.hasOwnProperty(oldChangeKey)) {
            const value = this.changes[oldChangeKey];
            delete this.changes[oldChangeKey];
            this.changes[newChangeKey] = value;
        } else {
            // 从原始数据中获取值
            const originalValue = this.getValueByPath(this.currentCharacter, `${sectionId}.${parentKey}.${oldNestedKey}`) || '';
            this.changes[newChangeKey] = originalValue;
        }
        
        // 标记旧键为删除
        this.changes[oldChangeKey] = '__DELETE__';
        
        this.showSaveSection();
        this.refreshDisplayWithChanges();
    }

    // 双击开始内联编辑
    startInlineEdit(element, sectionId, key) {
        if (this.isEditMode) return; // 如果已经在编辑模式，不需要双击编辑
        
        element.contentEditable = true;
        element.classList.add('editing');
        element.focus();
        
        // 选中所有文本
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        
        // 保存原始值
        const originalValue = element.textContent;
        
        // 失去焦点时保存
        const saveAndExit = () => {
            element.contentEditable = false;
            element.classList.remove('editing');
            
            const newValue = element.textContent.trim();
            if (newValue !== originalValue) {
                this.handleSimpleValueChange(sectionId, key, newValue);
                this.showToast(`属性 "${key}" 已更新`, 'success');
            }
            
            element.removeEventListener('blur', saveAndExit);
            element.removeEventListener('keydown', handleKeydown);
        };
        
        // 按键处理
        const handleKeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                element.blur();
            } else if (e.key === 'Escape') {
                element.textContent = originalValue;
                element.blur();
            }
        };
        
        element.addEventListener('blur', saveAndExit);
        element.addEventListener('keydown', handleKeydown);
    }

    // 双击开始编辑嵌套属性键
    startInlineEditNestedKey(element, sectionId, parentKey, nestedKey) {
        if (this.isEditMode) return;
        
        element.contentEditable = true;
        element.classList.add('editing');
        element.focus();
        
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        
        const originalKey = element.textContent;
        
        const saveAndExit = () => {
            element.contentEditable = false;
            element.classList.remove('editing');
            
            const newKey = element.textContent.trim();
            if (newKey !== originalKey && newKey !== '') {
                this.handleNestedKeyChange(sectionId, parentKey, nestedKey, newKey);
                this.showToast(`子属性键 "${originalKey}" 已更新为 "${newKey}"`, 'success');
            } else if (newKey === '') {
                element.textContent = originalKey; // 恢复原始值
            }
            
            element.removeEventListener('blur', saveAndExit);
            element.removeEventListener('keydown', handleKeydown);
        };
        
        const handleKeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                element.blur();
            } else if (e.key === 'Escape') {
                element.textContent = originalKey;
                element.blur();
            }
        };
        
        element.addEventListener('blur', saveAndExit);
        element.addEventListener('keydown', handleKeydown);
    }

    // 双击开始编辑嵌套属性值
    startInlineEditNestedValue(element, sectionId, parentKey, nestedKey) {
        if (this.isEditMode) return;
        
        element.contentEditable = true;
        element.classList.add('editing');
        element.focus();
        
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        
        const originalValue = element.textContent;
        
        const saveAndExit = () => {
            element.contentEditable = false;
            element.classList.remove('editing');
            
            const newValue = element.textContent.trim();
            if (newValue !== originalValue) {
                this.handleNestedValueChange(sectionId, parentKey, nestedKey, newValue);
                this.showToast(`子属性 "${nestedKey}" 已更新`, 'success');
            }
            
            element.removeEventListener('blur', saveAndExit);
            element.removeEventListener('keydown', handleKeydown);
        };
        
        const handleKeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                element.blur();
            } else if (e.key === 'Escape') {
                element.textContent = originalValue;
                element.blur();
            }
        };
        
        element.addEventListener('blur', saveAndExit);
        element.addEventListener('keydown', handleKeydown);
    }

    // 旧的方法保留兼容性
    handleValueChange(path, newValue) {
        this.changes[path] = newValue === '(空)' ? '' : newValue;
        this.showSaveSection();
    }
    
    toggleEditMode() {
        this.isEditMode = !this.isEditMode;
        
        if (this.isEditMode) {
            this.editBtn.classList.add('edit-mode');
            this.editBtn.querySelector('.btn-text').textContent = '退出编辑';
            this.refreshDisplay();
        } else {
            this.exitEditMode();
        }
    }
    
    exitEditMode() {
        this.isEditMode = false;
        this.editBtn.classList.remove('edit-mode');
        this.editBtn.querySelector('.btn-text').textContent = '编辑';
        this.changes = {};
        this.hideSaveSection();
        this.refreshDisplay();
    }
    
    refreshDisplay() {
        if (this.currentCharacter) {
            this.displayCharacterAttributes(this.currentCharacter);
        }
    }
    
    async saveChanges() {
        if (!this.currentCharacter || Object.keys(this.changes).length === 0) {
            alert('没有需要保存的更改');
            return;
        }
        
        try {
            this.saveBtn.disabled = true;
            this.saveBtn.textContent = '保存中...';
            
            const response = await fetch(`/api/character/${this.currentCharacter.character_name}/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    character_type: this.currentCharacter.character_type,
                    changes: this.changes
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('保存成功！');
                this.changes = {};
                this.hideSaveSection();
                // 重新加载数据
                await this.loadCharacterAttributes(this.currentCharacter.character_name);
            } else {
                alert('保存失败: ' + data.error);
            }
        } catch (error) {
            alert('保存错误: ' + error.message);
        } finally {
            this.saveBtn.disabled = false;
            this.saveBtn.textContent = '💾 保存更改';
        }
    }
    
    cancelEdit() {
        this.changes = {};
        this.hideSaveSection();
        this.refreshDisplay();
    }
    
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
                alert('数据书创建成功！');
                // 重新加载数据
                await this.loadCharacterAttributes(this.currentCharacter.character_name);
            } else {
                alert('创建失败: ' + data.error);
            }
        } catch (error) {
            alert('创建错误: ' + error.message);
        }
    }
    
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
    
    showSaveSection() {
        if (this.saveSection) {
            this.saveSection.classList.add('show');
        }
    }
    
    hideSaveSection() {
        if (this.saveSection) {
            this.saveSection.classList.remove('show');
        }
    }

    // 获取区域的基础路径
    getSectionBasePath(sectionId) {
        switch(sectionId) {
            case 'basic_info':
                return 'basic_info';
            case 'storybook_attributes':
                return 'storybook_data.属性';
            case 'other_info':
                return 'storybook_data';
            default:
                return sectionId;
        }
    }

    // 渲染添加属性区域
    renderAddAttributeSection(sectionId) {
        return `
            <div class="add-attribute-section ${this.isEditMode ? 'show' : ''}">
                <div class="add-attribute-form">
                    <div class="form-group">
                        <label>添加新属性:</label>
                        <div class="add-attribute-inputs">
                            <input type="text" 
                                   class="add-attribute-input" 
                                   id="new_attr_key_${sectionId}" 
                                   placeholder="属性名称">
                            <select class="add-attribute-type" id="new_attr_type_${sectionId}">
                                <option value="simple">简单属性</option>
                                <option value="nested">嵌套属性</option>
                            </select>
                            <input type="text" 
                                   class="add-attribute-input" 
                                   id="new_attr_value_${sectionId}" 
                                   placeholder="属性值（嵌套属性可留空）">
                        </div>
                        <div class="add-attribute-controls">
                            <button class="add-btn" onclick="attributesManager.addAttribute('${sectionId}')">
                                ➕ 添加属性
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // 添加新属性
    addAttribute(sectionId) {
        const keyInput = document.getElementById(`new_attr_key_${sectionId}`);
        const valueInput = document.getElementById(`new_attr_value_${sectionId}`);
        const typeSelect = document.getElementById(`new_attr_type_${sectionId}`);
        
        if (!keyInput || !valueInput || !typeSelect) {
            console.error('找不到输入元素');
            return;
        }
        
        const key = keyInput.value.trim();
        const value = valueInput.value.trim();
        const type = typeSelect.value;
        
        if (!key) {
            this.showToast('请输入属性名称', 'error');
            keyInput.focus();
            return;
        }
        
        // 使用简化的路径构建 - 直接使用 sectionId.key
        const changeKey = `${sectionId}.${key}`;
        
        // 检查是否已经在待更改列表中
        if (this.changes.hasOwnProperty(changeKey)) {
            this.showToast('该属性已在编辑列表中', 'error');
            keyInput.focus();
            return;
        }
        
        // 根据类型添加不同的属性
        if (type === 'nested') {
            // 嵌套属性：创建空对象
            this.changes[changeKey] = {};
            this.showToast(`已添加嵌套属性 "${key}"，可以添加子属性`, 'success');
        } else {
            // 简单属性
            this.changes[changeKey] = value;
            this.showToast(`已添加属性 "${key}"`, 'success');
        }
        
        // 清空输入框
        keyInput.value = '';
        valueInput.value = '';
        typeSelect.value = 'simple';
        
        // 显示保存按钮
        this.showSaveSection();
        
        // 重新渲染当前数据（包含新属性的预览）
        this.refreshDisplayWithChanges();
    }

    // 确认删除简单属性
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

    // 确认删除嵌套属性
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

    // 删除简单属性
    deleteSimpleAttribute(sectionId, key) {
        const changeKey = `${sectionId}.${key}`;
        this.changes[changeKey] = '__DELETE__';
        this.showSaveSection();
        this.refreshDisplayWithChanges();
        this.showToast(`属性 "${key}" 已标记为删除`, 'success');
    }

    // 删除嵌套属性
    deleteNestedAttribute(sectionId, parentKey, nestedKey) {
        const changeKey = `${sectionId}.${parentKey}.${nestedKey}`;
        this.changes[changeKey] = '__DELETE__';
        this.showSaveSection();
        this.refreshDisplayWithChanges();
        this.showToast(`子属性 "${nestedKey}" 已标记为删除`, 'success');
    }

    // 添加嵌套属性
    addNestedAttribute(sectionId, parentKey) {
        // 创建内联输入表单
        const nestedContainer = document.querySelector(`[data-section="${sectionId}"][data-key="${parentKey}"] .nested-attributes`);
        if (!nestedContainer) return;
        
        // 检查是否已经有添加表单
        if (nestedContainer.querySelector('.adding-nested-attr')) return;
        
        // 创建添加表单
        const addForm = document.createElement('div');
        addForm.className = 'nested-attr-item adding-nested-attr';
        addForm.innerHTML = `
            <input type="text" class="nested-attr-key editable" placeholder="输入子属性名称" id="new-nested-key">
            <input type="text" class="nested-attr-value editable" placeholder="输入子属性值" id="new-nested-value">
            <div class="nested-actions">
                <button class="attr-btn save-btn" onclick="attributesManager.saveNestedAttribute('${sectionId}', '${parentKey}', this)" title="保存">
                    ✓
                </button>
                <button class="attr-btn cancel-btn" onclick="attributesManager.cancelAddNestedAttribute(this)" title="取消">
                    ×
                </button>
            </div>
        `;
        
        nestedContainer.appendChild(addForm);
        
        // 聚焦到键名输入框
        const keyInput = addForm.querySelector('#new-nested-key');
        keyInput.focus();
        
        // 添加按键处理
        const handleKeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.target.id === 'new-nested-key') {
                    // 从键名输入框跳到值输入框
                    addForm.querySelector('#new-nested-value').focus();
                } else {
                    // 从值输入框保存
                    this.saveNestedAttribute(sectionId, parentKey, addForm.querySelector('.save-btn'));
                }
            } else if (e.key === 'Escape') {
                this.cancelAddNestedAttribute(addForm);
            }
        };
        
        keyInput.addEventListener('keydown', handleKeydown);
        addForm.querySelector('#new-nested-value').addEventListener('keydown', handleKeydown);
    }

    // 保存嵌套属性
    saveNestedAttribute(sectionId, parentKey, saveButton) {
        const addForm = saveButton.closest('.adding-nested-attr');
        const keyInput = addForm.querySelector('#new-nested-key');
        const valueInput = addForm.querySelector('#new-nested-value');
        
        const nestedKey = keyInput.value.trim();
        const nestedValue = valueInput.value.trim();
        
        if (!nestedKey) {
            keyInput.focus();
            this.showToast('请输入子属性名称', 'error');
            return;
        }
        
        // 检查是否已存在
        const changeKey = `${sectionId}.${parentKey}.${nestedKey}`;
        if (this.changes.hasOwnProperty(changeKey)) {
            keyInput.focus();
            this.showToast('该子属性名称已存在', 'error');
            return;
        }
        
        // 添加到更改记录
        this.changes[changeKey] = nestedValue;
        this.showSaveSection();
        
        // 移除添加表单
        addForm.remove();
        
        // 重新渲染
        this.refreshDisplayWithChanges();
        this.showToast(`已添加子属性 "${nestedKey}"`, 'success');
    }

    // 取消添加嵌套属性
    cancelAddNestedAttribute(addForm) {
        addForm.remove();
    }

    // 根据路径获取值
    getValueByPath(obj, path) {
        const keys = path.split('.');
        let current = obj;
        
        for (const key of keys) {
            if (current === null || current === undefined || typeof current !== 'object') {
                return undefined;
            }
            current = current[key];
        }
        
        return current;
    }

    // 根据路径设置值 - 支持新的简化路径格式
    setValueByPath(obj, path, value) {
        const keys = path.split('.');
        
        // 处理简化的路径格式 (sectionId.key)
        if (keys.length >= 2) {
            const sectionId = keys[0];
            const remainingPath = keys.slice(1);
            
            // 获取目标数据结构
            let targetObj;
            if (sectionId === 'basic_info') {
                if (!obj.basic_info) obj.basic_info = {};
                targetObj = obj.basic_info;
            } else if (sectionId === 'storybook_attributes') {
                if (!obj.storybook_data) obj.storybook_data = {};
                if (!obj.storybook_data.属性) obj.storybook_data.属性 = {};
                targetObj = obj.storybook_data.属性;
            } else if (sectionId === 'other_info') {
                if (!obj.storybook_data) obj.storybook_data = {};
                targetObj = obj.storybook_data;
            } else {
                // 兜底情况，尝试获取现有结构
                targetObj = obj;
            }
            
            // 在目标对象中设置值
            let current = targetObj;
            for (let i = 0; i < remainingPath.length - 1; i++) {
                const key = remainingPath[i];
                if (!(key in current) || typeof current[key] !== 'object') {
                    current[key] = {};
                }
                current = current[key];
            }
            
            const lastKey = remainingPath[remainingPath.length - 1];
            if (value === '__DELETE__') {
                delete current[lastKey];
            } else {
                current[lastKey] = value;
            }
        } else {
            // 兜底：使用原始逻辑
            let current = obj;
            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i];
                if (!(key in current) || typeof current[key] !== 'object') {
                    current[key] = {};
                }
                current = current[key];
            }
            
            const lastKey = keys[keys.length - 1];
            if (value === '__DELETE__') {
                delete current[lastKey];
            } else {
                current[lastKey] = value;
            }
        }
    }

    // 刷新显示（包含未保存的更改）
    refreshDisplayWithChanges() {
        if (!this.currentCharacter) return;
        
        // 创建数据副本
        const tempData = JSON.parse(JSON.stringify(this.currentCharacter));
        
        // 应用所有更改
        for (const [path, value] of Object.entries(this.changes)) {
            this.setValueByPath(tempData, path, value);
        }
        
        // 重新显示
        this.displayCharacterAttributes(tempData);
    }

    // 显示确认对话框
    showConfirmDialog() {
        this.confirmDialog.classList.add('show');
    }

    // 隐藏确认对话框
    hideConfirmDialog() {
        this.confirmDialog.classList.remove('show');
        this.pendingDeletePath = null;
    }
    
    /**
     * 安全地处理窗口关闭
     */
    handleCloseWindow() {
        try {
            // 检查是否有未保存的更改
            if (this.isEditMode && Object.keys(this.changes).length > 0) {
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
                                alert('请手动关闭浏览器标签页');
                            }
                        }
                    }, 100);
                }
            }
        } catch (error) {
            console.error('关闭窗口时出错:', error);
            alert('关闭窗口失败，请手动关闭浏览器标签页');
        }
    }

    // 打开数据书编辑器
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

    // 显示提示消息
    showToast(message, type = 'info') {
        // 创建toast提示
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        let backgroundColor;
        switch(type) {
            case 'success':
                backgroundColor = '#28a745';
                break;
            case 'error':
                backgroundColor = '#dc3545';
                break;
            case 'warning':
                backgroundColor = '#ffc107';
                break;
            default:
                backgroundColor = '#17a2b8';
        }
        
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${backgroundColor};
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 10000;
            font-family: 'Cinzel', serif;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideInRight 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        `;
        
        document.body.appendChild(toast);
        
        // 根据类型设置不同的显示时间
        const duration = type === 'error' ? 4000 : 3000;
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }
        }, duration);
    }
}

// 全局函数
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

// 全局头像点击和长按处理类
class AvatarInteractionManager {
    constructor() {
        this.longPressTimeout = null;
        this.longPressDelay = 300; // 0.3秒
        this.isLongPressing = false;
    }
    
    addRoleAvatarClickHandler(avatarElement, roleName) {
        if (!avatarElement || !roleName) return;
        
        this.bindAvatarEvents(avatarElement, roleName, 'role');
    }
    
    addPlayerAvatarClickHandler(avatarElement, playerName) {
        if (!avatarElement || !playerName) return;
        
        this.bindAvatarEvents(avatarElement, playerName, 'player');
    }
    
    bindAvatarEvents(avatarElement, name, type) {
        
        // 为单个元素绑定长按和点击事件
        const bindEventsToElement = (element) => {
            let startTime = 0;
            let isMouseDown = false;
            let longPressTimer = null;
            
            // 鼠标/触摸开始事件
            const startHandler = (e) => {
                isMouseDown = true;
                startTime = Date.now();
                this.isLongPressing = false;
                
                // 设置长按定时器
                longPressTimer = setTimeout(() => {
                    if (isMouseDown) {
                        this.isLongPressing = true;
                        if (type === 'role') {
                            this.handleLongPress(name);
                        } else if (type === 'player') {
                            this.handlePlayerLongPress(name);
                        }
                        // 触觉反馈（如果支持）
                        if (navigator.vibrate) {
                            navigator.vibrate(50);
                        }
                    }
                }, this.longPressDelay);
            };
            
            // 鼠标/触摸结束事件
            const endHandler = (e) => {
                if (!isMouseDown) return;
                
                isMouseDown = false;
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                // 清除长按定时器
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
                
                // 如果不是长按，则处理点击事件
                if (!this.isLongPressing && duration < this.longPressDelay) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (type === 'role') {
                        this.handleClick(name);
                    } else if (type === 'player') {
                        this.handlePlayerClick(name);
                    }
                }
                
                this.isLongPressing = false;
            };
            
            // 鼠标离开事件（取消长按）
            const leaveHandler = () => {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
                isMouseDown = false;
                this.isLongPressing = false;
            };
            
            // 悬停效果
            const mouseEnterHandler = function() {
                this.style.opacity = '0.8';
                this.style.transform = 'scale(1.05)';
                this.style.transition = 'all 0.2s ease';
            };
            
            const mouseLeaveHandler = function() {
                this.style.opacity = '1';
                this.style.transform = 'scale(1)';
            };
            
            // 绑定事件
            element.addEventListener('mousedown', startHandler);
            element.addEventListener('touchstart', startHandler, { passive: true });
            element.addEventListener('mouseup', endHandler);
            element.addEventListener('touchend', endHandler, { passive: true });
            element.addEventListener('mouseleave', leaveHandler);
            element.addEventListener('touchcancel', leaveHandler, { passive: true });
            element.addEventListener('mouseenter', mouseEnterHandler);
            element.addEventListener('mouseleave', mouseLeaveHandler);
            
            // 防止默认的drag行为
            element.addEventListener('dragstart', (e) => e.preventDefault());
            
            // 添加样式提示
            element.style.cursor = 'pointer';
            if (type === 'role') {
                element.title = `点击查看 ${name} 属性，长按0.3秒进行@`;
            } else if (type === 'player') {
                element.title = `点击查看 ${name} 信息，长按0.3秒提及玩家`;
            }
        };
        
        // 如果是img元素，还需要给对应的fallback元素也绑定事件
        if (avatarElement.tagName === 'IMG') {
            // 为img元素绑定事件
            bindEventsToElement(avatarElement);
            
            // 查找对应的fallback元素并绑定相同的事件
            const fallbackElement = avatarElement.nextElementSibling;
            if (fallbackElement && fallbackElement.classList.contains('avatar-fallback')) {
                bindEventsToElement(fallbackElement);
            }
        } else {
            // 对于其他元素（如fallback），直接绑定事件
            bindEventsToElement(avatarElement);
        }
    }
    
    addUserAvatarClickHandler(avatarElement, userName) {
        if (!avatarElement || !userName) return;
        
        // 创建通用的事件处理函数
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
        
        // 如果是img元素，还需要给对应的fallback元素也绑定事件
        if (avatarElement.tagName === 'IMG') {
            // 为img元素绑定事件
            avatarElement.addEventListener('click', clickHandler);
            avatarElement.addEventListener('mouseenter', mouseEnterHandler);
            avatarElement.addEventListener('mouseleave', mouseLeaveHandler);
            avatarElement.style.cursor = 'pointer';
            avatarElement.title = `点击查看 ${userName} 的属性信息`;
            
            // 查找对应的fallback元素并绑定相同的事件
            const fallbackElement = avatarElement.nextElementSibling;
            if (fallbackElement && fallbackElement.classList.contains('avatar-fallback')) {
                fallbackElement.addEventListener('click', clickHandler);
                fallbackElement.addEventListener('mouseenter', mouseEnterHandler);
                fallbackElement.addEventListener('mouseleave', mouseLeaveHandler);
                fallbackElement.style.cursor = 'pointer';
                fallbackElement.title = `点击查看 ${userName} 的属性信息`;
            }
        } else {
            // 对于其他元素（如fallback），直接绑定事件
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
        // 在输入框中插入@角色名
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            const cursorPos = messageInput.selectionStart;
            const textBefore = messageInput.value.substring(0, cursorPos);
            const textAfter = messageInput.value.substring(cursorPos);
            
            // 检查是否需要在前面加空格
            const needSpaceBefore = textBefore.length > 0 && !textBefore.endsWith(' ');
            const atText = (needSpaceBefore ? ' ' : '') + `@${roleName} `;
            
            messageInput.value = textBefore + atText + textAfter;
            messageInput.focus();
            
            // 设置光标位置到@文本后面
            const newCursorPos = cursorPos + atText.length;
            messageInput.setSelectionRange(newCursorPos, newCursorPos);
            
            // 显示提示
            this.showToast(`已@${roleName}`, 'success');
        }
    }
    
    handlePlayerClick(playerName) {
        // 玩家头像点击：和角色头像一样，打开user-attributes页面
        console.log(`点击玩家头像: ${playerName}`);
        this.handleClick(playerName);
    }
    
    handlePlayerLongPress(playerName) {
        // 玩家头像长按：在输入框中插入玩家名
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            const cursorPos = messageInput.selectionStart;
            const textBefore = messageInput.value.substring(0, cursorPos);
            const textAfter = messageInput.value.substring(cursorPos);
            
            // 检查是否需要在前面加空格
            const needSpaceBefore = textBefore.length > 0 && !textBefore.endsWith(' ');
            const playerText = (needSpaceBefore ? ' ' : '') + `#${playerName} `;
            
            messageInput.value = textBefore + playerText + textAfter;
            messageInput.focus();
            
            // 设置光标位置到#文本后面
            const newCursorPos = cursorPos + playerText.length;
            messageInput.setSelectionRange(newCursorPos, newCursorPos);
            
            // 显示提示
            this.showToast(`已提及玩家 ${playerName}`, 'success');
        }
    }
    
    showToast(message, type = 'info') {
        // 创建toast提示
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
        
        // 3秒后移除
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

// 全局头像绑定队列
window.avatarBindingQueue = window.avatarBindingQueue || [];

// 全局头像绑定函数（在UserAttributes加载前可用）
window.queueAvatarBinding = function(avatarElement, characterName, isUser = false) {
    if (window.UserAttributes) {
        // 如果UserAttributes已经可用，直接绑定
        if (isUser) {
            window.UserAttributes.addUserAvatarClickHandler(avatarElement, characterName);
        } else {
            window.UserAttributes.addRoleAvatarClickHandler(avatarElement, characterName);
        }
    } else {
        // 否则加入队列
        window.avatarBindingQueue.push({
            element: avatarElement,
            name: characterName,
            isUser: isUser
        });
    }
};

// 处理队列中的绑定
function processAvatarBindingQueue() {
    if (window.avatarBindingQueue && window.UserAttributes) {
        window.avatarBindingQueue.forEach(item => {
            if (item.isUser) {
                window.UserAttributes.addUserAvatarClickHandler(item.element, item.name);
            } else {
                window.UserAttributes.addRoleAvatarClickHandler(item.element, item.name);
            }
        });
        window.avatarBindingQueue = []; // 清空队列
    }
}

// 初始化
let attributesManager;
let avatarManager;

document.addEventListener('DOMContentLoaded', () => {
    // 只有在没有其他管理器时才初始化UserAttributesManager
    if (!window.characterCardManager) {
        attributesManager = new UserAttributesManager();
    }
    
    avatarManager = new AvatarInteractionManager();
    
    // 设置全局UserAttributes对象
    window.UserAttributes = avatarManager;
    
    // 处理队列中的绑定
    processAvatarBindingQueue();
});

// 添加CSS动画
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
