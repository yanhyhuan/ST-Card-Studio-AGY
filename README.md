# 酒馆角色卡工作台 (ST-Card-Studio-AGY)

运行在 Google Antigravity 右侧辅助栏的本地 SillyTavern 角色卡工具面板。用来在写卡和改卡时实时调试状态栏正则、预览 MVU 变量界面，以及离线拆包查看 `.png` / `.json` 角色卡内部结构。

纯本地运行，无第三方 npm 依赖，面板操作本身不消耗模型 Token。

---

## 主要功能

### 1. 状态栏调试
- **双格式正则兼容**：支持导入、编辑和导出角色卡原生正则（`findRegex` / `replaceString`）与酒馆助手正则（`find_regex` / `replace_string`），支持单条调试或多条规则按顺序串联执行。
- **MVU 与酒馆助手接口模拟**：预览沙盒内置 `getVariables`、`insertOrAssignVariables`、`updateVariablesWith`、`eventOn`、`Mvu.events.VARIABLE_UPDATE_ENDED` 等常用模拟桩。写脚本状态栏时不用每次改几行样式就重新打包进酒馆，可直接修改模拟变量 JSON 并手动触发更新事件看局部刷新效果。
- **宽窄屏与底色切换**：支持自适应宽度、`360px`（手机窄屏）、`660px`（桌面消息宽）与深浅画布切换，方便排查窄屏文字挤压或换行破版。
- **真机过滤预检**：自动检查普通楼层中会被真实酒馆 `DOMPurify` 洗掉的 `<script>` 与 `onclick=` 等内联事件，以及误勾 `promptOnly` 未开显示阶段导致界面不渲染的常见配置问题。
- **左侧对话同步**：开启面板右上角「对话同步」后，在左侧对话让 Agent 生成或修改状态栏草稿，右侧画布会自动同步重绘。

### 2. 角色卡拆包
- **本地只读解析**：拖入或选择 `.png` / `.json` 角色卡，直接在内存中读取 `ccv3` / `chara` 数据块（兼容 `tEXt`、`zTXt`、`iTXt`），不修改原图文件，拆包过程不自动执行卡内未知脚本。
- **字数与词元占比统计**：按人设、世界书、开场白、正则、脚本分类统计字符数与粗估词元比例，方便排查卡体量分布。
- **组件查看与一键送预览**：分类浏览内嵌正则、开场白分支、世界书条目（支持关键词筛选，区分常驻与触发词）、随卡脚本与外部链接引用。看到卡内自带的状态栏正则或 HTML 开局页，点一下即可连同匹配的开场白和初始变量一起送进调试台查看渲染效果；也可一键导出无损纯 `.json` 角色卡。

---

## 安装方法

> 环境要求：已安装 Google Antigravity 桌面客户端。

### 方式一：让 Antigravity 自动安装（最省事）

直接在 Antigravity 对话框中发送：

```text
帮我安装这个 Antigravity 插件仓库：https://github.com/yanhyhuan/ST-Card-Studio-AGY
```

### 方式二：命令行安装

```bash
git clone https://github.com/yanhyhuan/ST-Card-Studio-AGY.git
agy plugin install ./ST-Card-Studio-AGY
```

### 方式三：手动解压安装

下载仓库代码或 Release 压缩包，解压放入本机全局插件目录（确保 `plugin.json` 位于 `st-statusbar-preview` 文件夹根目录下）：

- **Windows**：`%USERPROFILE%\.gemini\config\plugins\st-statusbar-preview\`
- **macOS / Linux**：`~/.gemini/config/plugins/st-statusbar-preview/`

---

## 打开方式

安装后无需重启客户端：
1. 在左侧设置 **Customizations → Installed** 中确认「酒馆角色卡工作台」处于开启状态；
2. 在任意对话中对 Agent 说 **「打开酒馆角色卡工作台」** 并点击返回的入口胶囊，或在对话右上角扩展菜单中直接点开右侧栏面板。

---

## 目录结构

```text
├── plugin.json                         # 插件清单
├── assets/
│   └── logo.svg                        # 插件图标
├── skills/
│   └── st-statusbar-preview/
│       └── SKILL.md                    # 供 Agent 呼出面板与推送实时草稿的技能说明
└── sidecars/
    └── preview/
        ├── sidecar.json                # 右侧辅助栏伴生服务定义
        ├── main.mjs                    # 本地回环服务与单文件打包入口
        ├── src-index.html              # 面板结构模板
        ├── styles.css                  # 面板样式
        ├── app.js                      # 正则引擎、预检与沙盒模拟运行时
        ├── xray.js                     # PNG/JSON 角色卡只读解析器
        └── index.html                  # 自动生成的单文件内联产物
```

---

## 边界说明

- 面板内的渲染环境为独立无源沙盒（`sandbox="allow-scripts"`），仅模拟正则替换与常用变量读写，**不展开 `{{user}}` / `{{char}}` 等酒馆宏，也不模拟完整的多楼层存档同步**。
- 字数栏中的词元（Token）数值为按中英文字符比例换算的快速估算值。角色卡正式发布前，仍请导入真实 SillyTavern + TavernHelper 环境完成最终验收。

---

## 开源协议

[MIT License](./LICENSE)
