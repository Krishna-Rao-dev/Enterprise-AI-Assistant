import re
import uuid
from datetime import date
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP
from app.config import JIRA_API_TOKEN, JIRA_BASE_URL, JIRA_EMAIL
from app.db.postgres import (
    AsyncSessionLocal, LeaveBalance, LeaveRequest, User,
)

mcp = FastMCP("enterprise-actions")


def _jira_credentials() -> tuple[str, tuple[str, str]]:
    if not all((JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN)):
        raise RuntimeError(
            "Jira is not configured. Set JIRA_BASE_URL, JIRA_EMAIL, and "
            "JIRA_API_TOKEN (or JIRA_CREDENTIALS_JSON) in the backend environment."
        )
    return JIRA_BASE_URL.rstrip("/"), (JIRA_EMAIL, JIRA_API_TOKEN)


@mcp.tool()
async def jira_get_issue(issue_key: str) -> dict[str, Any]:
    """Fetch a Jira issue's key, summary, status, priority, and URL."""
    if not re.fullmatch(r"[A-Z][A-Z0-9_]*-\d+", issue_key):
        raise ValueError("issue_key must be a Jira key such as PROJ-123")
    base_url, auth = _jira_credentials()
    async with httpx.AsyncClient(
        base_url=base_url,
        auth=auth,
        timeout=20,
    ) as client:
        response = await client.get(
            f"/rest/api/3/issue/{issue_key}",
            params={"fields": "summary,status,priority,project"},
        )
        response.raise_for_status()
    issue = response.json()
    fields = issue.get("fields", {})
    return {
        "key": issue["key"],
        "summary": fields.get("summary", ""),
        "status": fields.get("status", {}).get("name", "Unknown"),
        "priority": fields.get("priority", {}).get("name", "Unspecified"),
        "project": fields.get("project", {}).get("key"),
        "url": f"{base_url}/browse/{issue['key']}",
    }


@mcp.tool()
async def jira_create_issue(
    project_key: str,
    summary: str,
    description: str,
    priority: str,
) -> dict[str, Any]:
    """Create a Jira task. The LangGraph host gates this write behind approval."""
    if not re.fullmatch(r"[A-Z][A-Z0-9_]{1,9}", project_key):
        raise ValueError("project_key must be an uppercase Jira project key")
    if not summary.strip() or len(summary) > 120:
        raise ValueError("summary must contain 1-120 characters")
    if priority not in {"Highest", "High", "Medium", "Low", "Lowest"}:
        raise ValueError("priority is not supported")
    base_url, auth = _jira_credentials()
    issue_fields: dict[str, Any] = {
        "project": {"key": project_key},
        "summary": summary.strip(),
        "issuetype": {"name": "Task"},
        "priority": {"name": priority},
    }
    if description.strip():
        issue_fields["description"] = {
            "type": "doc",
            "version": 1,
            "content": [{
                "type": "paragraph",
                "content": [{"type": "text", "text": description.strip()}],
            }],
        }
    async with httpx.AsyncClient(
        base_url=base_url,
        auth=auth,
        timeout=20,
    ) as client:
        response = await client.post(
            "/rest/api/3/issue",
            json={"fields": issue_fields},
        )
        response.raise_for_status()
    issue = response.json()
    return {
        "key": issue["key"],
        "url": f"{base_url}/browse/{issue['key']}",
    }


@mcp.tool()
async def hr_get_leave_balance(user_id: str) -> dict[str, Any]:
    """Read the caller's leave balance from the HR database."""
    async with AsyncSessionLocal() as session:
        user = await session.get(User, user_id)
        if user is None or not user.is_active:
            raise ValueError("Active employee was not found")
        balance = await session.get(LeaveBalance, user_id)
        if balance is None:
            raise RuntimeError("Leave balance has not been initialized")
        return {
            "user_id": user_id,
            "annual_days": balance.annual_days,
            "used_days": balance.used_days,
            "available_days": balance.annual_days - balance.used_days,
        }


@mcp.tool()
async def hr_submit_leave_request(
    user_id: str,
    start_date: str,
    end_date: str,
    reason: str,
) -> dict[str, Any]:
    """Submit a leave request after the user approves the proposed write."""
    start = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)
    if end < start:
        raise ValueError("end_date must be on or after start_date")
    if not reason.strip() or len(reason) > 500:
        raise ValueError("reason must contain 1-500 characters")

    requested_days = sum(
        1
        for day_number in range((end - start).days + 1)
        if date.fromordinal(start.toordinal() + day_number).weekday() < 5
    )
    async with AsyncSessionLocal() as session:
        user = await session.get(User, user_id)
        if user is None or not user.is_active:
            raise ValueError("Active employee was not found")
        if user.employment_type == "contractor":
            raise PermissionError("Contractors cannot submit paid-leave requests")
        balance = await session.get(LeaveBalance, user_id)
        if balance is None:
            raise RuntimeError("Leave balance has not been initialized")
        available = balance.annual_days - balance.used_days
        if requested_days > available:
            raise ValueError(
                f"Request is for {requested_days} working days; "
                f"only {available} are available"
            )
        request = LeaveRequest(
            request_id=str(uuid.uuid4()),
            user_id=user_id,
            start_date=start,
            end_date=end,
            reason=reason.strip(),
            status="submitted",
        )
        session.add(request)
        await session.commit()
        return {
            "request_id": request.request_id,
            "status": request.status,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "working_days": requested_days,
        }


if __name__ == "__main__":
    mcp.run(transport="stdio")
