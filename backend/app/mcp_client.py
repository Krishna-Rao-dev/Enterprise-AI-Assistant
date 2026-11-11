import json
import sys
from typing import Any

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

MCP_SERVER = StdioServerParameters(
    command=sys.executable,
    args=["-m", "app.mcp_server"],
)


async def call_mcp_tool(name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    async with stdio_client(MCP_SERVER) as (read_stream, write_stream):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            tools = await session.list_tools()
            if name not in {tool.name for tool in tools.tools}:
                raise RuntimeError(f"Configured MCP server does not expose {name}")
            result = await session.call_tool(name, arguments)
            if result.isError:
                messages = [
                    item.text for item in result.content
                    if getattr(item, "text", None)
                ]
                raise RuntimeError(
                    "; ".join(messages) or f"MCP tool {name} failed"
                )
            structured = getattr(result, "structuredContent", None)
            if structured is not None:
                return structured
            texts = [
                item.text for item in result.content
                if getattr(item, "text", None)
            ]
            if len(texts) != 1:
                raise RuntimeError(f"MCP tool {name} returned an invalid result")
            try:
                parsed = json.loads(texts[0])
            except json.JSONDecodeError as exc:
                raise RuntimeError(
                    f"MCP tool {name} returned non-JSON data"
                ) from exc
            if not isinstance(parsed, dict):
                raise RuntimeError(f"MCP tool {name} returned an invalid result")
            return parsed
