/**
 * 临时数据处理器
 * 负责处理向量化临时数据的管理和传输
 */

class TempDataHandler {
    constructor() {
        this.isInitialized = false;
        this.tempDataQueue = [];
        this.processingTimeout = null;
        
        // 初始化
        this.init();
    }
    
    init() {
        try {
            // 检查是否在支持的环境中
            if (typeof window !== 'undefined') {
                this.isInitialized = true;
                console.log('TempDataHandler 初始化成功');
            }
        } catch (error) {
            console.warn('TempDataHandler 初始化失败:', error);
        }
    }
    
    /**
     * 添加临时数据到队列
     * @param {Object} data - 要处理的数据
     * @param {string} type - 数据类型
     */
    addTempData(data, type = 'general') {
        if (!this.isInitialized) {
            console.warn('TempDataHandler 未初始化');
            return false;
        }
        
        try {
            const tempDataItem = {
                id: this.generateId(),
                data: data,
                type: type,
                timestamp: Date.now(),
                processed: false
            };
            
            this.tempDataQueue.push(tempDataItem);
            this.scheduleProcessing();
            
            return tempDataItem.id;
        } catch (error) {
            console.error('添加临时数据失败:', error);
            return false;
        }
    }
    
    /**
     * 处理队列中的临时数据
     */
    scheduleProcessing() {
        if (this.processingTimeout) {
            clearTimeout(this.processingTimeout);
        }
        
        this.processingTimeout = setTimeout(() => {
            this.processQueue();
        }, 1000); // 1秒后处理
    }
    
    /**
     * 处理队列
     */
    async processQueue() {
        if (this.tempDataQueue.length === 0) {
            return;
        }
        
        try {
            const unprocessedItems = this.tempDataQueue.filter(item => !item.processed);
            
            for (const item of unprocessedItems) {
                await this.processItem(item);
                item.processed = true;
            }
            
            // 清理已处理的项目（保留最近的10个）
            this.tempDataQueue = this.tempDataQueue.slice(-10);
            
        } catch (error) {
            console.error('处理队列失败:', error);
        }
    }
    
    /**
     * 处理单个数据项
     * @param {Object} item - 要处理的数据项
     */
    async processItem(item) {
        try {
            // 根据数据类型执行不同的处理逻辑
            switch (item.type) {
                case 'chat_message':
                    await this.processChatMessage(item.data);
                    break;
                case 'character_data':
                    await this.processCharacterData(item.data);
                    break;
                case 'storybook_data':
                    await this.processStorybookData(item.data);
                    break;
                default:
                    console.log('处理通用临时数据:', item.id);
                    break;
            }
        } catch (error) {
            console.error(`处理数据项 ${item.id} 失败:`, error);
        }
    }
    
    /**
     * 处理聊天消息数据
     * @param {Object} data - 聊天消息数据
     */
    async processChatMessage(data) {
        try {
            // 这里可以实现聊天消息的向量化处理
            console.log('处理聊天消息数据:', data);
        } catch (error) {
            console.error('处理聊天消息失败:', error);
        }
    }
    
    /**
     * 处理角色数据
     * @param {Object} data - 角色数据
     */
    async processCharacterData(data) {
        try {
            // 这里可以实现角色数据的向量化处理
            console.log('处理角色数据:', data);
        } catch (error) {
            console.error('处理角色数据失败:', error);
        }
    }
    
    /**
     * 处理数据书数据
     * @param {Object} data - 数据书数据
     */
    async processStorybookData(data) {
        try {
            // 这里可以实现数据书数据的向量化处理
            console.log('处理数据书数据:', data);
        } catch (error) {
            console.error('处理数据书数据失败:', error);
        }
    }
    
    /**
     * 生成唯一ID
     * @returns {string} 唯一标识符
     */
    generateId() {
        return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * 获取队列状态
     * @returns {Object} 队列状态信息
     */
    getQueueStatus() {
        return {
            total: this.tempDataQueue.length,
            processed: this.tempDataQueue.filter(item => item.processed).length,
            pending: this.tempDataQueue.filter(item => !item.processed).length,
            isInitialized: this.isInitialized
        };
    }
    
    /**
     * 清空队列
     */
    clearQueue() {
        this.tempDataQueue = [];
        if (this.processingTimeout) {
            clearTimeout(this.processingTimeout);
            this.processingTimeout = null;
        }
    }
}

// 全局实例
let tempDataHandler = null;

// 初始化函数
function initTempDataHandler() {
    if (!tempDataHandler) {
        tempDataHandler = new TempDataHandler();
        
        // 将实例暴露给全局作用域
        if (typeof window !== 'undefined') {
            window.tempDataHandler = tempDataHandler;
        }
    }
    return tempDataHandler;
}

// 自动初始化（如果在浏览器环境中）
if (typeof window !== 'undefined') {
    // 等待DOM加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTempDataHandler);
    } else {
        initTempDataHandler();
    }
}

// 导出（用于模块化环境）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TempDataHandler, initTempDataHandler };
}
