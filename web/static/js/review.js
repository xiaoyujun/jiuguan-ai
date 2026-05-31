// 回顾页面脚本
document.addEventListener('DOMContentLoaded', function() {
    // 元素引用
    const searchInput = document.getElementById('search-input');
    const roleFilter = document.getElementById('role-filter');
    const memoriesGrid = document.getElementById('memories-grid');
    const emptyState = document.getElementById('empty-state');
    const loadingDiv = document.getElementById('loading');
    const detailModal = document.getElementById('detail-modal');
    
    let allMemories = [];
    let currentMemory = null;
    
    // 初始化
    loadRoles();
    loadMemories();
    
    // 搜索输入
    searchInput.addEventListener('input', debounce(filterMemories, 300));
    
    // 角色过滤
    roleFilter.addEventListener('change', filterMemories);
    
    // 加载角色列表
    async function loadRoles() {
        try {
            const response = await fetch('/memories/api/roles');
            const data = await response.json();
            
            if (data.success) {
                data.roles.forEach(role => {
                    const option = document.createElement('option');
                    option.value = role;
                    option.textContent = role;
                    roleFilter.appendChild(option);
                });
            }
        } catch (error) {
            console.error('加载角色列表失败:', error);
        }
    }
    
    // 加载纪念列表
    async function loadMemories() {
        try {
            loadingDiv.style.display = 'block';
            memoriesGrid.style.display = 'none';
            emptyState.style.display = 'none';
            
            const response = await fetch('/memories/api/list');
            const data = await response.json();
            
            if (data.success) {
                allMemories = data.memories;
                displayMemories(allMemories);
            }
        } catch (error) {
            console.error('加载纪念列表失败:', error);
            alert('加载失败，请刷新页面重试');
        } finally {
            loadingDiv.style.display = 'none';
        }
    }
    
    // 显示纪念列表
    function displayMemories(memories) {
        memoriesGrid.innerHTML = '';
        
        if (memories.length === 0) {
            memoriesGrid.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }
        
        memoriesGrid.style.display = 'grid';
        emptyState.style.display = 'none';
        
        memories.forEach(memory => {
            const card = createMemoryCard(memory);
            memoriesGrid.appendChild(card);
        });
    }
    
    // 创建纪念卡片
    function createMemoryCard(memory) {
        const card = document.createElement('div');
        card.className = 'memory-card';
        card.onclick = () => showMemoryDetail(memory.id);
        
        const imageHtml = memory.image 
            ? `<img src="/memories/images/${memory.image}" alt="${memory.title}" class="memory-image">`
            : `<div class="memory-image-placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
               </div>`;
        
        const description = memory.description || '暂无描述';
        const time = formatDate(memory.created_at);
        
        card.innerHTML = `
            ${imageHtml}
            <div class="memory-content">
                <h3 class="memory-title">${escapeHtml(memory.title)}</h3>
                <p class="memory-description">${escapeHtml(description)}</p>
                <div class="memory-meta">
                    <span class="memory-role">${escapeHtml(memory.role_name)}</span>
                    <span class="memory-time">${time}</span>
                </div>
            </div>
        `;
        
        return card;
    }
    
    // 过滤纪念
    function filterMemories() {
        const keyword = searchInput.value.trim().toLowerCase();
        const role = roleFilter.value;
        
        let filtered = allMemories;
        
        if (role) {
            filtered = filtered.filter(m => m.role_name === role);
        }
        
        if (keyword) {
            filtered = filtered.filter(m => {
                const title = m.title.toLowerCase();
                const desc = (m.description || '').toLowerCase();
                return title.includes(keyword) || desc.includes(keyword);
            });
        }
        
        displayMemories(filtered);
    }
    
    // 显示纪念详情
    async function showMemoryDetail(memoryId) {
        try {
            const response = await fetch(`/memories/api/get/${memoryId}`);
            const data = await response.json();
            
            if (data.success) {
                currentMemory = data.memory;
                renderMemoryDetail(currentMemory);
                detailModal.style.display = 'flex';
            }
        } catch (error) {
            console.error('加载纪念详情失败:', error);
            alert('加载失败');
        }
    }
    
    // 渲染纪念详情
    function renderMemoryDetail(memory) {
        document.getElementById('modal-title').textContent = memory.title;
        document.getElementById('modal-role').textContent = memory.role_name;
        document.getElementById('modal-time').textContent = formatDate(memory.created_at);
        document.getElementById('modal-count').textContent = `${memory.message_count} 条`;
        
        // 图片
        const imageContainer = document.getElementById('modal-image-container');
        const modalImage = document.getElementById('modal-image');
        if (memory.image) {
            modalImage.src = `/memories/images/${memory.image}`;
            imageContainer.style.display = 'block';
        } else {
            imageContainer.style.display = 'none';
        }
        
        // 描述
        const descDiv = document.getElementById('modal-description');
        if (memory.description) {
            descDiv.textContent = memory.description;
            descDiv.style.display = 'block';
        } else {
            descDiv.style.display = 'none';
        }
        
        // 消息列表
        const messagesDiv = document.getElementById('modal-messages');
        messagesDiv.innerHTML = '';
        
        if (memory.messages && memory.messages.length > 0) {
            memory.messages.forEach(msg => {
                const msgDiv = document.createElement('div');
                msgDiv.className = 'message-item';
                
                // 处理不同格式的消息
                let roleName = '';
                let content = '';
                let roleClass = '';
                
                if (typeof msg === 'string') {
                    // 字符串格式: "角色名: 内容"
                    const colonIndex = msg.indexOf(':');
                    if (colonIndex > 0) {
                        roleName = msg.substring(0, colonIndex).trim();
                        content = msg.substring(colonIndex + 1).trim();
                    } else {
                        roleName = '系统';
                        content = msg;
                    }
                    // 判断是否为玩家消息（检查角色名是否匹配玩家名）
                    roleClass = roleName === memory.role_name ? '' : 'user';
                } else if (typeof msg === 'object') {
                    // 对象格式: {role: '...', content: '...'}
                    roleClass = msg.role === 'user' ? 'user' : (msg.role === 'system' ? 'system' : '');
                    roleName = msg.role === 'user' ? '玩家' : (msg.role === 'system' ? '系统' : msg.role);
                    content = msg.content || '';
                }
                
                msgDiv.innerHTML = `
                    <div class="message-role ${roleClass}">${escapeHtml(roleName)}</div>
                    <div class="message-content">${escapeHtml(content)}</div>
                `;
                
                messagesDiv.appendChild(msgDiv);
            });
        } else {
            messagesDiv.innerHTML = '<p style="text-align: center; color: #657786;">暂无消息记录</p>';
        }
        
        // 绑定按钮事件
        document.getElementById('delete-btn').onclick = () => deleteMemory(memory.id);
        document.getElementById('restore-btn').onclick = () => restoreMemory(memory.id);
    }
    
    // 删除纪念
    async function deleteMemory(memoryId) {
        if (!confirm('确定要删除这个纪念吗？此操作不可恢复。')) {
            return;
        }
        
        try {
            const response = await fetch(`/memories/api/delete/${memoryId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('删除成功');
                closeDetailModal();
                loadMemories();
            } else {
                throw new Error(data.error || '删除失败');
            }
        } catch (error) {
            console.error('删除失败:', error);
            alert('删除失败: ' + error.message);
        }
    }
    
    // 还原场景
    async function restoreMemory(memoryId) {
        if (!confirm('确定要将这个纪念的聊天记录还原到当前对话吗？')) {
            return;
        }
        
        try {
            const response = await fetch(`/memories/api/restore/${memoryId}`, {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert(`场景已还原！共恢复 ${data.restored_count} 条消息到 ${data.role_name} 的聊天记录中。`);
                closeDetailModal();
            } else {
                throw new Error(data.error || '还原失败');
            }
        } catch (error) {
            console.error('还原失败:', error);
            alert('还原失败: ' + error.message);
        }
    }
    
    // 工具函数
    function formatDate(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 60) {
            return `${minutes} 分钟前`;
        } else if (hours < 24) {
            return `${hours} 小时前`;
        } else if (days < 7) {
            return `${days} 天前`;
        } else {
            return date.toLocaleDateString('zh-CN');
        }
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
    
    // 导出全局函数供HTML使用
    window.closeDetailModal = function() {
        detailModal.style.display = 'none';
        currentMemory = null;
    };
});
