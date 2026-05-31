/**
 * 底层设定管理页面JavaScript功能
 * 支持关键词管理、搜索筛选、测试匹配等功能
 */

let settingsData = {};
let categories = [];
let currentEditingSetting = null;
let currentKeywords = [];
let searchTimeout = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
});

/**
 * 初始化页面
 */
async function initializePage() {
    try {
        await loadCategories();
        await loadSettings();
        setupEventListeners();
        updateStats();
    } catch (error) {
        console.error('初始化失败:', error);
        showMessage('页面初始化失败: ' + error.message, 'error');
    }
}

/**
 * 设置事件监听器
 */
function setupEventListeners() {
    // 搜索和筛选
    document.getElementById('search-input').addEventListener('input', handleSearch);
    document.getElementById('category-filter').addEventListener('change', handleSearch);
    
    // 按钮事件
    document.getElementById('add-setting-btn').addEventListener('click', () => openEditModal());
    document.getElementById('test-matching-btn').addEventListener('click', toggleTestPanel);
    document.getElementById('refresh-btn').addEventListener('click', () => loadSettings());
    
    // 模态框事件
    document.getElementById('close-modal').addEventListener('click', closeEditModal);
    document.getElementById('cancel-btn').addEventListener('click', closeEditModal);
    document.getElementById('save-btn').addEventListener('click', saveSetting);
    
    // 触发模式选择
    document.querySelectorAll('.trigger-mode-option').forEach(option => {
        option.addEventListener('click', function() {
            selectTriggerMode(this.dataset.mode);
        });
    });
    
    // 测试功能
    document.getElementById('run-test-btn').addEventListener('click', runMatchingTest);
    
    // 点击模态框外部关闭
    document.getElementById('edit-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeEditModal();
        }
    });
}

/**
 * 加载分类列表
 */
async function loadCategories() {
    try {
        const response = await fetch('/api/dev/hidden_settings/categories');
        const result = await response.json();
        
        if (result.success) {
            categories = result.data;
            updateCategoryFilter();
        } else {
            console.error('加载分类失败:', result.error);
        }
    } catch (error) {
        console.error('加载分类失败:', error);
    }
}

/**
 * 更新分类筛选器
 */
function updateCategoryFilter() {
    const categoryFilter = document.getElementById('category-filter');
    categoryFilter.innerHTML = '<option value="">所有分类</option>';
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });
}

/**
 * 加载设定数据
 */
async function loadSettings(query = '', category = '') {
    try {
        showLoading(true);
        
        const params = new URLSearchParams();
        if (query) params.append('query', query);
        if (category) params.append('category', category);
        
        const response = await fetch(`/api/dev/hidden_settings/entries?${params}`);
        const result = await response.json();
        
        if (result.success) {
            settingsData = result.data;
            renderSettings();
            updateStats();
        } else {
            showMessage('加载设定失败: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('加载设定失败:', error);
        showMessage('加载设定失败: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * 渲染设定列表
 */
function renderSettings() {
    const grid = document.getElementById('entries-grid');
    
    if (Object.keys(settingsData).length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <h3>暂无设定</h3>
                <p>点击"新增设定"按钮创建第一个底层设定</p>
                <button class="btn btn-primary" onclick="openEditModal()">新增设定</button>
            </div>
        `;
        return;
    }
    
    const settingsArray = Object.entries(settingsData);
    
    grid.innerHTML = settingsArray.map(([name, data]) => `
        <div class="entry-card ${!data.启用 ? 'disabled' : ''}">
            <div class="entry-header">
                <h3 class="entry-title">${escapeHtml(data.名称 || name)}</h3>
                <span class="entry-category">${escapeHtml(data.分类 || '系统')}</span>
            </div>
            
            <div class="entry-description">
                ${escapeHtml(data.描述 || '')}
            </div>
            
            <div class="entry-content">
                ${escapeHtml(data.内容 || '')}
            </div>
            
            <div class="entry-meta">
                <div class="meta-item">
                    <span class="icon-mode"></span>
                    <span class="meta-badge trigger-mode-badge ${data.触发模式 || 'keyword'}">${getTriggerModeLabel(data.触发模式)}</span>
                </div>
                <div class="meta-item">
                    <span class="icon-priority"></span>
                    <span>优先级: ${data.优先级 || 1}</span>
                </div>
                <div class="meta-item">
                    <span class="icon-keywords"></span>
                    <span>${(data.关键词 || []).length} 个关键词</span>
                </div>
            </div>
            
            <div class="keywords-list">
                ${(data.关键词 || []).map(keyword => 
                    `<span class="keyword-tag">${escapeHtml(keyword)}</span>`
                ).join('')}
            </div>
            
            <div class="entry-actions">
                <button class="btn btn-secondary btn-small" onclick="editSetting('${escapeHtml(name)}')">
                    <span class="icon-edit"></span> 编辑
                </button>
                <button class="btn btn-warning btn-small" onclick="toggleSetting('${escapeHtml(name)}')">
                    <span class="icon-toggle"></span> ${data.启用 ? '禁用' : '启用'}
                </button>
                <button class="btn btn-danger btn-small" onclick="deleteSetting('${escapeHtml(name)}')">
                    <span class="icon-delete"></span> 删除
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * 更新统计信息
 */
function updateStats() {
    const total = Object.keys(settingsData).length;
    const enabled = Object.values(settingsData).filter(data => data.启用).length;
    const categoriesSet = new Set(Object.values(settingsData).map(data => data.分类 || '系统'));
    const keywordTriggered = Object.values(settingsData).filter(data => 
        (data.触发模式 || 'keyword') === 'keyword'
    ).length;
    
    document.getElementById('total-settings').textContent = total;
    document.getElementById('enabled-settings').textContent = enabled;
    document.getElementById('categories-count').textContent = categoriesSet.size;
    document.getElementById('keyword-settings').textContent = keywordTriggered;
}

/**
 * 获取触发模式标签
 */
function getTriggerModeLabel(mode) {
    switch (mode) {
        case 'always': return '始终生效';
        case 'conditional': return '条件触发';
        case 'keyword':
        default: return '关键词触发';
    }
}

/**
 * 处理搜索
 */
function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const query = document.getElementById('search-input').value.trim();
        const category = document.getElementById('category-filter').value;
        loadSettings(query, category);
    }, 300);
}

/**
 * 打开编辑模态框
 */
function openEditModal(settingName = null) {
    currentEditingSetting = settingName;
    const modal = document.getElementById('edit-modal');
    const title = document.getElementById('modal-title');
    const form = document.getElementById('setting-form');
    
    // 重置表单
    form.reset();
    document.getElementById('trigger-mode').value = 'keyword';
    selectTriggerMode('keyword');
    
    if (settingName) {
        title.textContent = '编辑底层设定';
        const data = settingsData[settingName];
        if (data) {
            document.getElementById('setting-name').value = data.名称 || settingName;
            document.getElementById('setting-description').value = data.描述 || '';
            document.getElementById('setting-content').value = data.内容 || '';
            document.getElementById('setting-keywords').value = (data.关键词 || []).join(', ');
            document.getElementById('setting-category').value = data.分类 || '系统';
            document.getElementById('setting-priority').value = data.优先级 || 1;
            document.getElementById('setting-enabled').checked = data.启用 !== false;
            
            const triggerMode = data.触发模式 || 'keyword';
            document.getElementById('trigger-mode').value = triggerMode;
            selectTriggerMode(triggerMode);
        }
    } else {
        title.textContent = '新增底层设定';
        document.getElementById('setting-enabled').checked = true;
    }
    
    modal.style.display = 'block';
}

/**
 * 关闭编辑模态框
 */
function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
    currentEditingSetting = null;
}

/**
 * 选择触发模式
 */
function selectTriggerMode(mode) {
    // 更新选中状态
    document.querySelectorAll('.trigger-mode-option').forEach(option => {
        option.classList.remove('selected');
    });
    document.querySelector(`[data-mode="${mode}"]`).classList.add('selected');
    
    // 更新隐藏字段
    document.getElementById('trigger-mode').value = mode;
    
    // 显示/隐藏关键词输入框
    const keywordsGroup = document.getElementById('keywords-group');
    if (mode === 'keyword') {
        keywordsGroup.style.display = 'block';
    } else {
        keywordsGroup.style.display = 'none';
    }
}

/**
 * 保存设定
 */
async function saveSetting() {
    try {
        const formData = new FormData(document.getElementById('setting-form'));
        const data = {
            name: formData.get('name').trim(),
            description: formData.get('description').trim(),
            content: formData.get('content').trim(),
            keywords: formData.get('keywords').split(',').map(k => k.trim()).filter(k => k),
            category: formData.get('category').trim() || '系统',
            priority: parseInt(formData.get('priority')) || 1,
            trigger_mode: formData.get('trigger_mode') || 'keyword',
            enabled: formData.get('enabled') === 'on'
        };
        
        // 验证必填字段
        if (!data.name) {
            showMessage('设定名称不能为空', 'error');
            return;
        }
        
        if (!data.description) {
            showMessage('设定描述不能为空', 'error');
            return;
        }
        
        if (!data.content) {
            showMessage('设定内容不能为空', 'error');
            return;
        }
        
        // 如果是关键词触发模式，验证关键词
        if (data.trigger_mode === 'keyword' && data.keywords.length === 0) {
            showMessage('关键词触发模式下必须提供至少一个关键词', 'error');
            return;
        }
        
        showLoading(true);
        
        let response;
        if (currentEditingSetting) {
            // 更新现有设定
            response = await fetch(`/api/dev/hidden_settings/entries/${encodeURIComponent(currentEditingSetting)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
        } else {
            // 创建新设定
            response = await fetch('/api/dev/hidden_settings/entries', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
        }
        
        const result = await response.json();
        
        if (result.success) {
            showMessage(result.message, 'success');
            closeEditModal();
            await loadSettings();
            await loadCategories();
        } else {
            showMessage(result.error, 'error');
        }
    } catch (error) {
        console.error('保存设定失败:', error);
        showMessage('保存设定失败: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * 编辑设定
 */
function editSetting(settingName) {
    openEditModal(settingName);
}

/**
 * 切换设定启用状态
 */
async function toggleSetting(settingName) {
    try {
        const data = settingsData[settingName];
        if (!data) return;
        
        const newData = { ...data, enabled: !data.启用 };
        
        showLoading(true);
        
        const response = await fetch(`/api/dev/hidden_settings/entries/${encodeURIComponent(settingName)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: data.名称 || settingName,
                description: data.描述 || '',
                content: data.内容 || '',
                keywords: data.关键词 || [],
                category: data.分类 || '系统',
                priority: data.优先级 || 1,
                trigger_mode: data.触发模式 || 'keyword',
                enabled: newData.enabled
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage(`设定已${newData.enabled ? '启用' : '禁用'}`, 'success');
            await loadSettings();
        } else {
            showMessage(result.error, 'error');
        }
    } catch (error) {
        console.error('切换设定状态失败:', error);
        showMessage('操作失败: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * 删除设定
 */
async function deleteSetting(settingName) {
    if (!confirm(`确定要删除设定"${settingName}"吗？此操作无法撤销。`)) {
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await fetch(`/api/dev/hidden_settings/entries/${encodeURIComponent(settingName)}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage(result.message, 'success');
            await loadSettings();
            await loadCategories();
        } else {
            showMessage(result.error, 'error');
        }
    } catch (error) {
        console.error('删除设定失败:', error);
        showMessage('删除设定失败: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * 切换测试面板
 */
function toggleTestPanel() {
    const panel = document.getElementById('test-panel');
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'block';
    
    if (!isVisible) {
        document.getElementById('test-text').focus();
    }
}

/**
 * 运行匹配测试
 */
async function runMatchingTest() {
    try {
        const text = document.getElementById('test-text').value.trim();
        if (!text) {
            showMessage('请输入测试文本', 'error');
            return;
        }
        
        showLoading(true);
        
        const response = await fetch('/api/dev/hidden_settings/match', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text })
        });
        
        const result = await response.json();
        
        if (result.success) {
            const resultDiv = document.getElementById('test-result');
            const data = result.data;
            
            let output = `测试文本: ${data.original_text}\n\n`;
            output += `匹配到 ${data.matched_count} 个设定:\n\n`;
            
            if (data.matched_count > 0) {
                Object.entries(data.matched_settings).forEach(([name, setting]) => {
                    output += `• ${setting.名称 || name} (${setting.分类 || '系统'})\n`;
                    output += `  触发模式: ${getTriggerModeLabel(setting.触发模式)}\n`;
                    output += `  优先级: ${setting.优先级 || 1}\n`;
                    output += `  关键词: ${(setting.关键词 || []).join(', ')}\n`;
                    output += `  内容: ${setting.内容 || ''}\n\n`;
                });
                
                output += '\n注入内容:\n';
                output += data.settings_context;
            } else {
                output += '没有匹配的设定';
            }
            
            resultDiv.textContent = output;
            resultDiv.style.display = 'block';
        } else {
            showMessage(result.error, 'error');
        }
    } catch (error) {
        console.error('测试失败:', error);
        showMessage('测试失败: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * 显示加载状态
 */
function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'flex' : 'none';
}

/**
 * 显示消息
 */
function showMessage(message, type = 'info') {
    const messageEl = document.getElementById('message');
    messageEl.textContent = message;
    messageEl.className = `message ${type}`;
    messageEl.style.display = 'block';
    
    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 3000);
}

/**
 * HTML转义
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
