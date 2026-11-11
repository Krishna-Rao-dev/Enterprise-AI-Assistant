import pytest

from app.rag.graph import rag_app, validate_approved_arguments


def test_router_graph_contains_a_compiled_rag_subgraph():
    rag_node = rag_app.get_graph().nodes["rag"].data

    assert callable(getattr(rag_node, "get_graph", None))


def test_jira_write_arguments_are_normalized_and_restricted():
    arguments = validate_approved_arguments(
        "jira_create_issue",
        {
            "project_key": " pay ",
            "summary": "  Fix payroll export  ",
            "description": "Reproduce and correct the export failure.",
            "priority": "High",
            "reporter": "untrusted client value",
        },
        "u_isha",
    )

    assert arguments == {
        "project_key": "PAY",
        "summary": "Fix payroll export",
        "description": "Reproduce and correct the export failure.",
        "priority": "High",
    }


@pytest.mark.parametrize(
    "arguments",
    [
        {"project_key": "invalid-key", "summary": "Valid summary"},
        {"project_key": "PAY", "summary": " "},
        {"project_key": "PAY", "summary": "Valid summary", "priority": "Urgent"},
    ],
)
def test_jira_write_arguments_reject_invalid_values(arguments):
    with pytest.raises(ValueError):
        validate_approved_arguments("jira_create_issue", arguments, "u_isha")


def test_leave_request_binds_user_and_validates_dates():
    arguments = validate_approved_arguments(
        "hr_submit_leave_request",
        {
            "user_id": "untrusted-client-value",
            "start_date": "2026-07-06",
            "end_date": "2026-07-08",
            "reason": "Family event",
        },
        "u_isha",
    )

    assert arguments["user_id"] == "u_isha"


def test_leave_request_rejects_reversed_dates():
    with pytest.raises(ValueError, match="on or after"):
        validate_approved_arguments(
            "hr_submit_leave_request",
            {
                "start_date": "2026-07-08",
                "end_date": "2026-07-06",
                "reason": "Family event",
            },
            "u_isha",
        )
