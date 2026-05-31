# 插件模板

这是一个插件开发模板，帮助你快速创建自己的插件。

## 快速开始

### 1. 复制模板

```bash
# 在 web/plugins/ 目录下
cp -r _template my_plugin_name
cd my_plugin_name
```

### 2. 修改插件信息

编辑 `plugin.py`，修改 `get_plugin_info()` 方法：

```python
def get_plugin_info(self):
    return {
        'id': 'my-plugin',        # 你的插件ID
        'name': '我的插件',        # 插件名称
        'version': '1.0.0',
        'description': '插件描述',
        'author': '你的名字',
        'icon': '🎯'
    }
```

### 3. 实现功能

#### 后端（plugin.py）

在 `register_routes()` 中添加API路由：

```python
@bp.route('/my-api', methods=['POST'])
def my_api():
    data = request.json
    # 实现你的逻辑
    return jsonify({'success': True})
```

#### 前端（static/script.js）

实现命令处理函数：

```javascript
function executeMyCommand() {
    const client = window.pluginClient;
    // 实现你的逻辑
}

window.executeMyCommand = executeMyCommand;
```

#### 样式（static/style.css）

添加自定义样式：

```css
.my-plugin-element {
    /* 你的样式 */
}
```

### 4. 测试插件

1. 重启Flask应用
2. 在聊天框输入 `/`
3. 查看你的命令是否出现

## 文件结构

```
my_plugin_name/
├── plugin.py           # 后端逻辑
├── static/
│   ├── script.js       # 前端JavaScript
│   └── style.css       # CSS样式
└── README.md          # 说明文档
```

## 开发提示

### 常用API

**前端**：
- `pluginClient.showToast()` - 显示提示
- `pluginClient.getCurrentRole()` - 获取当前角色
- `pluginClient.triggerCharacterMessage()` - 触发角色消息
- `pluginClient.simulateAIEvent()` - 模拟AI事件

**后端**：
- `self.register_command()` - 注册斜杠命令
- `self.create_blueprint()` - 创建Flask蓝图
- `self.register_static_file()` - 注册静态文件

### 调试技巧

1. **后端调试**：使用 `print()` 输出到控制台
2. **前端调试**：使用浏览器开发者工具
3. **网络调试**：检查Network标签页

### 注意事项

1. 插件ID必须唯一
2. 前端函数必须导出到全局
3. 命令的action必须与JS函数名一致
4. 静态文件路径要正确

## 参考资料

- [完整开发文档](../README.md)
- [番茄钟插件示例](../pomodoro/)
- [API参考](../README.md#核心API)

祝开发愉快！ 🚀

