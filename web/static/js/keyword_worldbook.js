/**
 * 智能世界书页面JavaScript功能
 * 支持关键词管理、搜索筛选、移动端响应式交互
 */

let worldbookData = {};
let categories = [];
let currentEditingEntry = null;
let currentKeywords = [];
let currentView = 'grid';
let searchTimeout = null;
let selectedEntriesInList = new Set(); // 存储选中的条目名称

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
    initializeMobileBottomBar();
});

/**
 * 初始化页面
 */
async function initializePage() {
    try {
        await loadCategories();
        await loadWorldbookEntries();
        updateCategorySuggestions();
        initializeKeywordInput();
        
        // 初始化视图
        updateViewDisplay();
        
        console.log('智能世界书页面初始化完成');
    } catch (error) {
        console.error('页面初始化失败:', error);
        showError('页面初始化失败: ' + error.message);
    }
}

/**
 * 加载分类列表
 */
async function loadCategories() {
    try {
        const response = await fetch('/api/keyword_worldbook/categories');
        const data = await response.json();
        
        if (data.success) {
            categories = data.data;
            updateCategoryFilter();
        } else {
            console.error('加载分类失败:', data.error);
        }
    } catch (error) {
        console.error('加载分类失败:', error);
    }
}

/**
 * 更新分类筛选器
 */
function updateCategoryFilter() {
    const filterSelect = document.getElementById('category-filter');
    
    // 清空现有选项（保留"所有分类"）
    while (filterSelect.children.length > 1) {
        filterSelect.removeChild(filterSelect.lastChild);
    }
    
    // 添加分类选项
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        filterSelect.appendChild(option);
    });
}

/**
 * 更新分类建议
 */
function updateCategorySuggestions() {
    const datalist = document.getElementById('category-suggestions');
    datalist.innerHTML = '';
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        datalist.appendChild(option);
    });
}

/**
 * 加载世界书条目
 */
async function loadWorldbookEntries(query = '', category = '') {
    try {
        showLoading();
        
        const params = new URLSearchParams();
        if (query) params.append('query', query);
        if (category) params.append('category', category);
        
        const response = await fetch(`/api/keyword_worldbook/entries?${params}`);
        const data = await response.json();
        
        if (data.success) {
            worldbookData = data.data;
            renderEntries();
            updateStats();
        } else {
            showError('加载条目失败: ' + data.error);
        }
    } catch (error) {
        console.error('加载条目失败:', error);
        showError('加载条目失败: ' + error.message);
    }
}

/**
 * 渲染条目列表
 */
function renderEntries() {
    const container = document.getElementById('entries-container');
    container.className = `entries-container ${currentView}-view`;
    
    if (Object.keys(worldbookData).length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>暂无条目</h3>
                <p>没有找到匹配的世界书条目</p>
                <button class="btn-primary" onclick="createNewEntry()">创建第一个条目</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    // 按优先级和名称排序
    const sortedEntries = Object.entries(worldbookData).sort((a, b) => {
        const priorityA = a[1].优先级 || 1;
        const priorityB = b[1].优先级 || 1;
        if (priorityA !== priorityB) {
            return priorityB - priorityA; // 优先级高的在前
        }
        return a[0].localeCompare(b[0]); // 名称字母排序
    });
    
    sortedEntries.forEach(([entryName, entryData]) => {
        const card = createEntryCard(entryName, entryData);
        container.appendChild(card);
    });
}

/**
 * 创建条目卡片
 */
function createEntryCard(entryName, entryData) {
    const card = document.createElement('div');
    const isSelected = selectedEntriesInList.has(entryName);
    card.className = `entry-card ${!entryData.启用 ? 'disabled' : ''} ${isSelected ? 'selected' : ''}`;
    card.dataset.entryName = entryName;
    
    const name = entryData.名字 || entryName;
    const description = entryData.描述 || '暂无描述';
    const keywords = entryData.关键词 || [];
    const category = entryData.分类 || '默认';
    const priority = entryData.优先级 || 1;
    const enabled = entryData.启用 !== false;
    const triggerMode = entryData.触发模式 || 'keyword';
    
    // 优先级标签
    const priorityLabels = {
        1: '低',
        2: '中', 
        3: '高',
        4: '很高',
        5: '最高'
    };
    
    // 触发模式标签
    const triggerModeLabels = {
        'keyword': '关键词触发',
        'always': '全局生效'
    };
    
    // 生成关键词标签
    const keywordsHtml = Array.isArray(keywords) ? 
        keywords.map(keyword => `<span class="keyword-tag">${escapeHtml(keyword)}</span>`).join('') : '';
    
    // 复选框HTML
    const checkboxHtml = `
        <div class="entry-checkbox" onclick="event.stopPropagation();">
            <input type="checkbox" 
                   id="select-${escapeHtml(entryName)}" 
                   ${isSelected ? 'checked' : ''}
                   onchange="toggleEntrySelection('${escapeHtml(entryName)}')">
        </div>
    `;
    
    if (currentView === 'list') {
        card.innerHTML = `
            ${checkboxHtml}
            <div class="entry-content">
                <div class="entry-info">
                    <div class="entry-header">
                        <div class="entry-title">${escapeHtml(name)}</div>
                        <div class="entry-meta">
                            <span class="entry-badge category">${escapeHtml(category)}</span>
                            <span class="entry-badge priority">优先级: ${priorityLabels[priority] || priority}</span>
                            <span class="entry-badge trigger-mode ${triggerMode}">${triggerModeLabels[triggerMode] || triggerMode}</span>
                            ${!enabled ? '<span class="entry-badge disabled">已禁用</span>' : ''}
                        </div>
                    </div>
                    <div class="entry-description">${escapeHtml(description)}</div>
                    <div class="entry-keywords">${keywordsHtml}</div>
                </div>
            </div>
            <div class="entry-actions">
                <button class="btn-edit" onclick="event.stopPropagation(); editEntry('${entryName}', this)" title="编辑">✏️</button>
                <button class="btn-toggle" onclick="event.stopPropagation(); toggleEntry('${entryName}', ${!enabled})" title="${enabled ? '禁用' : '启用'}">${enabled ? '⏸️' : '▶️'}</button>
                <button class="btn-delete" onclick="event.stopPropagation(); confirmDeleteEntry('${entryName}')" title="删除">🗑️</button>
            </div>
        `;
    } else {
        card.innerHTML = `
            ${checkboxHtml}
            <div class="entry-header">
                <div class="entry-title">${escapeHtml(name)}</div>
                <div class="entry-meta">
                    <span class="entry-badge category">${escapeHtml(category)}</span>
                    <span class="entry-badge priority">优先级: ${priorityLabels[priority] || priority}</span>
                    <span class="entry-badge trigger-mode ${triggerMode}">${triggerModeLabels[triggerMode] || triggerMode}</span>
                    ${!enabled ? '<span class="entry-badge disabled">已禁用</span>' : ''}
                </div>
            </div>
            <div class="entry-description">${escapeHtml(description)}</div>
            <div class="entry-keywords">${keywordsHtml}</div>
            <div class="entry-actions">
                <button class="btn-edit" onclick="event.stopPropagation(); editEntry('${entryName}', this)">编辑</button>
                <button class="btn-toggle" onclick="event.stopPropagation(); toggleEntry('${entryName}', ${!enabled})">${enabled ? '禁用' : '启用'}</button>
                <button class="btn-delete" onclick="event.stopPropagation(); confirmDeleteEntry('${entryName}')">删除</button>
            </div>
        `;
    }
    
    // 点击卡片编辑（不包括复选框区域）
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.entry-checkbox') && !e.target.closest('.entry-actions')) {
            editEntry(entryName);
        }
    });
    
    return card;
}

/**
 * 更新统计信息
 */
function updateStats() {
    const total = Object.keys(worldbookData).length;
    const enabled = Object.values(worldbookData).filter(data => data.启用 !== false).length;
    const categoryCount = new Set(Object.values(worldbookData).map(data => data.分类 || '默认')).size;
    
    document.getElementById('total-count').textContent = total;
    document.getElementById('enabled-count').textContent = enabled;
    document.getElementById('category-count').textContent = categoryCount;
}

/**
 * 处理搜索输入
 */
function handleSearchInput() {
    // 防抖处理
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    searchTimeout = setTimeout(() => {
        performSearch();
    }, 300);
}

/**
 * 执行搜索
 */
function performSearch() {
    const query = document.getElementById('search-input').value.trim();
    const category = document.getElementById('category-filter').value;
    
    loadWorldbookEntries(query, category);
}

/**
 * 清除筛选
 */
function clearFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('category-filter').value = '';
    loadWorldbookEntries();
}

/**
 * 切换视图
 */
function toggleView(view) {
    currentView = view;
    
    // 更新按钮状态
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-view="${view}"]`).classList.add('active');
    
    // 重新渲染
    renderEntries();
}

/**
 * 更新视图显示
 */
function updateViewDisplay() {
    const container = document.getElementById('entries-container');
    container.className = `entries-container ${currentView}-view`;
}

/**
 * 创建新条目
 */
function createNewEntry() {
    currentEditingEntry = null;
    currentKeywords = [];
    
    document.getElementById('modal-title').textContent = '创建新条目';
    document.getElementById('entry-name').value = '';
    document.getElementById('entry-description').value = '';
    document.getElementById('entry-category').value = '默认';
    document.getElementById('entry-priority').value = '2';
    document.getElementById('entry-enabled').checked = true;
    document.getElementById('entry-trigger-mode').value = 'keyword';
    document.getElementById('delete-btn').style.display = 'none';
    
    updateKeywordsList();
    handleTriggerModeChange();
    showEditModal();
}

/**
 * 编辑条目
 */
function editEntry(entryName, buttonElement = null) {
    const entryData = worldbookData[entryName];
    if (!entryData) return;
    
    currentEditingEntry = entryName;
    currentKeywords = Array.isArray(entryData.关键词) ? [...entryData.关键词] : [entryName];
    
    document.getElementById('modal-title').textContent = '编辑条目';
    document.getElementById('entry-name').value = entryData.名字 || entryName;
    document.getElementById('entry-description').value = entryData.描述 || '';
    document.getElementById('entry-category').value = entryData.分类 || '默认';
    document.getElementById('entry-priority').value = entryData.优先级 || 2;
    document.getElementById('entry-enabled').checked = entryData.启用 !== false;
    document.getElementById('entry-trigger-mode').value = entryData.触发模式 || 'keyword';
    document.getElementById('delete-btn').style.display = 'inline-block';
    
    updateKeywordsList();
    handleTriggerModeChange();
    showEditModal();
}

/**
 * 处理触发模式变化
 */
function handleTriggerModeChange() {
    const triggerMode = document.getElementById('entry-trigger-mode').value;
    const keywordsSection = document.getElementById('keywords-section');
    const keywordsHint = document.getElementById('keywords-hint');
    const keywordInput = document.getElementById('keyword-input');
    
    if (triggerMode === 'always') {
        // 全局生效模式
        keywordsSection.style.opacity = '0.6';
        keywordInput.disabled = true;
        keywordInput.placeholder = '全局生效模式无需关键词';
        keywordsHint.textContent = '全局生效模式：此条目将在所有聊天中自动注入给AI，无需关键词触发';
        keywordsHint.style.color = 'var(--accent-color)';
    } else {
        // 关键词触发模式
        keywordsSection.style.opacity = '1';
        keywordInput.disabled = false;
        keywordInput.placeholder = '输入关键词后按回车添加';
        keywordsHint.textContent = '用户在聊天中提到这些关键词时，此条目将被注入给AI';
        keywordsHint.style.color = '';
    }
}

/**
 * 切换条目启用状态
 */
async function toggleEntry(entryName, enable) {
    try {
        const entryData = worldbookData[entryName];
        if (!entryData) return;
        
        const response = await fetch(`/api/keyword_worldbook/entries/${encodeURIComponent(entryName)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: entryData.名字 || entryName,
                description: entryData.描述 || '',
                keywords: entryData.关键词 || [entryName],
                category: entryData.分类 || '默认',
                priority: entryData.优先级 || 2,
                enabled: enable,
                trigger_mode: entryData.触发模式 || 'keyword'
            })
        });
        
        const data = await response.json();
        if (data.success) {
            await loadWorldbookEntries();
            showSuccess(enable ? '条目已启用' : '条目已禁用');
        } else {
            showError(data.error || '操作失败');
        }
    } catch (error) {
        console.error('切换条目状态失败:', error);
        showError('操作失败: ' + error.message);
    }
}

/**
 * 保存条目
 */
async function saveEntry() {
    try {
        const entryName = document.getElementById('entry-name').value.trim();
        const entryDescription = document.getElementById('entry-description').value.trim();
        const entryCategory = document.getElementById('entry-category').value.trim() || '默认';
        const entryPriority = parseInt(document.getElementById('entry-priority').value) || 2;
        const entryEnabled = document.getElementById('entry-enabled').checked;
        const entryTriggerMode = document.getElementById('entry-trigger-mode').value || 'keyword';
        
        if (!entryName) {
            showError('条目名称不能为空');
            return;
        }
        
        if (!entryDescription) {
            showError('条目描述不能为空');
            return;
        }
        
        if (entryTriggerMode === 'keyword' && currentKeywords.length === 0) {
            showError('关键词触发模式至少需要一个关键词');
            return;
        }
        
        const entryData = {
            name: entryName,
            description: entryDescription,
            keywords: currentKeywords,
            category: entryCategory,
            priority: entryPriority,
            enabled: entryEnabled,
            trigger_mode: entryTriggerMode
        };
        
        let url, method;
        if (currentEditingEntry) {
            // 更新现有条目
            url = `/api/keyword_worldbook/entries/${encodeURIComponent(currentEditingEntry)}`;
            method = 'PUT';
        } else {
            // 创建新条目
            url = '/api/keyword_worldbook/entries';
            method = 'POST';
        }
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(entryData)
        });
        
        const data = await response.json();
        if (data.success) {
            closeEditModal();
            await loadCategories(); // 重新加载分类
            await loadWorldbookEntries(); // 重新加载条目
            showSuccess(currentEditingEntry ? '条目更新成功' : '条目创建成功');
        } else {
            showError(data.error || '保存失败');
        }
    } catch (error) {
        console.error('保存条目失败:', error);
        showError('保存失败: ' + error.message);
    }
}

/**
 * 初始化关键词输入
 */
function initializeKeywordInput() {
    const keywordInput = document.getElementById('keyword-input');
    
    keywordInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            addKeyword();
        }
    });
    
    keywordInput.addEventListener('blur', function() {
        addKeyword();
    });
}

/**
 * 添加关键词
 */
function addKeyword() {
    const input = document.getElementById('keyword-input');
    const keyword = input.value.trim();
    
    if (keyword && !currentKeywords.includes(keyword)) {
        currentKeywords.push(keyword);
        input.value = '';
        updateKeywordsList();
    }
}

/**
 * 移除关键词
 */
function removeKeyword(keyword) {
    const index = currentKeywords.indexOf(keyword);
    if (index > -1) {
        currentKeywords.splice(index, 1);
        updateKeywordsList();
    }
}

/**
 * 更新关键词列表显示
 */
function updateKeywordsList() {
    const container = document.getElementById('keywords-list');
    container.innerHTML = '';
    
    currentKeywords.forEach(keyword => {
        const item = document.createElement('div');
        item.className = 'keyword-item';
        item.innerHTML = `
            <span>${escapeHtml(keyword)}</span>
            <span class="keyword-remove" onclick="removeKeyword('${escapeHtml(keyword)}')">&times;</span>
        `;
        container.appendChild(item);
    });
}

/**
 * 确认删除条目
 */
function confirmDeleteEntry(entryName) {
    document.getElementById('delete-entry-name').textContent = entryName;
    currentEditingEntry = entryName;
    showConfirmModal();
}

/**
 * 删除条目（从编辑模态框中调用）
 */
function deleteEntry() {
    if (!currentEditingEntry) return;
    
    document.getElementById('delete-entry-name').textContent = currentEditingEntry;
    closeEditModal();
    showConfirmModal();
}

/**
 * 确认删除
 */
async function confirmDelete() {
    if (!currentEditingEntry) return;
    
    try {
        const response = await fetch(`/api/keyword_worldbook/entries/${encodeURIComponent(currentEditingEntry)}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        if (data.success) {
            closeConfirmModal();
            await loadCategories();
            await loadWorldbookEntries();
            showSuccess('条目删除成功');
        } else {
            showError(data.error || '删除失败');
        }
    } catch (error) {
        console.error('删除条目失败:', error);
        showError('删除失败: ' + error.message);
    }
}

/**
 * 显示关键词测试模态框
 */
function showTestModal() {
    const modal = document.getElementById('test-modal');
    modal.style.display = 'block';
    document.getElementById('test-results').style.display = 'none';
    document.getElementById('test-text').value = '';
    
    // 移动端优化
    if (window.innerWidth <= 768) {
        const bottomBar = document.getElementById('mobile-bottom-bar');
        if (bottomBar) {
            bottomBar.style.display = 'none';
        }
        document.body.style.overflow = 'hidden';
    }
    
    // 延迟聚焦
    setTimeout(() => {
        document.getElementById('test-text').focus();
    }, 100);
}

/**
 * 关闭关键词测试模态框
 */
function closeTestModal() {
    const modal = document.getElementById('test-modal');
    modal.style.display = 'none';
    
    // 移动端优化
    if (window.innerWidth <= 768) {
        const bottomBar = document.getElementById('mobile-bottom-bar');
        if (bottomBar) {
            bottomBar.style.display = 'flex';
        }
        document.body.style.overflow = '';
    }
}

/**
 * 执行关键词测试
 */
async function performKeywordTest() {
    const testText = document.getElementById('test-text').value.trim();
    
    if (!testText) {
        showError('请输入测试文本');
        return;
    }
    
    try {
        const response = await fetch('/api/keyword_worldbook/match', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: testText
            })
        });
        
        const data = await response.json();
        if (data.success) {
            displayTestResults(data.data);
        } else {
            showError(data.error || '测试失败');
        }
    } catch (error) {
        console.error('关键词测试失败:', error);
        showError('测试失败: ' + error.message);
    }
}

/**
 * 显示测试结果
 */
function displayTestResults(results) {
    const resultsContainer = document.getElementById('test-results');
    const outputContainer = document.getElementById('test-output');
    
    if (results.matched_count === 0) {
        outputContainer.innerHTML = '<p style="color: var(--text-silver);">没有匹配到任何关键词</p>';
    } else {
        let html = `<p><strong>匹配到 ${results.matched_count} 个条目：</strong></p>`;
        
        Object.entries(results.matched_entries).forEach(([name, data]) => {
            html += `
                <div class="test-match-item">
                    <div class="test-match-title">${escapeHtml(data.名字 || name)}</div>
                    <div class="test-match-desc">${escapeHtml(data.描述 || '')}</div>
                    <div style="margin-top: 4px; font-size: 0.8rem; color: var(--text-silver);">
                        关键词: ${(data.关键词 || []).map(k => escapeHtml(k)).join(', ')}
                    </div>
                </div>
            `;
        });
        
        html += `
            <div style="margin-top: 16px; padding: 12px; background: var(--secondary-color); border-radius: var(--border-radius);">
                <strong>AI注入格式预览：</strong>
                <pre style="white-space: pre-wrap; margin-top: 8px; font-size: 0.9rem;">${escapeHtml(results.worldbook_context)}</pre>
            </div>
        `;
        
        outputContainer.innerHTML = html;
    }
    
    resultsContainer.style.display = 'block';
}

// ==================== 列表选择功能 ====================

/**
 * 切换条目选中状态
 */
function toggleEntrySelection(entryName) {
    if (selectedEntriesInList.has(entryName)) {
        selectedEntriesInList.delete(entryName);
    } else {
        selectedEntriesInList.add(entryName);
    }
    
    // 更新卡片样式
    const card = document.querySelector(`[data-entry-name="${entryName}"]`);
    if (card) {
        card.classList.toggle('selected', selectedEntriesInList.has(entryName));
    }
    
    updateSelectionUI();
}

/**
 * 全选当前视图
 */
function selectAllInView() {
    const cards = document.querySelectorAll('.entry-card');
    cards.forEach(card => {
        const entryName = card.dataset.entryName;
        if (entryName) {
            selectedEntriesInList.add(entryName);
            const checkbox = card.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = true;
            card.classList.add('selected');
        }
    });
    updateSelectionUI();
}

/**
 * 取消全选
 */
function deselectAllInView() {
    const cards = document.querySelectorAll('.entry-card');
    cards.forEach(card => {
        const entryName = card.dataset.entryName;
        if (entryName) {
            selectedEntriesInList.delete(entryName);
            const checkbox = card.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = false;
            card.classList.remove('selected');
        }
    });
    updateSelectionUI();
}

/**
 * 反选
 */
function invertSelectionInView() {
    const cards = document.querySelectorAll('.entry-card');
    cards.forEach(card => {
        const entryName = card.dataset.entryName;
        if (entryName) {
            if (selectedEntriesInList.has(entryName)) {
                selectedEntriesInList.delete(entryName);
                const checkbox = card.querySelector('input[type="checkbox"]');
                if (checkbox) checkbox.checked = false;
                card.classList.remove('selected');
            } else {
                selectedEntriesInList.add(entryName);
                const checkbox = card.querySelector('input[type="checkbox"]');
                if (checkbox) checkbox.checked = true;
                card.classList.add('selected');
            }
        }
    });
    updateSelectionUI();
}

/**
 * 全选复选框切换
 */
function toggleSelectAll() {
    const checkbox = document.getElementById('select-all-checkbox');
    if (checkbox.checked) {
        selectAllInView();
    } else {
        deselectAllInView();
    }
}

/**
 * 清除选择
 */
function clearSelection() {
    selectedEntriesInList.clear();
    const cards = document.querySelectorAll('.entry-card');
    cards.forEach(card => {
        const checkbox = card.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = false;
        card.classList.remove('selected');
    });
    updateSelectionUI();
}

/**
 * 更新选择相关UI
 */
function updateSelectionUI() {
    const count = selectedEntriesInList.size;
    const countSpan = document.getElementById('selected-count');
    const actionBar = document.getElementById('batch-action-bar');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    
    if (countSpan) {
        countSpan.textContent = count;
    }
    
    // 显示或隐藏批量操作栏
    if (actionBar) {
        actionBar.style.display = count > 0 ? 'flex' : 'none';
    }
    
    // 更新全选复选框状态
    const visibleCards = document.querySelectorAll('.entry-card');
    const allSelected = visibleCards.length > 0 && 
                       Array.from(visibleCards).every(card => 
                           selectedEntriesInList.has(card.dataset.entryName)
                       );
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = allSelected;
        selectAllCheckbox.indeterminate = count > 0 && !allSelected;
    }
}

/**
 * 从列表导出选中的条目
 */
async function exportSelectedFromList() {
    if (selectedEntriesInList.size === 0) {
        showError('请先选择要导出的条目');
        return;
    }
    
    try {
        const response = await fetch('/api/keyword_worldbook/batch/export', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                entries: Array.from(selectedEntriesInList)
            })
        });
        
        const data = await response.json();
        if (data.success) {
            downloadJSON(data.data, `智能世界书_选中_${new Date().toISOString().split('T')[0]}.json`);
            showSuccess(`成功导出 ${data.count} 个条目`);
        } else {
            showError(data.error || '导出失败');
        }
    } catch (error) {
        console.error('导出失败:', error);
        showError('导出失败: ' + error.message);
    }
}

/**
 * 从列表启用选中的条目
 */
async function enableSelectedFromList() {
    if (selectedEntriesInList.size === 0) {
        showError('请先选择要启用的条目');
        return;
    }
    
    await batchToggleEntries(Array.from(selectedEntriesInList), true);
}

/**
 * 从列表禁用选中的条目
 */
async function disableSelectedFromList() {
    if (selectedEntriesInList.size === 0) {
        showError('请先选择要禁用的条目');
        return;
    }
    
    await batchToggleEntries(Array.from(selectedEntriesInList), false);
}

/**
 * 批量切换条目状态
 */
async function batchToggleEntries(entryNames, enabled) {
    try {
        const response = await fetch('/api/keyword_worldbook/batch/toggle', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                entries: entryNames,
                enabled: enabled
            })
        });
        
        const data = await response.json();
        if (data.success) {
            await loadWorldbookEntries();
            clearSelection();
            showSuccess(data.message);
        } else {
            showError(data.error || '操作失败');
        }
    } catch (error) {
        console.error('操作失败:', error);
        showError('操作失败: ' + error.message);
    }
}

// ==================== 批量操作功能 ====================

let importData = null;

/**
 * 显示批量导入模态框
 */
function showBatchImportModal() {
    const modal = document.getElementById('batch-import-modal');
    modal.style.display = 'block';
    
    // 隐藏导入预览
    document.getElementById('import-preview').style.display = 'none';
    document.getElementById('import-file').value = '';
    
    // 移动端优化
    if (window.innerWidth <= 768) {
        const bottomBar = document.getElementById('mobile-bottom-bar');
        if (bottomBar) {
            bottomBar.style.display = 'none';
        }
        document.body.style.overflow = 'hidden';
    }
}

/**
 * 关闭批量导入模态框
 */
function closeBatchImportModal() {
    const modal = document.getElementById('batch-import-modal');
    modal.style.display = 'none';
    
    // 移动端优化
    if (window.innerWidth <= 768) {
        const bottomBar = document.getElementById('mobile-bottom-bar');
        if (bottomBar) {
            bottomBar.style.display = 'flex';
        }
        document.body.style.overflow = '';
    }
}

/**
 * 导出全部条目
 */
async function exportAllEntries() {
    try {
        const response = await fetch('/api/keyword_worldbook/batch/export', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                export_all: true
            })
        });
        
        const data = await response.json();
        if (data.success) {
            downloadJSON(data.data, `智能世界书_全部_${new Date().toISOString().split('T')[0]}.json`);
            showSuccess(`成功导出 ${data.count} 个条目`);
        } else {
            showError(data.error || '导出失败');
        }
    } catch (error) {
        console.error('导出失败:', error);
        showError('导出失败: ' + error.message);
    }
}


/**
 * 处理导入文件
 */
function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            importData = JSON.parse(e.target.result);
            showImportPreview(importData);
        } catch (error) {
            showError('文件格式错误，请确保是有效的JSON文件');
            console.error('解析文件失败:', error);
        }
    };
    reader.readAsText(file);
}

/**
 * 显示导入预览
 */
function showImportPreview(data) {
    const previewDiv = document.getElementById('import-preview');
    const contentDiv = document.getElementById('import-preview-content');
    
    const count = Object.keys(data).length;
    const existingCount = Object.keys(data).filter(name => worldbookData[name]).length;
    const newCount = count - existingCount;
    
    contentDiv.innerHTML = `
        <div class="import-stats">
            <p><strong>文件包含:</strong> ${count} 个条目</p>
            <p><strong>新条目:</strong> ${newCount} 个</p>
            <p><strong>已存在:</strong> ${existingCount} 个</p>
        </div>
        <div class="import-entries-list">
            ${Object.entries(data).map(([name, entry]) => {
                const exists = !!worldbookData[name];
                return `
                    <div class="import-entry-item ${exists ? 'exists' : 'new'}">
                        <span>${escapeHtml(entry.名字 || name)}</span>
                        <span class="entry-badge">${exists ? '已存在' : '新条目'}</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    previewDiv.style.display = 'block';
}

/**
 * 确认导入
 */
async function confirmImport() {
    if (!importData) {
        showError('没有可导入的数据');
        return;
    }
    
    const mode = document.querySelector('input[name="import-mode"]:checked').value;
    
    try {
        const response = await fetch('/api/keyword_worldbook/batch/import', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                entries: importData,
                mode: mode
            })
        });
        
        const data = await response.json();
        if (data.success) {
            await loadCategories();
            await loadWorldbookEntries();
            cancelImport();
            showSuccess(data.message);
            
            if (data.data.errors && data.data.errors.length > 0) {
                console.error('导入错误:', data.data.errors);
            }
        } else {
            showError(data.error || '导入失败');
        }
    } catch (error) {
        console.error('导入失败:', error);
        showError('导入失败: ' + error.message);
    }
}

/**
 * 取消导入
 */
function cancelImport() {
    importData = null;
    document.getElementById('import-preview').style.display = 'none';
    document.getElementById('import-file').value = '';
}

/**
 * 下载JSON文件
 */
function downloadJSON(data, filename) {
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = filename;
    link.click();
    
    URL.revokeObjectURL(link.href);
}

/**
 * 初始化移动端底部操作栏
 */
function initializeMobileBottomBar() {
    const bottomBar = document.getElementById('mobile-bottom-bar');
    if (!bottomBar) return;
    
    // 检测是否为移动设备
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        bottomBar.style.display = 'flex';
        
        // 初始化虚拟键盘处理
        initializeVirtualKeyboardHandling();
        
        // 监听滚动，实现自动隐藏/显示
        let lastScrollY = window.scrollY;
        let isBottomBarVisible = true;
        
        window.addEventListener('scroll', function() {
            const currentScrollY = window.scrollY;
            const scrollingDown = currentScrollY > lastScrollY;
            const scrollingUp = currentScrollY < lastScrollY;
            
            // 只有当滚动距离超过一定阈值时才触发隐藏/显示
            if (Math.abs(currentScrollY - lastScrollY) > 10) {
                if (scrollingDown && isBottomBarVisible && currentScrollY > 100) {
                    // 向下滚动且当前可见，隐藏底部栏
                    bottomBar.style.transform = 'translateY(100%)';
                    isBottomBarVisible = false;
                } else if (scrollingUp && !isBottomBarVisible) {
                    // 向上滚动且当前隐藏，显示底部栏
                    bottomBar.style.transform = 'translateY(0)';
                    isBottomBarVisible = true;
                }
                lastScrollY = currentScrollY;
            }
        });
        
        // 在模态框打开时隐藏底部栏
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.target.id && mutation.target.id.includes('modal')) {
                    const isModalOpen = mutation.target.style.display === 'block';
                    bottomBar.style.display = isModalOpen ? 'none' : 'flex';
                }
            });
        });
        
        // 监听所有模态框的显示状态变化
        const modals = ['edit-modal', 'confirm-modal', 'test-modal'];
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal) {
                observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
            }
        });
    } else {
        bottomBar.style.display = 'none';
    }
    
    // 窗口大小变化时重新检测
    window.addEventListener('resize', function() {
        const newIsMobile = window.innerWidth <= 768;
        bottomBar.style.display = newIsMobile ? 'flex' : 'none';
    });
}

/**
 * 初始化虚拟键盘处理
 */
function initializeVirtualKeyboardHandling() {
    // 检测虚拟键盘支持
    if ('visualViewport' in window) {
        // 使用 Visual Viewport API (现代浏览器)
        window.visualViewport.addEventListener('resize', handleViewportChange);
    } else {
        // 降级方案：监听窗口大小变化
        let initialHeight = window.innerHeight;
        window.addEventListener('resize', function() {
            handleLegacyKeyboardDetection(initialHeight);
        });
    }
    
    // 监听输入框焦点事件
    document.addEventListener('focusin', function(event) {
        if (isInputElement(event.target)) {
            handleInputFocus(event.target);
        }
    });
    
    document.addEventListener('focusout', function(event) {
        if (isInputElement(event.target)) {
            handleInputBlur(event.target);
        }
    });
}

/**
 * 处理视口变化（虚拟键盘弹出/收起）
 */
function handleViewportChange() {
    const viewport = window.visualViewport;
    const isKeyboardOpen = viewport.height < window.screen.height * 0.75;
    
    // 获取所有模态框
    const modals = ['edit-modal', 'confirm-modal', 'test-modal'];
    const openModal = modals.find(modalId => {
        const modal = document.getElementById(modalId);
        return modal && modal.style.display === 'block';
    });
    
    if (openModal) {
        const modal = document.getElementById(openModal);
        const modalFooter = modal.querySelector('.modal-footer');
        const modalBody = modal.querySelector('.modal-body');
        
        if (isKeyboardOpen) {
            // 键盘弹出时调整布局
            modalFooter.style.position = 'fixed';
            modalFooter.style.bottom = '0';
            modalFooter.style.transform = 'translateY(0)';
            modalBody.style.paddingBottom = '100px'; // 为按钮留出更多空间
        } else {
            // 键盘收起时恢复布局
            modalFooter.style.position = 'fixed';
            modalFooter.style.bottom = '0';
            modalFooter.style.transform = 'translateY(0)';
            modalBody.style.paddingBottom = '80px';
        }
    }
    
    // 处理底部操作栏
    const bottomBar = document.getElementById('mobile-bottom-bar');
    if (bottomBar && bottomBar.style.display === 'flex') {
        if (isKeyboardOpen) {
            bottomBar.style.display = 'none'; // 键盘弹出时隐藏底部栏
        } else {
            bottomBar.style.display = 'flex'; // 键盘收起时显示底部栏
        }
    }
}

/**
 * 降级方案：检测键盘弹出
 */
function handleLegacyKeyboardDetection(initialHeight) {
    const currentHeight = window.innerHeight;
    const heightDiff = initialHeight - currentHeight;
    const isKeyboardOpen = heightDiff > 150; // 高度差超过150px认为键盘弹出
    
    // 模拟 handleViewportChange 的行为
    const fakeViewport = {
        height: currentHeight
    };
    
    // 临时设置 visualViewport 用于 handleViewportChange
    const originalViewport = window.visualViewport;
    window.visualViewport = fakeViewport;
    handleViewportChange();
    window.visualViewport = originalViewport;
}

/**
 * 判断是否为输入元素
 */
function isInputElement(element) {
    const inputTypes = ['input', 'textarea', 'select'];
    return inputTypes.includes(element.tagName.toLowerCase());
}

/**
 * 处理输入框获得焦点
 */
function handleInputFocus(element) {
    // 延迟执行，等待虚拟键盘完全弹出
    setTimeout(() => {
        // 确保输入框在可视区域内
        const rect = element.getBoundingClientRect();
        const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        
        if (rect.bottom > viewportHeight - 60) { // 60px 为按钮区域预留空间
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }, 300);
}

/**
 * 处理输入框失去焦点
 */
function handleInputBlur(element) {
    // 键盘收起后的处理可以在这里添加
}

/**
 * FAB菜单相关
 */
function toggleFabMenu() {
    const fabMain = document.querySelector('.fab-main');
    const fabMenu = document.getElementById('fab-menu');
    
    if (fabMain && fabMenu) {
        fabMain.classList.toggle('active');
        fabMenu.classList.toggle('active');
    }
}

// 点击外部关闭FAB菜单
document.addEventListener('click', function(event) {
    const fabContainer = document.querySelector('.fab-container');
    if (fabContainer && !fabContainer.contains(event.target)) {
        const fabMain = document.querySelector('.fab-main');
        const fabMenu = document.getElementById('fab-menu');
        if (fabMain && fabMenu) {
            fabMain.classList.remove('active');
            fabMenu.classList.remove('active');
        }
    }
});

/**
 * 显示编辑模态框
 */
function showEditModal() {
    const modal = document.getElementById('edit-modal');
    modal.style.display = 'block';
    
    // 移动端优化
    if (window.innerWidth <= 768) {
        // 隐藏底部操作栏
        const bottomBar = document.getElementById('mobile-bottom-bar');
        if (bottomBar) {
            bottomBar.style.display = 'none';
        }
        
        // 确保模态框底部按钮可见
        const modalFooter = modal.querySelector('.modal-footer');
        if (modalFooter) {
            modalFooter.style.position = 'fixed';
            modalFooter.style.bottom = '0';
            modalFooter.style.left = '0';
            modalFooter.style.right = '0';
            modalFooter.style.zIndex = 'calc(var(--z-modal) + 1)';
        }
        
        // 防止背景滚动
        document.body.style.overflow = 'hidden';
    }
    
    // 延迟聚焦，避免键盘立即弹出
    setTimeout(() => {
        document.getElementById('entry-name').focus();
    }, 100);
}

/**
 * 关闭编辑模态框
 */
function closeEditModal() {
    const modal = document.getElementById('edit-modal');
    modal.style.display = 'none';
    currentEditingEntry = null;
    currentKeywords = [];
    
    // 移动端优化
    if (window.innerWidth <= 768) {
        // 恢复底部操作栏
        const bottomBar = document.getElementById('mobile-bottom-bar');
        if (bottomBar) {
            bottomBar.style.display = 'flex';
        }
        
        // 恢复背景滚动
        document.body.style.overflow = '';
    }
}

/**
 * 显示确认删除模态框
 */
function showConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    modal.style.display = 'block';
    
    // 移动端优化
    if (window.innerWidth <= 768) {
        const bottomBar = document.getElementById('mobile-bottom-bar');
        if (bottomBar) {
            bottomBar.style.display = 'none';
        }
        document.body.style.overflow = 'hidden';
    }
}

/**
 * 关闭确认删除模态框
 */
function closeConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    modal.style.display = 'none';
    currentEditingEntry = null;
    
    // 移动端优化
    if (window.innerWidth <= 768) {
        const bottomBar = document.getElementById('mobile-bottom-bar');
        if (bottomBar) {
            bottomBar.style.display = 'flex';
        }
        document.body.style.overflow = '';
    }
}

/**
 * 显示加载状态
 */
function showLoading() {
    const container = document.getElementById('entries-container');
    container.innerHTML = `
        <div class="loading-placeholder">
            <div class="loading-spinner"></div>
            <div class="loading-text">正在加载智能世界书...</div>
        </div>
    `;
}

/**
 * 显示成功消息
 */
function showSuccess(message) {
    // 简单的成功提示，可以后续扩展为更好的通知系统
    alert('✅ ' + message);
}

/**
 * 显示错误消息
 */
function showError(message) {
    // 简单的错误提示，可以后续扩展为更好的通知系统
    alert('❌ ' + message);
}

/**
 * HTML转义函数
 */
function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 点击模态框外部关闭模态框
window.onclick = function(event) {
    const editModal = document.getElementById('edit-modal');
    const confirmModal = document.getElementById('confirm-modal');
    const testModal = document.getElementById('test-modal');
    const batchImportModal = document.getElementById('batch-import-modal');
    
    if (event.target === editModal) {
        closeEditModal();
    }
    
    if (event.target === confirmModal) {
        closeConfirmModal();
    }
    
    if (event.target === testModal) {
        closeTestModal();
    }
    
    if (event.target === batchImportModal) {
        closeBatchImportModal();
    }
}

// 键盘快捷键
document.addEventListener('keydown', function(event) {
    // ESC键关闭模态框
    if (event.key === 'Escape') {
        closeEditModal();
        closeConfirmModal();
        closeTestModal();
        closeBatchImportModal();
    }
    
    // Ctrl+S保存（在编辑模态框中）
    if (event.ctrlKey && event.key === 's') {
        const editModal = document.getElementById('edit-modal');
        if (editModal.style.display === 'block') {
            event.preventDefault();
            saveEntry();
        }
    }
    
    // Ctrl+N创建新条目
    if (event.ctrlKey && event.key === 'n') {
        event.preventDefault();
        createNewEntry();
    }
    
    // Ctrl+F聚焦搜索框
    if (event.ctrlKey && event.key === 'f') {
        event.preventDefault();
        document.getElementById('search-input').focus();
    }
});
