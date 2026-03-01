# 富文本编辑器方案调研

**调研目标**：为公告/商品描述等后台内容选择一套**好用、展示一致、列表等格式无坑**的富文本方案。  
**项目上下文**：Next.js 16、React 19，当前已使用 TipTap（ProseMirror）+ 自写工具栏；此前遇到过 Markdown 编辑器难用、TipTap 有序列表数字不显示等问题。

---

## 1. 候选方案概览

| 方案 | 主流度 | 契合度 | 简洁性 | 生态 |
|------|--------|--------|--------|------|
| **TipTap（当前）** | ★★★★★ | ★★★★★ | ★★★★☆ | ★★★★★ |
| **Lexical + Lexkit** | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | ★★★★☆ |
| **Quill** | ★★★★☆ | ★★★☆☆ | ★★★★★ | ★★★☆☆ |

---

## 2. 分维度说明

### 2.1 主流度

- **TipTap**  
  - `@tiptap/react` 周下载约 **370 万**，`@tiptap/core` 约 **440 万**（npm 2024）。  
  - GitHub 约 **35k+ stars**，被 NYT、The Guardian、Atlassian 等采用，基于 ProseMirror 的 headless 封装，社区活跃。  
  - 结论：**当前 React 生态里最主流的富文本方案之一**。

- **Lexical**  
  - Meta 出品，GitHub 约 **21k–23k stars**，`@lexical/text` 周下载约 **89 万**。  
  - 核心体积小（约 22KB）、性能好，React 18+ 官方支持，React 19 有测试。  
  - 结论：**主流且上升快，但总下载与生态规模仍小于 TipTap**。

- **Quill**  
  - 老牌编辑器，npm 下载量高，API 简单。  
  - 功能与扩展性不如 TipTap/Lexical，大文档和复杂格式支持一般。  
  - 结论：**主流但偏“简单场景”**。

### 2.2 契合度（与当前项目的匹配度）

- **TipTap**  
  - 项目已依赖：`@tiptap/react`、`@tiptap/starter-kit`、`@tiptap/extension-placeholder`，与 Next.js 16、React 19 兼容。  
  - 输出 HTML，与现有 `ProductDescriptionView`（DOMPurify + prose）一致，无需改存储或展示层。  
  - 有序列表数字不显示来自 **CSS 被 preflight 重置**，已通过 `.ProseMirror ol/ul` 的 list-style + padding 修复，属样式问题而非引擎缺陷。  
  - 结论：**零迁移、仅需巩固样式即可**，契合度最高。

- **Lexical + Lexkit**  
  - 需新增：`lexical`、`@lexical/react`、`@lexical/html`、`@lexical/list`、`@lexical/rich-text` 等以及 Lexkit。  
  - 默认输出为 Lexical 节点/JSON，若继续存 HTML 需用 `@lexical/html` 做序列化/反序列化；或改存 JSON 并在前端用 Lexical 渲染，展示层改动大。  
  - 结论：**功能强但接入与数据模型改动明显**，契合度中等。

- **Quill**  
  - 需替换现有 TipTap 组件与存储约定（Delta/HTML）。  
  - 列表与格式表现未必优于当前修好样式后的 TipTap，且扩展性更弱。  
  - 结论：**替换成本不低、收益有限**，契合度一般。

### 2.3 简洁性（上手与维护成本）

- **TipTap**  
  - 已有封装（工具栏 + EditorContent），API 清晰；列表、加粗、斜体等由 StarterKit 提供。  
  - 列表“看不见数字”的修复已在全局 CSS + 组件 class 中完成，后续只需保持这段样式不冲突。  
  - 结论：**当前方案已较简洁，稍作规范即可**。

- **Lexical + Lexkit**  
  - Lexical 需自己组合 Plugin、Node、Listener，Lexkit 减轻一部分但仍有概念负担。  
  - 要接现有 HTML 展示需额外接好 HTML 的 import/export。  
  - 结论：**配置与心智负担明显高于当前 TipTap**。

- **Quill**  
  - API 简单，但功能与 UI 定制不如 TipTap 灵活。  
  - 结论：**使用简单，但能力与扩展性一般**。

### 2.4 生态

- **TipTap**  
  - 扩展多（协作、代码块、表格、Placeholder 等），文档全，Headless UI 示例多，与 Tailwind/Radix 风格一致。  
  - 结论：**生态最好**。

- **Lexical**  
  - 插件体系完整，Lexkit 提供 25+ 扩展；文档和示例相对分散。  
  - 结论：**生态良好但不如 TipTap 成体系**。

- **Quill**  
  - 模块化但高级能力（如协同、复杂列表）生态弱于前两者。  
  - 结论：**生态够用但偏基础**。

---

## 3. 有序列表“看不见数字”的成因与现状

- **原因**：Tailwind preflight 对 `ul/ol` 设置了 `list-style: none`，ProseMirror 渲染的 `<ol>` 没有恢复 `list-style-type` 和合适 `padding`，导致数字不显示或挤在一起。  
- **处理**：  
  - 在 `app/globals.css` 中为 `.ProseMirror ol/ul` 设置 `list-style-type`、`list-style-position`、`padding-left`，并为 `li::marker` 设置 `color: var(--foreground)`。  
  - 在 `RichTextEditor` 的 `EditorContent` 上增加 Tailwind 的列表相关类（如 `[&_.ProseMirror_ol]:list-decimal`、`pl-6` 等）作为双保险。  
- **结论**：这是**样式问题**，不是 TipTap/ProseMirror 的 bug；当前修复是业界常见做法（Stack Overflow、Tiptap 讨论区均有类似方案）。  
- 若仍有个别主题或嵌套下显示异常，可在同一套 CSS 里继续微调选择器或 `padding`，无需换编辑器。

---

## 4. 最终建议

- **推荐：继续采用 TipTap，并视需要再巩固一次样式与交互。**  
  - 理由：  
    1. **契合度**：已集成、出 HTML、与现有展示与存储完全兼容，无需改库或改数据。  
    2. **主流度与生态**：下载量与 star 数领先，文档和扩展齐全，长期维护有保障。  
    3. **问题性质**：当前痛点（列表数字不显示）已通过 CSS 修复，属样式层，不依赖“换一个编辑器”才能解决。  
    4. **成本**：不引入新依赖、不重写表单与展示逻辑，只需维护好现有 ProseMirror 列表样式即可。

- **可选增强（不换库）**  
  - 在 `RichTextEditor` 内为编辑区增加与前台一致的 **prose** 类（如 `prose prose-sm`），使编辑时预览效果更接近前台。  
  - 若后续需要表格、代码块等，可继续用 TipTap 官方扩展（Table、CodeBlock 等）按需接入。

- **何时再考虑 Lexical**  
  - 若未来有**极强性能诉求**（如超长文档、移动端低端机）或**深度定制节点/协同**，再评估 Lexical + Lexkit 的迁移成本与收益更合适；当前公告/商品描述场景下 TipTap 已足够且更省心。

---

## 5. 参考资料（摘要）

- TipTap: [npm @tiptap/react](https://www.npmjs.com/package/@tiptap/react), [GitHub](https://github.com/ueberdosis/tiptap), [OrderedList extension](https://tiptap.dev/docs/editor/extensions/nodes/ordered-list).  
- Lexical: [Lexical](https://lexical.dev/docs/getting-started/react), [npm lexical](https://www.npmjs.com/package/lexical).  
- Lexkit: [LexKit Get Started](https://lexkit.dev/docs/get-started).  
- 列表样式: [Can't see numbers in ol li list (Stack Overflow)](https://stackoverflow.com/questions/32524653/cant-see-numbers-in-ol-li-list), Tiptap 官方文档与 GitHub discussions 中关于 list 样式的说明。
