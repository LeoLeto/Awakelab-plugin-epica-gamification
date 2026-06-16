import json
import os
import re
from typing import Any, Dict, List, Optional

from openai import OpenAI


MAX_PAIRS_LIMIT = 15
MAX_CLOZE_LIMIT = 15
MAX_CLASSIFIER_LIMIT = 15
MAX_INTRUDER_LIMIT = 15


def limit_words(text: str, max_words: int) -> str:
    clean = re.sub(r"\s+", " ", text or "").strip()
    if not clean:
        return ""
    words = clean.split(" ")
    return " ".join(words[:max_words]).strip()


def normalize_pairs(raw: Any, max_words_per_side: int) -> List[Dict[str, str]]:
    if not isinstance(raw, list):
        return []

    normalized: List[Dict[str, str]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue

        question = str(item.get("question", item.get("q", ""))).strip()
        answer = str(item.get("answer", item.get("a", ""))).strip()
        question = limit_words(question, max_words_per_side)
        answer = limit_words(answer, max_words_per_side)

        if question and answer:
            normalized.append({"question": question, "answer": answer})

    return normalized


def normalize_cloze_items(raw: Any, max_words_per_side: int) -> List[Dict[str, Any]]:
    if not isinstance(raw, list):
        return []

    normalized: List[Dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue

        sentence = str(
            item.get("sentence", item.get("text", item.get("phrase", "")))
        ).strip()
        answer = str(item.get("answer", item.get("word", ""))).strip()
        sentence = re.sub(r"\s+", " ", sentence)
        answer = limit_words(answer, max_words_per_side)

        if not sentence or not answer:
            continue

        # Normaliza el hueco visual.
        sentence = sentence.replace("{{blank}}", "_____").replace("___", "_____")
        if "_____" not in sentence:
            pattern = re.compile(r"\b" + re.escape(answer) + r"\b", re.IGNORECASE)
            sentence, replaced = pattern.subn("_____", sentence, count=1)
            if replaced == 0:
                continue

        options_raw = item.get("options", [])
        if isinstance(options_raw, str):
            options_raw = [p.strip() for p in options_raw.split(",")]
        if not isinstance(options_raw, list):
            options_raw = []

        options = []
        seen = set()
        for opt in options_raw:
            val = limit_words(str(opt).strip(), max_words_per_side)
            key = val.lower()
            if not val or key in seen:
                continue
            seen.add(key)
            options.append(val)

        if answer.lower() not in seen:
            options.append(answer)

        if len(options) < 3:
            continue

        normalized.append(
            {
                "sentence": sentence,
                "answer": answer,
                "options": options[:6],
            }
        )

    return normalized


def normalize_classifier_items(raw: Any, max_words_per_side: int) -> List[Dict[str, str]]:
    if not isinstance(raw, list):
        return []

    normalized: List[Dict[str, str]] = []
    seen = set()
    for item in raw:
        if not isinstance(item, dict):
            continue

        concept = str(
            item.get("concept", item.get("term", item.get("item", item.get("question", ""))))
        ).strip()
        category = str(
            item.get("category", item.get("group", item.get("class", item.get("answer", ""))))
        ).strip()
        concept = limit_words(concept, max_words_per_side)
        category = limit_words(category, max_words_per_side)

        if not concept or not category:
            continue

        key = (concept.lower(), category.lower())
        if key in seen:
            continue
        seen.add(key)
        normalized.append({"concept": concept, "category": category})

    return normalized


def normalize_intruder_items(raw: Any, max_words_per_side: int) -> List[Dict[str, Any]]:
    if not isinstance(raw, list):
        return []

    normalized: List[Dict[str, Any]] = []
    seen = set()
    for item in raw:
        if not isinstance(item, dict):
            continue

        category = str(item.get("category", item.get("topic", item.get("theme", "")))).strip()
        intruder = str(item.get("intruder", item.get("odd", item.get("wrong", "")))).strip()
        category = limit_words(category, max_words_per_side)
        intruder = limit_words(intruder, max_words_per_side)

        options_raw = item.get("options", [])
        if isinstance(options_raw, str):
            options_raw = [p.strip() for p in options_raw.split(",")]
        if not isinstance(options_raw, list):
            options_raw = []

        options: List[str] = []
        seen_options = set()
        for opt in options_raw:
            val = limit_words(str(opt).strip(), max_words_per_side)
            key = val.lower()
            if not val or key in seen_options:
                continue
            seen_options.add(key)
            options.append(val)

        if intruder and intruder.lower() not in seen_options:
            options.append(intruder)
            seen_options.add(intruder.lower())

        if not category or not intruder or len(options) < 4:
            continue

        options = options[:4]
        if intruder.lower() not in [opt.lower() for opt in options]:
            continue

        key = (category.lower(), intruder.lower(), tuple(sorted([opt.lower() for opt in options])))
        if key in seen:
            continue
        seen.add(key)

        normalized.append(
            {
                "category": category,
                "intruder": intruder,
                "options": options,
            }
        )

    return normalized


def detect_language_from_text(text: str) -> str:
    sample = (text or "").lower()
    if not sample:
        return "es"

    # Fallback robusto para textos cortos o con OCR irregular.
    accent_hits = len(re.findall(r"[\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1\u00fc]", sample))
    es_hits = len(re.findall(r"\b(el|la|los|las|de|del|que|y|en|para|con|una|un|es|se|por|como)\b", sample))
    en_hits = len(re.findall(r"\b(the|and|of|to|in|for|with|is|are|on|that|this|as|by|from)\b", sample))

    es_score = accent_hits * 2 + es_hits
    en_score = en_hits
    return "es" if es_score >= en_score else "en"


def language_label(lang: str) -> str:
    return "Spanish" if lang == "es" else "English"


def pairs_match_language(pairs: List[Dict[str, str]], lang: str) -> bool:
    if not pairs:
        return False

    merged = " ".join(
        (str(item.get("question", "")) + " " + str(item.get("answer", ""))).strip()
        for item in pairs
        if isinstance(item, dict)
    ).lower()
    if not merged:
        return False

    if lang == "es":
        es_markers = len(
            re.findall(
                r"[\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1\u00fc]|\b(el|la|los|las|de|del|que|y|en|para|con|una|un|es|se|por|como)\b",
                merged,
            )
        )
        en_markers = len(re.findall(r"\b(the|and|of|to|in|for|with|is|are|on|that|this|as|by|from)\b", merged))
        return es_markers >= en_markers

    en_markers = len(re.findall(r"\b(the|and|of|to|in|for|with|is|are|on|that|this|as|by|from)\b", merged))
    es_markers = len(
        re.findall(
            r"[\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1\u00fc]|\b(el|la|los|las|de|del|que|y|en|para|con|una|un|es|se|por|como)\b",
            merged,
        )
    )
    return en_markers >= es_markers


def generate_pairs_from_text(
    text: str,
    max_pairs: int = 6,
    max_words_per_side: int = 10,
    difficulty: str = "medium",
    model: Optional[str] = None,
    openai_key: Optional[str] = None,
) -> List[Dict[str, str]]:
    api_key = openai_key or os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured.")

    use_model = model or os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    max_pairs = max(2, min(max_pairs, MAX_PAIRS_LIMIT))
    max_words_per_side = max(2, min(max_words_per_side, 30))
    difficulty = (difficulty or "medium").strip().lower()
    if difficulty not in {"easy", "medium", "hard"}:
        difficulty = "medium"

    client = OpenAI(api_key=api_key)
    target_lang = detect_language_from_text(text)
    target_lang_label = language_label(target_lang)

    system_prompt = (
        "You create memory game pairs from educational text. "
        "Return concise and factual question-answer pairs. "
        "Each side must be short and clear. "
        "Always keep the same language as the source text."
    )

    user_prompt = f"""
Generate exactly {max_pairs} question-answer pairs from the provided text.
Hard constraints:
- Output must be strict JSON object.
- Use key "pairs" with an array of objects.
- Each object has "question" and "answer".
- Max {max_words_per_side} words per question.
- Max {max_words_per_side} words per answer.
- No duplicates.
- No markdown.
- Language must be exactly: {target_lang_label}.
- If source text is Spanish, output Spanish only.
- If source text is English, output English only.
- Difficulty level: {difficulty}.
- easy: very direct and basic recall.
- medium: conceptual but straightforward.
- hard: requires deeper understanding and more precise wording.

Text:
\"\"\"
{text}
\"\"\"
"""

    def request_pairs(stronger_language_lock: bool = False) -> List[Dict[str, str]]:
        extra_rule = ""
        if stronger_language_lock:
            extra_rule = (
                f'\nSTRICT RULE: every "question" and "answer" must be in {target_lang_label}. '
                "Do not mix languages."
            )

        response = client.chat.completions.create(
            model=use_model,
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt + extra_rule},
            ],
        )

        content = response.choices[0].message.content or "{}"
        parsed = json.loads(content)
        return normalize_pairs(parsed.get("pairs", []), max_words_per_side)

    pairs = request_pairs(stronger_language_lock=False)
    if pairs and not pairs_match_language(pairs, target_lang):
        pairs = request_pairs(stronger_language_lock=True)

    if not pairs:
        raise RuntimeError("No valid pairs were generated.")

    return pairs[:max_pairs]


def generate_cloze_from_text(
    text: str,
    max_items: int = 6,
    max_words_per_side: int = 10,
    difficulty: str = "medium",
    model: Optional[str] = None,
    openai_key: Optional[str] = None,
) -> List[Dict[str, Any]]:
    api_key = openai_key or os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured.")

    use_model = model or os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    max_items = max(2, min(max_items, MAX_CLOZE_LIMIT))
    max_words_per_side = max(2, min(max_words_per_side, 30))
    difficulty = (difficulty or "medium").strip().lower()
    if difficulty not in {"easy", "medium", "hard"}:
        difficulty = "medium"

    client = OpenAI(api_key=api_key)
    target_lang = detect_language_from_text(text)
    target_lang_label = language_label(target_lang)

    system_prompt = (
        "You create educational fill-in-the-blank exercises from source text. "
        "Return concise and factual items. "
        "Always keep the same language as the source text."
    )

    user_prompt = f"""
Generate exactly {max_items} fill-in-the-blank items from the provided text.
Hard constraints:
- Output must be strict JSON object.
- Use key "items" with an array of objects.
- Each object has:
  - "sentence": one sentence containing exactly one blank using five underscores "_____"
  - "answer": the missing word or short term
  - "options": array with 4 options including the answer
- Max {max_words_per_side} words for "answer" and each option.
- No duplicates.
- No markdown.
- Language must be exactly: {target_lang_label}.
- Difficulty level: {difficulty}.

Text:
\"\"\"
{text}
\"\"\"
"""

    def request_items(stronger_language_lock: bool = False) -> List[Dict[str, Any]]:
        extra_rule = ""
        if stronger_language_lock:
            extra_rule = (
                f'\nSTRICT RULE: every "sentence", "answer" and option must be in {target_lang_label}.'
            )

        response = client.chat.completions.create(
            model=use_model,
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt + extra_rule},
            ],
        )

        content = response.choices[0].message.content or "{}"
        parsed = json.loads(content)
        return normalize_cloze_items(parsed.get("items", []), max_words_per_side)

    items = request_items(stronger_language_lock=False)
    if not items:
        items = request_items(stronger_language_lock=True)
    if not items:
        raise RuntimeError("No valid cloze items were generated.")

    return items[:max_items]


def generate_classifier_from_text(
    text: str,
    max_items: int = 6,
    max_words_per_side: int = 10,
    difficulty: str = "medium",
    model: Optional[str] = None,
    openai_key: Optional[str] = None,
) -> List[Dict[str, str]]:
    api_key = openai_key or os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured.")

    use_model = model or os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    max_items = max(2, min(max_items, MAX_CLASSIFIER_LIMIT))
    max_words_per_side = max(2, min(max_words_per_side, 30))
    difficulty = (difficulty or "medium").strip().lower()
    if difficulty not in {"easy", "medium", "hard"}:
        difficulty = "medium"

    client = OpenAI(api_key=api_key)
    target_lang = detect_language_from_text(text)
    target_lang_label = language_label(target_lang)

    system_prompt = (
        "You create educational classifier items from source text. "
        "Return concise concept-category mappings. "
        "Always keep the same language as the source text."
    )

    user_prompt = f"""
Generate exactly {max_items} classifier items from the provided text.
Hard constraints:
- Output must be strict JSON object.
- Use key "items" with an array of objects.
- Each object has:
  - "concept": term to classify
  - "category": correct category label
- Keep each concept and category under {max_words_per_side} words.
- Use exactly 2 different category labels in total.
- Category labels must be meaningful topic names derived from the text.
- Do NOT use generic labels like: left, right, gameplay, category 1, category 2, group 1, group 2.
- Reuse the same exact spelling for those 2 labels in all items.
- Distribute items across both categories (no empty category).
- No duplicates.
- No markdown.
- Language must be exactly: {target_lang_label}.
- Difficulty level: {difficulty}.

Text:
\"\"\"
{text}
\"\"\"
"""

    def is_generic_category_label(label: str) -> bool:
        clean = str(label or "").strip().lower()
        if not clean:
            return True
        generic_patterns = [
            r"\bleft\b",
            r"\bright\b",
            r"\bgameplay\b",
            r"\bcategory\b",
            r"\bgroup\b",
            r"\bside\b",
            r"^\s*(cat|grp)\s*\d+\s*$",
            r"^\s*(category|group|label)\s*\d+\s*$",
        ]
        for pattern in generic_patterns:
            if re.search(pattern, clean):
                return True
        return False

    def has_exactly_two_categories(items: List[Dict[str, str]]) -> bool:
        cats = []
        seen = set()
        for it in items:
            cat = str(it.get("category", "")).strip().lower()
            if not cat or cat in seen:
                continue
            seen.add(cat)
            cats.append(cat)
        if len(cats) != 2:
            return False
        for cat in cats:
            if is_generic_category_label(cat):
                return False
        return True

    def request_items(strict: bool = False) -> List[Dict[str, str]]:
        extra_rule = ""
        if strict:
            extra_rule = (
                "\nSTRICT RULE: return exactly "
                f"{max_items} items and exactly 2 categories only. "
                "Category labels must be real topic names from the text, never generic placeholders. "
                "If needed, regenerate internally until constraints are met."
            )

        response = client.chat.completions.create(
            model=use_model,
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt + extra_rule},
            ],
        )

        content = response.choices[0].message.content or "{}"
        parsed = json.loads(content)
        return normalize_classifier_items(parsed.get("items", []), max_words_per_side)

    items = request_items(strict=False)
    if not items or len(items) < max_items or not has_exactly_two_categories(items):
        items = request_items(strict=True)
    if not items:
        raise RuntimeError("No valid classifier items were generated.")

    return items[:max_items]


def generate_intruder_from_text(
    text: str,
    max_items: int = 6,
    max_words_per_side: int = 10,
    difficulty: str = "medium",
    model: Optional[str] = None,
    openai_key: Optional[str] = None,
) -> List[Dict[str, Any]]:
    api_key = openai_key or os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured.")

    use_model = model or os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    max_items = max(2, min(max_items, MAX_INTRUDER_LIMIT))
    max_words_per_side = max(2, min(max_words_per_side, 30))
    difficulty = (difficulty or "medium").strip().lower()
    if difficulty not in {"easy", "medium", "hard"}:
        difficulty = "medium"

    client = OpenAI(api_key=api_key)
    target_lang = detect_language_from_text(text)
    target_lang_label = language_label(target_lang)

    system_prompt = (
        "You create educational odd-one-out items from source text. "
        "Each item has one category, three valid examples and one intruder that does not fit. "
        "Always keep the same language as the source text."
    )

    user_prompt = f"""
Generate exactly {max_items} odd-one-out items from the provided text.
Hard constraints:
- Output must be strict JSON object.
- Use key "items" with an array of objects.
- Each object has:
  - "category": category being tested
  - "options": exactly 4 short options
  - "intruder": the option that does NOT belong to category
- Exactly one intruder per item.
- At least 2 different categories across the full response.
- Keep category and options under {max_words_per_side} words.
- No duplicates.
- No markdown.
- Language must be exactly: {target_lang_label}.
- Difficulty level: {difficulty}.

Text:
\"\"\"
{text}
\"\"\"
"""

    def has_min_category_variety(items: List[Dict[str, Any]]) -> bool:
        categories = set()
        for item in items:
            category = str(item.get("category", "")).strip().lower()
            if category:
                categories.add(category)
        return len(categories) >= 2

    def request_items(strict: bool = False) -> List[Dict[str, Any]]:
        extra_rule = ""
        if strict:
            extra_rule = (
                f"\nSTRICT RULE: return exactly {max_items} items and ensure at least 2 different categories."
            )
        response = client.chat.completions.create(
            model=use_model,
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt + extra_rule},
            ],
        )
        content = response.choices[0].message.content or "{}"
        parsed = json.loads(content)
        return normalize_intruder_items(parsed.get("items", []), max_words_per_side)

    items = request_items(strict=False)
    if len(items) < max_items or not has_min_category_variety(items):
        items = request_items(strict=True)
    if not items:
        raise RuntimeError("No valid intruder items were generated.")

    return items[:max_items]
