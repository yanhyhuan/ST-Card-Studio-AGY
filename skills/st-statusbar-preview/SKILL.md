---
name: st-statusbar-preview
description: 配合右侧栏“酒馆角色卡工作台” Sidecar 面板，实时推送状态栏正则、HTML/CSS 片段、测试楼层文本与 MVU 模拟变量 JSON 进行预览调试，或引导用户拖入 PNG/JSON 角色卡拆包查看。
---

# 酒馆角色卡工作台联动指南

本插件在 Antigravity 右侧辅助栏（Auxiliary Pane）提供本地面板：**`st-statusbar-preview/preview`**（显示名称：**酒馆角色卡工作台**）。

## 1. 打开面板

插件已启用时，提供一键开启胶囊：

```markdown
[酒馆角色卡工作台](sidecar://st-statusbar-preview/preview/)
```

若未启用，引导用户前往 `[酒馆角色卡工作台](customization://st-statusbar-preview)` 开启。

## 2. 从对话推送草稿到面板

编写或修改状态栏正则、HTML 或模拟变量后，可写入本地草稿文件同步至右侧栏：

- Windows：`%USERPROFILE%\.gemini\antigravity\st-statusbar-preview\live-draft.json`
- macOS / Linux：`~/.gemini/antigravity/st-statusbar-preview/live-draft.json`

```json
{
  "updatedAt": 1795168800000,
  "title": "状态栏草稿",
  "mode": "regex",
  "scriptName": "状态栏渲染",
  "findRegex": "/<status>([\\s\\S]*?)<\\/status>/gi",
  "replaceString": "<div class=\"card\">$1</div>",
  "trimStrings": [],
  "sampleInput": "正文\n<status>数据</status>",
  "mockVars": {
    "stat_data": {}
  }
}
```

## 3. 验收边界

右侧栏预览用于校验正则捕获、窄屏排版与常见 DOMPurify 过滤风险，发卡前仍需导入真实 SillyTavern 验收。
