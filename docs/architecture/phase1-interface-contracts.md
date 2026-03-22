# Phase 1 接口契约（会话 / 消息 / 运行 / SSE）

## 目标
在不引入真实模型和数据库之前，先跑通最小可验证链路：
- 创建会话
- 查询会话与历史消息
- 提交一条用户消息
- 创建 run
- 通过 SSE 返回模拟流式回复
- 保存 assistant 消息并可重新读取

## API 设计

### 1. POST /api/v1/sessions
创建会话。

### 2. GET /api/v1/sessions
返回会话列表，按更新时间倒序。

### 3. GET /api/v1/sessions/{id}
返回会话详情及消息历史。

### 4. POST /api/v1/chat/stream
请求体：
- `session_id`: string
- `message`: string
- `mode`: `fast | deep | background`

SSE 事件：
- `run_started`
- `stage_changed`
- `token`
- `answer_completed`
- `run_failed`

## 当前实现策略
- 先使用进程内内存仓库存储 session / message / run。
- 先用 mock pipeline 模拟 assistant 输出。
- 下一阶段替换为 SQLAlchemy + Alembic + 持久化存储。
