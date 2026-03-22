from app.schemas.run import RunMode


def build_mock_answer(user_message: str, mode: RunMode) -> str:
    normalized = user_message.strip()
    if mode is RunMode.FAST:
        return f"已进入 Fast 模式。我会先基于当前信息快速回应：{normalized}。下一阶段将尽量减少工具调用。"
    if mode is RunMode.BACKGROUND:
        return (
            f"已进入 Background 模式。我会把任务转为较长流程继续处理：{normalized}。"
            "当前为模拟执行，下一阶段会接入后台任务与进度面板。"
        )
    return (
        f"已进入 Deep 模式。我会先拆解你的研究任务：{normalized}。"
        "接下来将逐步接入搜索、网页阅读、证据整合与带引用回答。"
    )
