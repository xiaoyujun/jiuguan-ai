let storiesData = {};
let rolesData = {};
let playersData = {};

// 折叠按钮区域的函数
function toggleActionButtons() {
    const buttonsContainer = document.getElementById('action-buttons');
    const toggleIcon = document.querySelector('.collapse-toggle');
    
    if (buttonsContainer.classList.contains('collapsed')) {
        // 展开
        buttonsContainer.classList.remove('collapsed');
        toggleIcon.classList.remove('collapsed');
        toggleIcon.textContent = '▼';
    } else {
        // 折叠
        buttonsContainer.classList.add('collapsed');
        toggleIcon.classList.add('collapsed');
        toggleIcon.textContent = '▶';
    }
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    loadStories();
    loadRoles();
    loadPlayers();
    
    // 添加搜索和过滤事件监听器
    document.getElementById('story-search').addEventListener('input', filterAndDisplayStories);
    document.getElementById('tag-filter').addEventListener('change', filterAndDisplayStories);
    
    // 初始化选择计数器
    updateSelectionCounter();
});

// 加载角色数据
function loadRoles() {
    fetch('/api/roles')
        .then(response => response.json())
        .then(data => {
            rolesData = data;
            window.rolesData = data; // 设置为全局变量，供story_editor.js使用
            console.log('✅ 角色数据已加载:', Object.keys(data).length, '个角色');
            
            // 如果刷新函数存在，则刷新现有选择器
            if (window.refreshExistingSelectors && typeof window.refreshExistingSelectors === 'function') {
                window.refreshExistingSelectors();
            }
        })
        .catch(error => {
            console.error('❌ 加载角色数据失败:', error);
        });
}

// 将函数暴露到全局作用域
window.loadRoles = loadRoles;

// 加载玩家数据
function loadPlayers() {
    fetch('/api/players')
        .then(response => response.json())
        .then(data => {
            if (data.success && data.players) {
                // 将玩家数组转换为以玩家名称为键的对象
                const playersObject = {};
                data.players.forEach(player => {
                    const playerName = player.file_name || player.name;
                    playersObject[playerName] = player;
                });
                
                playersData = playersObject;
                window.playersData = playersObject; // 设置为全局变量，供story_editor.js使用
                console.log('✅ 玩家数据已加载:', Object.keys(playersObject).length, '个玩家');
                console.log('🔍 玩家列表:', Object.keys(playersObject));
                
                // 如果刷新函数存在，则刷新现有选择器
                if (window.refreshExistingSelectors && typeof window.refreshExistingSelectors === 'function') {
                    window.refreshExistingSelectors();
                }
            } else {
                console.error('❌ 玩家数据格式错误:', data);
                playersData = {};
                window.playersData = {};
            }
        })
        .catch(error => {
            console.error('❌ 加载玩家数据失败:', error);
            playersData = {};
            window.playersData = {};
        });
}

// 将函数暴露到全局作用域
window.loadPlayers = loadPlayers;

// 加载数据书
function loadStories() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('stories-grid').style.display = 'none';
    document.getElementById('no-stories').style.display = 'none';
    
    fetch('/api/stories')
        .then(response => response.json())
        .then(data => {
            storiesData = data;
            updateTagFilter(data);
            filterAndDisplayStories();
            document.getElementById('loading').style.display = 'none';
        })
        .catch(error => {
            console.error('数据书典籍加载失败:', error);
            document.getElementById('loading').style.display = 'none';
            document.getElementById('no-stories').style.display = 'block';
            document.getElementById('no-stories').innerHTML = `
                <h3>❌ 加载失败</h3>
                <p>无法加载数据书典籍，请刷新页面重试</p>
            `;
        });
}

// 更新标签过滤器
function updateTagFilter(stories) {
    const tagFilter = document.getElementById('tag-filter');
    const allTags = new Set();
    
    Object.values(stories).forEach(story => {
        if (story.标签 && Array.isArray(story.标签)) {
            story.标签.forEach(tag => allTags.add(tag));
        }
    });
    
    // 清空现有选项（保留"所有标签"）
    tagFilter.innerHTML = '<option value="">所有标签</option>';
    
    // 添加所有标签选项
    Array.from(allTags).sort().forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        tagFilter.appendChild(option);
    });
}

// 过滤和显示数据书
function filterAndDisplayStories() {
    const searchTerm = document.getElementById('story-search').value.toLowerCase();
    const selectedTag = document.getElementById('tag-filter').value;
    const grid = document.getElementById('stories-grid');
    grid.innerHTML = '';
    
    const filteredStories = Object.keys(storiesData).filter(storyName => {
        const storyData = storiesData[storyName];
        
        // 搜索过滤
        const matchesSearch = !searchTerm || 
            storyName.toLowerCase().includes(searchTerm) ||
            (storyData.描述 && storyData.描述.toLowerCase().includes(searchTerm)) ||
            (storyData.总结词 && storyData.总结词.some(sw => sw.toLowerCase().includes(searchTerm)));
        
        // 标签过滤
        const matchesTag = !selectedTag || 
            (storyData.标签 && storyData.标签.includes(selectedTag));
        
        return matchesSearch && matchesTag;
    });
    
    if (filteredStories.length === 0) {
        document.getElementById('no-stories').style.display = 'block';
        document.getElementById('stories-grid').style.display = 'none';
        if (searchTerm || selectedTag) {
            document.getElementById('no-stories').innerHTML = `
                <h3>🔍 无匹配结果</h3>
                <p>没有找到符合条件的数据书</p>
            `;
        }
    } else {
        document.getElementById('no-stories').style.display = 'none';
        document.getElementById('stories-grid').style.display = 'grid';
        
        filteredStories.forEach(storyName => {
            const storyData = storiesData[storyName];
            const card = createStoryCard(storyName, storyData);
            grid.appendChild(card);
        });
    }
}

// 创建数据书卡片
function createStoryCard(storyName, storyData) {
    const card = document.createElement('div');
    card.className = 'story-card';
    card.onclick = (e) => {
        // 如果点击的是复选框、按钮或其父元素，不触发编辑面板
        if (e.target.type === 'checkbox' || 
            e.target.closest('.story-selection-checkbox') ||
            e.target.closest('.story-card-actions') ||
            e.target.classList.contains('story-action-btn') ||
            e.target.classList.contains('edit-btn') ||
            e.target.classList.contains('export-btn') ||
            e.target.classList.contains('delete-btn')) {
            return;
        }
        openEditPanel('story', storyName, storyData);
    };
    
    // 关键词功能已移除，不再显示关键词
    // const keywords = Array.isArray(storyData.关键词) ? storyData.关键词 : [];
    // const keywordsHtml = keywords.map(keyword => 
    //     `<span class="keyword">${keyword}</span>`
    // ).join('');
    
    // 安全处理标签数组，处理可能的字符串值
    let tags = [];
    if (Array.isArray(storyData.标签)) {
        tags = storyData.标签;
    } else if (typeof storyData.标签 === 'string' && storyData.标签 !== '(空数组)') {
        // 如果是字符串但不是"(空数组)"，尝试解析或作为单个标签处理
        tags = [storyData.标签];
    }
    const tagsHtml = tags.map(tag => 
        `<span class="tag">${tag}</span>`
    ).join('');
    
    
    // 动态生成属性HTML
    let attributesHtml = '';
    const attributes = storyData.属性 || {};
    const attributeKeys = Object.keys(attributes);
    
    if (attributeKeys.length > 0) {
        attributesHtml = `
            <div class="attributes-section">
                <div class="attributes-header" onclick="toggleAttributes(this, event)">
                    <span class="toggle-icon">▶</span>
                    <span>属性 (${attributeKeys.length})</span>
                </div>
                <div class="attributes-content collapsed">
                    ${Object.entries(attributes).map(([attrName, attrValue]) => {
                        if (typeof attrValue === 'object' && attrValue !== null) {
                            if (Array.isArray(attrValue)) {
                                // 如果是数组（事件属性），显示为列表
                                const items = attrValue.map(item => 
                                    `<div class="attr-item">• ${item}</div>`
                                ).join('');
                                return `<div class="attribute-section"><h4>${attrName}</h4>${items}</div>`;
                            } else {
                                // 如果是对象，显示为键值对列表
                                const items = Object.entries(attrValue).map(([key, value]) => 
                                    `<div class="attr-item"><strong>${key}:</strong> ${value}</div>`
                                ).join('');
                                return `<div class="attribute-section"><h4>${attrName}</h4>${items}</div>`;
                            }
                        } else {
                            // 如果是简单值，直接显示
                            return `<div class="attribute-section"><h4>${attrName}</h4><div class="attr-value">${attrValue}</div></div>`;
                        }
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    const description = storyData.描述 || '暂无描述';
    const createTime = storyData.创建时间 ? new Date(storyData.创建时间).toLocaleDateString('zh-CN') : '';
    const updateTime = storyData.更新时间 ? new Date(storyData.更新时间).toLocaleDateString('zh-CN') : '';
    
    card.innerHTML = `
        <div class="story-selection-checkbox">
            <input type="checkbox" class="story-checkbox" data-story-name="${storyName.replace(/"/g, '&quot;')}" onchange="updateSelectionCounter()" onclick="event.stopPropagation()">
        </div>
        <div class="story-card-actions">
            <button class="story-action-btn edit-btn" data-story-name="${storyName.replace(/"/g, '&quot;')}" title="编辑">✏️</button>
            <button class="story-action-btn export-btn" data-story-name="${storyName.replace(/"/g, '&quot;')}" title="导出">📤</button>
            <button class="story-action-btn delete-btn" data-story-name="${storyName.replace(/"/g, '&quot;')}" title="删除">🗑️</button>
        </div>
        <div class="story-header">
            <h3>${storyName}</h3>
            <div class="story-meta">
                ${createTime ? `<span class="create-time">创建: ${createTime}</span>` : ''}
                ${updateTime ? `<span class="update-time">更新: ${updateTime}</span>` : ''}
            </div>
        </div>
        <div class="story-description">${description}</div>
        <div class="tags-section">
            ${tagsHtml}
        </div>
        ${attributesHtml}
    `;
    
    // 添加按钮事件监听器
    const editBtn = card.querySelector('.edit-btn');
    const exportBtn = card.querySelector('.export-btn');
    const deleteBtn = card.querySelector('.delete-btn');
    
    if (editBtn) {
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditPanel('story', storyName, storyData);
        });
    }
    
    if (exportBtn) {
        exportBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            exportSingleStory(storyName);
        });
    }
    
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteStory(storyName);
        });
    }
    
    return card;
}

// 切换属性显示
function toggleAttributes(header, event) {
    event.stopPropagation(); // 阻止事件冒泡
    const content = header.nextElementSibling;
    const icon = header.querySelector('.toggle-icon');
    
    if (content.classList.contains('collapsed')) {
        content.classList.remove('collapsed');
        icon.textContent = '▼';
        icon.style.transform = 'rotate(90deg)';
    } else {
        content.classList.add('collapsed');
        icon.textContent = '▶';
        icon.style.transform = 'rotate(0deg)';
    }
}



// 显示创建数据书方式选择对话框
function showCreateStoryDialog() {
    const dialogHTML = `
        <div class="dialog-overlay" id="create-story-dialog">
            <div class="dialog-content" style="max-width: 500px;">
                <div class="dialog-header">
                    <h3>➕ 创建新数据书</h3>
                    <button class="dialog-close" onclick="closeCreateStoryDialog()">&times;</button>
                </div>
                <div class="dialog-body">
                    <p style="margin-bottom: 20px; color: var(--text-color); text-align: center;">
                        请选择创建数据书的方式：
                    </p>
                    <div style="display: flex; flex-direction: column; gap: 15px;">
                        <button class="create-option-btn manual-create-btn" onclick="createNewStoryManually()">
                            <div class="create-option-icon">✏️</div>
                            <div class="create-option-content">
                                <div class="create-option-title">手动创建</div>
                                <div class="create-option-desc">使用传统方式手动填写数据书内容</div>
                            </div>
                        </button>
                    </div>
                </div>
                <div class="dialog-footer">
                    <button class="dialog-btn cancel-btn" onclick="closeCreateStoryDialog()">取消</button>
                </div>
            </div>
        </div>
    `;
    
    // 添加对话框到页面
    document.body.insertAdjacentHTML('beforeend', dialogHTML);
}

// 关闭创建数据书选择对话框
function closeCreateStoryDialog() {
    const dialog = document.getElementById('create-story-dialog');
    if (dialog) {
        dialog.remove();
    }
}

// 手动创建数据书
function createNewStoryManually() {
    closeCreateStoryDialog();
    // 使用原有的手动创建逻辑
    createNewStory();
}




// 显示AI整理对话框
function showAIOrganizeDialog() {
    // 首先检查是否有数据书可以整理
    if (Object.keys(storiesData).length === 0) {
        showToast('⚠️ 没有数据书可以整理', 'warning');
        return;
    }
    
    const userInput = prompt('🤖 AI智能整理数据书\n请描述您想要如何整理数据书：\n例如：删除重复内容、合并相似条目、清理无用信息、给玩家增加道具、修改血量、增加攻击力等。 ');
    if (!userInput || userInput.trim() === '') {
        return;
    }
    
    showToast('🤖 AI正在使用Agent模式智能整理数据书...', 'info');
    
    // 调用AI整理API（现在默认使用Agent模式）
    fetch('/ai_new/organize_stories', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            instruction: userInput.trim()
        })
    })
    .then(response => {
        console.log('🔍 API响应详情:');
        console.log('  状态码:', response.status);
        console.log('  状态文本:', response.statusText);
        console.log('  URL:', response.url);
        console.log('  响应头:', Object.fromEntries(response.headers.entries()));
        
        // 详细错误日志
        if (!response.ok) {
            const errorInfo = `HTTP ${response.status} ${response.statusText}`;
            console.error('❌ API请求失败:', errorInfo);
            
            // 根据不同的HTTP状态码显示不同的错误信息
            let errorMessage = '';
            switch(response.status) {
                case 401:
                    errorMessage = `❌ AI整理失败: 用户未登录或会话已过期 (HTTP ${response.status})`;
                    break;
                case 404:
                    errorMessage = `❌ AI整理失败: API端点不存在 (HTTP ${response.status})\n请求URL: ${response.url}`;
                    break;
                case 500:
                    errorMessage = `❌ AI整理失败: 服务器内部错误 (HTTP ${response.status})`;
                    break;
                default:
                    errorMessage = `❌ AI整理失败: ${errorInfo}\n请求URL: ${response.url}`;
            }
            
            showToast(errorMessage, 'error');
            
            // 尝试解析错误响应体
            return response.text().then(text => {
                console.error('❌ 错误响应体:', text);
                alert(`详细错误信息:\n\n状态码: ${response.status} ${response.statusText}\nURL: ${response.url}\n响应内容: ${text}`);
                return null;
            });
        }
        
        return response.json();
    })
    .then(data => {
        if (!data) return; // 如果出错，data会是null
        
        console.log('📊 API响应数据:', data);
        
        if (data.success) {
            showToast('🎉 AI整理完成！', 'success');
            
            // 显示Agent模式的详细结果信息
            let resultMessage = `🤖 Agent模式整理完成！\n\n${data.summary}\n\n📊 统计信息：\n• 处理了 ${data.processed_count} 个数据书\n• 执行了 ${data.instructions_count} 条编辑指令\n• 预计修改 ${data.estimated_changes} 项内容\n• ⚡ 节约算力模式`;
            
            alert(resultMessage);
            // 刷新数据书列表
            loadStories();
        } else {
            // 处理业务逻辑错误
            console.error('❌ 业务逻辑错误:', data);
            const detailedError = `❌ AI整理失败:\n\n错误信息: ${data.error}\n需要登录: ${data.requires_login || '否'}\n完整响应: ${JSON.stringify(data, null, 2)}`;
            
            showToast('❌ AI整理失败: ' + data.error, 'error');
            alert(detailedError);
        }
    })
    .catch(error => {
        console.error('❌ 网络或解析错误:', error);
        console.error('❌ 错误堆栈:', error.stack);
        
        const detailedError = `❌ 请求失败详情:\n\n错误类型: ${error.name}\n错误信息: ${error.message}\n错误堆栈: ${error.stack}`;
        
        showToast('❌ 整理请求失败: ' + error.message, 'error');
        alert(detailedError);
    });
}

// 删除数据书
function deleteStory(storyName) {
    if (!confirm(`确定要删除数据书 "${storyName}" 吗？此操作不可撤销。`)) {
        return;
    }
    
    fetch(`/api/stories/${encodeURIComponent(storyName)}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast('数据书删除成功', 'success');
            loadStories(); // 重新加载列表
        } else {
            showToast('删除失败: ' + (data.error || '未知错误'), 'error');
        }
    })
    .catch(error => {
        console.error('删除失败:', error);
        showToast('删除失败: ' + error.message, 'error');
    });
}





// 导出单个数据书
function exportSingleStory(storyName) {
    const storyData = storiesData[storyName];
    if (!storyData) {
        showToast('数据书数据不存在', 'error');
        return;
    }
    
    // 创建下载链接
    const dataStr = JSON.stringify(storyData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${storyName}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 清理URL
    URL.revokeObjectURL(url);
    
    showToast(`数据书 "${storyName}" 导出成功`, 'success');
}

// 显示批量导出对话框
function showBatchExportDialog() {
    if (Object.keys(storiesData).length === 0) {
        showToast('⚠️ 没有数据书可以导出', 'warning');
        return;
    }
    
    // 创建对话框HTML
    const dialogHTML = `
        <div class="dialog-overlay" id="batch-export-dialog">
            <div class="dialog-content" style="max-width: 600px;">
                <div class="dialog-header">
                    <h3>📤 批量导出数据书</h3>
                    <button class="dialog-close" onclick="closeBatchExportDialog()">&times;</button>
                </div>
                <div class="dialog-body">
                    <div class="form-group">
                        <label>选择要导出的数据书：</label>
                        <!-- 搜索框 -->
                        <div style="margin: 10px 0;">
                            <input type="text" id="story-search-input" placeholder="🔍 搜索数据书..." 
                                   style="width: 100%; padding: 8px; border: 1px solid var(--border-gold); border-radius: 4px; background: var(--bg-dark); color: var(--text-light); margin-bottom: 10px;"
                                   oninput="filterStoriesInExportDialog()">
                        </div>
                        <div style="margin: 10px 0;">
                            <button type="button" onclick="selectAllStories()" class="dialog-btn" style="margin-right: 10px; padding: 5px 10px; font-size: 12px;">全选</button>
                            <button type="button" onclick="selectNoStories()" class="dialog-btn" style="padding: 5px 10px; font-size: 12px;">全不选</button>
                            <span id="story-count-info" style="margin-left: 15px; color: #888; font-size: 12px;"></span>
                        </div>
                        <div id="story-selection-list" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border-gold); border-radius: 4px; padding: 10px;">
                            ${Object.keys(storiesData).map(storyName => `
                                <div style="margin: 5px 0;">
                                    <label style="display: flex; align-items: center; cursor: pointer;">
                                        <input type="checkbox" class="story-export-checkbox" value="${storyName}" checked style="margin-right: 8px;">
                                        <span>${storyName}</span>
                                    </label>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>导出格式：</label>
                        <div style="margin: 5px 0;">
                            <label style="display: flex; align-items: center; margin: 5px 0; cursor: pointer;">
                                <input type="radio" name="export-format" value="individual" checked style="margin-right: 8px;">
                                <span>单独文件（每个数据书一个JSON文件）</span>
                            </label>
                            <label style="display: flex; align-items: center; margin: 5px 0; cursor: pointer;">
                                <input type="radio" name="export-format" value="combined" style="margin-right: 8px;">
                                <span>合并文件（所有数据书在一个JSON文件中）</span>
                            </label>
                        </div>
                    </div>
                </div>
                <div class="dialog-footer">
                    <button class="dialog-btn cancel-btn" onclick="closeBatchExportDialog()">取消</button>
                    <button class="dialog-btn confirm-btn" onclick="executeBatchExport()">📤 导出</button>
                </div>
            </div>
        </div>
    `;
    
    // 添加对话框到页面
    document.body.insertAdjacentHTML('beforeend', dialogHTML);
    
    // 初始化计数信息
    const totalCount = Object.keys(storiesData).length;
    document.getElementById('story-count-info').textContent = `共 ${totalCount} 个数据书`;
}

// 关闭批量导出对话框
function closeBatchExportDialog() {
    const dialog = document.getElementById('batch-export-dialog');
    if (dialog) {
        dialog.remove();
    }
}

// 全选数据书（只选择可见的）
function selectAllStories() {
    const checkboxes = document.querySelectorAll('.story-export-checkbox:not([style*="display: none"])');
    checkboxes.forEach(checkbox => {
        const parentDiv = checkbox.closest('div');
        if (parentDiv.style.display !== 'none') {
            checkbox.checked = true;
        }
    });
}

// 全不选数据书
function selectNoStories() {
    const checkboxes = document.querySelectorAll('.story-export-checkbox:not([style*="display: none"])');
    checkboxes.forEach(checkbox => checkbox.checked = false);
}

// 搜索过滤数据书
function filterStoriesInExportDialog() {
    const searchTerm = document.getElementById('story-search-input').value.toLowerCase();
    const storyItems = document.querySelectorAll('#story-selection-list > div');
    let visibleCount = 0;
    let totalCount = storyItems.length;
    
    storyItems.forEach(item => {
        const storyName = item.querySelector('span').textContent.toLowerCase();
        if (storyName.includes(searchTerm)) {
            item.style.display = '';
            visibleCount++;
        } else {
            item.style.display = 'none';
        }
    });
    
    // 更新计数信息
    const countInfo = document.getElementById('story-count-info');
    if (searchTerm) {
        countInfo.textContent = `显示 ${visibleCount} / ${totalCount} 个数据书`;
        countInfo.style.color = visibleCount > 0 ? '#4CAF50' : '#f44336';
    } else {
        countInfo.textContent = `共 ${totalCount} 个数据书`;
        countInfo.style.color = '#888';
    }
}

// 执行批量导出
function executeBatchExport() {
    const selectedCheckboxes = document.querySelectorAll('.story-export-checkbox:checked');
    const selectedStories = Array.from(selectedCheckboxes).map(cb => cb.value);
    
    if (selectedStories.length === 0) {
        showToast('⚠️ 请选择要导出的数据书', 'warning');
        return;
    }
    
    const exportFormat = document.querySelector('input[name="export-format"]:checked').value;
    
    closeBatchExportDialog();
    
    if (exportFormat === 'individual') {
        // 单独导出每个数据书
        selectedStories.forEach(storyName => {
            const storyData = storiesData[storyName];
            const dataStr = JSON.stringify(storyData, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `${storyName}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(url);
        });
        showToast(`成功导出 ${selectedStories.length} 个数据书`, 'success');
    } else {
        // 合并导出
        const combinedData = {};
        selectedStories.forEach(storyName => {
            combinedData[storyName] = storiesData[storyName];
        });
        
        const dataStr = JSON.stringify(combinedData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `数据书批量导出_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        showToast(`成功导出 ${selectedStories.length} 个数据书到合并文件`, 'success');
    }
}

// 显示导入对话框
function showImportDialog() {
    // 创建对话框HTML
    const dialogHTML = `
        <div class="dialog-overlay" id="import-dialog">
            <div class="dialog-content" style="max-width: 600px;">
                <div class="dialog-header">
                    <h3>📥 导入数据书</h3>
                    <button class="dialog-close" onclick="closeImportDialog()">&times;</button>
                </div>
                <div class="dialog-body">
                    <div class="form-group">
                        <label>选择导入文件：</label>
                        <input type="file" id="import-file" accept=".json" multiple style="width: 100%; padding: 8px; border: 1px solid var(--border-gold); border-radius: 4px; background: var(--input-bg); color: var(--text-color);">
                        <p style="font-size: 12px; color: #888; margin-top: 5px;">
                            支持单个JSON文件或多个JSON文件。文件应包含数据书数据。
                        </p>
                    </div>
                    
                    <div class="form-group">
                        <label>导入选项：</label>
                        <div style="margin: 5px 0;">
                            <label style="display: flex; align-items: center; margin: 5px 0; cursor: pointer;">
                                <input type="radio" name="import-mode" value="skip" checked style="margin-right: 8px;">
                                <span>跳过已存在的数据书</span>
                            </label>
                            <label style="display: flex; align-items: center; margin: 5px 0; cursor: pointer;">
                                <input type="radio" name="import-mode" value="overwrite" style="margin-right: 8px;">
                                <span>覆盖已存在的数据书</span>
                            </label>
                            <label style="display: flex; align-items: center; margin: 5px 0; cursor: pointer;">
                                <input type="radio" name="import-mode" value="rename" style="margin-right: 8px;">
                                <span>重命名冲突的数据书（添加后缀）</span>
                            </label>
                        </div>
                    </div>
                </div>
                <div class="dialog-footer">
                    <button class="dialog-btn cancel-btn" onclick="closeImportDialog()">取消</button>
                    <button class="dialog-btn confirm-btn" onclick="executeImport()">📥 导入</button>
                </div>
            </div>
        </div>
    `;
    
    // 添加对话框到页面
    document.body.insertAdjacentHTML('beforeend', dialogHTML);
}

// 关闭导入对话框
function closeImportDialog() {
    const dialog = document.getElementById('import-dialog');
    if (dialog) {
        dialog.remove();
    }
}

// 执行导入
function executeImport() {
    const fileInput = document.getElementById('import-file');
    const files = fileInput.files;
    
    if (files.length === 0) {
        showToast('⚠️ 请选择要导入的文件', 'warning');
        return;
    }
    
    const importMode = document.querySelector('input[name="import-mode"]:checked').value;
    
    closeImportDialog();
    showToast('正在导入数据书...', 'info');
    
    let processedFiles = 0;
    let allStoriesToImport = {};
    
    // 先读取所有文件，收集所有数据书数据
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const jsonData = JSON.parse(e.target.result);
                
                // 判断是单个数据书还是多个数据书的合并文件
                if (jsonData.总结词 !== undefined || jsonData.关键词 !== undefined || jsonData.属性 !== undefined) {
                    // 单个数据书文件
                    const storyName = file.name.replace('.json', '');
                    allStoriesToImport[storyName] = jsonData;
                } else {
                    // 多个数据书的合并文件
                    Object.assign(allStoriesToImport, jsonData);
                }
                
            } catch (error) {
                console.error('解析JSON文件失败:', file.name, error);
                showToast(`解析文件 "${file.name}" 失败: ${error.message}`, 'error');
            }
            
            processedFiles++;
            
            // 所有文件读取完成后，执行批量导入
            if (processedFiles === files.length) {
                if (Object.keys(allStoriesToImport).length === 0) {
                    showToast('❌ 没有找到有效的数据书数据', 'error');
                    return;
                }
                
                // 使用批量导入API
                fetch('/api/stories/batch_import', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        stories: allStoriesToImport,
                        import_mode: importMode
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        const results = data.results;
                        let message = `导入完成！总计: ${results.total}, 成功: ${results.success}`;
                        if (results.skipped > 0) message += `, 跳过: ${results.skipped}`;
                        if (results.errors > 0) message += `, 失败: ${results.errors}`;
                        
                        showToast(message, results.success > 0 ? 'success' : 'warning');
                        
                        // 如果有错误，显示详细信息
                        if (results.error_details && results.error_details.length > 0) {
                            console.error('导入错误详情:', results.error_details);
                        }
                        
                        // 刷新数据书列表
                        loadStories();
                    } else {
                        showToast('❌ 批量导入失败: ' + data.error, 'error');
                    }
                })
                .catch(error => {
                    console.error('批量导入失败:', error);
                    showToast('❌ 导入请求失败: ' + error.message, 'error');
                });
            }
        };
        
        reader.onerror = function() {
            console.error('读取文件失败:', file.name);
            showToast(`读取文件 "${file.name}" 失败`, 'error');
            processedFiles++;
        };
        
        reader.readAsText(file);
    });
}

// 显示事件管理器对话框
function showEventCleanupDialog() {
    window.open('/event_manager', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
}

// 选择控制函数
function updateSelectionCounter() {
    const selectedCheckboxes = document.querySelectorAll('.story-checkbox:checked');
    const counter = document.getElementById('selection-counter');
    const exportBtn = document.querySelector('.export-selected-btn');
    const aiOrganizeBtn = document.querySelector('.ai-organize-selected-btn');
    
    const count = selectedCheckboxes.length;
    counter.textContent = `已选择: ${count}`;
    
    // 根据选择数量启用/禁用按钮
    if (exportBtn) {
        exportBtn.disabled = count === 0;
        exportBtn.style.opacity = count === 0 ? '0.5' : '1';
    }
    
    if (aiOrganizeBtn) {
        aiOrganizeBtn.disabled = count === 0;
        aiOrganizeBtn.style.opacity = count === 0 ? '0.5' : '1';
    }
}

function selectAllVisibleStories() {
    const visibleCheckboxes = document.querySelectorAll('.story-card:not([style*="display: none"]) .story-checkbox');
    visibleCheckboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
    updateSelectionCounter();
}

function invertSelection() {
    const visibleCheckboxes = document.querySelectorAll('.story-card:not([style*="display: none"]) .story-checkbox');
    visibleCheckboxes.forEach(checkbox => {
        checkbox.checked = !checkbox.checked;
    });
    updateSelectionCounter();
}

function clearSelection() {
    const allCheckboxes = document.querySelectorAll('.story-checkbox');
    allCheckboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    updateSelectionCounter();
}

function exportSelectedStories() {
    const selectedCheckboxes = document.querySelectorAll('.story-checkbox:checked');
    const selectedStories = Array.from(selectedCheckboxes).map(cb => cb.getAttribute('data-story-name'));
    
    if (selectedStories.length === 0) {
        showToast('⚠️ 请先选择要导出的数据书', 'warning');
        return;
    }
    
    // 显示导出选项对话框
    showExportSelectedDialog(selectedStories);
}

function showExportSelectedDialog(selectedStories) {
    const dialogHTML = `
        <div class="dialog-overlay" id="export-selected-dialog">
            <div class="dialog-content" style="max-width: 500px;">
                <div class="dialog-header">
                    <h3>📤 导出选中的数据书</h3>
                    <button class="dialog-close" onclick="closeExportSelectedDialog()">&times;</button>
                </div>
                <div class="dialog-body">
                    <div class="form-group">
                        <p>将导出以下 <strong>${selectedStories.length}</strong> 个数据书：</p>
                        <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--border-gold); border-radius: 4px; padding: 10px; margin: 10px 0;">
                            ${selectedStories.map(name => `<div style="margin: 2px 0;">• ${name}</div>`).join('')}
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>导出格式：</label>
                        <div style="margin: 5px 0;">
                            <label style="display: flex; align-items: center; margin: 5px 0; cursor: pointer;">
                                <input type="radio" name="selected-export-format" value="individual" checked style="margin-right: 8px;">
                                <span>单独文件（每个数据书一个JSON文件）</span>
                            </label>
                            <label style="display: flex; align-items: center; margin: 5px 0; cursor: pointer;">
                                <input type="radio" name="selected-export-format" value="combined" style="margin-right: 8px;">
                                <span>合并文件（所有数据书在一个JSON文件中）</span>
                            </label>
                        </div>
                    </div>
                </div>
                <div class="dialog-footer">
                    <button class="dialog-btn cancel-btn" onclick="closeExportSelectedDialog()">取消</button>
                    <button class="dialog-btn confirm-btn" onclick="executeSelectedExport()">📤 导出</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', dialogHTML);
}

function closeExportSelectedDialog() {
    const dialog = document.getElementById('export-selected-dialog');
    if (dialog) {
        dialog.remove();
    }
}

function executeSelectedExport() {
    const selectedCheckboxes = document.querySelectorAll('.story-checkbox:checked');
    const selectedStories = Array.from(selectedCheckboxes).map(cb => cb.getAttribute('data-story-name'));
    const exportFormat = document.querySelector('input[name="selected-export-format"]:checked').value;
    
    closeExportSelectedDialog();
    
    if (exportFormat === 'individual') {
        // 单独导出每个数据书
        selectedStories.forEach(storyName => {
            const storyData = storiesData[storyName];
            if (storyData) {
                const dataStr = JSON.stringify(storyData, null, 2);
                const dataBlob = new Blob([dataStr], {type: 'application/json'});
                const url = URL.createObjectURL(dataBlob);
                
                const link = document.createElement('a');
                link.href = url;
                link.download = `${storyName}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                URL.revokeObjectURL(url);
            }
        });
        showToast(`成功导出 ${selectedStories.length} 个数据书`, 'success');
    } else {
        // 合并导出
        const combinedData = {};
        selectedStories.forEach(storyName => {
            if (storiesData[storyName]) {
                combinedData[storyName] = storiesData[storyName];
            }
        });
        
        const dataStr = JSON.stringify(combinedData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `选中数据书导出_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        showToast(`成功导出 ${selectedStories.length} 个数据书到合并文件`, 'success');
    }
    
    // 清空选择
    clearSelection();
}

// AI整理选中数据书功能
function showAIOrganizeSelectedDialog() {
    const selectedCheckboxes = document.querySelectorAll('.story-checkbox:checked');
    const selectedStories = Array.from(selectedCheckboxes).map(cb => cb.getAttribute('data-story-name'));
    
    if (selectedStories.length === 0) {
        showToast('⚠️ 请先选择要整理的数据书', 'warning');
        return;
    }
    
    const dialogHTML = `
        <div class="dialog-overlay" id="ai-organize-selected-dialog">
            <div class="dialog-content" style="max-width: 600px;">
                <div class="dialog-header">
                    <h3>🤖 AI智能整理选中数据书</h3>
                    <button class="dialog-close" onclick="closeAIOrganizeSelectedDialog()">&times;</button>
                </div>
                <div class="dialog-body">
                    <div class="form-group">
                        <p>将对以下 <strong>${selectedStories.length}</strong> 个数据书进行AI智能整理：</p>
                        <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--border-gold); border-radius: 4px; padding: 10px; margin: 10px 0; background: rgba(0,0,0,0.2);">
                            ${selectedStories.map(name => `<div style="margin: 3px 0; color: var(--text-gold);">📚 ${name}</div>`).join('')}
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="organize-instruction-selected">整理指令：</label>
                        <textarea id="organize-instruction-selected" rows="4" placeholder="请描述您想要如何整理这些数据书：&#10;例如：删除重复内容、合并相似条目、清理无用信息、优化结构、标准化格式等" 
                                  style="width: 100%; padding: 8px; border: 1px solid var(--border-gold); border-radius: 4px; background: var(--input-bg); color: var(--text-color); resize: vertical; font-family: 'Crimson Text', serif;"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <div style="background: rgba(255, 165, 0, 0.1); border: 1px solid #FFA500; border-radius: 6px; padding: 12px; margin: 10px 0;">
                            <div style="color: #FFA500; font-weight: bold; margin-bottom: 8px;">🤖 利用AI模型整理数据书</div>
                            <div style="font-size: 0.9em; color: var(--text-color); line-height: 1.4;">
                                你可以使用指令进行修改数据书的一些部分<br>
                                比如为商店增加价目表 删除多余事件 等
                            </div>
                        </div>
                    </div>
                </div>
                <div class="dialog-footer">
                    <button class="dialog-btn cancel-btn" onclick="closeAIOrganizeSelectedDialog()">取消</button>
                    <button class="dialog-btn confirm-btn" onclick="executeAIOrganizeSelected()">🤖 开始整理</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', dialogHTML);
}

function closeAIOrganizeSelectedDialog() {
    const dialog = document.getElementById('ai-organize-selected-dialog');
    if (dialog) {
        dialog.remove();
    }
}

function executeAIOrganizeSelected() {
    const selectedCheckboxes = document.querySelectorAll('.story-checkbox:checked');
    const selectedStories = Array.from(selectedCheckboxes).map(cb => cb.getAttribute('data-story-name'));
    const organizeInstruction = document.getElementById('organize-instruction-selected').value.trim();
    
    if (!organizeInstruction) {
        showToast('⚠️ 请输入整理指令', 'warning');
        return;
    }
    
    closeAIOrganizeSelectedDialog();
    showToast(`🤖 AI正在使用Agent模式智能整理选中的 ${selectedStories.length} 个数据书...`, 'info');
    
    // 调用AI整理API，传递选中的数据书列表
    fetch('/ai_new/organize_stories', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            instruction: organizeInstruction,
            target_stories: selectedStories  // 新增：指定要整理的数据书
        })
    })
    .then(response => {
        console.log('🔍 AI整理选中数据书 - API响应详情:');
        console.log('  状态码:', response.status);
        console.log('  状态文本:', response.statusText);
        console.log('  URL:', response.url);
        
        if (!response.ok) {
            const errorInfo = `HTTP ${response.status} ${response.statusText}`;
            console.error('❌ API请求失败:', errorInfo);
            
            let errorMessage = '';
            switch(response.status) {
                case 401:
                    errorMessage = `❌ AI整理失败: 用户未登录或会话已过期 (HTTP ${response.status})`;
                    break;
                case 404:
                    errorMessage = `❌ AI整理失败: API端点不存在 (HTTP ${response.status})`;
                    break;
                case 500:
                    errorMessage = `❌ AI整理失败: 服务器内部错误 (HTTP ${response.status})`;
                    break;
                default:
                    errorMessage = `❌ AI整理失败: ${errorInfo}`;
            }
            
            showToast(errorMessage, 'error');
            return response.text().then(text => {
                console.error('❌ 错误响应体:', text);
                return null;
            });
        }
        
        return response.json();
    })
    .then(data => {
        if (!data) return;
        
        console.log('📊 AI整理选中数据书 - API响应数据:', data);
        
        if (data.success) {
            showToast('🎉 AI整理完成！', 'success');
            
            let resultMessage = `🤖 Agent模式整理完成！\n\n${data.summary}\n\n📊 统计信息：\n• 处理了选中的 ${selectedStories.length} 个数据书\n• 执行了 ${data.instructions_count} 条编辑指令\n• 预计修改 ${data.estimated_changes} 项内容\n• ⚡ 节约算力模式 - 精准整理`;
            
            alert(resultMessage);
            
            // 刷新数据书列表
            loadStories();
            
            // 清空选择
            clearSelection();
        } else {
            console.error('❌ 业务逻辑错误:', data);
            showToast('❌ AI整理失败: ' + data.error, 'error');
        }
    })
    .catch(error => {
        console.error('❌ 网络或解析错误:', error);
        showToast('❌ 整理请求失败: ' + error.message, 'error');
    });
}

// 显示提示消息
function showToast(message, type = 'info', duration = 3000) {
    // 创建提示元素
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#2196F3'};
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        z-index: 10000;
        font-family: 'Crimson Text', serif;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        max-width: 300px;
        word-wrap: break-word;
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // 自动移除
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, duration);
}
