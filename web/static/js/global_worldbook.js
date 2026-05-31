/**
 * 全局世界书页面JavaScript功能
 */

let worldbookData = {};
let currentEditingEntry = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    loadWorldbookEntries();
});

/**
 * 加载全局世界书条目
 */
function loadWorldbookEntries() {
    fetch('/api/global_worldbook')
        .then(response => response.json())
        .then(data => {
            worldbookData = data;
            renderEntries();
        })
        .catch(error => {
            console.error('加载全局世界书条目失败:', error);
            showError('加载条目失败: ' + error.message);
        });
}

/**
 * 渲染条目列表
 */
function renderEntries() {
    const grid = document.getElementById('entries-grid');
    
    if (Object.keys(worldbookData).length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <h3>暂无世界书条目</h3>
                <p>点击"创建新条目"开始记录世界的奥秘</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = '';
    
    Object.keys(worldbookData).forEach(entryName => {
        const entryData = worldbookData[entryName];
        const card = createEntryCard(entryName, entryData);
        grid.appendChild(card);
    });
}

/**
 * 创建条目卡片
 */
function createEntryCard(entryName, entryData) {
    const card = document.createElement('div');
    card.className = 'entry-card';
    card.onclick = () => editEntry(entryName, entryData);
    
    const title = entryData.名字 || entryName;
    const description = entryData.介绍 || '暂无介绍';
    
    card.innerHTML = `
        <div class="entry-title">${escapeHtml(title)}</div>
        <div class="entry-description">${escapeHtml(description)}</div>
        <div class="entry-actions">
            <button class="btn-danger" onclick="event.stopPropagation(); confirmDeleteEntry('${entryName}')">
                删除
            </button>
        </div>
    `;
    
    return card;
}

/**
 * 创建新条目
 */
function createNewEntry() {
    currentEditingEntry = null;
    
    document.getElementById('modal-title').textContent = '创建新条目';
    document.getElementById('entry-name').value = '';
    document.getElementById('entry-description').value = '';
    document.getElementById('delete-btn').style.display = 'none';
    
    showEditModal();
}

/**
 * 编辑条目
 */
function editEntry(entryName, entryData) {
    currentEditingEntry = entryName;
    
    document.getElementById('modal-title').textContent = '编辑条目';
    document.getElementById('entry-name').value = entryData.名字 || entryName;
    document.getElementById('entry-description').value = entryData.介绍 || '';
    document.getElementById('delete-btn').style.display = 'inline-block';
    
    showEditModal();
}

/**
 * 保存条目
 */
function saveEntry() {
    const entryName = document.getElementById('entry-name').value.trim();
    const entryDescription = document.getElementById('entry-description').value.trim();
    
    if (!entryName) {
        showError('条目名称不能为空');
        return;
    }
    
    const entryData = {
        entry_name: entryName,
        介绍: entryDescription
    };
    
    let url, method;
    
    if (currentEditingEntry) {
        // 更新现有条目
        url = `/api/global_worldbook/${encodeURIComponent(currentEditingEntry)}`;
        method = 'PUT';
        entryData.名字 = entryName;
    } else {
        // 创建新条目
        url = '/api/global_worldbook';
        method = 'POST';
    }
    
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(entryData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            closeEditModal();
            loadWorldbookEntries();
            showSuccess(currentEditingEntry ? '条目更新成功' : '条目创建成功');
        } else {
            showError(data.error || '保存失败');
        }
    })
    .catch(error => {
        console.error('保存条目失败:', error);
        showError('保存失败: ' + error.message);
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
function confirmDelete() {
    if (!currentEditingEntry) return;
    
    fetch(`/api/global_worldbook/${encodeURIComponent(currentEditingEntry)}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            closeConfirmModal();
            loadWorldbookEntries();
            showSuccess('条目删除成功');
        } else {
            showError(data.error || '删除失败');
        }
    })
    .catch(error => {
        console.error('删除条目失败:', error);
        showError('删除失败: ' + error.message);
    });
}

/**
 * 显示编辑模态框
 */
function showEditModal() {
    document.getElementById('edit-modal').style.display = 'block';
    document.getElementById('entry-name').focus();
}

/**
 * 关闭编辑模态框
 */
function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
    currentEditingEntry = null;
}

/**
 * 显示确认删除模态框
 */
function showConfirmModal() {
    document.getElementById('confirm-modal').style.display = 'block';
}

/**
 * 关闭确认删除模态框
 */
function closeConfirmModal() {
    document.getElementById('confirm-modal').style.display = 'none';
    currentEditingEntry = null;
}

/**
 * 显示成功消息
 */
function showSuccess(message) {
    // 简单的成功提示，可以后续扩展为更好的通知系统
    alert(message);
}

/**
 * 显示错误消息
 */
function showError(message) {
    // 简单的错误提示，可以后续扩展为更好的通知系统
    alert('错误: ' + message);
}

/**
 * HTML转义函数
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 点击模态框外部关闭模态框
window.onclick = function(event) {
    const editModal = document.getElementById('edit-modal');
    const confirmModal = document.getElementById('confirm-modal');
    
    if (event.target === editModal) {
        closeEditModal();
    }
    
    if (event.target === confirmModal) {
        closeConfirmModal();
    }
}

// 键盘快捷键
document.addEventListener('keydown', function(event) {
    // ESC键关闭模态框
    if (event.key === 'Escape') {
        closeEditModal();
        closeConfirmModal();
    }
    
    // Ctrl+S保存（在编辑模态框中）
    if (event.ctrlKey && event.key === 's') {
        const editModal = document.getElementById('edit-modal');
        if (editModal.style.display === 'block') {
            event.preventDefault();
            saveEntry();
        }
    }
});
