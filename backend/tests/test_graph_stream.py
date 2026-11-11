import asyncio

from langchain_core.documents import Document

from app.rag import graph
from app.routers.chat import _stream_graph


class FakeRouter:
    async def ainvoke(self, _prompt):
        return graph.RouteDecision(intent="rag")


class FakeChain:
    async def astream(self, _values):
        yield "grounded "
        yield "answer"


def test_nested_rag_subgraph_streams_steps_sources_and_answer(monkeypatch):
    document = Document(
        page_content="Approved deployment procedure.",
        metadata={"doc_id": "DEPLOY-1", "title": "Deployment", "section": "Release"},
    )
    monkeypatch.setattr(graph, "_route_model", FakeRouter())
    monkeypatch.setattr(graph, "hybrid_search", lambda *_args, **_kwargs: [document])
    monkeypatch.setattr(graph, "rerank_docs", lambda _query, docs: docs)
    monkeypatch.setattr(graph, "chain", FakeChain())

    async def collect():
        events = []
        result = None
        async for event, final_result in _stream_graph(
            question="How do we deploy?",
            user_id="u_isha",
            thread_id="stream-test-thread",
            groups={"engineering"},
            history=[],
            repo=None,
            repo_access={},
        ):
            if event is not None:
                events.append(event)
            if final_result is not None:
                result = final_result
                break
        return events, result

    events, result = asyncio.run(collect())

    assert result["answer"] == "grounded answer"
    assert result["sources"][0]["doc_id"] == "DEPLOY-1"
    assert any("data: retrieve" in event for event in events)
    assert any("data: rerank" in event for event in events)
    assert any("data: generate" in event for event in events)
    assert any("grounded answer" in event for event in events)
