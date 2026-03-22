# 中文网页智能体平台 V1：可行性与执行路线

## 1. 可行性结论

项目按文档要求 **可行**，但必须严格遵守“先主链路、后增强”的节奏。

### 为什么可行
- 需求文档已主动压缩到 V1，避免了多智能体、MCP 总线、复杂 RPA、企业权限等高复杂度范围。
- 技术栈以 FastAPI + Next.js + PostgreSQL/pgvector + Redis 为主，均适合快速形成可测试的单体式首版。
- 任务清单已按 Phase 0 ~ Phase 6 切分，天然适合逐阶段交付。

### 主要风险
- 外部依赖较多：模型 API、搜索源、网页读取、文件解析、向量检索、后台任务。
- Agent 控制循环如果过早做复杂，会迅速导致可观测性和调试成本失控。
- “引用答案”是主链路能力，若证据池与引用模型设计不稳，后续补救代价很高。

## 2. 建议的实施顺序

### Phase 0：底座先行
1. monorepo 与统一命令入口
2. docker-compose（PostgreSQL + Redis + pgvector）
3. FastAPI 健康检查、统一错误、request_id、日志
4. Next.js 聊天壳子
5. Alembic 与首批核心表
6. CI 最小闭环

### Phase 1：先跑通“聊天 + 持久化 + 模拟流式”
1. sessions/messages/runs 模型与接口
2. `POST /api/v1/chat/stream` 的 SSE 事件协议
3. 前端消息列表、会话列表、run 状态
4. 暂时用 mock assistant 验证端到端链路

### Phase 2：接模型，但先保持单智能体 + 单循环
1. Model adapter 抽象
2. Runtime 状态机骨架
3. 结构化 run 事件与 trace_id/run_id
4. 工具调用 reducer，避免原始工具输出直接灌回模型

### Phase 3：网页研究主链路
1. `web_search`
2. `web_reader`
3. 正文清洗、chunk、证据池
4. 引用答案生成

### Phase 4：文件解析与混合检索
1. 上传接口与文档元数据
2. PDF/DOCX/Markdown 解析
3. chunk + embedding + FTS / vector 混合检索
4. 网页 + 文件联合回答

### Phase 5：后台任务
1. Redis job runner
2. Deep / Background 模式切换
3. 前端研究进度面板

### Phase 6：质量与加固
1. 结构化日志 + Trace
2. 失败重试 / 降级 / 超时
3. 评测集
4. 集成测试与 e2e

## 3. 当前仓库落地策略

本次提交先完成 **Phase 0 的第一批可运行骨架**：
- 目录结构
- FastAPI 健康检查
- Next.js 聊天页面壳子
- 本地基础设施与 CI 脚本

下一次迭代应优先进入：
1. SQLAlchemy Base + Alembic 初始化
2. Session / Message / Run 模型
3. SSE 聊天接口与前端接流
