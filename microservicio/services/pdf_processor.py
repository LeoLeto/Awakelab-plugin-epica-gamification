import re


def extract_clean_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract readable text while skipping top/bottom page noise."""
    import fitz

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    full_text = ""

    for page in doc:
        rect = page.rect
        header_limit = rect.height * 0.10
        footer_limit = rect.height * 0.90

        blocks = page.get_text("blocks")
        for block in blocks:
            x0, y0, x1, y1, text, block_no, block_type = block
            if block_type == 0 and y0 > header_limit and y1 < footer_limit:
                clean_chunk = text.strip()
                if clean_chunk:
                    if clean_chunk.isdigit() and len(clean_chunk) < 5:
                        continue
                    full_text += clean_chunk + "\n\n"

    doc.close()

    full_text = re.sub(r"^\s*Page\s+\d+.*$", "", full_text, flags=re.MULTILINE)
    full_text = re.sub(r"^\s*\d+\s+of\s+\d+.*$", "", full_text, flags=re.MULTILINE)
    full_text = re.sub(r"\n{3,}", "\n\n", full_text)
    return full_text.strip()
