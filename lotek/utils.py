def get_names(index, user_ids):
    if not user_ids:
        return

    from whoosh.query import Or, Term
    terms = [
        Term("id", f"~{user_id}")
        for user_id in user_ids
    ]
    q = Or(terms)

    for hit in index.search(q, limit=len(terms)):
        user_id = hit["id"][1:]
        name = hit.get("name_t", None)
        yield user_id, name
