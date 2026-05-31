# 插件系统开发文档

## 📋 目录

1. [简介](#简介)
2. [快速开始](#快速开始)
3. [插件结构](#插件结构)
4. [核心API](#核心API)
5. [前端API](#前端API)
6. [示例：番茄钟插件](#示例番茄钟插件)
7. [最佳实践](#最佳实践)
8. [常见问题](#常见问题)

---

## 简介

本插件系统是为"密教大会"项目设计的扩展框架，允许第三方开发者轻松创建插件来扩展功能。

### 核心特性

- ✅ **斜杠命令注册** - 在聊天界面添加自定义 `/命令`
- ✅ **Flask蓝图支持** - 完整的后端路由系统
- ✅ **前端API** - 丰富的客户端JavaScript API
- ✅ **事件模拟** - 直接调用AI事件模拟功能
- ✅ **静态文件管理** - 自动加载CSS和JavaScript
- ✅ **热插拔** - 无需修改主程序即可添加/删除插件

---

## 快速开始

### 1. 创建插件目录

在 `web/plugins/` 下创建你的插件文件夹：

```
web/plugins/
└── my_plugin/           # 你的插件名称
    ├── plugin.py        # 必需：插件主文件
    ├── static/          # 可选：静态文件
    │   ├── script.js    # JavaScript文件
    │   └── style.css    # CSS样式
    └── README.md        # 可选：插件说明
```

### 2. 编写插件主文件

创建 `plugin.py`：

```python
from web.plugins.plugin_base import PluginBase

class MyPlugin(PluginBase):
    """我的第一个插件"""
    
    def get_plugin_info(self):
        """返回插件信息"""
        return {
            'id': 'my-plugin',
            'name': '我的插件',
            'version': '1.0.0',
            'description': '这是一个示例插件',
            'author': '你的名字',
            'icon': '🔥'
        }
    
    def initialize(self):
        """初始化插件"""
        # 创建蓝图
        bp = self.create_blueprint('my_plugin', __name__)
        
        # 注册路由
        @bp.route('/hello', methods=['GET'])
        def hello():
            return {'message': 'Hello from my plugin!'}
        
        # 注册斜杠命令
        self.register_command({
            'id': 'my-command',
            'name': '我的命令',
            'description': '执行自定义操作',
            'icon': '⚡',
            'category': 'plugin',
            'action': 'executeMyCommand'  # 对应前端JS函数名
        })
        
        # 注册静态文件
        from pathlib import Path
        plugin_dir = Path(__file__).parent
        self.register_static_file('js', str(plugin_dir / 'static' / 'script.js'))
        self.register_static_file('css', str(plugin_dir / 'static' / 'style.css'))
        
        return True
```

### 3. 编写前端脚本

创建 `static/script.js`：

```javascript
/**
 * 我的插件前端脚本
 */

// 实现命令处理函数（名称必须与 action 一致）
function executeMyCommand() {
    const client = window.pluginClient;
    
    // 检查是否选择了角色
    const role = client.getCurrentRole();
    if (!role) {
        client.showToast('请先选择一个角色', 'warning');
        return;
    }
    
    // 显示提示
    client.showToast('正在执行自定义命令...', 'info');
    
    // 调用后端API
    fetch('/plugins/my-plugin/hello')
        .then(response => response.json())
        .then(data => {
            client.showToast(data.message, 'success');
        })
        .catch(error => {
            client.showToast('执行失败: ' + error, 'error');
        });
}

// 导出到全局
window.executeMyCommand = executeMyCommand;

console.log('✅ 我的插件已加载');
```

### 4. 重启应用

重启Flask应用，插件将自动加载。在聊天输入框中输入 `/`，你会看到你的命令！

---

## 插件结构

### 必需文件

- **`plugin.py`** - 插件主文件，包含插件类

### 推荐文件结构

```
my_plugin/
├── plugin.py           # 插件主文件
├── static/             # 静态资源
│   ├── script.js       # JavaScript
│   ├── style.css       # 样式
│   └── images/         # 图片资源
├── templates/          # 模板文件（如果需要）
├── utils.py            # 工具函数
├── config.py           # 配置文件
└── README.md           # 说明文档
```

---

## 核心API

### PluginBase 基类

所有插件必须继承 `PluginBase` 并实现以下方法：

#### 必需方法

##### `get_plugin_info() -> Dict`

返回插件信息字典：

```python
def get_plugin_info(self):
    return {
        'id': 'unique-plugin-id',        # 唯一ID
        'name': '插件名称',               # 显示名称
        'version': '1.0.0',              # 版本号
        'description': '插件描述',        # 简短描述
        'author': '作者名',               # 作者
        'icon': '🔥'                     # emoji图标
    }
```

##### `initialize() -> bool`

初始化插件，返回 `True` 表示成功，`False` 表示失败：

```python
def initialize(self):
    # 创建蓝图
    bp = self.create_blueprint('my_plugin', __name__)
    
    # 注册路由、命令、静态文件等
    # ...
    
    return True
```

#### 可选方法

##### `on_enable()`

插件启用时调用：

```python
def on_enable(self):
    print("插件已启用")
```

##### `on_disable()`

插件禁用时调用：

```python
def on_disable(self):
    print("插件已禁用")
```

##### `on_uninstall()`

插件卸载时调用：

```python
def on_uninstall(self):
    # 清理资源
    pass
```

### 工具方法

#### `create_blueprint(name, import_name, url_prefix=None) -> Blueprint`

创建Flask蓝图：

```python
bp = self.create_blueprint('my_plugin', __name__)
# 默认URL前缀: /plugins/{plugin_id}
```

#### `register_command(command: Dict)`

注册斜杠命令：

```python
self.register_command({
    'id': 'my-cmd',                  # 命令ID
    'name': '命令名称',               # 显示名称
    'description': '命令描述',        # 描述
    'icon': '⚡',                     # emoji图标
    'category': 'plugin',            # 分类: ai/data/system/plugin
    'action': 'executeMyCommand'     # 前端JS函数名
})
```

#### `register_static_file(file_type, path, inject='body')`

注册静态文件：

```python
self.register_static_file('js', '/path/to/script.js', 'body')
self.register_static_file('css', '/path/to/style.css', 'head')
```

---

## 前端API

### PluginClient 类

前端提供全局 `window.pluginClient` 对象。

#### 基础方法

##### `showToast(message, type='info')`

显示提示消息：

```javascript
pluginClient.showToast('操作成功', 'success');
// 类型: 'info', 'success', 'warning', 'error'
```

##### `showDialog(title, content, onConfirm, onCancel)`

显示对话框：

```javascript
pluginClient.showDialog(
    '确认',
    '<p>是否继续？</p>',
    () => console.log('确认'),
    () => console.log('取消')
);
```

##### `getCurrentRole() -> Object`

获取当前选中的角色：

```javascript
const role = pluginClient.getCurrentRole();
if (role) {
    console.log('当前角色:', role.name);
}
```

#### 角色交互

##### `triggerCharacterMessage(roleName, message, saveToHistory=true) -> Promise`

触发角色发送消息：

```javascript
await pluginClient.triggerCharacterMessage(
    '角色名',
    '你好，这是一条消息',
    true
);
```

##### `simulateAIEvent(roleName, eventDescription) -> Promise`

模拟AI事件（修改角色状态）：

```javascript
await pluginClient.simulateAIEvent(
    '角色名',
    '角色感到非常疲惫，需要休息'
);
```

##### `getChatHistory(roleName, limit=null) -> Promise<Array>`

获取聊天历史：

```javascript
const history = await pluginClient.getChatHistory('角色名', 10);
console.log('最近10条消息:', history);
```

##### `addMessage(message, isUser=false)`

添加消息到聊天界面：

```javascript
pluginClient.addMessage('[系统] 操作完成', false);
```

#### UI组件

##### `createFloatingWindow(content, options) -> string`

创建浮动窗口：

```javascript
const windowId = pluginClient.createFloatingWindow(
    '<div>窗口内容</div>',
    {
        duration: 5000,          // 自动关闭时间（毫秒）
        position: 'bottom-right', // 位置
        className: 'custom-class' // 自定义类名
    }
);
```

##### `closeFloatingWindow(windowId)`

关闭浮动窗口：

```javascript
pluginClient.closeFloatingWindow(windowId);
```

#### HTTP请求

##### `request(url, options) -> Promise<Object>`

发送HTTP请求：

```javascript
const data = await pluginClient.request('/api/endpoint', {
    method: 'POST',
    body: JSON.stringify({ key: 'value' })
});
```

---

## 示例：番茄钟插件

完整的番茄钟插件示例位于 `web/plugins/pomodoro/`，包含：

1. **后端路由** - 处理番茄钟完成、触发角色消息
2. **前端UI** - 计时器界面、浮动窗口
3. **斜杠命令** - `/番茄钟` 启动计时器
4. **角色交互** - 完成后触发角色发送鼓励消息
5. **数据持久化** - 统计完成次数

### 关键代码片段

#### 后端：触发角色消息

```python
@bp.route('/trigger-character', methods=['POST'])
def trigger_character():
    data = request.json
    role_name = data.get('role_name')
    
    # 构建提示消息
    prompt = f"[系统提示] 用户刚刚完成了一个番茄钟计时"
    
    return jsonify({
        'success': True,
        'prompt': prompt,
        'role_name': role_name
    })
```

#### 前端：计时器逻辑

```javascript
async complete() {
    // 调用完成API
    const response = await fetch('/plugins/pomodoro/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            role_name: this.currentRole,
            duration: this.duration / 60
        })
    });
    
    // 触发角色消息
    await this.triggerCharacterMessage();
}
```

---

## 最佳实践

### 1. 命名规范

- **插件ID**: 使用小写字母和连字符，如 `my-awesome-plugin`
- **命令ID**: 前缀加插件ID，如 `my-plugin-command`
- **函数名**: 驼峰命名，如 `executeMyCommand`

### 2. 错误处理

始终使用try-catch处理错误：

```python
def initialize(self):
    try:
        # 插件初始化代码
        return True
    except Exception as e:
        print(f"插件初始化失败: {e}")
        return False
```

### 3. 用户体验

- 使用 `showToast` 提供即时反馈
- 重要操作前使用 `confirm` 确认
- 提供清晰的错误消息

### 4. 性能优化

- 避免在初始化时执行耗时操作
- 使用异步请求避免阻塞UI
- 适当使用缓存

### 5. 安全考虑

- 验证所有用户输入
- 使用Flask session验证用户身份
- 避免暴露敏感信息

---

## 常见问题

### Q: 插件未加载怎么办？

A: 检查以下几点：
1. 插件目录是否在 `web/plugins/` 下
2. 是否有 `plugin.py` 文件
3. 类是否继承 `PluginBase`
4. `initialize()` 是否返回 `True`
5. 查看控制台错误日志

### Q: 斜杠命令不显示？

A: 确保：
1. 调用了 `register_command()`
2. `action` 对应的JS函数已定义
3. 函数导出到全局：`window.functionName = functionName`

### Q: 如何访问角色数据？

A: 使用 `PluginAPI` 或前端 `pluginClient`：

```python
from web.plugins.plugin_api import plugin_api
result = plugin_api.get_role_info('角色名')
```

### Q: 如何调试插件？

A: 
1. 使用 `print()` 输出调试信息
2. 浏览器开发者工具查看JavaScript错误
3. 检查网络请求是否成功
4. 查看Flask控制台日志

### Q: 插件可以访问数据库吗？

A: 可以！插件可以：
- 读取角色配置文件（YAML）
- 调用API访问聊天历史
- 使用项目现有的数据管理模块

### Q: 如何实现插件间通信？

A: 
1. 通过全局JavaScript对象
2. 通过后端API
3. 使用自定义事件系统

---

## 技术支持

如有问题，请：
1. 查看番茄钟示例插件
2. 阅读本文档和API参考
3. 在项目Issues中提问

---

## 更新日志

### v1.0.0 (2025-10-03)
- ✅ 初始版本发布
- ✅ 核心插件系统
- ✅ 斜杠命令支持
- ✅ 番茄钟示范插件
- ✅ 完整文档

---

Happy Coding! 🎉

