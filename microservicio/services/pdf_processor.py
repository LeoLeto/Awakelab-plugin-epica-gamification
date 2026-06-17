import re


def extract_clean_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract readable text from PDF using block extraction with per-page fallback."""
    import fitz

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    full_text = ""

    for page in doc:
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
            page_text = page.get_text("text").strip()

        full_text += page_text + "\n\n"

    doc.close()

    full_text = re.sub(r"^\s*Page\s+\d+.*$", "", full_text, flags=re.MULTILINE)
    full_text = re.sub(r"^\s*\d+\s+of\s+\d+.*$", "", full_text, flags=re.MULTILINE)
    full_text = re.sub(r"\n{3,}", "\n\n", full_text)
    return full_text.strip()
