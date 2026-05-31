/**
 * 角色导入功能模块 - 统一的角色导入解决方案
 * 整合了图片导入、酒馆角色卡导入等功能
 * 位于 character_features 文件夹中，避免功能分散
 */

class CharacterImporter {
    constructor(characterManagement) {
        this.characterManagement = characterManagement;
        this.importFiles = [];
        this.selectedFiles = new Set(); // 记录选中的文件索引
        this.tavernCardImporter = null;
        
        this.init();
    }

    init() {
        this.setupImportModalEvents();
        
        // 初始化酒馆角色卡导入器
        if (window.TavernCardImporter) {
            this.tavernCardImporter = new window.TavernCardImporter(this.characterManagement);
        }
        
        console.log('CharacterImporter: 初始化完成');
    }

    /**
     * 设置导入模态框事件
     */
    setupImportModalEvents() {
        const importModal = document.getElementById('import-modal');
        const closeImportBtn = document.getElementById('close-import-modal-btn');
        const importCancelBtn = document.getElementById('import-cancel-btn');
        const selectImagesBtn = document.getElementById('select-import-images-btn');
        const imageInput = document.getElementById('import-image-input');
        const importConfirmBtn = document.getElementById('import-confirm-btn');

        if (!importModal) {
            console.warn('CharacterImporter: 导入模态框未找到');
            return;
        }

        // 关闭按钮事件
        [closeImportBtn, importCancelBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => {
                    this.closeImportModal();
                });
            }
        });

        // 点击模态框外部关闭
        if (importModal) {
            importModal.addEventListener('click', (e) => {
                if (e.target === importModal) {
                    this.closeImportModal();
                }
            });
        }

        // 导入标签页切换
        document.querySelectorAll('.import-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchImportTab(e.target.dataset.tab);
            });
        });

        // 图片选择和导入
        if (selectImagesBtn && imageInput) {
            selectImagesBtn.addEventListener('click', () => {
                imageInput.click();
            });

            imageInput.addEventListener('change', (e) => {
                this.handleImportImages(e.target.files);
            });
        }

        // 批量选择按钮事件
        const selectAllBtn = document.getElementById('select-all-images-btn');
        const deselectAllBtn = document.getElementById('deselect-all-images-btn');
        
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                this.selectAllFiles();
            });
        }
        
        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', () => {
                this.deselectAllFiles();
            });
        }

        // 确认导入按钮
        if (importConfirmBtn) {
            importConfirmBtn.addEventListener('click', () => {
                this.importCharacters();
            });
        }

        // 导入成功后不再需要额外的事件绑定
    }

    /**
     * 打开导入模态框
     */
    openImportModal() {
        const importModal = document.getElementById('import-modal');
        if (importModal) {
            importModal.style.display = 'block';
            this.clearImportFiles();
        }
    }

    /**
     * 关闭导入模态框
     */
    closeImportModal() {
        const importModal = document.getElementById('import-modal');
        if (importModal) {
            importModal.style.display = 'none';
            this.clearImportFiles();
        }
    }

    /**
     * 清理导入文件列表
     */
    clearImportFiles() {
        this.importFiles = [];
        this.selectedFiles.clear();
        const filesList = document.getElementById('import-images-list');
        const confirmBtn = document.getElementById('import-confirm-btn');
        
        if (filesList) filesList.innerHTML = '';
        if (confirmBtn) confirmBtn.disabled = true;
        
        // 隐藏批量选择按钮和信息
        this.hideBatchControls();
        
        // 清理描述生成数据卡表单
        this.clearDescriptionForm();
    }

    /**
     * 清理描述表单
     */
    clearDescriptionForm() {
        if (this.characterManagement && this.characterManagement.descriptionGenerator) {
            this.characterManagement.descriptionGenerator.resetForm();
        } else {
            // 手动清理表单元素
            const elementsToReset = [
                'character-name-input',
                'character-description-input',
                'clear-description-checkbox',
                'generation-progress',
                'generation-result'
            ];

            elementsToReset.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    if (element.type === 'checkbox') {
                        element.checked = true;
                    } else if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                        element.value = '';
                    } else {
                        element.style.display = 'none';
                    }
                }
            });
        }
    }

    /**
     * 移除指定的导入文件
     */
    removeImportFile(index) {
        // 移除文件
        this.importFiles.splice(index, 1);
        
        // 更新选中文件的索引（移除被删除的，后面的索引前移）
        const newSelectedFiles = new Set();
        for (const selectedIndex of this.selectedFiles) {
            if (selectedIndex < index) {
                newSelectedFiles.add(selectedIndex);
            } else if (selectedIndex > index) {
                newSelectedFiles.add(selectedIndex - 1);
            }
            // selectedIndex === index 的情况不添加（即被删除的文件）
        }
        this.selectedFiles = newSelectedFiles;
        
        if (this.importFiles.length === 0) {
            this.clearImportFiles();
        } else {
            // 重新渲染文件列表
            this.renderFilesList();
            this.updateConfirmButton();
        }
    }

    /**
     * 处理图片导入
     */
    handleImportImages(files) {
        const filesList = document.getElementById('import-images-list');
        const confirmBtn = document.getElementById('import-confirm-btn');
        
        if (!filesList || !confirmBtn) return;

        // 过滤出图片文件
        this.importFiles = Array.from(files).filter(file => 
            file.type.startsWith('image/')
        );

        if (this.importFiles.length === 0) {
            this.characterManagement.showNotification('请选择有效的图片文件', 'error');
            return;
        }

        // 初始化时默认全选
        this.selectedFiles.clear();
        for (let i = 0; i < this.importFiles.length; i++) {
            this.selectedFiles.add(i);
        }

        // 生成文件列表HTML
        this.renderFilesList();

        // 显示批量控制按钮和信息
        this.showBatchControls();

        // 更新确认按钮状态
        this.updateConfirmButton();
    }

    /**
     * 导入标签页切换
     */
    switchImportTab(tabName) {
        // 切换标签页按钮状态
        document.querySelectorAll('.import-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // 切换标签页内容
        document.querySelectorAll('.import-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.querySelector(`.import-tab-content[data-tab="${tabName}"]`).classList.add('active');

        // 根据标签页显示对应的按钮
        const importConfirmBtn = document.getElementById('import-confirm-btn');
        const tavernAIImportBtn = document.getElementById('tavern-ai-import-btn');

        if (tabName === 'tavern-ai') {
            // AI导入标签页 - 委托给酒馆角色卡导入器
            if (importConfirmBtn) importConfirmBtn.style.display = 'none';
            if (tavernAIImportBtn) tavernAIImportBtn.style.display = 'inline-block';
            if (this.tavernCardImporter) {
                this.tavernCardImporter.clearTavernAIUpload();
            }
        } else {
            // 其他标签页（图片导入等）
            if (importConfirmBtn) importConfirmBtn.style.display = 'inline-block';
            if (tavernAIImportBtn) tavernAIImportBtn.style.display = 'none';
            this.clearImportFiles();
        }
    }

    /**
     * 执行角色导入
     */
    async importCharacters() {
        if (!this.importFiles || this.importFiles.length === 0 || this.selectedFiles.size === 0) {
            this.characterManagement.showNotification('请选择要导入的文件', 'warning');
            return;
        }

        try {
            const results = [];
            
            // 获取选中的文件
            const selectedFiles = Array.from(this.selectedFiles)
                .map(index => this.importFiles[index])
                .filter(file => file); // 过滤掉可能的undefined
            
            // 显示导入进度提示
            this.characterManagement.showNotification(`开始导入 ${selectedFiles.length} 个选中的图片文件...`, 'info');
            
            // 逐个处理导入文件
            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];
                try {
                    // 从图片中提取角色数据
                    const characterData = await this.extractCharacterFromImage(file);
                    
                    // 验证角色数据格式
                    if (!this.validateCharacterData(characterData)) {
                        throw new Error('角色数据格式不正确');
                    }
                    
                    results.push({
                        file: file.name,
                        data: characterData,
                        originalFile: file,
                        success: true
                    });
                } catch (error) {
                    console.error(`导入文件 ${file.name} 失败:`, error);
                    results.push({
                        file: file.name,
                        error: error.message,
                        success: false
                    });
                }
            }

            // 统计导入结果
            const successCount = results.filter(r => r.success).length;
            const failCount = results.filter(r => !r.success).length;

            // 保存成功导入的角色
            for (const result of results) {
                if (result.success) {
                    await this.importSingleCharacter(result.data, result.originalFile);
                }
            }

            // 刷新角色列表
            if (successCount > 0) {
                await this.characterManagement.loadCharacters();
                this.characterManagement.filterAndRenderCharacters();
            }

            this.closeImportModal();
            
            // 处理导入结果
            if (failCount === 0) {
                // 完全成功，直接显示成功消息
                this.characterManagement.showNotification(`成功导入 ${successCount} 个角色`, 'success');
                
                // 导入成功后刷新页面
                setTimeout(() => {
                    this.characterManagement.showNotification('正在刷新页面...', 'info');
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                }, 2000);
            } else {
                // 部分失败，显示详细信息
                this.handlePartialImportResults(successCount, failCount, results);
                
                // 如果有成功导入的角色，也刷新页面
                if (successCount > 0) {
                    setTimeout(() => {
                        this.characterManagement.showNotification('正在刷新页面...', 'info');
                        setTimeout(() => {
                            window.location.reload();
                        }, 1000);
                    }, 4000);
                }
            }

        } catch (error) {
            console.error('导入失败:', error);
            this.characterManagement.showNotification('导入过程中发生错误', 'error');
        }
    }

    /**
     * 处理部分导入成功的结果
     */
    handlePartialImportResults(successCount, failCount, results) {
        this.characterManagement.showNotification(`导入完成：成功 ${successCount} 个，失败 ${failCount} 个`, 'warning');
        
        // 显示详细的失败信息
        const failedFiles = results.filter(r => !r.success);
        if (failedFiles.length > 0) {
            console.warn('导入失败的文件:', failedFiles);
            let errorDetails = '失败的文件:\n';
            failedFiles.forEach(f => {
                errorDetails += `- ${f.file}: ${f.error}\n`;
            });
            setTimeout(() => {
                this.characterManagement.showNotification(errorDetails, 'error');
            }, 2000);
        }
        
        // 如果有成功导入的角色，显示成功信息
        if (successCount > 0) {
            setTimeout(() => {
                this.characterManagement.showNotification(`其中成功导入了 ${successCount} 个角色`, 'info');
            }, 3000);
        }
    }

    /**
     * 导入单个角色
     */
    async importSingleCharacter(characterData, originalFile = null) {
        try {
            console.log('开始导入角色:', characterData.名字 || characterData.role_name);
            
            // 确保有role_name字段
            if (!characterData.role_name && characterData.名字) {
                characterData.role_name = characterData.名字;
            }
            
            // 验证数据完整性
            if (!characterData.role_name || !characterData.名字) {
                console.error('角色数据验证失败:', characterData);
                throw new Error('角色数据不完整：缺少必要的名称字段');
            }
            
            const characterName = characterData.role_name || characterData.名字;
            
            // 检查是否存在同名角色
            const existingCharacter = this.characterManagement.characters.find(c => c.name === characterName);
            if (existingCharacter) {
                const shouldOverwrite = await this.showOverwriteConfirmation(characterName);
                if (!shouldOverwrite) {
                    throw new Error(`导入取消：角色 "${characterName}" 已存在`);
                }
            }
            
            console.log('发送角色数据到服务器:', {
                role_name: characterData.role_name,
                名字: characterData.名字,
                dataKeys: Object.keys(characterData)
            });
            
            const response = await fetch('/api/roles', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(characterData)
            });

            if (!response.ok) {
                // 尝试获取详细错误信息
                let errorDetails = `HTTP error! status: ${response.status}`;
                try {
                    const errorResponse = await response.json();
                    console.error('服务器响应错误:', errorResponse);
                    if (errorResponse.error) {
                        errorDetails += ` - ${errorResponse.error}`;
                    }
                } catch (e) {
                    console.error('无法解析错误响应:', e);
                    // 无法解析错误响应，使用默认错误信息
                }
                console.error('导入角色失败:', errorDetails);
                throw new Error(errorDetails);
            }

            const result = await response.json();
            console.log('角色导入成功:', result);
            
            // 如果导入的是图片文件，则将图片设置为角色头像
            if (originalFile && originalFile.type.startsWith('image/')) {
                try {
                    await this.uploadCharacterAvatar(characterData.role_name || characterData.名字, originalFile);
                } catch (avatarError) {
                    console.warn('设置角色头像失败:', avatarError);
                    // 头像上传失败不影响角色导入，只是警告
                }
            }
            
            // 如果导入的角色有数据书数据，自动创建数据书
            if (characterData.has_storybook && characterData.storybook_data) {
                await this.autoCreateStorybook(characterName, characterData.storybook_data);
                // 清理角色简介中的数据书内容
                await this.cleanCharacterDescription(characterName);
            } else {
                // 检查是否可以从简介中解析出数据书信息
                const parsedStorybook = this.parseStorybookFromDescription(characterData);
                if (parsedStorybook) {
                    console.log(`📖 从简介中检测到数据书格式，自动创建数据书`);
                    await this.autoCreateStorybook(characterName, parsedStorybook);
                    // 清理角色简介中的数据书内容
                    await this.cleanCharacterDescription(characterName, characterData);
                }
            }
            
            // 添加角色的标签到全局标签集合
            if (characterData.tags && Array.isArray(characterData.tags)) {
                characterData.tags.forEach(tag => this.characterManagement.allTags.add(tag));
                this.characterManagement.updateTagFilter();
            }

            return result;
        } catch (error) {
            console.error('导入单个角色失败:', error);
            throw error;
        }
    }

    /**
     * 验证角色数据格式
     */
    validateCharacterData(characterData) {
        if (!characterData) {
            console.error('角色数据为空');
            return false;
        }

        // 检查必要的字段
        if (!characterData.名字 && !characterData.role_name) {
            console.error('角色数据缺少名称字段');
            return false;
        }

        console.log('角色数据验证通过:', {
            名字: characterData.名字,
            role_name: characterData.role_name,
            hasIntroduction: !!characterData.介绍,
            hasTags: !!(characterData.tags && characterData.tags.length > 0)
        });

        return true;
    }

    /**
     * 上传角色头像
     */
    async uploadCharacterAvatar(characterName, file) {
        if (!file || !file.type.startsWith('image/')) {
            throw new Error('无效的图片文件');
        }

        try {
            console.log(`开始上传角色 "${characterName}" 的头像`);
            
            const formData = new FormData();
            formData.append('avatar', file);

            const response = await fetch(`/api/roles/${encodeURIComponent(characterName)}/avatar`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`头像上传失败: ${response.status} - ${errorText}`);
            }
            
            console.log(`角色 "${characterName}" 头像上传成功`);
            return true;
            
        } catch (error) {
            console.error(`角色 "${characterName}" 头像上传失败:`, error);
            throw error;
        }
    }

    /**
     * 从图片中提取角色数据 - 统一的导入格式支持
     */
    async extractCharacterFromImage(file) {
        console.log(`开始从图片 "${file.name}" 提取角色数据`);
        
        // 方法1: 尝试酒馆角色卡格式（PNG元数据或Base64嵌入）
        try {
        if (window.TavernCardImporter) {
            const tempImporter = new window.TavernCardImporter(this.characterManagement);
                const characterData = await tempImporter.extractCharacterFromImage(file);
                console.log('✅ 使用酒馆角色卡格式成功提取角色数据:', characterData);
                
                // 验证酒馆角色卡数据的完整性
                if (this.validateTavernCardData(characterData)) {
                    return this.normalizeCharacterData(characterData);
                }
            }
        } catch (error) {
            console.log('🔄 酒馆角色卡格式提取失败:', error.message);
        }
        
        // 方法2: 尝试PNG tEXt块元数据格式（一些其他工具的导出格式）
        try {
            const pngTextData = await this.extractPNGTextChunks(file);
            if (pngTextData) {
                console.log('✅ 使用PNG文本块格式成功提取角色数据:', pngTextData);
                return this.normalizeCharacterData(pngTextData);
            }
        } catch (error) {
            console.log('🔄 PNG文本块格式提取失败:', error.message);
        }
        
        // 所有格式都失败
        throw new Error(`无法从图片 "${file.name}" 中提取角色数据。支持的格式：\n• 酒馆角色卡(CharacterAI/TavernAI)\n• 带有PNG文本元数据的角色图片`);
    }


    /**
     * 验证酒馆角色卡数据
     */
    validateTavernCardData(data) {
        return data && (data.name || data.名字 || data.role_name);
    }

    /**
     * 统一角色数据格式
     */
    normalizeCharacterData(rawData) {
        
        // 统一字段映射
        const normalized = {
            ...rawData
        };
        
        // 确保有统一的名称字段
        if (!normalized.名字 && rawData.name) {
            normalized.名字 = rawData.name;
        }
        if (!normalized.role_name && (rawData.name || rawData.名字)) {
            normalized.role_name = rawData.name || rawData.名字;
        }
        
        // 确保有标签数组
        if (!normalized.tags) {
            normalized.tags = [];
        }
        
        // 映射常见的字段
        if (rawData.description && !normalized.介绍) {
            normalized.介绍 = rawData.description;
        }
        if (rawData.first_mes && !normalized.开场白) {
            normalized.开场白 = rawData.first_mes;
        }
        
        // 设置默认类别
        if (!normalized.category) {
            normalized.category = 'npc'; // 默认为NPC角色
        }
        
        console.log('角色数据标准化完成:', {
            原始格式: rawData.export_metadata ? '系统导出' : '外部导入',
            名字: normalized.名字,
            role_name: normalized.role_name,
            类别: normalized.category
        });
        
        return normalized;
    }

    /**
     * 提取PNG文本块数据（支持其他工具的导出格式）
     */
    async extractPNGTextChunks(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const dataView = new DataView(arrayBuffer);
            
            // 检查PNG文件头
            const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
            for (let i = 0; i < 8; i++) {
                if (dataView.getUint8(i) !== pngSignature[i]) {
                    throw new Error('不是有效的PNG文件');
                }
            }
            
            let offset = 8;
            
            // 遍历PNG块
            while (offset < arrayBuffer.byteLength - 8) {
                const length = dataView.getUint32(offset);
                const type = String.fromCharCode(
                    dataView.getUint8(offset + 4),
                    dataView.getUint8(offset + 5),
                    dataView.getUint8(offset + 6),
                    dataView.getUint8(offset + 7)
                );
                
                // 查找文本块
                if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
                    const textData = new Uint8Array(arrayBuffer, offset + 8, length);
                    const textString = new TextDecoder('utf-8').decode(textData);
                    
                    // 尝试解析为JSON
                    const nullIndex = textString.indexOf('\0');
                    if (nullIndex !== -1) {
                        const key = textString.substring(0, nullIndex);
                        const value = textString.substring(nullIndex + 1);
                        
                        if (key.toLowerCase().includes('character') || key.toLowerCase().includes('chara')) {
                            try {
                                return JSON.parse(value);
                            } catch (e) {
                                // 尝试base64解码
                                try {
                                    const decoded = atob(value);
                                    return JSON.parse(decoded);
                                } catch (e2) {
                                    console.log('无法解析PNG文本块数据');
                                }
                            }
                        }
                    }
                }
                
                offset += 8 + length + 4; // 跳过长度、类型、数据和CRC
            }
            
            return null;
        } catch (error) {
            console.error('提取PNG文本块失败:', error);
            return null;
        }
    }

    /**
     * 显示覆盖确认对话框
     */
    async showOverwriteConfirmation(characterName) {
        return new Promise((resolve) => {
            // 创建更详细的确认对话框
            const existingCharacter = this.characterManagement.characters.find(c => c.name === characterName);
            let message = `⚠️ 角色冲突检测\n\n角色 "${characterName}" 已存在`;
            
            if (existingCharacter) {
                message += `\n\n现有角色信息:`;
                message += `\n• 类型: ${existingCharacter.category === 'narrator' ? '旁白角色' : 'NPC角色'}`;
                if (existingCharacter.tags && existingCharacter.tags.length > 0) {
                    message += `\n• 标签: ${existingCharacter.tags.join(', ')}`;
                }
                message += `\n• 创建时间: ${existingCharacter.created || '未知'}`;
            }
            
            message += `\n\n⚠️ 覆盖操作将完全替换现有角色的所有数据`;
            message += `\n\n点击"确定"覆盖现有角色`;
            message += `\n点击"取消"跳过该角色的导入`;
            
            const confirmed = confirm(message);
            resolve(confirmed);
        });
    }

    /**
     * 显示数据书创建提示
     */
    async showStorybookCreationPrompt(characterName, storybookData) {
        try {
            // 分析数据书内容
            let dataDescription = '';
            if (storybookData) {
                const keys = Object.keys(storybookData);
                dataDescription = `\n\n📊 数据书内容预览:`;
                
                if (storybookData.总结词) {
                    dataDescription += `\n• 总结词: ${Array.isArray(storybookData.总结词) ? storybookData.总结词.join(', ') : storybookData.总结词}`;
                }
                if (storybookData.关键词) {
                    dataDescription += `\n• 关键词: ${Array.isArray(storybookData.关键词) ? storybookData.关键词.join(', ') : storybookData.关键词}`;
                }
                if (storybookData.属性) {
                    const attrKeys = Object.keys(storybookData.属性);
                    dataDescription += `\n• 属性字段: ${attrKeys.length}个 (${attrKeys.slice(0, 3).join(', ')}${attrKeys.length > 3 ? '...' : ''})`;
                }
                if (storybookData.事件 && Array.isArray(storybookData.事件)) {
                    dataDescription += `\n• 事件记录: ${storybookData.事件.length}条`;
                }
                
                dataDescription += `\n• 数据字段总数: ${keys.length}个`;
            }
            
            const message = `📚 检测到角色数据书\n\n角色 "${characterName}" 包含完整的数据书数据。${dataDescription}\n\n💡 建议创建数据书以获得完整的角色功能:\n• 智能记忆和上下文理解\n• 结构化属性和技能系统\n• 事件记录和成长追踪\n\n❓ 是否要为该角色创建数据书？\n\n点击"确定"创建完整数据书\n点击"取消"仅导入基本角色信息`;
            
            const shouldCreate = confirm(message);
            
            if (shouldCreate) {
                console.log(`开始为角色 "${characterName}" 创建数据书`);
                this.characterManagement.showNotification(`正在为角色 "${characterName}" 创建数据书...`, 'info');
                
                // 创建数据书
                const response = await fetch(`/api/storybooks`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: characterName,
                        data: storybookData,
                        bind_to_role: characterName
                    })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    console.log(`数据书创建成功:`, result);
                    this.characterManagement.showNotification(`✅ 成功为角色 "${characterName}" 创建数据书，已自动绑定`, 'success');
        } else {
                    const errorText = await response.text();
                    console.error('创建数据书失败:', errorText);
                    this.characterManagement.showNotification(`⚠️ 为角色 "${characterName}" 创建数据书失败: ${errorText}`, 'warning');
                }
        } else {
                console.log(`用户选择跳过为角色 "${characterName}" 创建数据书`);
                this.characterManagement.showNotification(`角色 "${characterName}" 已导入（未创建数据书）`, 'info');
            }
        } catch (error) {
            console.error('数据书创建提示失败:', error);
            this.characterManagement.showNotification(`数据书创建过程中发生错误: ${error.message}`, 'error');
        }
    }

    /**
     * 自动创建数据书（无需用户确认）
     */
    async autoCreateStorybook(characterName, storybookData) {
        try {
            console.log(`🔄 开始为角色 "${characterName}" 自动创建数据书`);
            this.characterManagement.showNotification(`正在为角色 "${characterName}" 创建数据书...`, 'info');
            
            // 确保数据书包含所有必需字段
            const validatedData = this.validateAndCompleteStorybookData(storybookData, characterName);
            console.log(`📋 验证后的数据书数据:`, validatedData);
            
            // 创建数据书 - 使用v2 API
            const response = await fetch(`/api/v2/storybooks/${encodeURIComponent(characterName)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(validatedData)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log(`✅ 数据书创建成功:`, result);
                
                // 绑定数据书到角色
                await this.bindStorybookToRole(characterName, characterName);
                
                this.characterManagement.showNotification(`✅ 成功为角色 "${characterName}" 创建数据书，已自动绑定`, 'success');
            } else {
                const errorText = await response.text();
                console.error('创建数据书失败:', errorText);
                this.characterManagement.showNotification(`⚠️ 为角色 "${characterName}" 创建数据书失败: ${errorText}`, 'warning');
            }
        } catch (error) {
            console.error('自动创建数据书失败:', error);
            this.characterManagement.showNotification(`数据书创建过程中发生错误: ${error.message}`, 'error');
        }
    }

    /**
     * 清理角色简介中的数据书内容
     */
    async cleanCharacterDescription(characterName, characterData = null) {
        try {
            console.log(`🧹 清理角色 "${characterName}" 简介中的数据书内容`);
            
            // 获取当前角色数据
            let roleData;
            if (characterData) {
                roleData = characterData;
            } else {
                const response = await fetch(`/api/roles/${encodeURIComponent(characterName)}`);
                if (!response.ok) {
                    console.warn('获取角色数据失败，跳过简介清理');
                    return;
                }
                roleData = await response.json();
            }
            
            const originalDescription = roleData.介绍 || roleData.description || '';
            if (!originalDescription) {
                console.log('角色简介为空，无需清理');
                return;
            }
            
            // 提取基本角色描述（数据书格式之前的内容）
            const cleanedDescription = this.extractBasicDescription(originalDescription);
            
            // 如果清理后的描述与原描述不同，更新角色文件
            if (cleanedDescription !== originalDescription) {
                await this.updateCharacterDescription(characterName, cleanedDescription);
                console.log(`✅ 已清理角色简介，移除数据书格式内容`);
                console.log(`   原长度: ${originalDescription.length} 字符`);
                console.log(`   新长度: ${cleanedDescription.length} 字符`);
            } else {
                console.log('简介中未检测到数据书格式，无需清理');
            }
            
        } catch (error) {
            console.warn('清理角色简介失败:', error);
            // 清理失败不影响导入过程
        }
    }

    /**
     * 提取基本角色描述，移除数据书格式内容
     */
    extractBasicDescription(description) {
        console.log(`🔍 开始清理简介，原长度: ${description.length}`);
        
        // 检查是否包含数据书格式内容
        const hasStorybookFormat = description.includes('**总结词**') || 
                                 description.includes('**关键词**') || 
                                 description.includes('**角色描述**') ||
                                 description.includes('## 角色属性') ||
                                 description.includes('**外貌特征**') ||
                                 description.includes('**能力值**') ||
                                 description.includes('**社交关系**') ||
                                 description.includes('**背包物品**') ||
                                 description.includes('**标签**');
        
        // 检查是否包含详细的角色描述（即使没有标准数据书格式）
        const hasDetailedDescription = description.length > 150 || 
                                      description.includes('外表') ||
                                      description.includes('内心') ||
                                      description.includes('性格') ||
                                      description.includes('能力') ||
                                      description.includes('智力') ||
                                      description.includes('力量') ||
                                      description.includes('穿着') ||
                                      description.includes('喜欢') ||
                                      description.includes('擅长');
        
        if (!hasStorybookFormat && !hasDetailedDescription) {
            console.log('未检测到数据书格式或详细描述，保持原描述');
            return description;
        }
        
        console.log('🧹 检测到数据书格式，开始彻底清理');
        
        // 策略1: 如果简介以"角色描述："开头，提取冒号后的第一句话
        if (description.startsWith('角色描述：')) {
            const afterColon = description.substring('角色描述：'.length);
            
            // 查找第一个数据书标记的位置
            const markers = ['**总结词**', '**关键词**', '**角色描述**', '## 角色属性'];
            let firstMarkerPos = -1;
            
            for (const marker of markers) {
                const pos = afterColon.indexOf(marker);
                if (pos !== -1) {
                    if (firstMarkerPos === -1 || pos < firstMarkerPos) {
                        firstMarkerPos = pos;
                    }
                }
            }
            
            if (firstMarkerPos !== -1) {
                // 提取第一个标记之前的内容
                let cleanText = afterColon.substring(0, firstMarkerPos).trim();
                console.log(`📝 提取到基本描述: "${cleanText.substring(0, 50)}..."`);
                return cleanText;
            }
        }
        
        // 策略2: 查找并提取**角色描述**字段的内容
        const roleDescMatch = description.match(/\*\*角色描述\*\*:\s*([^*\n]+)/);
        if (roleDescMatch && roleDescMatch[1]) {
            const extracted = roleDescMatch[1].trim();
            console.log(`📝 从**角色描述**字段提取: "${extracted.substring(0, 50)}..."`);
            return extracted;
        }
        
        // 策略3: 查找第一个数据书标记，提取之前的所有内容
        const allMarkers = [
            '**总结词**', '**关键词**', '**角色描述**', '## 角色属性',
            '**外貌特征**', '**能力值**', '**社交关系**', '**背包物品**', '**标签**'
        ];
        
        let earliestPos = -1;
        for (const marker of allMarkers) {
            const pos = description.indexOf(marker);
            if (pos !== -1) {
                if (earliestPos === -1 || pos < earliestPos) {
                    earliestPos = pos;
                }
            }
        }
        
        if (earliestPos > 0) {
            let beforeMarkers = description.substring(0, earliestPos).trim();
            // 移除可能的前缀
            beforeMarkers = beforeMarkers.replace(/^角色描述：?/, '').trim();
            
            if (beforeMarkers.length > 10) {
                console.log(`📝 提取标记前内容: "${beforeMarkers.substring(0, 50)}..."`);
                return beforeMarkers;
            }
        }
        
        // 策略4: 对于包含数据书格式的角色，采用更激进的清理策略
        // 如果简介很长（超过100字符）且包含数据书格式，直接清空
        if (description.length > 100) {
            console.log('🗑️ 简介过长且包含数据书格式，完全清空以避免重复');
            return '';
        }
        
        // 策略5: 如果简介较短，尝试保留第一句话
        const sentences = description.split(/[。！？.!?]/);
        if (sentences.length > 0 && sentences[0].trim().length > 0 && sentences[0].trim().length < 50) {
            const firstSentence = sentences[0].trim();
            console.log(`📝 保留第一句话: "${firstSentence}"`);
            return firstSentence;
        }
        
        // 最终策略: 完全清空简介
        console.log('🗑️ 无法提取有效的基本描述，完全清空简介');
        return '';
    }

    /**
     * 更新角色的简介字段
     */
    async updateCharacterDescription(characterName, newDescription) {
        try {
            const response = await fetch(`/api/roles/${encodeURIComponent(characterName)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    介绍: newDescription
                })
            });
            
            if (!response.ok) {
                console.warn('更新角色简介失败:', response.status);
            }
        } catch (error) {
            console.warn('更新角色简介时出错:', error);
        }
    }

    /**
     * 验证并补全数据书数据，确保包含所有必需字段
     */
    validateAndCompleteStorybookData(storybookData, characterName) {
        // 创建一个新的数据书对象，确保包含所有必需字段
        const validatedData = {
            // 必需字段 - 如果不存在则提供默认值
            总结词: storybookData.总结词 || [characterName],
            关键词: storybookData.关键词 || [],
            属性: storybookData.属性 || {},
            
            // 可选字段 - 保留原有数据
            标签: storybookData.标签 || [],
            描述: storybookData.描述 || `${characterName}的数据书`,
            捆绑角色: storybookData.捆绑角色 || [characterName],
            捆绑玩家: storybookData.捆绑玩家 || [],
            
            // 时间戳
            创建时间: storybookData.创建时间 || new Date().toISOString(),
            更新时间: new Date().toISOString()
        };
        
        // 如果关键词为空，尝试从其他字段生成
        if (validatedData.关键词.length === 0) {
            // 从总结词复制
            if (validatedData.总结词.length > 0) {
                validatedData.关键词 = [...validatedData.总结词];
            }
            // 从标签复制
            if (validatedData.标签.length > 0) {
                validatedData.关键词 = validatedData.关键词.concat(validatedData.标签);
            }
            // 如果还是空，添加默认关键词
            if (validatedData.关键词.length === 0) {
                validatedData.关键词 = [characterName, '角色'];
            }
        }
        
        // 确保属性字段不为空
        if (Object.keys(validatedData.属性).length === 0) {
            validatedData.属性 = {
                基本信息: {
                    名称: characterName,
                    类型: '角色'
                }
            };
        }
        
        console.log(`✅ 数据书验证完成，必需字段检查:`);
        console.log(`   总结词: ${validatedData.总结词.length}个`);
        console.log(`   关键词: ${validatedData.关键词.length}个`);
        console.log(`   属性字段: ${Object.keys(validatedData.属性).length}个`);
        
        return validatedData;
    }

    /**
     * 绑定数据书到角色
     */
    async bindStorybookToRole(roleName, storybookName) {
        try {
            const response = await fetch('/api/bind_story_to_role', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    story_name: storybookName,
                    role_name: roleName,
                    remove_role_description: false
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log(`✅ 数据书绑定成功:`, result);
            } else {
                const errorText = await response.text();
                console.warn('绑定数据书失败:', errorText);
                // 绑定失败不阻止导入过程，只是警告
            }
        } catch (error) {
            console.warn('绑定数据书时出错:', error);
            // 绑定失败不阻止导入过程，只是警告
        }
    }

    /**
     * 从角色简介中解析数据书信息
     */
    parseStorybookFromDescription(characterData) {
        try {
            const description = characterData.介绍 || characterData.description || '';
            if (!description) return null;
            
            // 检查是否包含数据书格式的内容
            const hasStorybookFormat = description.includes('**总结词**') || 
                                     description.includes('**关键词**') || 
                                     description.includes('**角色描述**') ||
                                     description.includes('## 角色属性') ||
                                     description.includes('**外貌特征**') ||
                                     description.includes('**能力值**');
            
            if (!hasStorybookFormat) {
                console.log('简介中未检测到数据书格式');
                return null;
            }
            
            console.log('📖 检测到简介包含数据书格式，开始解析...');
            
            // 获取角色名字
            const characterName = characterData.名字 || characterData.name || characterData.role_name || '未知角色';
            
            // 解析数据书结构
            const storybook = {
                总结词: this.extractArrayFromDescription(description, '**总结词**'),
                关键词: this.extractArrayFromDescription(description, '**关键词**'),
                描述: this.extractSingleField(description, '**角色描述**'),
                属性: this.parseAttributesFromDescription(description),
                标签: this.extractArrayFromDescription(description, '**标签**'),
                更新时间: new Date().toISOString(),
                捆绑角色: [characterName],
                捆绑玩家: []
            };
            
            // 清理空字段（但保留重要的结构字段）
            Object.keys(storybook).forEach(key => {
                // 不删除捆绑角色和捆绑玩家字段，即使它们为空
                if (key === '捆绑角色' || key === '捆绑玩家' || key === '更新时间') {
                    return;
                }
                if (!storybook[key] || (Array.isArray(storybook[key]) && storybook[key].length === 0)) {
                    delete storybook[key];
                }
            });
            
            console.log('📋 解析得到的数据书结构:', storybook);
            return Object.keys(storybook).length > 3 ? storybook : null; // 至少要有3个有效字段
            
        } catch (error) {
            console.error('解析简介中的数据书信息失败:', error);
            return null;
        }
    }

    /**
     * 从描述中提取数组字段
     */
    extractArrayFromDescription(text, fieldName) {
        const regex = new RegExp(`${fieldName.replace(/\*/g, '\\*')}:\\s*([^\\n]+)`, 'i');
        const match = text.match(regex);
        if (match && match[1]) {
            return match[1].split(',').map(item => item.trim()).filter(item => item);
        }
        return [];
    }

    /**
     * 从描述中提取单个字段
     */
    extractSingleField(text, fieldName) {
        const regex = new RegExp(`${fieldName.replace(/\*/g, '\\*')}:\\s*([^\\n]+)`, 'i');
        const match = text.match(regex);
        return match && match[1] ? match[1].trim() : '';
    }

    /**
     * 从描述中解析属性信息
     */
    parseAttributesFromDescription(text) {
        const attributes = {};
        
        // 解析外貌特征
        const appearanceMatch = text.match(/\*\*外貌特征\*\*:\s*([\s\S]*?)(?=\n\*\*|$)/i);
        if (appearanceMatch) {
            const appearanceText = appearanceMatch[1];
            const appearanceLines = appearanceText.split('\n').filter(line => line.trim().startsWith('-'));
            if (appearanceLines.length > 0) {
                attributes.外貌特征 = {};
                appearanceLines.forEach(line => {
                    const match = line.match(/- ([^:]+): (.+)/);
                    if (match) {
                        attributes.外貌特征[match[1].trim()] = match[2].trim();
                    }
                });
            }
        }
        
        // 解析能力值
        const abilitiesMatch = text.match(/\*\*能力值\*\*:\s*([\s\S]*?)(?=\n\*\*|$)/i);
        if (abilitiesMatch) {
            const abilitiesText = abilitiesMatch[1];
            const abilityLines = abilitiesText.split('\n').filter(line => line.trim().startsWith('-'));
            if (abilityLines.length > 0) {
                attributes.能力值 = {};
                abilityLines.forEach(line => {
                    const match = line.match(/- ([^:]+): (.+)/);
                    if (match) {
                        attributes.能力值[match[1].trim()] = match[2].trim();
                    }
                });
            }
        }
        
        // 解析社交关系
        const relationsMatch = text.match(/\*\*社交关系\*\*:\s*([\s\S]*?)(?=\n\*\*|$)/i);
        if (relationsMatch) {
            const relationsText = relationsMatch[1];
            const relationLines = relationsText.split('\n').filter(line => line.trim().startsWith('-'));
            if (relationLines.length > 0) {
                attributes.社交关系 = {};
                relationLines.forEach(line => {
                    const match = line.match(/- ([^:]+): (.+)/);
                    if (match) {
                        const value = match[2].trim();
                        // 如果包含逗号，转换为数组
                        attributes.社交关系[match[1].trim()] = value.includes(',') ? 
                            value.split(',').map(item => item.trim()) : value;
                    }
                });
            }
        }
        
        // 解析背包物品
        const inventoryMatch = text.match(/\*\*背包物品\*\*:\s*([\s\S]*?)(?=\n\*\*|$)/i);
        if (inventoryMatch) {
            const inventoryText = inventoryMatch[1];
            const inventoryLines = inventoryText.split('\n').filter(line => line.trim().startsWith('-'));
            if (inventoryLines.length > 0) {
                attributes.背包 = {};
                inventoryLines.forEach(line => {
                    const match = line.match(/- ([^:]+): (.+)/);
                    if (match) {
                        attributes.背包[match[1].trim()] = match[2].trim();
                    }
                });
            }
        }
        
        // 解析状态信息（详细描述、性格特点）
        const detailMatch = this.extractSingleField(text, '**详细描述**');
        const personalityMatch = this.extractSingleField(text, '**性格特点**');
        
        if (detailMatch || personalityMatch) {
            attributes.状态 = {};
            if (detailMatch) attributes.状态.描述 = detailMatch;
            if (personalityMatch) attributes.状态.性格特点 = personalityMatch;
        }
        
        return Object.keys(attributes).length > 0 ? attributes : null;
    }

    // 已移除导入成功后的数据书创建确认功能
    // 现在导入成功后直接完成，不再询问是否创建数据书

    /**
     * 导出角色为图片
     */
    async exportCharacterAsImage() {
        const currentCharacter = this.characterManagement.currentCharacter;
        if (!currentCharacter) return;

        try {
            // 获取角色头像
            let avatarSrc;
            if (currentCharacter.type === 'player') {
                avatarSrc = `/avatar/${encodeURIComponent(currentCharacter.name)}`;
            } else {
                avatarSrc = `/api/roles/${encodeURIComponent(currentCharacter.name)}/avatar`;
            }

            // 直接下载原始头像图片
            await this.downloadImage(avatarSrc, currentCharacter.name);

        } catch (error) {
            console.error('导出图片失败:', error);
            this.characterManagement.showNotification('导出图片失败: ' + error.message, 'error');
        }
    }

    /**
     * 下载图片
     */
    async downloadImage(imageSrc, characterName) {
        try {
            const link = document.createElement('a');
            link.href = imageSrc;
            link.download = `${characterName}_avatar.png`;
            link.click();
            
            this.characterManagement.showNotification(`已导出角色 "${characterName}" 的头像图片`, 'success');

        } catch (error) {
            console.error('下载图片失败:', error);
            this.characterManagement.showNotification('下载图片失败: ' + error.message, 'error');
        }
    }

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 渲染文件列表
     */
    renderFilesList() {
        const filesList = document.getElementById('import-images-list');
        if (!filesList) return;

        filesList.innerHTML = this.importFiles.map((file, index) => `
            <div class="import-file-item image-item ${this.selectedFiles.has(index) ? 'selected' : ''}" 
                 data-index="${index}">
                <div class="import-file-info">
                    <img class="import-image-preview" src="${URL.createObjectURL(file)}" alt="图片预览">
                    <div class="import-file-details">
                        <div class="import-file-name">${file.name}</div>
                        <div class="import-file-size">${this.formatFileSize(file.size)}</div>
                    </div>
                </div>
                <button class="import-file-remove" data-index="${index}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        // 绑定点击事件（选择/取消选择）
        filesList.querySelectorAll('.import-file-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // 如果点击的是删除按钮，不触发选择逻辑
                if (e.target.closest('.import-file-remove')) {
                    return;
                }
                
                const index = parseInt(item.dataset.index);
                this.toggleFileSelection(index);
            });
        });

        // 绑定删除按钮事件
        filesList.querySelectorAll('.import-file-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止冒泡到父元素的点击事件
                const index = parseInt(btn.dataset.index);
                this.removeImportFile(index);
            });
        });

        // 更新选择计数
        this.updateSelectedCount();
    }

    /**
     * 切换文件选择状态
     */
    toggleFileSelection(index) {
        if (this.selectedFiles.has(index)) {
            this.selectedFiles.delete(index);
        } else {
            this.selectedFiles.add(index);
        }
        
        // 更新UI
        this.updateFileItemUI(index);
        this.updateSelectedCount();
        this.updateConfirmButton();
    }

    /**
     * 更新单个文件项的UI状态
     */
    updateFileItemUI(index) {
        const fileItem = document.querySelector(`.import-file-item[data-index="${index}"]`);
        if (fileItem) {
            if (this.selectedFiles.has(index)) {
                fileItem.classList.add('selected');
            } else {
                fileItem.classList.remove('selected');
            }
        }
    }

    /**
     * 全选文件
     */
    selectAllFiles() {
        this.selectedFiles.clear();
        for (let i = 0; i < this.importFiles.length; i++) {
            this.selectedFiles.add(i);
        }
        
        // 更新所有文件项的UI
        this.updateAllFileItemsUI();
        this.updateSelectedCount();
        this.updateConfirmButton();
    }

    /**
     * 取消全选
     */
    deselectAllFiles() {
        this.selectedFiles.clear();
        
        // 更新所有文件项的UI
        this.updateAllFileItemsUI();
        this.updateSelectedCount();
        this.updateConfirmButton();
    }

    /**
     * 更新所有文件项的UI状态
     */
    updateAllFileItemsUI() {
        document.querySelectorAll('.import-file-item').forEach((item, index) => {
            if (this.selectedFiles.has(index)) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    /**
     * 更新选择计数显示
     */
    updateSelectedCount() {
        const selectedCountEl = document.getElementById('selected-count');
        if (selectedCountEl) {
            selectedCountEl.textContent = this.selectedFiles.size;
        }
    }

    /**
     * 更新确认按钮状态
     */
    updateConfirmButton() {
        const confirmBtn = document.getElementById('import-confirm-btn');
        if (confirmBtn) {
            confirmBtn.disabled = this.selectedFiles.size === 0;
        }
    }

    /**
     * 显示批量控制元素
     */
    showBatchControls() {
        const selectAllBtn = document.getElementById('select-all-images-btn');
        const deselectAllBtn = document.getElementById('deselect-all-images-btn');
        const batchInfo = document.getElementById('batch-import-info');
        
        if (selectAllBtn) selectAllBtn.style.display = 'inline-block';
        if (deselectAllBtn) deselectAllBtn.style.display = 'inline-block';
        if (batchInfo) batchInfo.style.display = 'block';
    }

    /**
     * 隐藏批量控制元素
     */
    hideBatchControls() {
        const selectAllBtn = document.getElementById('select-all-images-btn');
        const deselectAllBtn = document.getElementById('deselect-all-images-btn');
        const batchInfo = document.getElementById('batch-import-info');
        
        if (selectAllBtn) selectAllBtn.style.display = 'none';
        if (deselectAllBtn) deselectAllBtn.style.display = 'none';
        if (batchInfo) batchInfo.style.display = 'none';
    }
}

// 导出类以供其他模块使用
window.CharacterImporter = CharacterImporter;

