@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo 正在安装Python依赖包...
echo.

REM 检查Python是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到Python，请先安装Python 3.7或更高版本
    echo 下载地址: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM 优先使用本地虚拟环境（若可用）
set "VENV_PY=%~dp0venv\Scripts\python.exe"
if exist "%VENV_PY%" (
    "%VENV_PY%" --version >nul 2>&1
    if not errorlevel 1 (
        call "%~dp0venv\Scripts\activate.bat"
    ) else (
        echo [WARN] 检测到虚拟环境但Python不可用，改用系统Python
    )
)

REM 升级pip
echo 正在升级pip...
python -m pip install --upgrade pip

REM 安装依赖
echo 正在安装项目依赖...
python -m pip install -r requirements.txt

if errorlevel 1 (
    echo.
    echo 依赖安装失败，正在尝试使用国内镜像源...
    echo.
    echo 尝试清华大学镜像源...
    python -m pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple/
    if errorlevel 1 (
        echo.
        echo 尝试阿里云镜像源...
        python -m pip install -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/
        if errorlevel 1 (
            echo.
            echo 尝试腾讯云镜像源...
            python -m pip install -r requirements.txt -i https://mirrors.cloud.tencent.com/pypi/simple/
            if errorlevel 1 (
                echo.
                echo 尝试豆瓣镜像源...
                python -m pip install -r requirements.txt -i https://pypi.douban.com/simple/
                if errorlevel 1 (
                    echo.
                    echo 所有镜像源都失败了，请检查网络连接或手动安装依赖
                    echo.
                    echo 可用的国内镜像源：
                    echo   清华大学: https://pypi.tuna.tsinghua.edu.cn/simple/
                    echo   阿里云:   https://mirrors.aliyun.com/pypi/simple/
                    echo   腾讯云:   https://mirrors.cloud.tencent.com/pypi/simple/
                    echo   豆瓣:     https://pypi.douban.com/simple/
                    echo   华为云:   https://repo.huaweicloud.com/repository/pypi/simple/
                    echo.
                    echo 手动安装命令示例：
                    echo python -m pip install -r requirements.txt -i [镜像源地址]
                    pause
                    exit /b 1
                )
            )
        )
    )
)

echo.
echo 依赖安装完成！
echo 您现在可以运行 启动.bat 来启动应用程序
pause
