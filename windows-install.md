# OpenCLI Windows 便携包说明

这个方案的目标不是生成 Windows 原生 `exe`，而是在当前环境中产出一个可分发的 Windows 便携包。

产物特点：

- 在 macOS / Linux 上打包。
- 在 Windows 上解压即可运行。
- Windows 端不需要重新编译项目。
- Windows 端需要预先安装 Node.js 22.19.0 或更高版本。

## 一、打包端操作

在项目根目录执行：

```bash
npm ci
npm run build
node scripts/package-windows-portable.cjs
```

执行完成后，会生成：

```text
artifacts/opencli-windows-portable-v<version>.zip
```

例如当前仓库版本是 `1.7.4-local.0`，则文件名类似：

```text
artifacts/opencli-windows-portable-v1.7.4-local.0.zip
```

## 二、Windows 端运行前提

先安装 Node.js 22.19.0 或更高版本，建议直接安装最新的 Node.js 22 LTS，方式如下：

### 方式 A：用 winget

在 PowerShell 中执行：

```powershell
winget install OpenJS.NodeJS.LTS
```

### 方式 B：官网下载

到 Node.js 官网下载安装 LTS 版本，安装完成后确认：

```powershell
node -v
npm -v
```

建议 `node -v` 输出为 `v22.19.0` 或更高版本。

## 三、Windows 端使用步骤

1. 把 `opencli-windows-portable-v<version>.zip` 解压到一个固定目录，例如：

```text
C:\tools\opencli
```

2. 打开 PowerShell，进入目录：

```powershell
cd C:\tools\opencli\opencli-windows-portable-v<version>
```

3. 先验证是否可运行：

```powershell
.\opencli.cmd --version
.\opencli.cmd list
```

4. 如需诊断环境，可执行：

```powershell
.\opencli.cmd doctor
```

## 四、可选：加入 PATH

如果希望在任意目录直接执行 `opencli`，把解压目录加入系统 PATH。

例如把下面目录加入 PATH：

```text
C:\tools\opencli\opencli-windows-portable-v<version>
```

加入后可直接运行：

```powershell
opencli.cmd --version
```

## 五、浏览器能力说明

如果你要使用浏览器相关命令，例如 `bilibili`、`zhihu`、`twitter`、`browser` 等，还需要安装 Browser Bridge 扩展。

最简单的方式：

1. 到 GitHub Releases 下载扩展 zip。
2. 解压后在 Chrome / Chromium 的 `chrome://extensions` 中开启开发者模式。
3. 选择“加载已解压的扩展程序”。
4. 再执行：

```powershell
.\opencli.cmd doctor
```

## 六、当前方案的边界

- 这不是单文件 `exe`，而是 Node.js 便携运行包。
- 因为项目本体是 Node CLI，所以 Windows 机器仍然需要安装 Node.js。
- 某些外部工具的自动安装命令目前主要偏向 macOS；OpenCLI 主程序本身可运行，但部分“代装外部 CLI”的体验在 Windows 上未完全补齐。

## 七、重新打包

代码有变更后，重新执行：

```bash
npm run build
node scripts/package-windows-portable.cjs
```

旧 zip 会被覆盖重建。
