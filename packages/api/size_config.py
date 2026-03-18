"""Category-specific size configuration, validation, and sort logic."""

import re
from typing import List, Optional

# Size type constants
STANDARD = "standard"
WAIST_LENGTH = "waist_length"
NUMERIC_EU = "numeric_eu"

# Category → allowed size types. First entry is the default.
# Categories with multiple entries let the brand choose per-product.
CATEGORY_SIZE_TYPES = {
    "tshirts": [STANDARD],
    "hoodies": [STANDARD],
    "dresses": [STANDARD],
    "jeans": [STANDARD, WAIST_LENGTH],
    "sneakers": [NUMERIC_EU],
}

STANDARD_SIZES = ["XS", "S", "M", "L", "XL"]
WAIST_VALUES = list(range(58, 111, 2))   # 58-110 cm, step 2
LENGTH_VALUES = list(range(72, 93, 2))   # 72-92 cm, step 2
EU_SHOE_SIZES = [s / 2 for s in range(70, 101)]  # 35.0-50.0 in 0.5 steps

_STANDARD_ORDER = {s: i for i, s in enumerate(STANDARD_SIZES)}
_WAIST_LENGTH_RE = re.compile(r"^(\d{2,3})\s*[×x]\s*(\d{2,3})$")


def get_size_types(category_id: str) -> List[str]:
    """Return list of allowed size types for a category."""
    return CATEGORY_SIZE_TYPES.get(category_id, [STANDARD])


def get_size_type(category_id: str) -> str:
    """Return the default (first) size type for a category."""
    return get_size_types(category_id)[0]


def _detect_size_type(size: str) -> str:
    """Detect size type from a size string."""
    if size in STANDARD_SIZES or size == "One Size":
        return STANDARD
    if _WAIST_LENGTH_RE.match(size):
        return WAIST_LENGTH
    try:
        float(size)
        return NUMERIC_EU
    except ValueError:
        return STANDARD


def normalize_size(size: str, category_id: str) -> str:
    """Normalize size string — e.g. ASCII 'x' → '×' for waist×length."""
    if size == "One Size":
        return size
    allowed = get_size_types(category_id)
    if WAIST_LENGTH in allowed:
        return re.sub(r"(?<=\d)\s*x\s*(?=\d)", "×", size)
    return size


def _validate_single_size(size_type: str, size: str) -> Optional[str]:
    """Validate a size against a specific size type. Returns error or None."""
    if size_type == STANDARD:
        if size not in STANDARD_SIZES:
            return f"Недопустимый размер '{size}'. Допустимые: {', '.join(STANDARD_SIZES)}, One Size"
        return None

    if size_type == WAIST_LENGTH:
        m = _WAIST_LENGTH_RE.match(size)
        if not m:
            return f"Размер должен быть в формате Ш×Д в см (например 76×82)"
        waist, length = int(m.group(1)), int(m.group(2))
        if waist not in WAIST_VALUES:
            return f"Обхват талии {waist} вне диапазона ({WAIST_VALUES[0]}–{WAIST_VALUES[-1]})"
        if length not in LENGTH_VALUES:
            return f"Длина {length} вне диапазона ({LENGTH_VALUES[0]}–{LENGTH_VALUES[-1]})"
        return None

    if size_type == NUMERIC_EU:
        try:
            val = float(size)
        except ValueError:
            return f"Недопустимый размер обуви '{size}'. Должен быть числом (например 42, 43.5)"
        if val not in EU_SHOE_SIZES:
            return f"Размер обуви {val} вне диапазона ({EU_SHOE_SIZES[0]}–{EU_SHOE_SIZES[-1]})"
        return None

    return None


def validate_size(category_id: str, size: str) -> Optional[str]:
    """Validate size for category. Returns error message or None if valid."""
    if size == "One Size":
        return None

    allowed = get_size_types(category_id)

    # Try each allowed type — pass if any matches
    errors = []
    for st in allowed:
        err = _validate_single_size(st, size)
        if err is None:
            return None
        errors.append(err)

    if len(allowed) == 1:
        return errors[0]
    return f"Недопустимый размер '{size}' для этой категории"


def validate_size_consistency(category_id: str, sizes: List[str]) -> Optional[str]:
    """Ensure all non-One-Size sizes use the same size type. Returns error or None."""
    allowed = get_size_types(category_id)
    if len(allowed) <= 1:
        return None

    real_sizes = [s for s in sizes if s != "One Size"]
    if not real_sizes:
        return None

    detected = _detect_size_type(real_sizes[0])
    for s in real_sizes[1:]:
        if _detect_size_type(s) != detected:
            return "Нельзя сочетать стандартные размеры (XS/S/M/L/XL) с размерами ширина×длина"
    return None


def get_size_sort_key(size: str, category_id: str = "") -> tuple:
    """Return sort key tuple for correct ordering."""
    if size == "One Size":
        return (999,)

    # Detect actual type from the value (handles multi-type categories)
    detected = _detect_size_type(size)

    if detected == STANDARD:
        return (_STANDARD_ORDER.get(size, 998),)

    if detected == WAIST_LENGTH:
        normalized = normalize_size(size, category_id)
        m = _WAIST_LENGTH_RE.match(normalized)
        if m:
            return (int(m.group(1)), int(m.group(2)))
        return (998,)

    if detected == NUMERIC_EU:
        try:
            return (float(size),)
        except ValueError:
            return (998,)

    return (_STANDARD_ORDER.get(size, 998),)
