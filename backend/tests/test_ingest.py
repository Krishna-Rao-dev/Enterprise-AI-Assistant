import pytest

from ingest import table_chunks, validate_repo


def test_table_chunks_repeat_header_and_separator():
    rows = [f"| item {index} | value |" for index in range(31)]
    table = "\n".join(["| name | value |", "| --- | --- |", *rows])

    chunks = list(table_chunks(table, max_rows=15))

    assert len(chunks) == 3
    assert all(chunk.startswith("| name | value |\n| --- | --- |") for chunk in chunks)
    assert [len(chunk.splitlines()) - 2 for chunk in chunks] == [15, 15, 1]


def test_repo_metadata_requires_nonempty_known_groups():
    with pytest.raises(ValueError, match="must not be empty"):
        validate_repo({
            "doc_id": "REPO-1",
            "title": "Repository guide",
            "repo": "example",
            "allowed_groups": [],
        }, "repo.md")

    with pytest.raises(ValueError, match="unknown groups"):
        validate_repo({
            "doc_id": "REPO-1",
            "title": "Repository guide",
            "repo": "example",
            "allowed_groups": ["made_up"],
        }, "repo.md")
