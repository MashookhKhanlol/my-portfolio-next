"""app/services/embeddings.py — Lazy-loaded fastembed wrapper (BAAI/bge-small-en-v1.5)"""

from __future__ import annotations
from typing import List
import asyncio
import numpy as np

_model = None
MODEL_NAME = "BAAI/bge-small-en-v1.5"   # 384 dims, ~130MB, ONNX


def _load_model():
    """Load once, reuse forever. fastembed uses ONNX — very lightweight."""
    global _model
    if _model is None:
        from fastembed import TextEmbedding
        _model = TextEmbedding(model_name=MODEL_NAME)
    return _model


async def embed_texts(texts: List[str]) -> List[List[float]]:
    """Embed a list of texts. Runs in a thread pool to stay non-blocking."""
    loop = asyncio.get_event_loop()

    def _embed():
        model = _load_model()
        embeddings = list(model.embed(texts))
        return [e.tolist() for e in embeddings]

    return await loop.run_in_executor(None, _embed)


async def embed_query(text: str) -> List[float]:
    result = await embed_texts([text])
    return result[0]
