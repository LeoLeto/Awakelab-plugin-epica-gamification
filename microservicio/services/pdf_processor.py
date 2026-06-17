import logging
import re

logger = logging.getLogger(__name__)

_TESSERACT_AVAILABLE = None  # cached after first check


def _check_tesseract() -> bool:
    global _TESSERACT_AVAILABLE
    if _TESSERACT_AVAILABLE is not None:
        return _TESSERACT_AVAILABLE
    try:
        import fitz
        # get_textpage_ocr is only useful when Tesseract tessdata is present.
        # Try a tiny blank document as a probe.
        probe = fitz.open()
        probe.new_page()
        probe[0].get_textpage_ocr(language="eng", dpi=72, full=False)
        probe.close()
        _TESSERACT_AVAILABLE = True
    except Exception:
        _TESSERACT_AVAILABLE = False
    return _TESSERACT_AVAILABLE


def _ocr_page(page) -> str:
    """Render page and OCR with Tesseract via PyMuPDF. Returns '' if unavailable."""
    try:
        tp = page.get_textpage_ocr(language="spa+eng", dpi=150, full=True)
        return page.get_text(textpage=tp).strip()
    except Exception as e:
        logger.debug("OCR failed on page: %s", e)
        return ""


def extract_clean_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract readable text from a PDF.

    Strategy (each applied per-page, stopping at the first that yields content):
    1. Block extraction with header/footer trim (fast, works for real text PDFs).
    2. Full-page get_text("text") (catches nested XObjects from authoring tools).
    3. Tesseract OCR via PyMuPDF (handles image-based / dual-layer PDFs).
    """
    import fitz

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    total_pages = len(doc)
    full_text = ""
    strategy_counts = {"block": 0, "fulltext": 0, "ocr": 0, "empty": 0}

    tesseract_ok = _check_tesseract()
    if not tesseract_ok:
        logger.warning(
            "Tesseract not available — OCR fallback disabled. "
            "Install with: sudo apt-get install -y tesseract-ocr tesseract-ocr-spa"
        )

    for page_num, page in enumerate(doc):
        rect = page.rect
        header_limit = rect.height * 0.10
        footer_limit = rect.height * 0.90

        # Strategy 1: block extraction with header/footer trim
        page_text = ""
        for block in page.get_text("blocks"):
            x0, y0, x1, y1, text, block_no, block_type = block
            if block_type == 0 and y0 > header_limit and y1 < footer_limit:
                clean_chunk = text.strip()
                if clean_chunk and not (clean_chunk.isdigit() and len(clean_chunk) < 5):
                    page_text += clean_chunk + "\n\n"

        if len(page_text.strip()) >= 30:
            strategy_counts["block"] += 1
        else:
            # Strategy 2: full page text (handles nested XObjects)
            page_text = page.get_text("text").strip()
            if len(page_text.strip()) >= 30:
                strategy_counts["fulltext"] += 1
            elif tesseract_ok:
                # Strategy 3: OCR (image-based or dual-layer PDFs)
                page_text = _ocr_page(page)
                if len(page_text.strip()) >= 5:
                    strategy_counts["ocr"] += 1
                    logger.debug("Page %d: OCR yielded %d chars", page_num + 1, len(page_text.strip()))
                else:
                    strategy_counts["empty"] += 1
                    logger.debug("Page %d: all strategies returned empty", page_num + 1)
            else:
                strategy_counts["empty"] += 1

        full_text += page_text + "\n\n"

    doc.close()

    full_text = re.sub(r"^\s*Page\s+\d+.*$", "", full_text, flags=re.MULTILINE)
    full_text = re.sub(r"^\s*\d+\s+of\s+\d+.*$", "", full_text, flags=re.MULTILINE)
    full_text = re.sub(r"\n{3,}", "\n\n", full_text)
    result = full_text.strip()

    logger.info(
        "PDF extraction: %d pages — block=%d fulltext=%d ocr=%d empty=%d — %d total chars",
        total_pages,
        strategy_counts["block"], strategy_counts["fulltext"],
        strategy_counts["ocr"], strategy_counts["empty"],
        len(result),
    )

    return result
