# 知识图谱（Knowledge Graph）功能深度调研报告

> 调研日期：2026-08-08  
> 调研范围：GitHub 开源项目 + 商业化产品 + 可视化方案 + 投研领域应用  
> 目标：为 Rocket 的知识图谱功能设计提供参考

---

## 一、知识图谱开源项目全景

### 1.1 构建层（Construction）

#### 🔥 Microsoft GraphRAG — 微软官方 GraphRAG 实现

- **GitHub**: [microsoft/graphrag](https://github.com/microsoft/graphrag) · 35,323 ⭐
- **定位**：模块化的基于图的检索增强生成（RAG）系统
- **核心能力**：
  - 从非结构化文本构建层次化知识图谱
  - 社区检测（Community Detection）聚类相关实体
  - 全局查询（Global Search）+ 局部查询（Local Search）双模式
  - 支持多轮推理和跨文档关联
- **技术架构**：
  ```
  原始文档 → 文本分块 → LLM 实体抽取 → 实体消歧 → 关系抽取
         → 社区检测 → 社区摘要 → 图谱存储 → 查询引擎
  ```
- **构建流程**：
  1. **索引阶段**：将文档切分为文本块，用 LLM 提取实体和关系
  2. **图谱构建**：实体消歧（合并同名实体）、关系去重、社区检测
  3. **摘要生成**：为每个社区生成高层摘要
  4. **查询阶段**：Global Search（基于社区摘要回答宏观问题）+ Local Search（基于实体邻居回答具体问题）
- **对 Rocket 的启示**：
  - ✅ 层次化图谱（实体 → 社区 → 全局摘要）非常适合投研场景（公司 → 行业 → 宏观）
  - ✅ 全局/局部双查询模式可映射为"行业趋势分析"和"公司具体问题"
  - ⚠️ 依赖 OpenAI API，成本高；Rocket 可适配本地模型降低成本

---

#### 🔥 LightRAG — 简单快速的 GraphRAG

- **GitHub**: [HKUDS/LightRAG](https://github.com/HKUDS/LightRAG) · 38,624 ⭐
- **定位**：GraphRAG 的轻量高效替代方案
- **核心能力**：
  - 双检索模式：Low-level（具体实体/关系）+ High-level（抽象主题/概念）
  - 增量更新：新文档加入时无需重建整个图谱
  - 图结构 + 向量检索混合
- **与 GraphRAG 对比**：
  | 维度 | GraphRAG | LightRAG |
  |---|---|---|
  | 构建速度 | 慢（需社区检测和多层摘要）| 快（增量更新）|
  | 查询速度 | 中等 | 快 |
  | 全局理解 | 强（社区摘要）| 中等 |
  | 增量更新 | 不支持 | ✅ 支持 |
  | 实现复杂度 | 高 | 低 |
  | 成本 | 高（多轮 LLM 调用）| 低 |
- **对 Rocket 的启示**：
  - ✅ **增量更新** 是 Rocket 的刚需（Workspace 持续新增研报/公告）
  - ✅ **Low/High 双模式** 对应投研中的"具体问题"和"主题趋势"
  - ✅ 实现更简单，适合作为 Rocket 的第一代知识图谱方案

---

#### 🔥 cognee — AI Agent 记忆层知识图谱

- **GitHub**: [topoteretes/cognee](https://github.com/topoteretes/cognee) · 29,852 ⭐
- **定位**：开源 AI 记忆平台，为 Agent 提供持久化长期记忆
- **核心能力**：
  - 自托管知识图谱引擎
  - 跨会话记忆保持
  - 实体提取和关系映射
  - 与 LangChain、LlamaIndex 等框架集成
- **技术特点**：
  - 支持多种存储后端（Neo4j、SQLite、内存）
  - 可配置实体类型和关系类型
  - 自动从对话中提取和更新图谱
- **对 Rocket 的启示**：
  - ✅ **AI 记忆** 概念可直接映射：Workspace 就是 Agent 的"研究记忆"
  - ✅ 跨会话持久化与 Rocket 的 Workspace 现场恢复理念一致
  - ✅ 可配置实体类型（公司、人物、产品、事件、财务指标等）适合投研场景

---

#### 🔥 graphiti — 实时知识图谱

- **GitHub**: [getzep/graphiti](https://github.com/getzep/graphiti) · 29,672 ⭐
- **定位**：为 AI Agent 构建实时知识图谱
- **核心能力**：
  - 实时增量构建（新信息到达即更新图谱）
  - 时间感知（实体和关系带时间戳，可查询历史状态）
  - 事实版本管理（同一实体属性变化时保留历史版本）
- **对 Rocket 的启示**：
  - ✅ **时间感知** 对投研至关重要（公司营收变化、管理层变动、并购事件的时间线）
  - ✅ **事实版本管理** 可追踪"某公司毛利率从 30% 降到 25%"的演变过程

---

#### 🔥 Neo4j LLM Graph Builder — 官方知识图谱构建工具

- **GitHub**: [neo4j-labs/llm-graph-builder](https://github.com/neo4j-labs/llm-graph-builder) · 5,040 ⭐
- **定位**：Neo4j 官方提供的从非结构化数据构建知识图谱的工具
- **核心能力**：
  - 支持 PDF、网页、YouTube、Wikipedia 等多种数据源
  - 使用 LLM 提取实体和关系
  - 自动 schema 推断或自定义 schema
  - 可视化编辑和验证
- **技术架构**：
  ```
  文档 → 文本提取 → LLM Entity/Relation Extraction → Neo4j 存储
  用户可干预：验证实体、合并/拆分、添加关系
  ```
- **对 Rocket 的启示**：
  - ✅ **Schema 可配置**：投研场景可定义专属 schema（公司、人物、产品、事件、财务指标、风险因素）
  - ✅ **人机协同**：AI 提取 + 用户验证/修正，提高准确率
  - ✅ Neo4j 作为存储后端是成熟方案

---

#### 🔥 DeepKE — 知识图谱抽取与构建开源工具包

- **GitHub**: [zjunlp/DeepKE](https://github.com/zjunlp/DeepKE) · 4,455 ⭐
- **定位**：浙江大学 NLP 实验室出品，面向知识图谱抽取的全流程工具
- **核心能力**：
  - 命名实体识别（NER）
  - 关系抽取（RE）
  - 属性抽取（AE）
  - 事件抽取（EE）
  - 支持低资源场景（few-shot、zero-shot）
- **技术特点**：
  - 基于 PyTorch 的深度学习模型
  - 支持 BERT、RoBERTa 等预训练模型
  - 中文支持良好
  - 提供标注工具和评测脚本
- **对 Rocket 的启示**：
  - ✅ 如果不用 LLM 而用专用模型，DeepKE 是更轻量的选择
  - ✅ 中文金融 NER 可基于此微调（识别公司名、人名、财务指标等）
  - ⚠️ 需要训练数据，适合后期优化阶段

---

#### 🔥 GraphGPT — GPT 驱动的知识图谱提取

- **GitHub**: [varunshenoy/GraphGPT](https://github.com/varunshenoy/GraphGPT) · 4,427 ⭐
- **定位**：用 GPT-3 从非结构化文本提取知识图谱的最简实现
- **核心思路**：
  ```
  Prompt: "给定以下文本，提取所有实体和它们之间的关系，
           以 (实体1, 关系, 实体2) 的格式返回..."
  ```
- **对 Rocket 的启示**：
  - ✅ 实现极简，可作为原型快速验证
  - ✅ Prompt 工程是关键，可针对投研场景定制提取模板
  - ⚠️ 仅适合小规模，大规模需用 GraphRAG/LightRAG 的批处理方案

---

#### 🔥 HippoRAG — 受人类记忆启发的 RAG 框架

- **GitHub**: [OSU-NLP-Group/HippoRAG](https://github.com/OSU-NLP-Group/HippoRAG) · 3,923 ⭐
- **定位**：NeurIPS'24 论文实现，RAG + 知识图谱 + Personalized PageRank
- **核心能力**：
  - 用 Personalized PageRank 在知识图谱上做检索
  - 模拟人类长期记忆的联想检索机制
  - 持续整合跨文档知识
- **对 Rocket 的启示**：
  - ✅ **PageRank 式关联发现** 可自动找出最重要的实体和关系
  - ✅ 适合投研中"从一家公司发现产业链关联"的场景

---

### 1.2 存储层（Storage）

| 项目 | 技术 | 特点 | 适用场景 |
|---|---|---|---|
| **Neo4j** | 图数据库 | 成熟、Cypher 查询、可视化工具丰富 | 通用知识图谱存储 |
| **FalkorDB** | Rust + GraphBLAS | 高性能、稀疏矩阵表示、为 GraphRAG 优化 | 大规模图谱、RAG 场景 |
| **memgraph** | C++ 内存图数据库 | Cypher 兼容、实时分析、轻量部署 | 实时更新场景 |
| **SQLite** | 关系数据库 | 零配置、本地优先、单文件 | Rocket 本地优先首选 |
| **JSON/JSONL** | 文件 | 最简单、无需数据库 | 小规模、快速原型 |

**对 Rocket 的建议**：
- **短期**：JSON/JSONL 文件存储（利用现有 Workspace 文件系统，零新增依赖）
- **中期**：SQLite + 内存索引（平衡查询性能和部署简单性）
- **远期**：可选 Neo4j/memgraph（如需要复杂图查询和可视化）

---

### 1.3 可视化层（Visualization）

#### Cytoscape.js — 高性能网络图库

- **GitHub**: [cytoscape/cytoscape.js](https://github.com/cytoscape/cytoscape.js) · 10,200+ ⭐
- **定位**：交互式网络图可视化，适合复杂关系展示
- **核心能力**：
  - 力导向布局（Force-directed layout）
  - 多种布局算法（圆形、网格、同心圆、层次等）
  - 高性能（支持数千节点流畅渲染）
  - 丰富的交互（缩放、拖拽、选中、高亮邻居）
  - 可自定义节点/边的样式
- **典型用法**：
  ```javascript
  cytoscape({
    container: document.getElementById('cy'),
    elements: [
      { data: { id: 'a', label: '贵州茅台' } },
      { data: { id: 'b', label: '白酒行业' } },
      { data: { id: 'e1', source: 'a', target: 'b', label: '属于' } },
    ],
    layout: { name: 'cose', padding: 10 },
    style: [
      { selector: 'node', style: { 'background-color': '#666', label: 'data(label)' } },
      { selector: 'edge', style: { width: 3, 'line-color': '#ccc', 'target-arrow-shape': 'triangle' } },
    ],
  });
  ```

#### D3.js — 灵活但学习曲线陡峭

- **GitHub**: [d3/d3](https://github.com/d3/d3) · 108,000+ ⭐
- **定位**：底层数据可视化库，完全自定义
- **力导向图示例**：
  ```javascript
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2));
  ```
- **对 Rocket 的建议**：除非需要高度自定义，否则优先用封装好的库

#### react-force-graph — React 封装的力导向图

- **GitHub**: [vasturiano/react-force-graph](https://github.com/vasturiano/react-force-graph) · 5,200+ ⭐
- **定位**：React 组件化的 3D/2D 力导向图
- **特点**：声明式 API、支持 3D 展示、VR 支持
- **适用**：需要炫酷效果或 3D 展示的场景

#### vis-network (vis.js) — 易用的网络图

- **GitHub**: [visjs/vis-network](https://github.com/visjs/vis-network) · 8,700+ ⭐
- **定位**：开箱即用的网络图，配置驱动
- **特点**：
  - 配置简单，快速上手
  - 内置多种布局算法
  - 丰富的交互事件
  - 节点可自定义为图片/HTML
- **对 Rocket 的建议**：**首选方案**，因为 Rocket 是 React 应用，vis-network 的封装 [react-graph-vis](https://github.com/crubier/react-graph-vis) 可直接使用

#### sigma.js — 大规模图可视化

- **GitHub**: [jacomyal/sigma.js](https://github.com/jacomyal/sigma.js) · 5,700+ ⭐
- **定位**：专门优化的大规模图渲染（万级节点）
- **适用**：超大规模图谱（如全网公司关联）

#### 可视化方案对比

| 库 | 学习成本 | 性能 | React 集成 | 自定义程度 | 推荐度 |
|---|---|---|---|---|---|
| vis-network | 低 | 中等 | ✅ 有封装 | 中等 | ⭐⭐⭐⭐⭐ |
| Cytoscape.js | 中 | 高 | ✅ 有封装 | 高 | ⭐⭐⭐⭐⭐ |
| react-force-graph | 低 | 中等 | ✅ 原生 | 中等 | ⭐⭐⭐⭐ |
| sigma.js | 中 | 极高 | ⚠️ 需适配 | 高 | ⭐⭐⭐⭐ |
| D3.js | 高 | 高 | ⚠️ 需封装 | 极高 | ⭐⭐⭐ |

**Rocket 推荐**：
- **默认**：vis-network（开发快、效果好、React 集成好）
- **高级用户**：Cytoscape.js（更多布局算法、更强交互）

---

## 二、知识图谱构建方法论

### 2.1 LLM-based 构建（当前主流）

```
┌─────────────────────────────────────────────────────────────┐
│                    知识图谱构建流水线                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  输入文档（PDF/Word/HTML/Markdown）                          │
│       │                                                     │
│       ▼                                                     │
│  文本提取与清洗                                               │
│       │                                                     │
│       ▼                                                     │
│  文本分块（Chunking）                                         │
│       │  ← 按段落/语义/固定长度切分                          │
│       ▼                                                     │
│  LLM 实体抽取（Entity Extraction）                            │
│       │  ← Prompt: "提取所有公司和人物实体..."                  │
│       ▼                                                     │
│  LLM 关系抽取（Relation Extraction）                          │
│       │  ← Prompt: "提取实体之间的关系..."                      │
│       ▼                                                     │
│  实体消歧（Entity Resolution）                                │
│       │  ← "贵州茅台" = "茅台" = "600519.SH"                   │
│       ▼                                                     │
│  关系去重与合并                                               │
│       │                                                     │
│       ▼                                                     │
│  图谱存储（JSON/SQLite/Neo4j）                                │
│       │                                                     │
│       ▼                                                     │
│  向量化索引（可选，用于语义检索）                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Prompt 工程模板（投研场景）

**实体抽取 Prompt**：
```
你是一个金融领域的知识图谱构建专家。请从以下文本中提取所有实体，
按以下类别分类：

实体类型：
- COMPANY: 公司名称（如"贵州茅台"、"腾讯控股"）
- PERSON: 人物名称（如"马化腾"、"任正非"）
- PRODUCT: 产品/服务（如"iPhone"、"微信"）
- INDUSTRY: 行业/板块（如"白酒"、"新能源汽车"）
- FINANCIAL_METRIC: 财务指标（如"毛利率"、"ROE"）
- EVENT: 事件（如"并购"、"定增"、"分红"）
- RISK_FACTOR: 风险因素（如"地缘政治风险"、"原材料涨价"）
- REGULATOR: 监管机构（如"证监会"、"美联储"）

请按以下格式返回：
[
  {"text": "贵州茅台", "type": "COMPANY", "start": 10, "end": 14},
  ...
]

文本：
{document_text}
```

**关系抽取 Prompt**：
```
基于以下实体列表和原文，抽取实体之间的关系：

关系类型：
- BELONGS_TO: 公司属于某行业
- COMPETES_WITH: 公司与公司竞争
- SUPPLIES_TO: 公司向公司供应
- INVESTED_IN: 公司投资/持股
- HAS_PRODUCT: 公司拥有产品
- LED_BY: 公司由人物领导
- REGULATED_BY: 受监管机构监管
- HAS_RISK: 公司面临风险
- ACQUIRED: 公司收购另一家公司
- PARTNERS_WITH: 公司与公司合作

请按以下格式返回：
[
  {"source": "贵州茅台", "relation": "BELONGS_TO", "target": "白酒行业", "evidence": "..."},
  ...
]

实体：{entity_list}
文本：{document_text}
```

### 2.3 实体消歧策略

```
问题："茅台"可能指"贵州茅台（公司）"、"茅台酒（产品）"、"茅台镇（地点）"

策略：
1. 上下文消歧：看周围词汇（"茅台股价"→公司；"喝茅台"→产品）
2. 别名库：维护实体别名映射 {"贵州茅台": ["茅台", "600519.SH", "Moutai"]}
3. LLM 辅助："根据上下文，这里的'茅台'指的是什么？"
4. 用户确认：低置信度时提示用户选择
```

---

## 三、知识图谱呈现方式调研

### 3.1 可视化交互设计模式

#### 模式一：力导向全局图（Force-directed Graph）

**典型产品**：Obsidian Graph View、Roam Research、Athens Research

**特点**：
- 所有节点通过力导向算法自动布局
- 节点距离反映关系紧密程度
- 支持缩放、拖拽、聚焦
- 颜色区分实体类型

**截图描述**（Obsidian Graph View）：
```
┌──────────────────────────────────────┐
│  🔍 搜索...    [颜色分组] [显示设置]   │
├──────────────────────────────────────┤
│                                      │
│      ●───●        ●────●             │
│     /    │\      /      \            │
│    ●     ● ●    ●        ●           │
│     \   /        │      /            │
│      ●─●         ●────●              │
│                                      │
│  [蓝色=公司] [绿色=人物] [红色=事件]   │
└──────────────────────────────────────┘
```

**适用场景**：探索性浏览、发现隐性关联

---

#### 模式二：中心辐射图（Radial / Egocentric）

**典型产品**：ResearchRabbit、Connected Papers

**特点**：
- 以一个核心实体为中心
- 一层一层向外展示关联实体
- 关系类型以不同颜色/线型区分

**截图描述**（ResearchRabbit）：
```
┌──────────────────────────────────────┐
│           ● 父公司                    │
│          /                           │
│    供应商●────●贵州茅台────●竞争对手  │
│          \    |中心节点    /          │
│           ●   |         ●            │
│         子公司  ●产品    行业          │
│                                      │
│  点击节点展开更多关联                  │
└──────────────────────────────────────┘
```

**适用场景**：围绕特定公司/人物的深度研究

---

#### 模式三：时间线 + 图谱混合（Timeline + Graph）

**典型产品**：Kumu、Neo4j Bloom

**特点**：
- X 轴为时间，Y 轴为关系网络
- 事件按时间顺序排列
- 可看到关系和实体的演变

**适用场景**：事件驱动分析（并购史、管理层变动史）

---

#### 模式四：层次树状图（Hierarchical Tree）

**典型产品**：机构图谱、股权穿透工具

**特点**：
- 从上到下的层级结构
- 股权/控制关系清晰
- 支持展开/折叠

**适用场景**：股权结构、组织架构、产业链上下游

---

#### 模式五：表格 + 图谱双视图

**典型产品**：AlphaSense、Hebbia

**特点**：
- 左侧：结构化数据表格（实体列表、关系列表）
- 右侧：可视化图谱
- 点击表格项高亮图谱中对应节点
- 双向联动

**适用场景**：精确查询 + 可视化探索结合

---

### 3.2 交互设计要点

| 交互 | 说明 | 必要性 |
|---|---|---|
| **缩放/平移** | 鼠标滚轮缩放、拖拽平移 | 必须 |
| **点击聚焦** | 点击节点高亮其邻居，其他淡化 | 必须 |
| **双击展开** | 双击节点加载更多关联 | 推荐 |
| **悬停提示** | 鼠标悬停显示实体详情 | 必须 |
| **搜索定位** | 输入实体名自动定位到图中 | 必须 |
| **过滤筛选** | 按实体类型/关系类型过滤 | 推荐 |
| **路径发现** | 选择两个节点，显示最短路径 | 推荐 |
| **时间滑块** | 拖动查看不同时期的图谱状态 | 创新 |
| **图谱演化动画** | 播放图谱随时间的演变过程 | 创新 |
| **导出图片** | 将当前视图导出为 PNG/SVG | 推荐 |

---

## 四、投研领域知识图谱 Schema 设计

### 4.1 实体类型（Node Types）

```typescript
interface EntityNode {
  id: string;           // 唯一标识
  type: EntityType;     // 实体类型
  name: string;         // 显示名称
  aliases: string[];    // 别名（用于消歧）
  properties: Record<string, any>;  // 附加属性
  source: string[];     // 来源文档
  firstSeen: Date;      // 首次出现
  lastUpdated: Date;    // 最后更新
}

type EntityType =
  | 'COMPANY'           // 公司（贵州茅台、腾讯控股）
  | 'PERSON'            // 人物（马化腾、任正非）
  | 'PRODUCT'           // 产品（iPhone、微信）
  | 'INDUSTRY'          // 行业（白酒、新能源汽车）
  | 'SECTOR'            // 板块（沪深300、科创板）
  | 'FINANCIAL_METRIC'  // 财务指标（毛利率、ROE、净利润）
  | 'EVENT'             // 事件（并购、定增、分红、财报发布）
  | 'RISK_FACTOR'       // 风险因素（地缘政治、原材料涨价、汇率波动）
  | 'REGULATOR'         // 监管机构（证监会、美联储、SEC）
  | 'MARKET'            // 市场（A股、港股、美股）
  | 'CONCEPT'           // 概念（AI芯片、碳中和、元宇宙）
  | 'LOCATION'          // 地点（深圳、硅谷、长三角）
  ;
```

### 4.2 关系类型（Edge Types）

```typescript
interface RelationEdge {
  id: string;
  source: string;       // 源实体 ID
  target: string;       // 目标实体 ID
  type: RelationType;   // 关系类型
  properties: {
    confidence: number; // 置信度 0-1
    evidence: string;   // 证据文本
    sourceDoc: string;  // 来源文档
    startDate?: Date;   // 关系起始时间
    endDate?: Date;     // 关系结束时间
    weight?: number;    // 关系权重
  };
}

type RelationType =
  | 'BELONGS_TO'        // 公司属于行业
  | 'LISTED_ON'         // 公司上市于某市场
  | 'COMPETES_WITH'     // 公司与公司竞争
  | 'SUPPLIES_TO'       // A 向 B 供应
  | 'CUSTOMER_OF'       // A 是 B 的客户
  | 'INVESTED_IN'       // A 投资/持股 B
  | 'HAS_SUBSIDIARY'    // A 拥有子公司 B
  | 'HAS_PRODUCT'       // 公司拥有产品
  | 'LED_BY'            // 公司由人物领导
  | 'WORKS_AT'          // 人物工作于公司
  | 'REGULATED_BY'      // 受监管机构监管
  | 'HAS_RISK'          // 面临风险
  | 'ACQUIRED'          // A 收购 B
  | 'PARTNERS_WITH'     // A 与 B 合作
  | 'RELATED_CONCEPT'   // 相关概念
  | 'LOCATED_IN'        // 位于某地
  | 'HAS_METRIC'        // 公司有某财务指标
  | 'PARTICIPATED_IN'   // 参与了某事件
  ;
```

### 4.3 投研场景示例图谱

```
                    ┌─────────────┐
                    │  新能源汽车   │
                    │   (INDUSTRY) │
                    └──────┬──────┘
                           │ BELONGS_TO
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   比亚迪      │   │   宁德时代    │   │   特斯拉      │
│  (COMPANY)   │   │  (COMPANY)   │   │  (COMPANY)   │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │                  │
       │ SUPPLIES_TO      │ SUPPLIES_TO      │ COMPETES_WITH
       │                  │                  │
       ▼                  ▼                  ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  刀片电池     │   │  麒麟电池     │   │   4680电池   │
│  (PRODUCT)   │   │  (PRODUCT)   │   │  (PRODUCT)   │
└──────────────┘   └──────────────┘   └──────────────┘

┌──────────────┐
│   王传福      │
│   (PERSON)   │
└──────┬───────┘
       │ LED_BY
       ▼
┌──────────────┐
│   比亚迪      │
│  (COMPANY)   │
└──────┬───────┘
       │ HAS_RISK
       ▼
┌──────────────┐
│ 原材料涨价    │
│ (RISK_FACTOR)│
└──────────────┘
```

---

## 五、技术方案建议（Rocket 适配）

### 5.1 推荐架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Rocket 知识图谱架构                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  Workspace  │    │  Workspace  │    │  Workspace  │     │
│  │   PDF/DOC   │───→│  Markdown   │───→│   笔记文件   │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│         │                  │                  │             │
│         └──────────────────┼──────────────────┘             │
│                            ▼                                │
│                   ┌─────────────────┐                       │
│                   │  文本提取与清洗   │                       │
│                   │  (MarkItDown)   │                       │
│                   └────────┬────────┘                       │
│                            ▼                                │
│                   ┌─────────────────┐                       │
│                   │   文本分块        │                       │
│                   │  (语义/固定长度)  │                       │
│                   └────────┬────────┘                       │
│                            ▼                                │
│                   ┌─────────────────┐                       │
│                   │  LLM 实体/关系   │                       │
│                   │    抽取 Agent   │                       │
│                   │  (本地/远程 LLM) │                       │
│                   └────────┬────────┘                       │
│                            ▼                                │
│                   ┌─────────────────┐                       │
│                   │  实体消歧与合并   │                       │
│                   │  (别名库 + LLM)  │                       │
│                   └────────┬────────┘                       │
│                            ▼                                │
│              ┌─────────────────────────┐                    │
│              │      知识图谱存储         │                    │
│              │  ┌───────────────────┐  │                    │
│              │  │  图谱数据 (JSON)   │  │                    │
│              │  │  ~/.rocket/kg/     │  │                    │
│              │  └───────────────────┘  │                    │
│              │  ┌───────────────────┐  │                    │
│              │  │  向量索引 (SQLite) │  │                    │
│              │  │  + sqlite-vec     │  │                    │
│              │  └───────────────────┘  │                    │
│              └───────────┬─────────────┘                    │
│                          ▼                                  │
│              ┌─────────────────────────┐                    │
│              │       查询引擎           │                    │
│              │  · 关键词匹配            │                    │
│              │  · 语义检索              │                    │
│              │  · 图遍历查询            │                    │
│              └───────────┬─────────────┘                    │
│                          ▼                                  │
│              ┌─────────────────────────┐                    │
│              │     可视化渲染层         │                    │
│              │  · vis-network /        │                    │
│              │    Cytoscape.js         │                    │
│              │  · React 组件           │                    │
│              └─────────────────────────┘                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 实现阶段规划

#### Phase 1：MVP（2-3 周）

**目标**：Workspace 文档 → 知识图谱 → 基础可视化

**功能**：
- [ ] 从 Workspace Markdown/PDF 提取文本
- [ ] 用 LLM 抽取实体和关系（Prompt 工程）
- [ ] JSON 文件存储图谱数据
- [ ] vis-network 基础可视化（力导向图）
- [ ] 点击节点查看详情（来源文档、证据文本）

**存储结构**：
```
~/.rocket/workspaces/{workspaceId}/
  ├── kg/
  │   ├── entities.json      # 实体列表
  │   ├── relations.json     # 关系列表
  │   └── index.json         # 元数据（最后更新时间等）
```

#### Phase 2：增强（3-4 周）

**目标**：提升准确率和交互体验

**功能**：
- [ ] 实体消歧（别名库 + LLM 辅助）
- [ ] 用户验证/修正界面（人机协同）
- [ ] 按实体类型过滤
- [ ] 搜索定位节点
- [ ] 路径发现（两节点间最短路径）
- [ ] 增量更新（新文档加入时只更新变化部分）

#### Phase 3：智能（4-6 周）

**目标**：与 Agent 深度整合

**功能**：
- [ ] Agent 可查询知识图谱回答问题
- [ ] Agent 自动维护图谱（对话中新增的知识自动入库）
- [ ] 时间感知（实体/关系带时间戳）
- [ ] 图谱演化（查看某个实体/关系的历史变化）
- [ ] 社区检测（自动发现紧密关联的实体群组）
- [ ] SQLite + sqlite-vec 替代 JSON 存储

#### Phase 4：高级（远期）

**功能**：
- [ ] 多 Workspace 联合查询
- [ ] 图谱导出（PNG/SVG/Neo4j）
- [ ] 自定义 Schema
- [ ] 批量数据提取（Matrix 模式）
- [ ] 风险检测 Skill（自动扫描图谱中的风险信号）

### 5.3 Prompt 设计建议

**使用结构化输出（Structured Output）**：

```typescript
// 使用 Claude 的 tool_use 或 OpenAI 的 function_calling
// 确保 LLM 返回标准 JSON，避免解析错误

const extractEntitiesTool = {
  name: "extract_entities",
  description: "从文本中提取金融实体",
  input_schema: {
    type: "object",
    properties: {
      entities: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            type: { 
              type: "string",
              enum: ["COMPANY", "PERSON", "PRODUCT", "INDUSTRY", 
                     "FINANCIAL_METRIC", "EVENT", "RISK_FACTOR", "REGULATOR"]
            },
            confidence: { type: "number", minimum: 0, maximum: 1 }
          },
          required: ["text", "type", "confidence"]
        }
      },
      relations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            source: { type: "string" },
            target: { type: "string" },
            type: { 
              type: "string",
              enum: ["BELONGS_TO", "COMPETES_WITH", "SUPPLIES_TO", 
                     "INVESTED_IN", "LED_BY", "HAS_RISK", "ACQUIRED"]
            },
            evidence: { type: "string" },
            confidence: { type: "number" }
          },
          required: ["source", "target", "type", "evidence", "confidence"]
        }
      }
    },
    required: ["entities", "relations"]
  }
};
```

### 5.4 性能与成本优化

| 优化策略 | 说明 | 效果 |
|---|---|---|
| **本地模型** | 使用 Ollama 本地运行 7B/13B 模型做实体抽取 | 成本降为 0，保护隐私 |
| **批处理** | 多个文本块合并一次性调用 LLM | 减少 API 调用次数 50%+ |
| **缓存** | 已处理的文档哈希缓存，避免重复抽取 | 增量更新时几乎无成本 |
| **置信度过滤** | 只保留 confidence > 0.7 的结果 | 减少噪声，提升质量 |
| **后台索引** | 文档导入后在后台异步构建图谱 | 不阻塞用户操作 |

---

## 六、竞品可视化参考截图

### 6.1 Obsidian Graph View — 笔记知识图谱

```
┌─────────────────────────────────────────────────────────┐
│  Graph view                                    [X] [?]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│              ●────●           ●────●                    │
│             /│    \          /      \                   │
│            ● ●────●        ●        ●                  │
│             \│    /         \      /                    │
│              ●────●           ●────●                    │
│                                                         │
│     ●        ●────●────●         ●────●                 │
│      \      /            \       /    \                 │
│       ●────●              ●────●      ●                 │
│      /      \                                            │
│     ●        ●                                           │
│                                                         │
│  ─────────────────────────────────────────────────     │
│  [搜索...]  深度: 2  [●─── 显示标签]  [● 显示孤立节点]   │
└─────────────────────────────────────────────────────────┘

交互：
- 悬停高亮节点 + 邻居
- 点击打开对应笔记
- 拖拽调整布局
- 滚轮缩放
- 搜索过滤
```

**对 Rocket 的启示**：
- ✅ 简洁的力导向布局，无多余装饰
- ✅ 悬停高亮邻居是核心交互
- ✅ 搜索 + 深度控制帮助聚焦

---

### 6.2 ResearchRabbit — 学术文献关联网络

```
┌─────────────────────────────────────────────────────────┐
│  ResearchRabbit                              [用户头像]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│        ┌───┐                                          │
│        │ 📄 │ ←── Similar Work ──→ ┌───┐             │
│        └───┘                        │ 📄 │             │
│          │                          └───┘             │
│     Authors│                              │            │
│          │                          Authors            │
│          ▼                              ▼             │
│        ●────●                        ●────●            │
│       /      \                      /      \           │
│      ●        ●                    ●        ●          │
│     作者A    作者B                作者C    作者D        │
│                                                         │
│  [📄 种子论文] ── Similar ──→ [📄 相关论文1]            │
│              ── Cited By ──→ [📄 引用论文2]             │
│              ── References ──→ [📄 参考文献3]           │
│                                                         │
└─────────────────────────────────────────────────────────┘

交互：
- 以种子论文为中心辐射展开
- 不同颜色 = 不同关系类型（Similar/Cited By/References）
- 点击节点展开更多关联
- 可直接添加论文到收藏
```

**对 Rocket 的启示**：
- ✅ **中心辐射模式** 非常适合投研中"围绕一家公司展开研究"
- ✅ **关系类型用颜色区分** 一目了然
- ✅ 点击展开更多关联是渐进式探索的好模式

---

### 6.3 Neo4j Bloom — 企业级图可视化

```
┌─────────────────────────────────────────────────────────┐
│  Neo4j Bloom                                     [🔍]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐                                       │
│  │  🔍 搜索...  │                                       │
│  │  Company    │                                       │
│  │  Person     │                                       │
│  │  Product    │                                       │
│  └─────────────┘                                       │
│                                                         │
│        ┌──────────┐                                    │
│        │  Company  │◄─────owns────┐                   │
│        │ [Logo]    │              │                   │
│        │ $100M     │         ┌────┴────┐              │
│        └─────┬─────┘         │ Product  │              │
│              │               │ [Icon]   │              │
│         employs│              │ v2.0    │              │
│              │               └─────────┘              │
│              ▼                                         │
│        ┌──────────┐                                    │
│        │  Person   │                                    │
│        │ [Photo]   │                                    │
│        │ CEO       │                                    │
│        └──────────┘                                    │
│                                                         │
│  右侧面板：                                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │  选中节点详情                                     │   │
│  │  ─────────────                                   │   │
│  │  Name: Company A                                 │   │
│  │  Revenue: $100M                                  │   │
│  │  Industry: Tech                                  │   │
│  │                                                  │   │
│  │  [查看属性] [展开关系] [添加到视图]                │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘

交互：
- 自然语言查询："Show me all companies in Tech industry"
- 右侧详情面板
- 规则驱动的样式（收入 > $1B 的节点更大）
- 场景（Saved views）
```

**对 Rocket 的启示**：
- ✅ **右侧详情面板** 是展示实体属性的标准做法
- ✅ **自然语言查询** 降低使用门槛
- ✅ **规则驱动的样式**（大公司节点更大）直观传达信息
- ⚠️ 企业级工具较重，Rocket 可取其精华做轻量版

---

### 6.4 Kumu — 关系图谱工具

```
┌─────────────────────────────────────────────────────────┐
│  Kumu                                      [New Map]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  左侧：                                                  │
│  ┌─────────────┐                                       │
│  │  元素        │                                       │
│  │  ─────────   │         ●────●                        │
│  │  Company (5) │        / \  / \                       │
│  │  Person (8)  │       ●   ●●   ●                      │
│  │  Product (3) │        \ /  \ /                       │
│  │              │         ●────●                        │
│  │  连接        │                                       │
│  │  ─────────   │                                       │
│  │  owns (4)    │                                       │
│  │  works (8)   │                                       │
│  │  supplies(2) │                                       │
│  └─────────────┘                                       │
│                                                         │
│  底部：                                                  │
│  [筛选: All] [颜色: By Type] [大小: By Revenue] [布局]   │
│                                                         │
└─────────────────────────────────────────────────────────┘

特点：
- 极强的自定义能力（颜色、大小、形状都映射到属性）
- 支持导入 Excel/CSV
- 团队协作
```

**对 Rocket 的启示**：
- ✅ **属性映射到视觉编码**（颜色=类型，大小=营收）是信息密度最大化的好方式
- ✅ **左侧元素/连接列表** 帮助理解图谱构成

---

## 七、推荐 Rocket 的知识图谱 UI 设计

### 7.1 整体布局

```
┌────────────────────────────────────────────────────────────┐
│  Rocket Research Workbench                    [🔍] [⚙️]    │
├──────────┬─────────────────────────────┬───────────────────┤
│          │                             │                   │
│  左栏     │      中栏 - 知识图谱         │      右栏        │
│  导航     │                             │     Agent        │
│          │  ┌───────────────────────┐  │     对话         │
│  📁 资料  │  │  顶部工具栏            │  │                   │
│  📝 笔记  │  │  [🔍搜索] [过滤▼] [布局▼]│  │  ┌─────────────┐ │
│  🔗 图谱  │  └───────────────────────┘  │  │ Agent        │ │
│          │                             │  │ ┌───────────┐│ │
│  ────────│  ┌───────────────────────┐  │  │ │你好，    ││ │
│  📊 自选股│  │                       │  │  │ │有什么    ││ │
│  🏭 行业  │  │    知识图谱可视化      │  │  │ │可以帮您？││ │
│          │  │    (力导向/辐射/层次)   │  │  │ └───────────┘│ │
│  ────────│  │                       │  │  │              │ │
│  ⚙️ 设置  │  │    ●────●────●       │  │  │ ┌───────────┐│ │
│          │  │   / \   │   / \      │  │  │ │用户输入  ││ │
│          │  │  ●   ●──●──●   ●     │  │  │ │框        ││ │
│          │  │   \ /   │   \ /      │  │  │ └───────────┘│ │
│          │  │    ●────●────●       │  │  │              │ │
│          │  │                       │  │  └─────────────┘ │
│          │  └───────────────────────┘  │                   │
│          │                             │                   │
│          │  选中节点时底部展开：          │                   │
│          │  ┌───────────────────────┐  │                   │
│          │  │ 📄 来源文档（3）        │  │                   │
│          │  │ ─────────────────────  │  │                   │
│          │  │ 1. 贵州茅台2024年报.pdf │  │                   │
│          │  │    "...茅台酒的毛利率    │  │                   │
│          │  │    达到91.96%..."       │  │                   │
│          │  │                        │  │                   │
│          │  │ 🔗 关联实体（5）        │  │                   │
│          │  │ ─────────────────────  │  │                   │
│          │  │ 丁雄军 ──LED_BY── 贵州茅台│  │                   │
│          │  │ 白酒行业 ←─BELONGS_TO   │  │                   │
│          │  └───────────────────────┘  │                   │
│          │                             │                   │
├──────────┴─────────────────────────────┴───────────────────┤
│  底部状态栏：当前 Workspace │ 图谱节点: 156 │ 关系: 342 │ 📡   │
└────────────────────────────────────────────────────────────┘
```

### 7.2 节点设计

```
┌────────────────────────────────────────────────────────────┐
│  节点样式（按实体类型）                                      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│   │   🏢        │    │   👤        │    │   📦        │   │
│   │  贵州茅台   │    │   王传福    │    │  刀片电池   │   │
│   │  公司       │    │   人物      │    │  产品       │   │
│   └─────────────┘    └─────────────┘    └─────────────┘   │
│      蓝色底色          绿色底色           橙色底色          │
│                                                            │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│   │   🏭        │    │   ⚠️        │    │   📅        │   │
│   │  新能源汽车 │    │ 原材料涨价 │    │  2024Q3财报 │   │
│   │  行业       │    │  风险       │    │  事件       │   │
│   └─────────────┘    └─────────────┘    └─────────────┘   │
│      紫色底色          红色底色           黄色底色          │
│                                                            │
│  节点大小可映射到属性（如市值、营收等）                      │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 7.3 交互流程

```
用户场景：研究员正在看贵州茅台的研报，想查看相关关联网络

Step 1: 研究员在右栏 Agent 输入：
        "帮我看看贵州茅台的关联图谱"

Step 2: Agent 查询知识图谱，返回结果，中栏自动切换到图谱视图

Step 3: 图谱以"贵州茅台"为中心辐射展示：
        - 一级邻居：白酒行业、丁雄军、茅台酒、五粮液
        - 二级邻居（可展开）：泸州老窖、洋河股份...

Step 4: 研究员点击"白酒行业"节点
        → 高亮该节点和连接
        → 右侧/底部面板显示详情：
          · 行业概况
          · 相关公司列表
          · 来源文档

Step 5: 研究员点击"来源文档"中的某篇研报
        → 中栏切换为 PDF 预览
        → 自动跳转到相关段落

Step 6: 研究员问 Agent：
        "茅台和五粮液在供应链上有什么关联？"
        → Agent 在图谱中查找路径
        → 高亮路径：茅台 ← BELONGS_TO ← 白酒行业 → BELONGS_TO → 五粮液
        → Agent 回答："它们同属白酒行业，在上游..."
```

---

## 八、Sources

- [Microsoft GraphRAG](https://github.com/microsoft/graphrag)
- [LightRAG](https://github.com/HKUDS/LightRAG)
- [cognee](https://github.com/topoteretes/cognee)
- [graphiti](https://github.com/getzep/graphiti)
- [Neo4j LLM Graph Builder](https://github.com/neo4j-labs/llm-graph-builder)
- [DeepKE](https://github.com/zjunlp/DeepKE)
- [GraphGPT](https://github.com/varunshenoy/GraphGPT)
- [HippoRAG](https://github.com/OSU-NLP-Group/HippoRAG)
- [FalkorDB](https://github.com/FalkorDB/FalkorDB)
- [memgraph](https://github.com/memgraph/memgraph)
- [vis-network](https://github.com/visjs/vis-network)
- [Cytoscape.js](https://github.com/cytoscape/cytoscape.js)
- [react-force-graph](https://github.com/vasturiano/react-force-graph)
- [sigma.js](https://github.com/jacomyal/sigma.js)
- [Obsidian](https://obsidian.md/)
- [ResearchRabbit](https://www.researchrabbit.ai/)
- [Neo4j Bloom](https://neo4j.com/bloom/)
- [Kumu](https://kumu.io/)
- [Yuxi](https://github.com/xerrors/Yuxi)
- [awesome-knowledge-graph](https://github.com/husthuke/awesome-knowledge-graph)
- [QASystemOnMedicalKG](https://github.com/liuhuanyong/QASystemOnMedicalKG)
- [claude-obsidian](https://github.com/AgriciDaniel/claude-obsidian)
- [Athens Research](https://github.com/athensresearch/athens)
