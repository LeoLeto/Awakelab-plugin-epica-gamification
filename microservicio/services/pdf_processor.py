import logging
import re

logger = logging.getLogger(__name__)


def extract_clean_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract readable text from PDF using block extraction with per-page fallback."""
    import fitz

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    total_pages = len(doc)
    full_text = ""
    fallback_pages = []

    for page_num, page in enumerate(doc):
        rect = page.rect
        header_limit = rect.height * 0.10
        footer_limit = rect.height * 0.90

        # Primary: block extraction with header/footer trim
        page_text = ""
        blocks = page.get_text("blocks")
        for block in blocks:
            x0, y0, x1, y1, text, block_no, block_type = block
            if block_type == 0 and y0 > header_limit and y1 < footer_limit:
                clean_chunk = text.strip()
                if clean_chunk and not (clean_chunk.isdigit() and len(clean_chunk) < 5):
                    page_text += clean_chunk + "\n\n"

        # Fallback for PDFs with nested XObjects or non-standard block structure
        # (common in PDFs exported from e-learning authoring tools like iSpring/Articulate)
        if len(page_text.strip()) < 30:
            fallback_text = page.get_text("text").strip()
            logger.debug(
                "Page %d: block extraction yielded %d chars, fallback yielded %d chars",
                page_num + 1, len(page_text.strip()), len(fallback_text),
            )
            page_text = fallback_text
            fallback_pages.append(page_num + 1)

        full_text += page_text + "\n\n"

    doc.close()

    full_text = re.sub(r"^\s*Page\s+\d+.*$", "", full_text, flags=re.MULTILINE)
    full_text = re.sub(r"^\s*\d+\s+of\s+\d+.*$", "", full_text, flags=re.MULTILINE)
    full_text = re.sub(r"\n{3,}", "\n\n", full_text)
    result = full_text.strip()

    logger.info(
        "PDF extraction complete: %d pages, %d chars extracted, "
        "fallback used on %d pages: %s",
        total_pages,
        len(result),
        len(fallback_pages),
        fallback_pages if fallback_pages else "none",
    )

    return result
