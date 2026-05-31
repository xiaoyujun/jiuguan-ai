class UserAttributesManager {
    constructor() {
        this.isEditMode = false;
        this.currentCharacter = null;
        this.originalData = null;
        this.changes = {};
        
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
    }
    
    bindEvents() {
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
                     ${this.isEditMode ? `oninput="attributesManager.handleSimpleValueChange('${sectionId}', '${key}', this.textContent)"` : ''}>
                    ${displayValue}
                </div>
                <div class="attribute-actions">
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
                <div class="nested-attr-key">${nestedKey}</div>
                <div class="nested-attr-value ${this.isEditMode ? 'editable' : ''}" 
                     ${this.isEditMode ? 'contenteditable="true"' : ''}
                     ${this.isEditMode ? `oninput="attributesManager.handleNestedValueChange('${sectionId}', '${key}', '${nestedKey}', this.textContent)"` : ''}>
                    ${nestedValue === '' ? '(空)' : String(nestedValue)}
                </div>
                <div class="nested-actions">
                    <button class="attr-btn delete-btn" onclick="attributesManager.confirmDeleteNestedAttribute('${sectionId}', '${key}', '${nestedKey}')" title="删除子属性">
                        ×
                    </button>
                </div>
            </div>
        `).join('');

        return `
            <div class="nested-object" data-section="${sectionId}" data-key="${key}">
                <div style="font-weight: bold; color: var(--text-gold); margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <span>${key}</span>
                    <button class="attr-btn delete-btn" onclick="attributesManager.confirmDeleteSimpleAttribute('${sectionId}', '${key}')" title="删除整个属性">
                        🗑️ 删除
                    </button>
                </div>
                <div class="nested-attributes">
                    ${nestedItems}
                </div>
                <div class="nested-controls">
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
                    <button class="add-btn" onclick="attributesManager.addAttribute('${sectionId}')">
                        ➕ 添加属性
                    </button>
                </div>
            </div>
        `;
    }

    // 添加新属性
    addAttribute(sectionId) {
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
        
        // 使用简化的路径构建 - 直接使用 sectionId.key
        const changeKey = `${sectionId}.${key}`;
        
        // 检查是否已经在待更改列表中
        if (this.changes.hasOwnProperty(changeKey)) {
            alert('该属性已在编辑列表中');
            keyInput.focus();
            return;
        }
        
        // 添加到更改记录
        this.changes[changeKey] = value;
        
        // 清空输入框
        keyInput.value = '';
        valueInput.value = '';
        
        // 显示保存按钮
        this.showSaveSection();
        
        // 重新渲染当前数据（包含新属性的预览）
        this.refreshDisplayWithChanges();
        
        // 提示成功
        this.showToast(`已添加属性 "${key}"`, 'success');
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
        const nestedKey = prompt('请输入子属性名称:');
        if (!nestedKey || !nestedKey.trim()) return;
        
        const nestedValue = prompt('请输入子属性值:') || '';
        const changeKey = `${sectionId}.${parentKey}.${nestedKey}`;
        this.changes[changeKey] = nestedValue;
        this.showSaveSection();
        this.refreshDisplayWithChanges();
        this.showToast(`已添加子属性 "${nestedKey}"`, 'success');
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
                        this.handleLongPress(roleName);
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
                    this.handleClick(roleName);
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
            element.title = `点击查看 ${roleName} 属性，长按0.3秒进行@`;
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
    attributesManager = new UserAttributesManager();
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
