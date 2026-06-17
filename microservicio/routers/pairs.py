from typing import Optional

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

import db.database as database
from services.pdf_processor import extract_clean_text_from_pdf
from services.pairs_generator import (
    generate_classifier_from_text,
    generate_cloze_from_text,
    generate_intruder_from_text,
    generate_pairs_from_text,
)
from services.text_chunker import chunk_text_by_tokens

router = APIRouter()


class PairsRequest(BaseModel):
    text: str = Field(min_length=20)
    maxPairs: int = Field(default=6, ge=2, le=15)
    maxWordsPerSide: int = Field(default=10, ge=2, le=30)
    difficulty: str = Field(default="medium")
    activityName: str = Field(default="Memory3D")
    model: Optional[str] = None
    openaiKey: Optional[str] = None
    mongoUri: Optional[str] = None
    mongoDbName: Optional[str] = None
    mongoCollection: Optional[str] = None
    gameMode: str = Field(default="memory")


@router.post("/pairs")
async def create_pairs(payload: PairsRequest):
    try:
        gamemode = (payload.gameMode or "memory").strip().lower()
        if gamemode == "dragfill":
            items = generate_cloze_from_text(
                text=payload.text,
                max_items=payload.maxPairs,
                max_words_per_side=payload.maxWordsPerSide,
                difficulty=payload.difficulty,
                model=payload.model,
                openai_key=payload.openaiKey,
            )
        elif gamemode == "classifier":
            items = generate_classifier_from_text(
                text=payload.text,
                max_items=payload.maxPairs,
                max_words_per_side=payload.maxWordsPerSide,
                difficulty=payload.difficulty,
                model=payload.model,
                openai_key=payload.openaiKey,
            )
        elif gamemode == "intruder":
            items = generate_intruder_from_text(
                text=payload.text,
                max_items=payload.maxPairs,
                max_words_per_side=payload.maxWordsPerSide,
                difficulty=payload.difficulty,
                model=payload.model,
                openai_key=payload.openaiKey,
            )
        else:
            gamemode = "memory"
            items = generate_pairs_from_text(
                text=payload.text,
                max_pairs=payload.maxPairs,
                max_words_per_side=payload.maxWordsPerSide,
                difficulty=payload.difficulty,
                model=payload.model,
                openai_key=payload.openaiKey,
            )

        stored = database.save_pairs_document(
            source_type="text",
            source_name=payload.activityName,
            source_text=payload.text,
            pairs=items,
            mongo_uri=payload.mongoUri,
            mongo_db_name=payload.mongoDbName,
            mongo_collection=payload.mongoCollection,
        )

        return {
            "status": "success",
            "mode": gamemode,
            "pairs": items,
            "total_pairs": len(items),
            "stored_in_mongo": stored,
        }
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(exc)},
        )


@router.post("/pairs_from_pdf")
async def create_pairs_from_pdf(
    file: UploadFile = File(...),
    max_pairs: int = Form(6),
    max_words_per_side: int = Form(10),
    difficulty: str = Form("medium"),
    activity_name: str = Form("Memory3D"),
    model: Optional[str] = Form(None),
    openai_key: Optional[str] = Form(None),
    mongo_uri: Optional[str] = Form(None),
    mongo_db_name: Optional[str] = Form(None),
    mongo_collection: Optional[str] = Form(None),
    game_mode: str = Form("memory"),
):
    try:
        max_pairs = max(2, min(max_pairs, 15))
        pdf_bytes = await file.read()
        clean_text = extract_clean_text_from_pdf(pdf_bytes)

        if len(clean_text.strip()) < 50:
            return JSONResponse(
                status_code=422,
                content={
                    "status": "error",
                    "message": (
                        f"The uploaded PDF has too little extractable text "
                        f"({len(clean_text.strip())} chars). "
                        "The PDF may use scanned images or a non-standard text encoding."
                    ),
                },
            )

        gamemode = (game_mode or "memory").strip().lower()
        if gamemode == "dragfill":
            items = generate_cloze_from_text(
                text=clean_text,
                max_items=max_pairs,
                max_words_per_side=max_words_per_side,
                difficulty=difficulty,
                model=model,
                openai_key=openai_key,
            )
        elif gamemode == "classifier":
            items = generate_classifier_from_text(
                text=clean_text,
                max_items=max_pairs,
                max_words_per_side=max_words_per_side,
                difficulty=difficulty,
                model=model,
                openai_key=openai_key,
            )
        elif gamemode == "intruder":
            items = generate_intruder_from_text(
                text=clean_text,
                max_items=max_pairs,
                max_words_per_side=max_words_per_side,
                difficulty=difficulty,
                model=model,
                openai_key=openai_key,
            )
        else:
            gamemode = "memory"
            items = generate_pairs_from_text(
                text=clean_text,
                max_pairs=max_pairs,
                max_words_per_side=max_words_per_side,
                difficulty=difficulty,
                model=model,
                openai_key=openai_key,
            )

        chunks = chunk_text_by_tokens(clean_text, chunk_size=500, overlap=50)

        stored = database.save_pairs_document(
            source_type="pdf",
            source_name=file.filename or activity_name,
            source_text=clean_text,
            pairs=items,
            chunks=chunks,
            mongo_uri=mongo_uri,
            mongo_db_name=mongo_db_name,
            mongo_collection=mongo_collection,
        )

        return {
            "status": "success",
            "mode": gamemode,
            "pairs": items,
            "total_pairs": len(items),
            "chunks": len(chunks),
            "stored_in_mongo": stored,
        }
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(exc)},
        )


@router.post("/debug_pdf")
async def debug_pdf_extraction(file: UploadFile = File(...)):
    """Diagnose PDF extraction without calling OpenAI. Returns per-page stats and a text sample."""
    try:
        import fitz

        pdf_bytes = await file.read()
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        total_pages = len(doc)
        per_page = []

        for page_num, page in enumerate(doc):
            rect = page.rect
            header_limit = rect.height * 0.10
            footer_limit = rect.height * 0.90

            block_chars = 0
            blocks = page.get_text("blocks")
            for block in blocks:
                x0, y0, x1, y1, text, block_no, block_type = block
                if block_type == 0 and y0 > header_limit and y1 < footer_limit:
                    clean_chunk = text.strip()
                    if clean_chunk and not (clean_chunk.isdigit() and len(clean_chunk) < 5):
                        block_chars += len(clean_chunk)

            fallback_chars = len(page.get_text("text").strip())
            used_fallback = block_chars < 30
            per_page.append({
                "page": page_num + 1,
                "block_chars": block_chars,
                "fallback_chars": fallback_chars,
                "used_fallback": used_fallback,
            })

        doc.close()

        clean_text = extract_clean_text_from_pdf(pdf_bytes)
        total_chars = len(clean_text.strip())

        return {
            "status": "success",
            "filename": file.filename,
            "total_pages": total_pages,
            "total_chars_extracted": total_chars,
            "would_pass_threshold": total_chars >= 50,
            "per_page": per_page,
            "text_sample": clean_text[:800] if clean_text else "",
        }
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(exc)},
        )


@router.post("/extract")
async def extract_pdf_text(
    file: UploadFile = File(...),
    mongo_uri: Optional[str] = Form(None),
    mongo_db_name: Optional[str] = Form(None),
    mongo_collection: Optional[str] = Form(None),
):
    try:
        pdf_bytes = await file.read()
        clean_text = extract_clean_text_from_pdf(pdf_bytes)
        chunks = chunk_text_by_tokens(clean_text, chunk_size=500, overlap=50)

        stored = database.save_pairs_document(
            source_type="pdf_extract",
            source_name=file.filename or "uploaded.pdf",
            source_text=clean_text,
            pairs=[],
            chunks=chunks,
            mongo_uri=mongo_uri,
            mongo_db_name=mongo_db_name,
            mongo_collection=mongo_collection,
        )

        return {
            "status": "success",
            "text": clean_text,
            "chunks": chunks,
            "total_chunks": len(chunks),
            "stored_in_mongo": stored,
        }
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(exc)},
        )
