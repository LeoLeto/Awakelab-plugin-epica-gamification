from typing import List

import tiktoken


def chunk_text_by_tokens(text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
    if not text.strip():
        return []

    encoding = tiktoken.get_encoding("cl100k_base")
    tokens = encoding.encode(text)

    chunks: List[str] = []
    start = 0
    total = len(tokens)

    while start < total:
        end = min(start + chunk_size, total)
        chunk_tokens = tokens[start:end]
        chunks.append(encoding.decode(chunk_tokens))
        if end >= total:
            break
        start = max(end - overlap, 0)

    return chunks
