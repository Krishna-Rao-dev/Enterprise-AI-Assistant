from langchain_core.documents import Document

from app.rag.retrieval import _acl_filter, _chunk_allowed


def test_policy_access_uses_user_groups_without_repo_acl():
    policy = Document(
        page_content="policy",
        metadata={
            "source_type": "policy",
            "allowed_groups": "engineering,hr",
        },
    )

    assert _chunk_allowed(policy, {"engineering"}, None, {})
    assert not _chunk_allowed(policy, {"finance"}, None, {})


def test_repo_access_requires_document_and_database_group_grants():
    repo_doc = Document(
        page_content="repo",
        metadata={
            "repo": "payments",
            "allowed_groups": "engineering,contractors",
        },
    )
    repo_acl = {"payments": {"engineering"}}

    assert _chunk_allowed(repo_doc, {"engineering"}, None, repo_acl)
    assert not _chunk_allowed(repo_doc, {"contractors"}, None, repo_acl)
    assert not _chunk_allowed(repo_doc, {"engineering"}, "auth", repo_acl)
    assert not _chunk_allowed(repo_doc, {"engineering"}, None, {})


def test_vector_filter_is_fail_closed_to_allowed_repo_and_policy_docs():
    where = _acl_filter(
        {"engineering", "hr"},
        {"payments": {"engineering"}},
        None,
    )

    assert where == {
        "$or": [
            {
                "$and": [
                    {"source_type": "policy"},
                    {"$or": [{"grp_engineering": True}, {"grp_hr": True}]},
                ]
            },
            {
                "$and": [
                    {"repo": "payments"},
                    {"grp_engineering": True},
                ]
            },
        ]
    }


def test_vector_filter_omits_database_denied_repositories():
    where = _acl_filter({"finance"}, {"engineering-only": {"engineering"}}, None)

    assert where == {
        "$and": [{"source_type": "policy"}, {"grp_finance": True}]
    }
