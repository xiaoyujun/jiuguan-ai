// 纪念创建页面脚本
document.addEventListener('DOMContentLoaded', function() {
    // 元素引用
    const roleSelect = document.getElementById('role-select');
    const messageCountSlider = document.getElementById('message-count');
    const sliderValue = document.querySelector('.slider-value');
    const imageUploadArea = document.getElementById('image-upload-area');
    const imageUpload = document.getElementById('image-upload');
    const imagePreview = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');
    const removeImageBtn = document.getElementById('remove-image');
    const createBtn = document.getElementById('create-btn');
    const loadingDiv = document.getElementById('loading');
    
    let selectedFile = null;
    
    // 从URL参数获取初始值
    const urlParams = new URLSearchParams(window.location.search);
    const initialRole = urlParams.get('role');
    const initialCount = urlParams.get('count');
    
    // 加载角色列表
    loadRoles(initialRole);
    
    // 设置初始消息数量
    if (initialCount && !isNaN(initialCount)) {
        const count = parseInt(initialCount);
        if (count >= 1 && count <= 50) {
            messageCountSlider.value = count;
            sliderValue.textContent = count;
        }
    }
    
    // 滑块值更新
    messageCountSlider.addEventListener('input', function() {
        sliderValue.textContent = this.value;
    });
    
    // 图片上传区域点击
    imageUploadArea.addEventListener('click', function(e) {
        if (!e.target.classList.contains('remove-image')) {
            imageUpload.click();
        }
    });
    
    // 图片选择
    imageUpload.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                alert('请选择图片文件');
                return;
            }
            
            if (file.size > 10 * 1024 * 1024) {
                alert('图片大小不能超过10MB');
                return;
            }
            
            selectedFile = file;
            
            // 显示预览
            const reader = new FileReader();
            reader.onload = function(e) {
                previewImg.src = e.target.result;
                imageUploadArea.querySelector('.upload-placeholder').style.display = 'none';
                imagePreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });
    
    // 移除图片
    removeImageBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        selectedFile = null;
        imageUpload.value = '';
        previewImg.src = '';
        imagePreview.style.display = 'none';
        imageUploadArea.querySelector('.upload-placeholder').style.display = 'block';
    });
    
    // 创建纪念
    createBtn.addEventListener('click', createMemory);
    
    // 加载角色列表
    async function loadRoles(preselectedRole = null) {
        try {
            const response = await fetch('/memories/api/roles');
            const data = await response.json();
            
            if (data.success) {
                roleSelect.innerHTML = '<option value="">-- 请选择角色 --</option>';
                data.roles.forEach(role => {
                    const option = document.createElement('option');
                    option.value = role;
                    option.textContent = role;
                    // 如果有预选角色且匹配，则选中
                    if (preselectedRole && role === preselectedRole) {
                        option.selected = true;
                    }
                    roleSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('加载角色列表失败:', error);
            alert('加载角色列表失败，请刷新页面重试');
        }
    }
    
    // 创建纪念
    async function createMemory() {
        const title = document.getElementById('title').value.trim();
        const roleName = roleSelect.value;
        const messageCount = messageCountSlider.value;
        const description = document.getElementById('description').value.trim();
        
        if (!title) {
            alert('请输入纪念标题');
            return;
        }
        
        if (!roleName) {
            alert('请选择角色');
            return;
        }
        
        // 显示加载状态
        createBtn.disabled = true;
        loadingDiv.style.display = 'block';
        document.querySelector('.memory-form').style.opacity = '0.5';
        
        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('role_name', roleName);
            formData.append('message_count', messageCount);
            formData.append('description', description);
            
            if (selectedFile) {
                formData.append('image', selectedFile);
            }
            
            const response = await fetch('/memories/api/create', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('纪念创建成功！');
                // 清空表单
                document.getElementById('title').value = '';
                document.getElementById('description').value = '';
                roleSelect.value = '';
                messageCountSlider.value = 5;
                sliderValue.textContent = '5';
                if (selectedFile) {
                    removeImageBtn.click();
                }
                
                // 跳转到回顾页面
                window.location.href = '/memories/review';
            } else {
                throw new Error(data.error || '创建失败');
            }
        } catch (error) {
            console.error('创建纪念失败:', error);
            alert('创建失败: ' + error.message);
        } finally {
            createBtn.disabled = false;
            loadingDiv.style.display = 'none';
            document.querySelector('.memory-form').style.opacity = '1';
        }
    }
});
