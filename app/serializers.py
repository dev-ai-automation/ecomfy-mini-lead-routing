from sqlalchemy import inspect as sa_inspect


def to_dict(obj) -> dict:
    return {c.key: getattr(obj, c.key) for c in sa_inspect(obj).mapper.column_attrs}


def to_list(objs) -> list[dict]:
    return [to_dict(o) for o in objs]
