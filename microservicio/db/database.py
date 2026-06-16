import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import pymongo


def _resolve_mongo_uri(mongo_uri: Optional[str]) -> str:
    return (mongo_uri or os.getenv("MONGO_URI", "")).strip()


def _resolve_db_name(mongo_db_name: Optional[str]) -> str:
    return (mongo_db_name or os.getenv("MONGO_DB_NAME", "memory3d")).strip()


def _resolve_collection(mongo_collection: Optional[str]) -> str:
    return (mongo_collection or os.getenv("MONGO_COLLECTION", "memory3d_pairs")).strip()


def save_pairs_document(
    source_type: str,
    source_name: str,
    source_text: str,
    pairs: List[Dict[str, str]],
    chunks: Optional[List[str]] = None,
    mongo_uri: Optional[str] = None,
    mongo_db_name: Optional[str] = None,
    mongo_collection: Optional[str] = None,
) -> bool:
    uri = _resolve_mongo_uri(mongo_uri)
    if not uri:
        return False

    db_name = _resolve_db_name(mongo_db_name)
    collection_name = _resolve_collection(mongo_collection)

    client = pymongo.MongoClient(uri)
    try:
        collection = client[db_name][collection_name]
        document: Dict[str, Any] = {
            "source_type": source_type,
            "source_name": source_name,
            "source_text": source_text,
            "pairs": pairs,
            "chunks": chunks or [],
            "created_at": datetime.now(timezone.utc),
        }
        collection.insert_one(document)
        return True
    finally:
        client.close()
