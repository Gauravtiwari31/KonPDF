"""NW: KonPDF's built-in assistant. No API keys, no outside AI service.

NW turns plain-language requests ("make this photo under 50 KB",
"isko PDF bana do", "comprime este PDF a 1 MB") into a plan of KonPDF tool
steps the person confirms with one tap, answers how-to questions, and
explains errors in simple words, in the language the person writes in.

Two tiers, both in this file:

* Core (always on): language detection by script and keyword scores, a
  multilingual lexicon of actions, formats and units, regex extractors for
  sizes, dimensions, percentages, angles and page ranges, and a small
  knowledge base. Deterministic and fast; needs no download.
* Local LLM (optional): if `NW_MODEL_PATH` points to a small instruction
  model in GGUF format (e.g. Qwen2.5-0.5B/1.5B-Instruct) and
  `llama-cpp-python` is installed, it answers free-form questions the core
  can't. Its plans must pass the same validation as everything else, or NW
  falls back to the core answer.

Languages: English (en), Hindi (hi), Hinglish (hi-Latn), Spanish (es),
French (fr), German (de), Portuguese (pt).
"""

from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any

LANGS = ("en", "hi", "hi-Latn", "es", "fr", "de", "pt")

# --------------------------------------------------------------------------
# Language detection
# --------------------------------------------------------------------------

_STOPWORDS: dict[str, set[str]] = {
    "en": set(
        "the to a an this that it is are make convert into under please my me i you can how what why and of for with "
        "file files image photo picture pages page smaller less than from in on be do does want need help".split()
    ),
    "hi-Latn": set(
        "karo kar kardo krdo karna karke do de dena bana banao banado bnado banaa isko ise isse yeh ye ko ka ki ke "
        "mein me hai hain kya kaise kitna kitni nahi nhi mujhe chahiye wala wali se tak bhi aur sab saare saari "
        "chhota chota chhoti choti kam jyada zyada bada badi photo ki ek jaldi please plz bhai yaar thoda".split()
    ),
    "es": set(
        "el la los las de que en por para un una unos y con convertir convierte convierta comprimir comprime "
        "reducir reduce archivo archivos imagen imágenes foto fotos hazlo haz quiero puedes cómo como qué menos "
        "tamaño páginas página mi mis esto este esta pdf a al del".split()
    ),
    "fr": set(
        "le la les des de du un une et en pour avec convertir convertis convertissez compresser compresse réduire "
        "réduis fichier fichiers image images photo photos je veux peux comment pourquoi moins taille pages page "
        "mon ma mes ce ces cette est-ce au aux est ajoute ajouter ajoutez fusionne fusionnez sur".split()
    ),
    "de": set(
        "der die das und ein eine einen mit für von zu in umwandeln konvertieren konvertiere verkleinern verkleinere "
        "komprimieren komprimiere datei dateien bild bilder foto fotos ich möchte bitte wie warum kleiner als unter "
        "seiten seite mein meine dies diese ist".split()
    ),
    "pt": set(
        "o a os as um uma de do da dos das para com e em converter converta converte comprimir comprima reduzir "
        "reduza arquivo arquivos imagem imagens foto fotos eu quero você pode como por que menos tamanho páginas "
        "página meu minha isso este esta não".split()
    ),
}

# Words that only one language uses are strong signals.
_STRONG: dict[str, set[str]] = {
    "hi-Latn": {"karo", "kardo", "banao", "banado", "isko", "chahiye", "kaise", "nahi", "mujhe", "chhota", "chota", "kitna", "hai", "mein"},
    "es": {"convierte", "comprimir", "hazlo", "quiero", "puedes", "tamaño", "cómo", "qué", "páginas", "archivo", "imagen"},
    "fr": {"convertis", "compresser", "réduire", "fichier", "veux", "peux", "pourquoi", "taille", "est-ce", "cette", "ces", "ajoute", "fusionne", "numéros"},
    "de": {"umwandeln", "konvertieren", "verkleinern", "komprimieren", "datei", "bitte", "möchte", "warum", "kleiner", "seiten", "bild"},
    "pt": {"converta", "comprima", "reduza", "arquivo", "quero", "você", "imagem", "tamanho", "não", "isso"},
}


def _words(text: str) -> list[str]:
    return re.findall(r"[a-zA-Zà-ÿÀ-ßñç\-']+", text.lower())


# Everyday English and file words. They say nothing about other languages
# ("reduce" is also Spanish, "pdf" is everywhere), so only English counts them.
EN_VOCAB = set(
    """the to a an this that these those it its is are be was were make made convert converting change turn into as in on at
    for of and or with from by my me i im i'm you your can could would will should please pls plz need want wanna help
    reduce compress compressed resize shrink enhance improve fix clean photo photos picture pictures pic pics image images
    file files document documents doc page pages size format smaller bigger small big less more than under below above
    over max min maximum minimum quality clear sharp rotate flip crop merge combine join split extract delete remove add
    password lock unlock watermark number numbers word excel it's also then now just only all every each same one two
    three first second third last left right new old do does did done get give keep put save send upload form hd
    so too very much little bit ok okay yes no not dont don't how what why when where which who there here up down
    type kind into onto please thanks thank sign signature mobile phone app scan scanned copy black white color colour
    instead actually anyway again still something nice good bad great better best really maybe some any other another
    send share open view see look show tell know think like love try use using used want would should must""".split()
)
DOMAIN_WORDS = {"pdf", "pdfs", "jpg", "jpeg", "png", "webp", "heic", "gif", "bmp", "tiff", "svg", "docx", "xlsx", "csv", "json", "kb", "mb", "px", "ppt", "pptx"}


def detect_language(text: str, hint: str | None = None) -> str:
    """The language a message is written in. With no telling words (just "pdf"), the app's language (`hint`)."""
    if re.search(r"[ऀ-ॿ]", text):
        return "hi"
    words = [w for w in _words(text) if w not in DOMAIN_WORDS]
    if not words:
        return hint if hint in LANGS else "en"
    scores: dict[str, float] = {}
    for lang, vocab in _STOPWORDS.items():
        counted = words if lang == "en" else [w for w in words if w not in EN_VOCAB]
        scores[lang] = sum(1 for w in counted if w in vocab) + 2 * sum(1 for w in counted if w in _STRONG.get(lang, set()))
    scores["en"] += sum(1 for w in words if w in EN_VOCAB and w not in _STOPWORDS["en"])
    if re.search(r"[áéíóúñ¿¡]", text.lower()):
        scores["es"] += 1.5
    if re.search(r"[àâçèéêëîïôûœ]", text.lower()):
        scores["fr"] += 1.5
    if re.search(r"[äöüß]", text.lower()):
        scores["de"] += 2
    if re.search(r"[ãõâêôç]", text.lower()):
        scores["pt"] += 1.5
    best = max(scores, key=lambda k: scores[k])
    ranked = sorted(scores.values(), reverse=True)
    if ranked[0] == 0:
        return hint if hint in LANGS else "en"
    # A near-tie goes to the app's language, but only if it is one of the leaders.
    if hint in LANGS and ranked[0] - scores.get(hint, 0) < 1:
        return hint
    # Hinglish leans on English words too ("photo ko compress karo").
    if best == "en" and scores["hi-Latn"] >= 2:
        return "hi-Latn"
    return best


# --------------------------------------------------------------------------
# Lexicon: actions, formats, presets
# --------------------------------------------------------------------------

def _norm(text: str) -> str:
    text = unicodedata.normalize("NFC", text.lower())
    # Devanagari digits → ASCII
    text = text.translate(str.maketrans("०१२३४५६७८९", "0123456789"))
    return re.sub(r"\s+", " ", text).strip()


ACTIONS: dict[str, list[str]] = {
    "merge": [
        "merge", "combine", "join", "put together", "into one", "single pdf", "one pdf", "jod", "jodo", "jod do", "milao", "mila do", "ek pdf",
        "जोड़", "जोड़ो", "मिलाओ", "एक पीडीएफ", "unir", "combinar", "juntar", "fusionar", "fusionner", "combiner", "assembler",
        "zusammenfügen", "kombinieren", "verbinden", "mesclar", "fusionne", "fusionnez", "junte", "juntar",
    ],
    "split": ["split", "separate", "break into", "alag", "alag karo", "अलग", "dividir", "separar", "diviser", "séparer", "aufteilen", "trennen", "teilen"],
    "rotate": [
        "rotate", "turn left", "turn right", "turn it left", "turn it right", "turn sideways", "turn upside down", "upside down",
        "sideways", "ghumao", "ghuma do", "घुमाओ", "girar", "rotar", "gira", "pivoter", "tourner", "drehen", "rodar",
    ],
    "flip": ["flip", "mirror", "mirrored", "flip horizontally", "flip vertically", "espejo", "voltear", "miroir", "retourner", "spiegeln", "espelhar", "inverter"],
    "crop": ["crop", "cut to", "trim", "make it square", "square photo", "square image", "recortar", "recadrer", "rogner", "zuschneiden", "cortar"],
    "extract": ["extract", "keep only", "only page", "only pages", "sirf page", "sirf pages", "निकालो", "extraer", "solo la página", "solo las páginas", "extraire", "extrahieren", "extrair"],
    "delete": [
        "delete page", "delete pages", "remove page", "remove pages", "page hatao", "pages hatao", "page hata", "पेज हटाओ",
        "eliminar página", "eliminar páginas", "borrar página", "supprimer la page", "supprimer les pages", "seite löschen",
        "seiten löschen", "seite entfernen", "excluir página", "remover página",
    ],
    "protect": [
        "password protect", "add password", "add a password", "set password", "set a password", "put a password", "password on it",
        "secure it", "protect it", "protect this", "lock", "encrypt", "taala", "lock karo", "password laga",
        "पासवर्ड लगा", "ताला", "proteger", "contraseña", "bloquear", "verrouiller", "protéger", "mot de passe", "schützen",
        "passwort", "verschlüsseln", "senha",
    ],
    "unlock": [
        "unlock", "remove password", "remove the password", "decrypt", "password hatao", "password hata", "पासवर्ड हटाओ",
        "desbloquear", "quitar contraseña", "quitar la contraseña", "déverrouiller", "enlever le mot de passe", "entsperren",
        "passwort entfernen", "remover senha", "tirar a senha",
    ],
    "watermark": ["watermark", "stamp", "वॉटरमार्क", "marca de agua", "filigrane", "wasserzeichen", "marca d'água", "marca dágua"],
    "page_numbers": [
        "page number", "page numbers", "number the pages", "numbering", "page no", "पेज नंबर", "numerar", "número de página",
        "números de página", "numéroter", "numéros de page", "seitenzahlen", "nummerieren", "numeração", "numerar páginas",
    ],
    "compress": [
        "compress", "smaller", "reduce", "shrink", "decrease", "lighter", "less size", "low size", "small size", "chhota", "chota",
        "chhoti", "choti", "kam karo", "size kam", "छोटा", "छोटी", "कम करो", "साइज़ कम", "comprimir", "comprime", "reducir",
        "más pequeño", "compresser", "réduire", "plus petit", "komprimieren", "verkleinern", "kleiner", "reduzir", "diminuir",
        "menor",
    ],
    "resize": [
        "resize", "dimension", "dimensions", "pixels", "px", "width", "height", "scale", "size badlo", "resize karo", "साइज़ बदलो",
        "redimensionar", "redimensionner", "größe ändern", "skalieren", "redimensione",
    ],
    "convert": [
        "convert", "change to", "turn into", "turn it into", "make it a", "make it", "save as", "export as", "badlo", "bana do", "banao",
        "banado", "convert karo", "बदलो", "बनाओ", "बना दो", "कन्वर्ट", "convertir", "convierte", "pasar a", "convertis",
        "transformer", "en format", "umwandeln", "konvertieren", "converter", "converta", "transformar",
    ],
    "enhance": [
        "enhance", "improve", "better", "clearer", "clear", "sharpen", "sharp", "brighten", "fix", "clean up", "clean", "quality",
        "saaf", "behtar", "achha", "acchi", "साफ़", "साफ", "बेहतर", "mejorar", "mejora", "nítida", "améliorer", "plus net",
        "verbessern", "schärfen", "melhorar", "nitidez",
    ],
}  # fmt: skip

FILTER_WORDS: dict[str, list[str]] = {
    "grayscale": ["grayscale", "greyscale", "gray", "grey", "black and white", "black & white", "b&w", "b/w", "kala safed", "black white", "काला सफेद", "ब्लैक एंड व्हाइट", "blanco y negro", "escala de grises", "noir et blanc", "schwarz-weiß", "schwarzweiß", "graustufen", "preto e branco"],
    "sepia": ["sepia", "sépia"],
    "vintage": ["vintage", "retro", "old style", "purana"],
    "vivid": ["vivid", "vibrant", "colourful", "colorful", "punchy"],
    "warm": ["warm", "warmer", "cálido", "chaud", "wärmer"],
    "cool": ["cool", "cooler", "cold", "frío", "froid", "kühler"],
    "invert": ["invert", "negative", "invertir", "inverser", "invertieren"],
    "blur": ["blur", "blurry effect", "desenfocar", "flou", "unscharf"],
    "noir": ["noir", "dramatic"],
    "fade": ["fade", "faded", "matte"],
}  # fmt: skip

PRESET_WORDS: dict[str, list[str]] = {
    "passport": ["passport", "पासपोर्ट", "pasaporte", "passeport", "reisepass", "passaporte"],
    "us_visa": ["us visa", "visa photo", "american visa", "visa"],
    "india_form_photo": ["govt form", "government form", "form photo", "sarkari", "ssc", "upsc", "neet", "jee", "exam form", "application form", "फॉर्म", "सरकारी"],
    "signature": ["signature", "sign", "dastakhat", "हस्ताक्षर", "firma", "signature scan", "unterschrift", "assinatura"],
    "id_scan": ["aadhaar", "aadhar", "pan card", "id card", "id scan", "आधार", "पैन"],
    "instagram_story": ["story", "stories", "reel", "reels"],
    "instagram_portrait": ["instagram portrait", "insta portrait"],
    "instagram_square": ["instagram", "insta", "ig post"],
    "whatsapp_dp": ["whatsapp", "dp", "profile picture", "profile pic", "pfp"],
    "youtube_thumb": ["youtube", "thumbnail", "yt thumb"],
    "linkedin_banner": ["linkedin"],
    "x_header": ["twitter", "x header"],
    "full_hd": ["full hd", "1080p", "fhd"],
    "hd": ["hd", "720p"],
    "uhd_4k": ["4k", "uhd"],
    "a4_300dpi": ["a4 print", "print a4", "a4", "a4 size"],
    "email": ["email", "e-mail", "mail", "gmail", "correo", "courriel"],
}  # fmt: skip

FORMAT_WORDS: dict[str, list[str]] = {
    "jpg": ["jpg", "jpeg", "jfif"],
    "png": ["png"],
    "webp": ["webp"],
    "heic": ["heic", "heif"],
    "bmp": ["bmp", "bitmap"],
    "gif": ["gif"],
    "tiff": ["tiff", "tif"],
    "ico": ["ico", "favicon", "icon"],
    "avif": ["avif"],
    "svg": ["svg"],
    "pdf": ["pdf", "पीडीएफ"],
    "docx": ["docx", "word", "doc file", "word file", "वर्ड"],
    "doc": ["doc"],
    "txt": ["txt", "text", "plain text", "texto", "texte"],
    "md": ["markdown", "md"],
    "html": ["html", "web page", "webpage"],
    "xlsx": ["xlsx", "excel", "spreadsheet", "एक्सेल", "hoja de cálculo", "tableur"],
    "xls": ["xls"],
    "csv": ["csv"],
    "tsv": ["tsv"],
    "json": ["json"],
    "pptx": ["pptx", "powerpoint", "ppt", "slides", "presentation"],
    "odt": ["odt"],
    "ods": ["ods"],
}  # fmt: skip

IMAGE_FMTS = {"jpg", "png", "webp", "heic", "bmp", "gif", "tiff", "ico", "avif", "svg"}
IMAGE_OUT = {"jpg", "png", "webp", "bmp", "gif", "tiff", "ico", "avif"}
DOC_FMTS = {"docx", "doc", "txt", "md", "html", "odt", "rtf"}
SHEET_FMTS = {"xlsx", "xls", "csv", "tsv", "json", "ods"}
SLIDE_FMTS = {"pptx", "ppt", "odp"}

OUT_OF_SCOPE = {
    "background": [
        "remove background", "remove the background", "background remove", "remove bg", "bg remove", "background hatao",
        "background hata do", "transparent background", "change background", "quitar fondo", "quitar el fondo",
        "supprimer l'arrière-plan", "enlever le fond", "hintergrund entfernen", "remover fundo", "tirar o fundo", "बैकग्राउंड हटाओ",
    ],
    "video": ["video", "mp4", "mov", "avi", "mkv", "वीडियो", "vídeo", "vidéo"],
    "audio": ["audio", "mp3", "wav", "song", "music", "gaana", "गाना", "ऑडियो", "música", "musique", "musik", "áudio"],
    "ocr": ["ocr", "read the text", "extract text from image", "text from photo", "text from image", "image to text", "photo to text", "scan to text", "editable text from scan", "टेक्स्ट निकालो"],
}  # fmt: skip

GREETINGS = ["hi", "hii", "hello", "hey", "namaste", "namaskar", "नमस्ते", "नमस्कार", "hola", "bonjour", "salut", "hallo", "olá", "oi", "yo", "good morning"]
THANKS = ["thanks", "thank you", "thx", "ty", "shukriya", "dhanyavad", "dhanyawad", "धन्यवाद", "शुक्रिया", "gracias", "merci", "danke", "obrigado", "obrigada"]
QUESTION_STARTS = (
    "how", "what", "why", "can ", "can i", "is ", "are ", "does", "do you", "which", "where", "kaise", "kya", "kyun", "kyon", "kitna",
    "क्या", "कैसे", "क्यों", "कितना", "cómo", "como", "qué", "que ", "por qué", "puedo", "puedes", "comment", "pourquoi", "est-ce",
    "est ce", "quoi", "puis-je", "wie", "was", "warum", "kann", "welche", "posso", "por que", "o que", "pode",
)  # fmt: skip


def _has(text: str, phrases: list[str]) -> bool:
    for phrase in phrases:
        if re.search(r"[ऀ-ॿ]", phrase):
            if phrase in text:
                return True
        elif re.search(r"(?<![\w])" + re.escape(phrase) + r"(?![\w])", text):
            return True
    return False


# --------------------------------------------------------------------------
# Typo tolerance: "compres" → compress, "pfd" → pdf, "pasport" → passport
# --------------------------------------------------------------------------


def _edit_distance(a: str, b: str, limit: int) -> int:
    """Damerau–Levenshtein (adjacent swaps count as one edit), stopping early past `limit`."""
    if abs(len(a) - len(b)) > limit:
        return limit + 1
    prev2: list[int] = []
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i] + [0] * len(b)
        for j, cb in enumerate(b, 1):
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb))
            if i > 1 and j > 1 and ca == b[j - 2] and a[i - 2] == cb:
                cur[j] = min(cur[j], prev2[j - 2] + 1)
        if min(cur) > limit:
            return limit + 1
        prev2, prev = prev, cur
    return prev[-1]


_KEYWORDS: set[str] = set()
_KNOWN: set[str] = set()


def _vocab() -> tuple[set[str], set[str]]:
    """Single-word keywords NW acts on, and every word it already knows (never "corrected")."""
    if not _KEYWORDS:
        for table in (ACTIONS, FORMAT_WORDS, PRESET_WORDS, FILTER_WORDS):
            for phrases in table.values():
                for phrase in phrases:
                    for word in phrase.split():
                        if word.isascii() and word.isalpha() and len(word) >= 3:
                            _KEYWORDS.add(word)
        _KEYWORDS.update({"pages", "page", "password", "image", "images", "photo", "photos", "picture", "size"})
        _KNOWN.update(EN_VOCAB, _KEYWORDS, *_STOPWORDS.values(), *_STRONG.values())
    return _KEYWORDS, _KNOWN


def correct_typos(text: str) -> str:
    keywords, known = _vocab()

    def fix(match: re.Match) -> str:
        word = match.group(0)
        if word in known or not word.isascii() or len(word) < 3:
            return word
        limit = 1 if len(word) <= 5 else 2
        best, best_d = word, limit + 1
        for candidate in keywords:
            # Typos keep roughly the same length ("instead" is not "insta").
            if abs(len(candidate) - len(word)) > 1:
                continue
            # Three-letter words only match formats ("pfd" → "pdf"), never ordinary words.
            if len(word) == 3 and candidate not in DOMAIN_WORDS:
                continue
            d = _edit_distance(word, candidate, limit)
            if d < best_d or (d == best_d and len(candidate) > len(best)):
                best, best_d = candidate, d
        return best if best_d <= limit else word

    return re.sub(r"[a-z]+", fix, text)


# --------------------------------------------------------------------------
# Extractors: sizes, dimensions, percent, dpi, angle, pages, password, text
# --------------------------------------------------------------------------

_UNIT_KB = r"(kb|kib|k|kilobytes?|kilobyte|केबी|किलोबाइट|ko)"
_UNIT_MB = r"(mb|mib|megabytes?|megabyte|एमबी|मेगाबाइट|mo)"
_NUM = r"(\d+(?:[.,]\d+)?)"
_MAX_WORDS = r"(under|below|less than|max|maximum|at most|within|upto|up to|not more than|se kam|se kum|tak|से कम|तक|menos de|como máximo|moins de|au plus|maximum de|unter|weniger als|höchstens|maximal|abaixo de|no máximo|até)"
_MIN_WORDS = r"(over|above|more than|at least|min|minimum|se zyada|se jyada|से ज़्यादा|से अधिक|más de|al menos|plus de|au moins|mehr als|mindestens|mais de|pelo menos)"


def _to_float(s: str) -> float:
    return float(s.replace(",", "."))


@dataclass
class Facts:
    """Everything NW understood from one message."""

    max_kb: float | None = None
    min_kb: float | None = None
    width: int | None = None
    height: int | None = None
    print_size: dict[str, Any] | None = None
    percent: float | None = None
    dpi: int | None = None
    angle: int | None = None
    pages: str | None = None
    password: str | None = None
    text: str | None = None
    formats: list[str] = field(default_factory=list)
    target: str | None = None
    preset: str | None = None
    filters: list[str] = field(default_factory=list)
    actions: set[str] = field(default_factory=set)
    document_hint: bool = False
    low_light: bool = False
    upscale: bool = False
    denoise: bool = False
    strip: bool = False
    flip: str | None = None  # "horizontal" | "vertical"
    crop: str | None = None  # "1:1", "16:9"...


ORDINALS = {"first": "1", "1st": "1", "second": "2", "2nd": "2", "third": "3", "3rd": "3", "fourth": "4", "4th": "4", "fifth": "5", "5th": "5", "last": "last", "pehla": "1", "pehle": "1", "aakhri": "last", "akhri": "last"}
IMAGE_TARGET_WORDS = {"image", "images", "picture", "pictures", "photo", "photos", "pic", "pics", "jpgs", "photo mein", "imagen", "imágenes", "imagens", "bilder", "bild"}
PASSWORD_FILLER = {
    "is", "hai", "=", ":", "laga", "lagao", "lagado", "do", "de", "karo", "kar", "set", "add", "to", "of", "with", "as", "the", "a",
    "me", "mein", "should", "be", "use", "it", "this", "pdf", "file", "please", "rakh", "rakho", "ka", "ki", "ke", "es", "est",
    "ist", "é", "será", "sera", "on", "protect", "remove", "hatao", "using", "my", "new", "old", "current", "and", "then",
}  # fmt: skip


def _password(raw: str) -> str | None:
    """The word after "password" / "lock with" that isn't filler ("password laga do 1234" → 1234)."""
    m = re.search(r"(?:password|passcode|passwort|पासवर्ड|contraseña|mot de passe|senha|\bpin\b|lock(?:\s+it)?\s+with)(.*)", raw, re.I)
    if not m:
        return None
    for token in re.findall(r"[^\s\"'“”‘’,]+", m.group(1))[:6]:
        token = token.strip(".:;!?")
        if len(token) >= 4 and token.lower() not in PASSWORD_FILLER:
            return token
    return None


def extract(raw: str) -> Facts:
    text = correct_typos(_norm(raw))
    f = Facts()

    # Sizes: ranges first ("20-50 kb", "20 to 50 kb"), then single sizes.
    rng = re.search(_NUM + r"\s*(?:-|–|to|se|से|a|à|bis)\s*" + _NUM + r"\s*" + _UNIT_KB + r"(?![a-z])", text)
    if rng:
        a, b = sorted((_to_float(rng.group(1)), _to_float(rng.group(2))))
        f.min_kb, f.max_kb = a, b
    else:
        for m in re.finditer(_NUM + r"\s*(" + _UNIT_KB[1:-1] + "|" + _UNIT_MB[1:-1] + r")(?![a-z])", text):
            value = _to_float(m.group(1))
            unit = m.group(2)
            kb = value * 1024 if re.fullmatch(_UNIT_MB, unit) else value
            before = text[max(0, m.start() - 25) : m.start()]
            after = text[m.end() : m.end() + 14]
            if re.search(_MIN_WORDS + r"\s*$", before) or re.match(r"\s*(se zyada|se jyada|से ज़्यादा|से अधिक)", after):
                f.min_kb = kb
            else:
                f.max_kb = kb

    # Dimensions: 1080x1080, 1920 by 1080, 3.5 x 4.5 cm
    dim = re.search(_NUM + r"\s*(?:x|×|\*|by)\s*" + _NUM + r"\s*(px|pixels?|cm|mm|in|inch|inches|इंच)?(?![a-z])", text)
    if dim:
        w, h, unit = _to_float(dim.group(1)), _to_float(dim.group(2)), (dim.group(3) or "")
        if unit in ("cm", "mm", "in", "inch", "inches", "इंच"):
            f.print_size = {"width": w, "height": h, "unit": {"inch": "in", "inches": "in", "इंच": "in"}.get(unit, unit)}
        elif w >= 8 and h >= 8:
            f.width, f.height = int(w), int(h)
    else:
        one = re.search(r"(\d{2,5})\s*(?:px|pixels?)\s*(wide|width|chaudi|ancho|large|breit)?", text)
        if one:
            f.width = int(one.group(1))
        wm = re.search(r"(?:width|chaudai|ancho|largeur|breite)\s*(?:of|=|:)?\s*(\d{2,5})", text)
        hm = re.search(r"(?:height|lambai|alto|hauteur|höhe)\s*(?:of|=|:)?\s*(\d{2,5})", text)
        if wm:
            f.width = int(wm.group(1))
        if hm:
            f.height = int(hm.group(1))

    pct = re.search(r"(\d{1,3}(?:[.,]\d+)?)\s*(%|percent|per cent|prozent|por ciento|pour cent|por cento|pratishat|प्रतिशत)", text)
    if pct:
        f.percent = _to_float(pct.group(1))
    dpi = re.search(r"(\d{2,4})\s*dpi", text)
    if dpi:
        f.dpi = int(dpi.group(1))

    ang = re.search(r"(90|180|270)\s*(?:°|deg|degree|degrees|grad|grados|degrés|डिग्री)?", text)
    if ang and _has(text, ACTIONS["rotate"]):
        f.angle = int(ang.group(1))
    elif _has(text, ACTIONS["rotate"]):
        if _has(text, ["left", "anticlockwise", "counterclockwise", "baaye", "बाएं", "izquierda", "gauche", "links", "esquerda"]):
            f.angle = 270
        elif _has(text, ["upside down", "ulta", "उल्टा", "180"]):
            f.angle = 180
        else:
            f.angle = 90

    pages = re.search(r"(?:pages?|pg|p\.|पेज|páginas?|seiten?|pannon?)\s*((?:\d+|last)(?:\s*(?:-|–|to|,|and|aur|y|et|und|e)\s*(?:\d+|last))*)", text)
    if pages:
        spec = re.sub(r"\s*(?:to|–)\s*", "-", pages.group(1))
        spec = re.sub(r"\s*(?:and|aur|y|et|und|e)\s*", ",", spec)
        f.pages = re.sub(r"\s+", "", spec)
    else:
        # "first 3 pages", "the last page", "second page", "pehla page"
        first_n = re.search(r"\bfirst\s+(\d{1,3})\s+pages?", text)
        ordinal = re.search(r"\b(" + "|".join(ORDINALS) + r")\s+(?:page|पेज|página|seite)", text)
        if first_n:
            f.pages = f"1-{first_n.group(1)}"
        elif ordinal:
            f.pages = ORDINALS[ordinal.group(1)]

    f.password = _password(raw)

    aspect = re.search(r"\b(1:1|4:3|3:4|3:2|2:3|16:9|9:16|4:5)\b", text)
    if aspect:
        f.crop = aspect.group(1)
    elif _has(text, ["square", "1 by 1", "chaukor", "cuadrada", "carré", "quadratisch", "quadrada"]):
        f.crop = "1:1"
    if _has(text, ["vertical", "vertically", "top to bottom", "upside"]) and _has(text, ["flip", "mirror"]):
        f.flip = "vertical"
    elif _has(text, ["flip", "mirror", "mirrored", "espejo", "voltear", "miroir", "spiegeln", "espelhar"]):
        f.flip = "horizontal"

    quoted = re.search(r"[\"“'‘]([^\"”'’]{1,80})[\"”'’]", raw)
    if quoted:
        f.text = quoted.group(1).strip()
    else:
        # "stamp DRAFT on it", "watermark it with confidential"
        mark = re.search(r"(?:watermark|stamp)\s+(?:it\s+|this\s+|the\s+pdf\s+)?(?:with\s+|as\s+|of\s+)?([^\s,.]+(?:\s+[^\s,.]+)?)", raw, re.I)
        if mark:
            skip = {"on", "it", "this", "to", "the", "a", "in", "across", "every", "all", "page", "pages", "pdf", "file"}
            words = [w for w in mark.group(1).split() if w.lower() not in skip]
            if words and words[0].lower() not in ("add", "please", "karo", "lagao"):
                f.text = " ".join(words[:2]).upper()

    for fmt, words in FORMAT_WORDS.items():
        for w in words:
            for m in re.finditer(r"(?<![\w.])\.?" + re.escape(w) + r"(?![\w])", text):
                f.formats.append((m.start(), fmt))  # type: ignore[arg-type]
    f.formats.sort()
    ordered = []
    for _, fmt in f.formats:  # type: ignore[misc]
        if fmt not in ordered:
            ordered.append(fmt)
    f.formats = ordered
    # Target: "to X", "into X", "as X", "X mein", "X me", "X bana", "en X", "zu X", "para X", "X में"
    tgt = re.search(
        r"(?:to|into|as|in|en|zu|in ein|para|pour|vers|em)\s+(?:an?\s+|un\s+|une\s+|ein\s+|uma?\s+)?\.?([a-z]+)(?:\s+(?:file|format|document|fichier|datei|archivo|arquivo))?\b",
        text,
    )
    candidates = []
    if tgt:
        candidates.append(tgt.group(1))
    tgt2 = re.search(r"\.?([a-z]+)\s+(?:mein|me|में|bana|banao|banado|bna|बना|format mein|file mein)\b", text)
    if tgt2:
        candidates.insert(0, tgt2.group(1))
    for word in candidates:
        if word in IMAGE_TARGET_WORDS:
            f.target = "jpg"  # "to images", "as pictures"
            break
        for fmt, words in FORMAT_WORDS.items():
            if word in words:
                f.target = fmt
                break
        if f.target:
            break

    for preset, words in PRESET_WORDS.items():
        if _has(text, words):
            f.preset = preset
            break
    if f.preset in ("hd",) and not re.search(r"\bhd\b", text):
        f.preset = None
    for name, words in FILTER_WORDS.items():
        if _has(text, words):
            f.filters.append(name)
    for action, words in ACTIONS.items():
        if _has(text, words):
            f.actions.add(action)
    # "delete some pages", "remove the last page", "keep just pages 2-4"
    page_word = r"(?:pages?|पेज|páginas?|seiten?|pannon?)"
    if re.search(r"\b(?:delete|remove|get rid of|drop|erase|cut out|hatao|hata do|eliminar|borrar|quitar|supprimer|enlever|löschen|entfernen|excluir|remover|tirar)\b.{0,25}" + page_word, text) or re.search(
        page_word + r".{0,15}(?:hatao|hata do|हटाओ)", text
    ):
        f.actions.add("delete")
    elif re.search(r"\b(?:keep|only|just|sirf|solo|seulement|nur|apenas)\b.{0,20}" + page_word, text):
        f.actions.add("extract")
    f.document_hint = _has(text, ["document", "scan", "scanned", "page", "receipt", "notes", "bill", "दस्तावेज़", "स्कैन", "documento", "escaneo", "reçu", "dokument", "scanné", "digitalizado", "copy", "notebook"])
    f.low_light = _has(text, ["dark", "dim", "low light", "night", "andhera", "andheri", "अंधेरा", "oscura", "oscuro", "sombre", "dunkel", "escura", "escuro"])
    f.upscale = _has(text, ["upscale", "enlarge", "bigger", "larger", "bada karo", "badi karo", "बड़ा", "ampliar", "agrandir", "vergrößern", "aumentar", "2x", "double"])
    f.denoise = _has(text, ["noise", "noisy", "grainy", "grain", "ruido", "bruit", "rauschen", "ruído", "dhundla"])
    f.strip = _has(text, ["metadata", "exif", "location", "gps", "hidden details", "privacy"])
    return f


# --------------------------------------------------------------------------
# Replies, in every language
# --------------------------------------------------------------------------

T: dict[str, dict[str, str]] = {
    "greet": {
        "en": "Hi! I'm NW. Tell me what you need, like “make this photo under 50 KB” or “merge these PDFs”, and I'll set it up.",
        "hi": "नमस्ते! मैं NW हूँ। बताइए क्या करना है, जैसे “इस फ़ोटो को 50 KB से कम करो” या “ये PDF जोड़ दो”, मैं तैयार कर दूँगा।",
        "hi-Latn": "Namaste! Main NW hoon. Batao kya karna hai, jaise “is photo ko 50 KB se kam karo” ya “yeh PDFs jod do”, main set kar dunga.",
        "es": "¡Hola! Soy NW. Dime qué necesitas, como “deja esta foto en menos de 50 KB” o “une estos PDF”, y lo preparo.",
        "fr": "Bonjour ! Je suis NW. Dites-moi ce qu’il vous faut, comme « cette photo sous 50 Ko » ou « fusionne ces PDF », et je m’en occupe.",
        "de": "Hallo! Ich bin NW. Sag mir, was du brauchst, etwa „dieses Foto unter 50 KB“ oder „füge diese PDFs zusammen“, und ich bereite es vor.",
        "pt": "Oi! Eu sou o NW. Diga o que precisa, como “deixe esta foto com menos de 50 KB” ou “junte estes PDFs”, e eu preparo.",
    },
    "plan": {
        "en": "Got it! Here's the plan: {summary}. Tap Run when you're ready.",
        "hi": "समझ गया! प्लान यह है: {summary}। तैयार हों तो Run दबाइए।",
        "hi-Latn": "Samajh gaya! Plan yeh hai: {summary}. Ready ho to Run dabao.",
        "es": "¡Entendido! El plan: {summary}. Toca Run cuando quieras.",
        "fr": "Compris ! Voici le plan : {summary}. Touchez Run quand vous êtes prêt.",
        "de": "Alles klar! Der Plan: {summary}. Tippe auf Run, wenn du bereit bist.",
        "pt": "Entendi! O plano: {summary}. Toque em Run quando quiser.",
    },
    "need_files": {
        "en": "Attach your file with the + button, then tap Run.",
        "hi": "+ बटन से अपनी फ़ाइल जोड़िए, फिर Run दबाइए।",
        "hi-Latn": "+ button se apni file attach karo, phir Run dabao.",
        "es": "Adjunta tu archivo con el botón + y toca Run.",
        "fr": "Ajoutez votre fichier avec le bouton +, puis touchez Run.",
        "de": "Hänge deine Datei mit dem +-Knopf an und tippe auf Run.",
        "pt": "Anexe seu arquivo com o botão + e toque em Run.",
    },
    "unknown": {
        "en": "I didn't quite get that. I can convert files, resize or compress photos, enhance scans, and work with PDFs. Try “convert to PDF” or “make it under 100 KB”.",
        "hi": "मैं ठीक से समझ नहीं पाया। मैं फ़ाइलें कन्वर्ट, फ़ोटो छोटी या रीसाइज़, स्कैन साफ़, और PDF के काम कर सकता हूँ। कहिए “PDF में बदलो” या “100 KB से कम करो”।",
        "hi-Latn": "Main theek se samajh nahi paaya. Main files convert, photos resize ya chhoti, scans saaf, aur PDF ke kaam kar sakta hoon. Bolo “PDF mein badlo” ya “100 KB se kam karo”.",
        "es": "No lo entendí bien. Puedo convertir archivos, redimensionar o comprimir fotos, mejorar escaneos y trabajar con PDF. Prueba “convierte a PDF” o “déjalo en menos de 100 KB”.",
        "fr": "Je n’ai pas bien compris. Je peux convertir des fichiers, redimensionner ou compresser des photos, améliorer des scans et gérer des PDF. Essayez « convertis en PDF » ou « moins de 100 Ko ».",
        "de": "Das habe ich nicht ganz verstanden. Ich kann Dateien umwandeln, Fotos verkleinern, Scans verbessern und mit PDFs arbeiten. Versuch „in PDF umwandeln“ oder „unter 100 KB“.",
        "pt": "Não entendi bem. Posso converter arquivos, redimensionar ou comprimir fotos, melhorar digitalizações e trabalhar com PDFs. Tente “converta para PDF” ou “deixe com menos de 100 KB”.",
    },
    "thanks": {
        "en": "You're welcome! Anything else?",
        "hi": "आपका स्वागत है! और कुछ?",
        "hi-Latn": "Koi baat nahi! Aur kuch?",
        "es": "¡De nada! ¿Algo más?",
        "fr": "Avec plaisir ! Autre chose ?",
        "de": "Gern geschehen! Sonst noch etwas?",
        "pt": "De nada! Mais alguma coisa?",
    },
    "video": {
        "en": "KonPDF doesn't work with video. It handles images, PDFs, documents and sheets. If you have a screenshot or a frame as an image, I can help with that.",
        "hi": "KonPDF वीडियो के साथ काम नहीं करता। यह इमेज, PDF, डॉक्यूमेंट और शीट संभालता है। कोई स्क्रीनशॉट या फ़ोटो हो तो मैं मदद कर सकता हूँ।",
        "hi-Latn": "KonPDF video ke saath kaam nahi karta. Yeh images, PDF, documents aur sheets handle karta hai. Koi screenshot ya photo ho to main help kar sakta hoon.",
        "es": "KonPDF no trabaja con vídeo. Maneja imágenes, PDF, documentos y hojas de cálculo. Si tienes una captura como imagen, te ayudo.",
        "fr": "KonPDF ne gère pas la vidéo. Il s’occupe des images, PDF, documents et tableurs. Si vous avez une capture en image, je peux aider.",
        "de": "KonPDF arbeitet nicht mit Videos, sondern mit Bildern, PDFs, Dokumenten und Tabellen. Mit einem Screenshot als Bild kann ich helfen.",
        "pt": "O KonPDF não trabalha com vídeo. Ele cuida de imagens, PDFs, documentos e planilhas. Se tiver uma captura como imagem, eu ajudo.",
    },
    "audio": {
        "en": "KonPDF doesn't work with audio. It handles images, PDFs, documents and sheets.",
        "hi": "KonPDF ऑडियो के साथ काम नहीं करता। यह इमेज, PDF, डॉक्यूमेंट और शीट संभालता है।",
        "hi-Latn": "KonPDF audio ke saath kaam nahi karta. Yeh images, PDF, documents aur sheets handle karta hai.",
        "es": "KonPDF no trabaja con audio. Maneja imágenes, PDF, documentos y hojas de cálculo.",
        "fr": "KonPDF ne gère pas l’audio. Il s’occupe des images, PDF, documents et tableurs.",
        "de": "KonPDF arbeitet nicht mit Audio, sondern mit Bildern, PDFs, Dokumenten und Tabellen.",
        "pt": "O KonPDF não trabalha com áudio. Ele cuida de imagens, PDFs, documentos e planilhas.",
    },
    "ocr": {
        "en": "KonPDF doesn't read text out of pictures (no OCR). But I can clean up a scan so it's easier to read, or turn it into a PDF.",
        "hi": "KonPDF तस्वीरों से टेक्स्ट नहीं पढ़ता (OCR नहीं)। पर मैं स्कैन को साफ़ कर सकता हूँ ताकि पढ़ना आसान हो, या उसे PDF बना सकता हूँ।",
        "hi-Latn": "KonPDF photos se text nahi padhta (OCR nahi). Par main scan ko saaf kar sakta hoon taaki padhna aasaan ho, ya use PDF bana sakta hoon.",
        "es": "KonPDF no lee texto de imágenes (sin OCR). Pero puedo limpiar un escaneo para que se lea mejor o convertirlo en PDF.",
        "fr": "KonPDF ne lit pas le texte des images (pas d’OCR). Mais je peux nettoyer un scan pour le rendre plus lisible, ou en faire un PDF.",
        "de": "KonPDF liest keinen Text aus Bildern (kein OCR). Ich kann aber einen Scan verbessern oder in ein PDF umwandeln.",
        "pt": "O KonPDF não lê texto de imagens (sem OCR). Mas posso limpar uma digitalização para facilitar a leitura ou transformá-la em PDF.",
    },
    "ask_password": {
        "en": "Which password should I use? Write it like: password: yourpassword",
        "hi": "कौन सा पासवर्ड लगाऊँ? ऐसे लिखिए: password: आपकापासवर्ड",
        "hi-Latn": "Kaunsa password lagaun? Aise likho: password: tumharapassword",
        "es": "¿Qué contraseña uso? Escríbela así: contraseña: tucontraseña",
        "fr": "Quel mot de passe dois-je utiliser ? Écrivez : mot de passe : votremotdepasse",
        "de": "Welches Passwort soll ich nehmen? Schreib: Passwort: deinpasswort",
        "pt": "Qual senha devo usar? Escreva assim: senha: suasenha",
    },
    "ask_target": {
        "en": "Which format should it become? For example PDF, JPG, PNG, Word or Excel.",
        "hi": "किस फ़ॉर्मैट में बदलूँ? जैसे PDF, JPG, PNG, Word या Excel।",
        "hi-Latn": "Kis format mein badlun? Jaise PDF, JPG, PNG, Word ya Excel.",
        "es": "¿A qué formato lo paso? Por ejemplo PDF, JPG, PNG, Word o Excel.",
        "fr": "Dans quel format ? Par exemple PDF, JPG, PNG, Word ou Excel.",
        "de": "In welches Format? Zum Beispiel PDF, JPG, PNG, Word oder Excel.",
        "pt": "Para qual formato? Por exemplo PDF, JPG, PNG, Word ou Excel.",
    },
    "ask_cant_output": {
        "en": "KonPDF can open {fmt} files but can't save to {fmt}. JPG, PNG or PDF work everywhere. Which one would you like?",
        "hi": "KonPDF {fmt} फ़ाइलें खोल सकता है पर {fmt} में सेव नहीं कर सकता। JPG, PNG या PDF हर जगह चलते हैं। कौन सा चाहिए?",
        "hi-Latn": "KonPDF {fmt} files khol sakta hai par {fmt} mein save nahi kar sakta. JPG, PNG ya PDF har jagah chalte hain. Kaunsa chahiye?",
        "es": "KonPDF abre archivos {fmt} pero no guarda en {fmt}. JPG, PNG o PDF funcionan en todas partes. ¿Cuál prefieres?",
        "fr": "KonPDF ouvre les fichiers {fmt} mais ne peut pas enregistrer en {fmt}. JPG, PNG ou PDF marchent partout. Lequel voulez-vous ?",
        "de": "KonPDF öffnet {fmt}-Dateien, kann aber nicht als {fmt} speichern. JPG, PNG oder PDF gehen überall. Was möchtest du?",
        "pt": "O KonPDF abre arquivos {fmt}, mas não salva em {fmt}. JPG, PNG ou PDF funcionam em todo lugar. Qual você quer?",
    },
    "ask_more_files": {
        "en": "Merging needs two or more files. Attach the other PDFs or images with the + button and ask again.",
        "hi": "जोड़ने के लिए दो या ज़्यादा फ़ाइलें चाहिए। + बटन से बाकी PDF या इमेज जोड़िए और फिर कहिए।",
        "hi-Latn": "Jodne ke liye do ya zyada files chahiye. + button se baaki PDFs ya images attach karo aur phir bolo.",
        "es": "Para unir hacen falta dos o más archivos. Adjunta los otros PDF o imágenes con el botón + y vuelve a pedirlo.",
        "fr": "Pour fusionner, il faut au moins deux fichiers. Ajoutez les autres PDF ou images avec le bouton + puis redemandez.",
        "de": "Zum Zusammenfügen braucht es zwei oder mehr Dateien. Hänge die anderen PDFs oder Bilder mit + an und frag nochmal.",
        "pt": "Para juntar são precisos dois ou mais arquivos. Anexe os outros PDFs ou imagens com o botão + e peça de novo.",
    },
    "ask_pages": {
        "en": "Which pages? Write them like “pages 1-3, 7”.",
        "hi": "कौन से पेज? ऐसे लिखिए: “pages 1-3, 7”।",
        "hi-Latn": "Kaunse pages? Aise likho: “pages 1-3, 7”.",
        "es": "¿Qué páginas? Escríbelas así: “páginas 1-3, 7”.",
        "fr": "Quelles pages ? Écrivez « pages 1-3, 7 ».",
        "de": "Welche Seiten? Schreib „Seiten 1-3, 7“.",
        "pt": "Quais páginas? Escreva “páginas 1-3, 7”.",
    },
    "background": {
        "en": "KonPDF can't remove backgrounds yet. I can crop the photo, make it black & white, brighten it, or put it on a page as a PDF.",
        "hi": "KonPDF अभी बैकग्राउंड नहीं हटा सकता। मैं फ़ोटो काट सकता हूँ, ब्लैक एंड व्हाइट या साफ़ कर सकता हूँ, या उसे PDF बना सकता हूँ।",
        "hi-Latn": "KonPDF abhi background nahi hata sakta. Main photo crop kar sakta hoon, black & white ya saaf kar sakta hoon, ya PDF bana sakta hoon.",
        "es": "KonPDF aún no quita fondos. Puedo recortar la foto, pasarla a blanco y negro, aclararla o ponerla en un PDF.",
        "fr": "KonPDF ne sait pas encore enlever un arrière-plan. Je peux recadrer la photo, la passer en noir et blanc, l’éclaircir ou en faire un PDF.",
        "de": "KonPDF kann noch keine Hintergründe entfernen. Ich kann das Foto zuschneiden, schwarz-weiß machen, aufhellen oder als PDF speichern.",
        "pt": "O KonPDF ainda não remove fundos. Posso cortar a foto, deixá-la em preto e branco, clareá-la ou colocá-la num PDF.",
    },
    "confirm": {
        "en": "Ready! Tap Run on the plan and I'll do it.",
        "hi": "तैयार! प्लान पर Run दबाइए, मैं कर दूँगा।",
        "hi-Latn": "Ready! Plan pe Run dabao, main kar dunga.",
        "es": "¡Listo! Toca Run en el plan y lo hago.",
        "fr": "C’est prêt ! Touchez Run sur le plan et je m’en occupe.",
        "de": "Fertig! Tippe beim Plan auf Run, dann lege ich los.",
        "pt": "Pronto! Toque em Run no plano e eu faço.",
    },
    "already_format": {
        "en": "{name} is already a {fmt} file, so there's nothing to convert. Want it smaller, resized, or in another format?",
        "hi": "{name} पहले से ही {fmt} फ़ाइल है, बदलने को कुछ नहीं। इसे छोटा, रीसाइज़ या किसी और फ़ॉर्मैट में करें?",
        "hi-Latn": "{name} pehle se hi {fmt} file hai, badalne ko kuch nahi. Ise chhota, resize ya kisi aur format mein karein?",
        "es": "{name} ya es un archivo {fmt}, no hay nada que convertir. ¿Lo quieres más pequeño, redimensionado o en otro formato?",
        "fr": "{name} est déjà un fichier {fmt}, rien à convertir. Plus petit, redimensionné ou dans un autre format ?",
        "de": "{name} ist schon eine {fmt}-Datei, da gibt es nichts umzuwandeln. Kleiner, andere Größe oder ein anderes Format?",
        "pt": "{name} já é um arquivo {fmt}, não há o que converter. Quer menor, redimensionado ou em outro formato?",
    },
    "already_small": {
        "en": "Good news: {name} is already {size}, so it's under your limit.",
        "hi": "अच्छी बात: {name} पहले से ही {size} है, यानी आपकी सीमा से कम।",
        "hi-Latn": "Achhi baat: {name} pehle se hi {size} hai, yaani aapki limit se kam.",
        "es": "Buena noticia: {name} ya ocupa {size}, por debajo de tu límite.",
        "fr": "Bonne nouvelle : {name} fait déjà {size}, sous votre limite.",
        "de": "Gute Nachricht: {name} hat schon {size}, also unter deinem Limit.",
        "pt": "Boa notícia: {name} já tem {size}, abaixo do seu limite.",
    },
    "unknown_image": {
        "en": "I'm not sure what you'd like to do with {name}. I can make it smaller (to any KB), resize it, make it passport size, clean it up, rotate or crop it, or turn it into a PDF. Tap an idea below or say it your way.",
        "hi": "{name} के साथ आप क्या करना चाहते हैं, मैं समझ नहीं पाया। मैं इसे छोटा (किसी भी KB तक), रीसाइज़, पासपोर्ट साइज़, साफ़, घुमा या काट सकता हूँ, या PDF बना सकता हूँ। नीचे कोई सुझाव चुनिए या अपने शब्दों में बताइए।",
        "hi-Latn": "{name} ke saath kya karna hai, main samajh nahi paaya. Main ise chhota (kisi bhi KB tak), resize, passport size, saaf, rotate ya crop kar sakta hoon, ya PDF bana sakta hoon. Neeche koi idea chuno ya apne shabdon mein batao.",
        "es": "No estoy seguro de qué quieres hacer con {name}. Puedo reducirla (a los KB que quieras), redimensionarla, dejarla tamaño pasaporte, mejorarla, girarla, recortarla o pasarla a PDF. Toca una idea o dímelo a tu manera.",
        "fr": "Je ne suis pas sûr de ce que vous voulez faire avec {name}. Je peux la réduire (à n’importe quel Ko), la redimensionner, au format passeport, l’améliorer, la pivoter, la recadrer ou en faire un PDF. Touchez une idée ou dites-le à votre façon.",
        "de": "Ich bin nicht sicher, was du mit {name} machen möchtest. Ich kann es verkleinern (auf beliebige KB), die Größe ändern, Passfoto-Format, verbessern, drehen, zuschneiden oder ein PDF daraus machen. Tippe auf eine Idee oder sag es mit deinen Worten.",
        "pt": "Não tenho certeza do que você quer fazer com {name}. Posso reduzir (para quantos KB quiser), redimensionar, deixar tamanho passaporte, melhorar, girar, cortar ou transformar em PDF. Toque numa ideia ou diga do seu jeito.",
    },
    "unknown_pdf": {
        "en": "I'm not sure what you'd like to do with {name}. I can compress it (to any size), turn it into Word or images, merge or split it, keep or delete pages, rotate it, add a password, a watermark or page numbers. Tap an idea below or say it your way.",
        "hi": "{name} के साथ आप क्या करना चाहते हैं, मैं समझ नहीं पाया। मैं इसे छोटा, Word या इमेज, जोड़/बाँट, पेज रख/हटा, घुमा, या पासवर्ड, वॉटरमार्क और पेज नंबर लगा सकता हूँ। नीचे कोई सुझाव चुनिए या अपने शब्दों में बताइए।",
        "hi-Latn": "{name} ke saath kya karna hai, main samajh nahi paaya. Main ise chhota, Word ya images mein, jod/baant, pages rakh/hata, rotate, ya password, watermark aur page numbers laga sakta hoon. Neeche koi idea chuno ya apne shabdon mein batao.",
        "es": "No estoy seguro de qué quieres hacer con {name}. Puedo comprimirlo, pasarlo a Word o imágenes, unirlo o dividirlo, conservar o borrar páginas, girarlo, ponerle contraseña, marca de agua o números de página. Toca una idea o dímelo a tu manera.",
        "fr": "Je ne suis pas sûr de ce que vous voulez faire avec {name}. Je peux le compresser, le convertir en Word ou en images, le fusionner ou le diviser, garder ou supprimer des pages, le pivoter, ajouter un mot de passe, un filigrane ou des numéros. Touchez une idée ou dites-le à votre façon.",
        "de": "Ich bin nicht sicher, was du mit {name} machen möchtest. Ich kann es komprimieren, in Word oder Bilder umwandeln, zusammenfügen oder teilen, Seiten behalten oder löschen, drehen, Passwort, Wasserzeichen oder Seitenzahlen hinzufügen. Tippe auf eine Idee oder sag es mit deinen Worten.",
        "pt": "Não tenho certeza do que você quer fazer com {name}. Posso comprimir, converter para Word ou imagens, juntar ou dividir, manter ou excluir páginas, girar, colocar senha, marca d'água ou números de página. Toque numa ideia ou diga do seu jeito.",
    },
    "unknown_document": {
        "en": "I'm not sure what you'd like to do with {name}. I can turn it into a PDF, plain text, Markdown, a web page or pictures, or copy its tables into Excel. Tap an idea below or say it your way.",
        "hi": "{name} के साथ आप क्या करना चाहते हैं, मैं समझ नहीं पाया। मैं इसे PDF, टेक्स्ट, Markdown, वेब पेज या तस्वीरों में बदल सकता हूँ, या इसकी टेबल Excel में डाल सकता हूँ।",
        "hi-Latn": "{name} ke saath kya karna hai, main samajh nahi paaya. Main ise PDF, text, Markdown, web page ya photos mein badal sakta hoon, ya iski tables Excel mein daal sakta hoon.",
        "es": "No estoy seguro de qué quieres hacer con {name}. Puedo pasarlo a PDF, texto, Markdown, página web o imágenes, o copiar sus tablas a Excel.",
        "fr": "Je ne suis pas sûr de ce que vous voulez faire avec {name}. Je peux le convertir en PDF, texte, Markdown, page web ou images, ou copier ses tableaux dans Excel.",
        "de": "Ich bin nicht sicher, was du mit {name} machen möchtest. Ich kann es in PDF, Text, Markdown, eine Webseite oder Bilder umwandeln oder seine Tabellen nach Excel kopieren.",
        "pt": "Não tenho certeza do que você quer fazer com {name}. Posso convertê-lo em PDF, texto, Markdown, página web ou imagens, ou copiar as tabelas para o Excel.",
    },
    "unknown_sheet": {
        "en": "I'm not sure what you'd like to do with {name}. I can turn it into Excel, CSV, JSON, a PDF table or a Word table. Tap an idea below or say it your way.",
        "hi": "{name} के साथ आप क्या करना चाहते हैं, मैं समझ नहीं पाया। मैं इसे Excel, CSV, JSON, PDF टेबल या Word टेबल में बदल सकता हूँ।",
        "hi-Latn": "{name} ke saath kya karna hai, main samajh nahi paaya. Main ise Excel, CSV, JSON, PDF table ya Word table mein badal sakta hoon.",
        "es": "No estoy seguro de qué quieres hacer con {name}. Puedo pasarlo a Excel, CSV, JSON, una tabla en PDF o en Word.",
        "fr": "Je ne suis pas sûr de ce que vous voulez faire avec {name}. Je peux le convertir en Excel, CSV, JSON, tableau PDF ou Word.",
        "de": "Ich bin nicht sicher, was du mit {name} machen möchtest. Ich kann es in Excel, CSV, JSON, eine PDF- oder Word-Tabelle umwandeln.",
        "pt": "Não tenho certeza do que você quer fazer com {name}. Posso convertê-lo em Excel, CSV, JSON, tabela em PDF ou Word.",
    },
    "explain_more": {
        "en": "Here's what happened: {title}. {why} What to try: {hint}",
        "hi": "क्या हुआ: {title}. {why} क्या करें: {hint}",
        "hi-Latn": "Kya hua: {title}. {why} Kya karein: {hint}",
        "es": "Esto pasó: {title}. {why} Qué probar: {hint}",
        "fr": "Ce qui s’est passé : {title}. {why} À essayer : {hint}",
        "de": "Was passiert ist: {title}. {why} Versuch Folgendes: {hint}",
        "pt": "O que aconteceu: {title}. {why} O que tentar: {hint}",
    },
}

STEP_TEXT: dict[str, dict[str, str]] = {
    "convert": {"en": "convert to {to}", "hi": "{to} में बदलना", "hi-Latn": "{to} mein badalna", "es": "convertir a {to}", "fr": "convertir en {to}", "de": "in {to} umwandeln", "pt": "converter para {to}"},
    "resize_kb": {"en": "make it under {size}", "hi": "{size} से कम करना", "hi-Latn": "{size} se kam karna", "es": "dejarlo en menos de {size}", "fr": "passer sous {size}", "de": "unter {size} bringen", "pt": "deixar com menos de {size}"},
    "resize_range": {"en": "make it {min}–{size}", "hi": "{min}–{size} करना", "hi-Latn": "{min}–{size} karna", "es": "dejarlo entre {min} y {size}", "fr": "entre {min} et {size}", "de": "auf {min}–{size} bringen", "pt": "deixar entre {min} e {size}"},
    "resize_px": {"en": "resize to {w} × {h} px", "hi": "{w} × {h} px करना", "hi-Latn": "{w} × {h} px karna", "es": "redimensionar a {w} × {h} px", "fr": "redimensionner en {w} × {h} px", "de": "auf {w} × {h} px ändern", "pt": "redimensionar para {w} × {h} px"},
    "resize_pct": {"en": "resize to {p} %", "hi": "{p} % करना", "hi-Latn": "{p} % karna", "es": "redimensionar al {p} %", "fr": "redimensionner à {p} %", "de": "auf {p} % skalieren", "pt": "redimensionar para {p} %"},
    "resize_print": {"en": "resize to {w} × {h} {u}", "hi": "{w} × {h} {u} करना", "hi-Latn": "{w} × {h} {u} karna", "es": "redimensionar a {w} × {h} {u}", "fr": "redimensionner en {w} × {h} {u}", "de": "auf {w} × {h} {u} ändern", "pt": "redimensionar para {w} × {h} {u}"},
    "resize_preset": {"en": "{preset} size", "hi": "{preset} साइज़", "hi-Latn": "{preset} size", "es": "tamaño {preset}", "fr": "format {preset}", "de": "Format {preset}", "pt": "tamanho {preset}"},
    "compress_img": {"en": "compress it", "hi": "छोटा करना", "hi-Latn": "chhota karna", "es": "comprimirlo", "fr": "le compresser", "de": "komprimieren", "pt": "comprimir"},
    "strip": {"en": "remove hidden details", "hi": "छिपी जानकारी हटाना", "hi-Latn": "hidden details hatana", "es": "quitar datos ocultos", "fr": "retirer les infos cachées", "de": "versteckte Infos entfernen", "pt": "remover dados ocultos"},
    "enhance": {"en": "enhance ({what})", "hi": "बेहतर बनाना ({what})", "hi-Latn": "behtar banana ({what})", "es": "mejorar ({what})", "fr": "améliorer ({what})", "de": "verbessern ({what})", "pt": "melhorar ({what})"},
    "compress_pdf": {"en": "compress the PDF", "hi": "PDF छोटी करना", "hi-Latn": "PDF chhoti karna", "es": "comprimir el PDF", "fr": "compresser le PDF", "de": "das PDF komprimieren", "pt": "comprimir o PDF"},
    "compress_pdf_kb": {"en": "compress the PDF under {size}", "hi": "PDF को {size} से कम करना", "hi-Latn": "PDF ko {size} se kam karna", "es": "comprimir el PDF a menos de {size}", "fr": "compresser le PDF sous {size}", "de": "das PDF unter {size} komprimieren", "pt": "comprimir o PDF para menos de {size}"},
    "merge": {"en": "merge into one PDF", "hi": "एक PDF में जोड़ना", "hi-Latn": "ek PDF mein jodna", "es": "unir en un solo PDF", "fr": "fusionner en un PDF", "de": "zu einem PDF zusammenfügen", "pt": "juntar em um PDF"},
    "split": {"en": "split into single pages", "hi": "हर पेज अलग करना", "hi-Latn": "har page alag karna", "es": "separar en páginas", "fr": "séparer en pages", "de": "in Einzelseiten teilen", "pt": "separar em páginas"},
    "split_ranges": {"en": "split into {pages}", "hi": "{pages} में बाँटना", "hi-Latn": "{pages} mein baantna", "es": "dividir en {pages}", "fr": "diviser en {pages}", "de": "in {pages} teilen", "pt": "dividir em {pages}"},
    "rotate": {"en": "rotate {angle}°", "hi": "{angle}° घुमाना", "hi-Latn": "{angle}° ghumana", "es": "girar {angle}°", "fr": "pivoter de {angle}°", "de": "um {angle}° drehen", "pt": "girar {angle}°"},
    "extract": {"en": "keep pages {pages}", "hi": "पेज {pages} रखना", "hi-Latn": "pages {pages} rakhna", "es": "conservar las páginas {pages}", "fr": "garder les pages {pages}", "de": "Seiten {pages} behalten", "pt": "manter as páginas {pages}"},
    "delete": {"en": "delete pages {pages}", "hi": "पेज {pages} हटाना", "hi-Latn": "pages {pages} hatana", "es": "eliminar las páginas {pages}", "fr": "supprimer les pages {pages}", "de": "Seiten {pages} löschen", "pt": "excluir as páginas {pages}"},
    "protect": {"en": "add a password", "hi": "पासवर्ड लगाना", "hi-Latn": "password lagana", "es": "poner contraseña", "fr": "ajouter un mot de passe", "de": "Passwort setzen", "pt": "colocar senha"},
    "unlock": {"en": "remove the password", "hi": "पासवर्ड हटाना", "hi-Latn": "password hatana", "es": "quitar la contraseña", "fr": "retirer le mot de passe", "de": "Passwort entfernen", "pt": "remover a senha"},
    "watermark": {"en": "add the watermark “{text}”", "hi": "“{text}” वॉटरमार्क लगाना", "hi-Latn": "“{text}” watermark lagana", "es": "añadir la marca de agua “{text}”", "fr": "ajouter le filigrane « {text} »", "de": "Wasserzeichen „{text}“ hinzufügen", "pt": "adicionar a marca d'água “{text}”"},
    "img_rotate": {"en": "rotate the picture {angle}°", "hi": "तस्वीर {angle}° घुमाना", "hi-Latn": "photo {angle}° ghumana", "es": "girar la imagen {angle}°", "fr": "pivoter l’image de {angle}°", "de": "das Bild um {angle}° drehen", "pt": "girar a imagem {angle}°"},
    "img_flip": {"en": "flip it", "hi": "उल्टा (मिरर) करना", "hi-Latn": "mirror karna", "es": "voltearla", "fr": "la retourner", "de": "spiegeln", "pt": "espelhar"},
    "img_crop": {"en": "crop to {ratio}", "hi": "{ratio} में काटना", "hi-Latn": "{ratio} mein crop karna", "es": "recortar a {ratio}", "fr": "recadrer en {ratio}", "de": "auf {ratio} zuschneiden", "pt": "cortar em {ratio}"},
    "page_numbers": {"en": "add page numbers", "hi": "पेज नंबर डालना", "hi-Latn": "page numbers daalna", "es": "numerar las páginas", "fr": "numéroter les pages", "de": "Seitenzahlen hinzufügen", "pt": "numerar as páginas"},
}  # fmt: skip

THEN = {"en": ", then ", "hi": ", फिर ", "hi-Latn": ", phir ", "es": ", luego ", "fr": ", puis ", "de": ", dann ", "pt": ", depois "}

PRESET_LABEL = {
    "passport": "passport photo",
    "us_visa": "US visa photo",
    "india_form_photo": "form photo (3.5 × 4.5 cm)",
    "signature": "signature",
    "id_scan": "ID scan",
    "instagram_square": "Instagram post",
    "instagram_portrait": "Instagram portrait",
    "instagram_story": "story",
    "whatsapp_dp": "WhatsApp DP",
    "youtube_thumb": "YouTube thumbnail",
    "linkedin_banner": "LinkedIn banner",
    "x_header": "X header",
    "full_hd": "Full HD",
    "hd": "HD",
    "uhd_4k": "4K",
    "a4_300dpi": "A4 print",
    "email": "email",
}

ENHANCE_LABEL = {
    "auto": "auto fix",
    "document": "clean document",
    "bw_document": "black & white document",
    "low_light": "low light",
    "denoise": "less grain",
    "upscale_2x": "2× bigger",
    "grayscale": "black & white",
}

SUGGEST: dict[str, dict[str, list[str]]] = {
    "image": {
        "en": ["Make it under 100 KB", "Convert to PDF", "Passport photo", "Enhance it", "Rotate it", "Crop to square"],
        "hi": ["100 KB से कम करो", "PDF बना दो", "पासपोर्ट फ़ोटो", "साफ़ करो"],
        "hi-Latn": ["100 KB se kam karo", "PDF bana do", "Passport photo", "Enhance karo"],
        "es": ["Menos de 100 KB", "Convertir a PDF", "Foto de pasaporte", "Mejorarla"],
        "fr": ["Moins de 100 Ko", "Convertir en PDF", "Photo d’identité passeport", "L’améliorer"],
        "de": ["Unter 100 KB", "In PDF umwandeln", "Passfoto", "Verbessern"],
        "pt": ["Menos de 100 KB", "Converter para PDF", "Foto de passaporte", "Melhorar"],
    },
    "pdf": {
        "en": ["Compress to 1 MB", "Convert to Word", "Add page numbers", "Split pages"],
        "hi": ["1 MB तक छोटा करो", "Word में बदलो", "पेज नंबर डालो", "पेज अलग करो"],
        "hi-Latn": ["1 MB tak chhota karo", "Word mein badlo", "Page numbers daalo", "Pages alag karo"],
        "es": ["Comprimir a 1 MB", "Convertir a Word", "Numerar páginas", "Separar páginas"],
        "fr": ["Compresser à 1 Mo", "Convertir en Word", "Numéroter les pages", "Séparer les pages"],
        "de": ["Auf 1 MB komprimieren", "In Word umwandeln", "Seitenzahlen", "Seiten teilen"],
        "pt": ["Comprimir para 1 MB", "Converter para Word", "Numerar páginas", "Separar páginas"],
    },
    "document": {
        "en": ["Convert to PDF", "Convert to text", "Tables to Excel"],
        "hi": ["PDF बना दो", "टेक्स्ट में बदलो", "टेबल Excel में"],
        "hi-Latn": ["PDF bana do", "Text mein badlo", "Tables Excel mein"],
        "es": ["Convertir a PDF", "Convertir a texto", "Tablas a Excel"],
        "fr": ["Convertir en PDF", "Convertir en texte", "Tableaux vers Excel"],
        "de": ["In PDF umwandeln", "In Text umwandeln", "Tabellen nach Excel"],
        "pt": ["Converter para PDF", "Converter para texto", "Tabelas para Excel"],
    },
    "sheet": {
        "en": ["Convert to PDF", "Convert to CSV", "Convert to Excel"],
        "hi": ["PDF बना दो", "CSV में बदलो", "Excel में बदलो"],
        "hi-Latn": ["PDF bana do", "CSV mein badlo", "Excel mein badlo"],
        "es": ["Convertir a PDF", "Convertir a CSV", "Convertir a Excel"],
        "fr": ["Convertir en PDF", "Convertir en CSV", "Convertir en Excel"],
        "de": ["In PDF umwandeln", "In CSV umwandeln", "In Excel umwandeln"],
        "pt": ["Converter para PDF", "Converter para CSV", "Converter para Excel"],
    },
    "other": {
        "en": ["Convert to PDF", "What can you do?", "Are my files private?"],
        "hi": ["PDF बना दो", "तुम क्या कर सकते हो?", "क्या मेरी फ़ाइलें सुरक्षित हैं?"],
        "hi-Latn": ["PDF bana do", "Tum kya kar sakte ho?", "Meri files safe hain?"],
        "es": ["Convertir a PDF", "¿Qué puedes hacer?", "¿Mis archivos son privados?"],
        "fr": ["Convertir en PDF", "Que sais-tu faire ?", "Mes fichiers sont-ils privés ?"],
        "de": ["In PDF umwandeln", "Was kannst du?", "Sind meine Dateien privat?"],
        "pt": ["Converter para PDF", "O que você faz?", "Meus arquivos são privados?"],
    },
}

# How-to answers: (keywords in any language, answer per language)
FAQ: list[tuple[list[str], dict[str, str]]] = [
    (
        ["what can you do", "what do you do", "help", "features", "kya kar sakte", "क्या कर सकते", "qué puedes hacer", "que sais-tu faire", "que peux-tu faire", "was kannst du", "o que você faz", "o que voce faz"],
        {
            "en": "I can convert images, PDFs, Word files and sheets into each other, resize photos to exact pixels, cm or KB, enhance scans and photos, and merge, split, compress, lock or number PDFs. Just tell me what you want.",
            "hi": "मैं इमेज, PDF, Word और शीट को एक-दूसरे में बदल सकता हूँ, फ़ोटो को सही पिक्सल, cm या KB में कर सकता हूँ, स्कैन और फ़ोटो साफ़ कर सकता हूँ, और PDF जोड़, बाँट, छोटी, लॉक या नंबर कर सकता हूँ। बस बताइए।",
            "hi-Latn": "Main images, PDF, Word aur sheets ko ek doosre mein badal sakta hoon, photos ko exact pixels, cm ya KB mein kar sakta hoon, scans aur photos saaf kar sakta hoon, aur PDF jod, baant, chhoti, lock ya number kar sakta hoon. Bas batao.",
            "es": "Convierto imágenes, PDF, Word y hojas de cálculo entre sí, ajusto fotos a píxeles, cm o KB exactos, mejoro escaneos y fotos, y uno, separo, comprimo, protejo o numero PDF. Solo dime qué quieres.",
            "fr": "Je convertis images, PDF, Word et tableurs entre eux, redimensionne les photos au pixel, au cm ou au Ko près, améliore scans et photos, et fusionne, sépare, compresse, verrouille ou numérote les PDF. Dites-moi simplement.",
            "de": "Ich wandle Bilder, PDFs, Word-Dateien und Tabellen ineinander um, bringe Fotos auf exakte Pixel, cm oder KB, verbessere Scans und Fotos, und füge PDFs zusammen, teile, komprimiere, sperre oder nummeriere sie. Sag einfach, was du brauchst.",
            "pt": "Converto imagens, PDFs, Word e planilhas entre si, ajusto fotos em pixels, cm ou KB exatos, melhoro digitalizações e fotos, e junto, separo, comprimo, protejo ou numero PDFs. É só pedir.",
        },
    ),
    (
        ["private", "privacy", "safe", "secure", "stored", "keep my files", "delete my files", "surakshit", "safe hain", "सुरक्षित", "privados", "privé", "privés", "sicher", "privat", "seguros"],
        {
            "en": "Your files are sent to the converter only to process them and are deleted after 30 minutes. I only see file names and sizes, never what's inside. History stays on your phone.",
            "hi": "आपकी फ़ाइलें सिर्फ़ प्रोसेस करने के लिए कन्वर्टर पर जाती हैं और 30 मिनट बाद हटा दी जाती हैं। मैं सिर्फ़ फ़ाइल का नाम और साइज़ देखता हूँ, अंदर का कुछ नहीं। हिस्ट्री आपके फ़ोन पर ही रहती है।",
            "hi-Latn": "Aapki files sirf process karne ke liye converter pe jaati hain aur 30 minute baad delete ho jaati hain. Main sirf file ka naam aur size dekhta hoon, andar ka kuch nahi. History aapke phone pe hi rehti hai.",
            "es": "Tus archivos se envían al conversor solo para procesarlos y se borran a los 30 minutos. Yo solo veo nombres y tamaños, nunca el contenido. El historial queda en tu teléfono.",
            "fr": "Vos fichiers ne sont envoyés au convertisseur que pour être traités et sont supprimés après 30 minutes. Je ne vois que les noms et tailles, jamais le contenu. L’historique reste sur votre téléphone.",
            "de": "Deine Dateien gehen nur zur Verarbeitung an den Konverter und werden nach 30 Minuten gelöscht. Ich sehe nur Namen und Größen, nie den Inhalt. Der Verlauf bleibt auf deinem Handy.",
            "pt": "Seus arquivos vão ao conversor só para serem processados e são apagados depois de 30 minutos. Eu só vejo nomes e tamanhos, nunca o conteúdo. O histórico fica no seu telefone.",
        },
    ),
    (
        ["blurry", "blur", "quality", "pixelated", "dhundla", "धुंधला", "quality kharab", "borrosa", "calidad", "floue", "qualité", "unscharf", "qualität", "embaçada", "qualidade"],
        {
            "en": "Very small file sizes (like 20 KB) force lower quality. Try a slightly bigger limit, or use Enhance → Auto enhance before resizing.",
            "hi": "बहुत छोटी फ़ाइल (जैसे 20 KB) में क्वालिटी कम हो जाती है। थोड़ी बड़ी लिमिट रखिए, या रीसाइज़ से पहले Enhance → Auto enhance कीजिए।",
            "hi-Latn": "Bahut chhoti file (jaise 20 KB) mein quality kam ho jaati hai. Thodi badi limit rakho, ya resize se pehle Enhance → Auto enhance karo.",
            "es": "Los tamaños muy pequeños (como 20 KB) bajan la calidad. Prueba un límite algo mayor o usa Enhance → Auto enhance antes de redimensionar.",
            "fr": "Les très petites tailles (comme 20 Ko) réduisent la qualité. Essayez une limite un peu plus grande, ou Enhance → Auto enhance avant de redimensionner.",
            "de": "Sehr kleine Dateigrößen (wie 20 KB) kosten Qualität. Nimm ein etwas größeres Limit oder vorher Enhance → Auto enhance.",
            "pt": "Tamanhos muito pequenos (como 20 KB) reduzem a qualidade. Tente um limite um pouco maior ou use Enhance → Auto enhance antes.",
        },
    ),
    (
        ["formats", "which files", "file types", "supported", "kaun se format", "कौन से फ़ॉर्मैट", "formatos", "quels formats", "welche formate"],
        {
            "en": "Images: JPG, PNG, WEBP, HEIC, AVIF, GIF, BMP, TIFF, ICO, SVG. PDF. Documents: DOCX, TXT, Markdown, HTML (and DOC, ODT, RTF, PPTX with the full converter). Sheets: XLSX, XLS, ODS, CSV, TSV, JSON. No video, audio or OCR.",
            "hi": "इमेज: JPG, PNG, WEBP, HEIC, AVIF, GIF, BMP, TIFF, ICO, SVG। PDF। डॉक्यूमेंट: DOCX, TXT, Markdown, HTML (और पूरे कन्वर्टर के साथ DOC, ODT, RTF, PPTX)। शीट: XLSX, XLS, ODS, CSV, TSV, JSON। वीडियो, ऑडियो या OCR नहीं।",
            "hi-Latn": "Images: JPG, PNG, WEBP, HEIC, AVIF, GIF, BMP, TIFF, ICO, SVG. PDF. Documents: DOCX, TXT, Markdown, HTML (aur full converter ke saath DOC, ODT, RTF, PPTX). Sheets: XLSX, XLS, ODS, CSV, TSV, JSON. Video, audio ya OCR nahi.",
            "es": "Imágenes: JPG, PNG, WEBP, HEIC, AVIF, GIF, BMP, TIFF, ICO, SVG. PDF. Documentos: DOCX, TXT, Markdown, HTML (y DOC, ODT, RTF, PPTX con el conversor completo). Hojas: XLSX, XLS, ODS, CSV, TSV, JSON. Sin vídeo, audio ni OCR.",
            "fr": "Images : JPG, PNG, WEBP, HEIC, AVIF, GIF, BMP, TIFF, ICO, SVG. PDF. Documents : DOCX, TXT, Markdown, HTML (et DOC, ODT, RTF, PPTX avec le convertisseur complet). Tableurs : XLSX, XLS, ODS, CSV, TSV, JSON. Pas de vidéo, d’audio ni d’OCR.",
            "de": "Bilder: JPG, PNG, WEBP, HEIC, AVIF, GIF, BMP, TIFF, ICO, SVG. PDF. Dokumente: DOCX, TXT, Markdown, HTML (und DOC, ODT, RTF, PPTX mit dem vollen Konverter). Tabellen: XLSX, XLS, ODS, CSV, TSV, JSON. Kein Video, Audio oder OCR.",
            "pt": "Imagens: JPG, PNG, WEBP, HEIC, AVIF, GIF, BMP, TIFF, ICO, SVG. PDF. Documentos: DOCX, TXT, Markdown, HTML (e DOC, ODT, RTF, PPTX com o conversor completo). Planilhas: XLSX, XLS, ODS, CSV, TSV, JSON. Sem vídeo, áudio ou OCR.",
        },
    ),
    (
        ["limit", "how big", "max size", "maximum size", "kitni badi", "कितनी बड़ी", "límite", "taille maximale", "maximale größe", "tamanho máximo"],
        {
            "en": "Each file can be up to 50 MB, and you can send up to 20 files at once.",
            "hi": "हर फ़ाइल 50 MB तक हो सकती है, और एक बार में 20 फ़ाइलें भेज सकते हैं।",
            "hi-Latn": "Har file 50 MB tak ho sakti hai, aur ek baar mein 20 files bhej sakte ho.",
            "es": "Cada archivo puede ocupar hasta 50 MB y puedes enviar hasta 20 a la vez.",
            "fr": "Chaque fichier peut faire jusqu’à 50 Mo, et vous pouvez en envoyer 20 à la fois.",
            "de": "Jede Datei darf bis zu 50 MB haben, und du kannst bis zu 20 auf einmal senden.",
            "pt": "Cada arquivo pode ter até 50 MB e você pode enviar até 20 de uma vez.",
        },
    ),
    (
        ["who are you", "what are you", "your name", "tum kaun", "तुम कौन", "quién eres", "qui es-tu", "wer bist du", "quem é você"],
        {
            "en": "I'm NW, KonPDF's built-in helper. I run on KonPDF's own converter, with no outside AI service.",
            "hi": "मैं NW हूँ, KonPDF का अपना सहायक। मैं KonPDF के अपने कन्वर्टर पर चलता हूँ, किसी बाहरी AI सेवा के बिना।",
            "hi-Latn": "Main NW hoon, KonPDF ka apna helper. Main KonPDF ke apne converter pe chalta hoon, kisi bahar ki AI service ke bina.",
            "es": "Soy NW, el ayudante de KonPDF. Funciono en el propio conversor de KonPDF, sin servicios de IA externos.",
            "fr": "Je suis NW, l’assistant intégré de KonPDF. Je tourne sur le convertisseur de KonPDF, sans service d’IA externe.",
            "de": "Ich bin NW, der Helfer in KonPDF. Ich laufe auf KonPDFs eigenem Konverter, ohne externen KI-Dienst.",
            "pt": "Sou o NW, o assistente do KonPDF. Rodo no próprio conversor do KonPDF, sem serviços de IA externos.",
        },
    ),
    (
        ["free", "cost", "price", "paid", "paisa", "पैसे", "gratis", "gratuit", "kostenlos", "grátis"],
        {
            "en": "Yes, KonPDF is free to use. No account needed.",
            "hi": "हाँ, KonPDF मुफ़्त है। कोई अकाउंट नहीं चाहिए।",
            "hi-Latn": "Haan, KonPDF free hai. Koi account nahi chahiye.",
            "es": "Sí, KonPDF es gratis. No hace falta cuenta.",
            "fr": "Oui, KonPDF est gratuit. Aucun compte nécessaire.",
            "de": "Ja, KonPDF ist kostenlos. Kein Konto nötig.",
            "pt": "Sim, o KonPDF é grátis. Não precisa de conta.",
        },
    ),
]  # fmt: skip


def _t(key: str, lang: str, **params: Any) -> str:
    template = T[key].get(lang) or T[key]["en"]
    return template.format(**params) if params else template


def _step_phrase(step: dict[str, Any], lang: str) -> str:
    tool, p = step["tool"], step["params"]

    def s(key: str, **kw: Any) -> str:
        return (STEP_TEXT[key].get(lang) or STEP_TEXT[key]["en"]).format(**kw)

    if tool == "convert":
        return s("convert", to=str(p.get("to", "")).upper().replace("DOCX", "Word").replace("XLSX", "Excel"))
    if tool == "resize":
        parts = []
        if p.get("crop"):
            parts.append(s("img_crop", ratio=p["crop"]))
        if p.get("rotate"):
            parts.append(s("img_rotate", angle={270: "−90"}.get(p["rotate"], p["rotate"])))
        if p.get("flip"):
            parts.append(s("img_flip"))
        if p.get("preset"):
            parts.append(s("resize_preset", preset=PRESET_LABEL.get(p["preset"], p["preset"])))
        elif p.get("mode") == "pixels":
            parts.append(s("resize_px", w=p.get("width") or "auto", h=p.get("height") or "auto"))
        elif p.get("mode") == "percent":
            parts.append(s("resize_pct", p=_fmt_num(p.get("percent"))))
        elif p.get("mode") == "print":
            pr = p.get("print") or {}
            parts.append(s("resize_print", w=_fmt_num(pr.get("width")), h=_fmt_num(pr.get("height")), u=pr.get("unit", "cm")))
        elif p.get("mode") == "compress" and not p.get("max_kb"):
            parts.append(s("compress_img"))
        if p.get("max_kb"):
            key = "resize_range" if p.get("min_kb") else "resize_kb"
            parts.append(s(key, size=_size(p["max_kb"], lang), min=_fmt_num(p.get("min_kb"))))
        if p.get("strip_metadata") and not parts:
            parts.append(s("strip"))
        return THEN.get(lang, ", ").join(parts) or s("compress_img")
    if tool == "enhance":
        what = p.get("preset") or p.get("filter") or "auto"
        return s("enhance", what=ENHANCE_LABEL.get(what, str(what).replace("_", " ")))
    if tool == "compress_pdf":
        return s("compress_pdf_kb", size=_size(p["target_kb"], lang)) if p.get("target_kb") else s("compress_pdf")
    if tool == "split":
        return s("split_ranges", pages=p.get("ranges")) if p.get("mode") == "ranges" else s("split")
    if tool == "rotate":
        return s("rotate", angle={270: "−90", 90: "90"}.get(p.get("angle", 90), p.get("angle", 90)))
    if tool in ("extract", "delete"):
        return s(tool, pages=p.get("pages"))
    if tool == "watermark":
        return s("watermark", text=p.get("text", ""))
    return s(tool)


def _size(kb: Any, lang: str) -> str:
    """50 → "50 KB", 1024 → "1 MB" (Ko/Mo in French)."""
    kb = float(kb)
    k, m = ("Ko", "Mo") if lang == "fr" else ("KB", "MB")
    if kb >= 1024:
        return f"{_fmt_num(round(kb / 1024, 1))} {m}"
    return f"{_fmt_num(round(kb))} {k}"


def _fmt_num(value: Any) -> str:
    if value is None:
        return ""
    number = float(value)
    return str(int(number)) if number.is_integer() else f"{number:g}"


# --------------------------------------------------------------------------
# Planning
# --------------------------------------------------------------------------

def _ext(file: dict[str, Any]) -> str:
    name = str(file.get("name", "")).lower()
    ext = name.rsplit(".", 1)[-1] if "." in name else ""
    return {"jpeg": "jpg", "jfif": "jpg", "tif": "tiff", "heif": "heic", "htm": "html"}.get(ext, ext)


def _context_kind(files: list[dict[str, Any]], facts: Facts) -> str:
    """What the person is working with: 'image', 'pdf', 'document', 'sheet' or 'unknown'."""
    kinds = set()
    for f in files:
        name = str(f.get("name", "")).lower()
        mime = str(f.get("mime", "")).lower()
        ext = name.rsplit(".", 1)[-1] if "." in name else ""
        if mime.startswith("image/") or ext in IMAGE_FMTS:
            kinds.add("image")
        elif mime == "application/pdf" or ext == "pdf":
            kinds.add("pdf")
        elif ext in SHEET_FMTS:
            kinds.add("sheet")
        elif ext in DOC_FMTS or ext in SLIDE_FMTS:
            kinds.add("document")
    if len(kinds) == 1:
        return kinds.pop()
    if kinds == {"image", "pdf"}:
        return "mixed"
    sources = [f for f in facts.formats if f != facts.target]
    if sources:
        first = sources[0]
        if first in IMAGE_FMTS:
            return "image"
        if first == "pdf":
            return "pdf"
        if first in SHEET_FMTS:
            return "sheet"
        if first in DOC_FMTS | SLIDE_FMTS:
            return "document"
    if facts.preset or facts.width or facts.print_size or facts.filters or facts.low_light or facts.upscale or facts.crop or facts.flip:
        return "image"
    if facts.actions & {"merge", "split", "extract", "delete", "protect", "unlock", "watermark", "page_numbers"}:
        return "pdf"
    return "unknown"


@dataclass
class Plan:
    steps: list[dict[str, Any]] = field(default_factory=list)
    missing: str | None = None  # "password" | "target" | "pages" | "cant_output" | "more_files"
    detail: str = ""

    def add(self, tool: str, **params: Any) -> None:
        self.steps.append({"tool": tool, "params": {k: v for k, v in params.items() if v is not None}})


def build_plan(facts: Facts, files: list[dict[str, Any]]) -> Plan:
    plan = Plan()
    kind = _context_kind(files, facts)
    a = facts.actions
    # Without an explicit "to X", a single format word that isn't what the files already are is the target.
    target = facts.target
    if not target and facts.formats:
        file_exts = {str(f.get("name", "")).lower().rsplit(".", 1)[-1] for f in files}
        others = [fmt for fmt in facts.formats if fmt not in file_exts]
        if others and ("convert" in a or len(facts.formats) == 1 or files):
            target = others[-1]
    if target == "doc":
        target = "docx"
    # Formats KonPDF reads but can't write.
    if target in ("svg", "heic", "pptx", "ppt", "odt", "ods", "xls"):
        plan.missing, plan.detail = "cant_output", target.upper()
        return plan
    # Merging needs two or more files.
    if "merge" in facts.actions and len(files) == 1 and _context_kind(files, facts) == "pdf":
        plan.missing = "more_files"
        return plan

    pdf_only = {"merge", "split", "extract", "delete", "protect", "unlock", "watermark", "page_numbers"}
    # Rotating is a PDF job for PDFs (or when pages are named), an image job otherwise.
    rotate_pdf = "rotate" in a and (kind in ("pdf", "mixed", "document") or (kind == "unknown" and facts.pages is not None))
    image_side = kind in ("image", "unknown") and not (a & pdf_only) and not rotate_pdf
    wants_pdf_ops = bool(a & pdf_only) or rotate_pdf
    size_given = facts.max_kb is not None or facts.min_kb is not None

    # 1. Enhance (images, before any resizing)
    if kind in ("image", "unknown", "mixed") and not wants_pdf_ops:
        preset = None
        if "enhance" in a or facts.low_light or facts.denoise or (facts.upscale and not (facts.width or facts.percent)):
            if facts.document_hint and "grayscale" in facts.filters:
                preset = "bw_document"
            elif facts.document_hint:
                preset = "document"
            elif facts.low_light:
                preset = "low_light"
            elif facts.denoise:
                preset = "denoise"
            elif facts.upscale:
                preset = "upscale_2x"
            else:
                preset = "auto"
        filt = None
        if facts.filters and preset != "bw_document":
            filt = facts.filters[0]
            if filt == "grayscale" and facts.document_hint:
                preset, filt = "bw_document", None
        if preset or filt:
            plan.add("enhance", preset=preset, filter=filt)

    # 2. Resize (images)
    if image_side and kind != "mixed":
        params: dict[str, Any] = {}
        if facts.preset:
            params.update(mode="preset", preset=facts.preset)
        elif facts.width or facts.height:
            params.update(mode="pixels", width=facts.width, height=facts.height, fit="fill" if facts.width and facts.height else None)
        elif facts.print_size:
            params.update(mode="print", print={**facts.print_size, "dpi": facts.dpi or 300}, fit="fill")
        elif facts.percent:
            params.update(mode="percent", percent=facts.percent)
        elif facts.dpi and "resize" in a:
            params.update(mode="dpi", dpi=facts.dpi)
        if size_given:
            params.setdefault("mode", "filesize")
            params.update(max_kb=facts.max_kb, min_kb=facts.min_kb)
            if facts.max_kb is None and facts.min_kb is not None:
                params["max_kb"] = None
        elif "compress" in a and not params:
            params.update(mode="compress")
        if facts.strip and not params:
            params.update(mode="filesize", strip_metadata=True)
        elif facts.strip:
            params["strip_metadata"] = True
        # Rotate / flip / crop the picture itself.
        turns = {
            "rotate": (facts.angle or 90) if "rotate" in a else None,
            "flip": facts.flip if "flip" in a or facts.flip else None,
            "crop": facts.crop if "crop" in a or (facts.crop and not params) else None,
        }
        turns = {k: v for k, v in turns.items() if v}
        if turns:
            params.setdefault("mode", "transform")
            params.update(turns)
        if target in IMAGE_OUT and params:
            params["format"] = target
            target = None if not size_given else None
        if params:
            plan.add("resize", **params)

    # 3. Convert
    if target and target != "pdf" or (target == "pdf" and kind != "pdf"):
        if not (kind == "pdf" and target == "pdf"):
            if target and not (plan.steps and plan.steps[-1]["tool"] == "resize" and plan.steps[-1]["params"].get("format") == target):
                plan.add("convert", to=target)

    # 4. PDF operations, in a sensible order
    pdfish = kind in ("pdf", "mixed") or any(s["tool"] == "convert" and s["params"].get("to") == "pdf" for s in plan.steps) or wants_pdf_ops
    if pdfish:
        if "merge" in a:
            if kind == "image":
                # Images → PDF already makes one combined PDF.
                if not any(s["tool"] == "convert" for s in plan.steps):
                    plan.add("convert", to="pdf")
            else:
                plan.add("merge")
        if "split" in a:
            if facts.pages and "," in facts.pages:
                plan.add("split", mode="ranges", ranges=facts.pages)
            else:
                plan.add("split", mode="each")
        if "extract" in a:
            if not facts.pages:
                plan.missing = "pages"
            plan.add("extract", pages=facts.pages)
        if "delete" in a:
            if not facts.pages:
                plan.missing = "pages"
            plan.add("delete", pages=facts.pages)
        if rotate_pdf:
            plan.add("rotate", angle=facts.angle or 90, pages=facts.pages)
        if "unlock" in a:
            if not facts.password:
                plan.missing = "password"
            plan.add("unlock", password=facts.password)
        if "watermark" in a:
            plan.add("watermark", text=facts.text or "CONFIDENTIAL", style="diagonal", opacity=0.3)
        if "page_numbers" in a:
            plan.add("page_numbers", position="bottom-center", style="n")
        if ("compress" in a or (size_given and kind == "pdf")) and kind in ("pdf", "mixed") or ("compress" in a and wants_pdf_ops):
            plan.add("compress_pdf", target_kb=facts.max_kb, level=None if facts.max_kb else "medium")
        if "protect" in a and "unlock" not in a:
            if not facts.password:
                plan.missing = "password"
            plan.add("protect", password=facts.password)

    # Converting with nothing to convert to
    if not plan.steps and "convert" in a and not target:
        plan.missing = "target"
    return plan


# --------------------------------------------------------------------------
# Conversation: follow-ups, confirmations, notes
# --------------------------------------------------------------------------

CONFIRM = {
    "yes", "y", "yeah", "yep", "ok", "okay", "ok do it", "okay do it", "sure", "do it", "go", "go ahead", "run", "run it",
    "yes please", "please do", "proceed", "haan", "han", "ha", "haa", "theek hai", "thik hai", "kar do", "karo", "chalo",
    "हाँ", "हां", "ठीक है", "करो", "sí", "si", "vale", "dale", "oui", "d'accord", "vas-y", "ja", "klar", "mach", "los",
    "sim", "pode", "claro", "beleza",
}  # fmt: skip
# Questions that want information, not a file job ("how does...", "what is...").
INFO_STARTS = (
    "how", "why", "what", "which", "where", "when", "is it", "is my", "are ", "does", "do you", "who", "kya", "kaise", "kyun",
    "kyon", "क्या", "कैसे", "क्यों", "cómo", "qué", "por qué", "dónde", "comment", "pourquoi", "quoi", "qu'est", "est-ce",
    "wie", "was", "warum", "wo ", "como", "o que", "por que", "onde",
)  # fmt: skip
REFINE_STARTS = (
    "also", "and ", "then", "now", "instead", "but ", "plus", "too", "same", "actually", "no,", "no ", "not ", "aur", "bhi", "phir",
    "ab ", "nahi", "और", "भी", "फिर", "también", "y ", "luego", "ahora", "mejor", "aussi", "et ", "puis", "maintenant", "plutôt",
    "auch", "und ", "dann", "jetzt", "lieber", "também", "e ", "depois", "agora",
)  # fmt: skip
REFINE_WORDS = ("instead", "as well", " too", "bhi", "भी", "también", "aussi", "auch", "também", "en vez", "au lieu", "stattdessen", "em vez")


def is_refinement(text: str, facts: Facts) -> bool:
    """Does this message build on the one before ("also under 100 kb", "png instead", "password: 1234")?"""
    if text.startswith(REFINE_STARTS) or any(w in text for w in REFINE_WORDS):
        return True
    has_detail = any(
        (facts.max_kb, facts.min_kb, facts.width, facts.height, facts.print_size, facts.percent, facts.pages, facts.password, facts.preset, facts.target, facts.crop)
    )
    # Only details, no job of its own: "under 50 kb", "pages 2-3", "password: abcd", "png".
    return has_detail and not facts.actions and len(text.split()) <= 6


def merge_facts(base: Facts, new: Facts) -> Facts:
    """`base` updated with everything `new` says; new details win, jobs add up."""
    merged = Facts(**{k: getattr(base, k) for k in base.__dataclass_fields__})
    for name in merged.__dataclass_fields__:
        value = getattr(new, name)
        if name == "actions":
            merged.actions = set(base.actions) | set(new.actions)
        elif name == "formats":
            merged.formats = list(new.formats) + [f for f in base.formats if f not in new.formats]
        elif name == "filters":
            merged.filters = list(new.filters) or list(base.filters)
        elif value not in (None, False, "", [], set()):
            setattr(merged, name, value)
    # A format named in a follow-up is the new target ("make it png instead").
    if not new.target and new.formats:
        merged.target = new.formats[0]
    # A new target replaces the old one: drop the old format so it isn't picked again.
    if merged.target and base.target and merged.target != base.target:
        merged.formats = [f for f in merged.formats if f != base.target]
    return merged


def _conversation_facts(user_messages: list[str]) -> Facts:
    """Facts of the latest request, including the follow-ups that refined it."""
    chain: list[str] = []
    for text in reversed(user_messages[-6:]):
        chain.insert(0, text)
        normalized = correct_typos(_norm(text))
        if normalized.strip(" .!") in CONFIRM:
            continue
        if not is_refinement(normalized, extract(text)):
            break
    facts = Facts()
    for text in chain:
        if correct_typos(_norm(text)).strip(" .!") in CONFIRM:
            continue
        facts = merge_facts(facts, extract(text))
    return facts


def _size_note(plan: Plan, files: list[dict[str, Any]], lang: str) -> str | None:
    """'It's already 80 KB' when a file is already under the size asked for."""
    if len(plan.steps) != 1 or len(files) != 1:
        return None
    step = plan.steps[0]
    limit = step["params"].get("max_kb") if step["tool"] == "resize" else step["params"].get("target_kb") if step["tool"] == "compress_pdf" else None
    if not limit or step["params"].get("mode") not in (None, "filesize"):
        return None
    size = int(files[0].get("size") or 0)
    if 0 < size <= float(limit) * 1024:
        return _t("already_small", lang, name=files[0].get("name", ""), size=_size(size / 1024, lang))
    return None


# --------------------------------------------------------------------------
# Optional local LLM tier
# --------------------------------------------------------------------------

SYSTEM_PROMPT = """You are NW, the assistant inside KonPDF, an app that converts images, PDFs, documents and spreadsheets.
KonPDF cannot do video, audio or OCR. Answer in the user's language ({lang}), in one to three short, friendly sentences.
If the user wants a file action, also return a plan using only these tools:
convert{{to}}, resize{{mode,preset,width,height,percent,max_kb,min_kb,format}}, enhance{{preset,filter}},
compress_pdf{{level,target_kb}}, merge, split{{mode,ranges}}, rotate{{angle,pages}}, extract{{pages}}, delete{{pages}},
protect{{password}}, unlock{{password}}, watermark{{text}}, page_numbers.
Reply ONLY with JSON: {{"reply": "...", "plan": {{"steps": [{{"tool": "...", "params": {{}}}}]}} or null}}"""


class LocalLLM:
    """A small GGUF model through llama-cpp-python, if both are available."""

    def __init__(self, path: str) -> None:
        from llama_cpp import Llama  # type: ignore[import-not-found]

        self.llm = Llama(model_path=path, n_ctx=2048, n_threads=4, verbose=False)

    def ask(self, message: str, lang: str, files: list[dict[str, Any]]) -> dict[str, Any] | None:
        names = ", ".join(f"{f.get('name')} ({f.get('size', 0) // 1024} KB)" for f in files[:10]) or "none"
        out = self.llm.create_chat_completion(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT.format(lang=lang)},
                {"role": "user", "content": f"Attached files: {names}\n\n{message}"},
            ],
            temperature=0.2,
            max_tokens=300,
            response_format={"type": "json_object"},
        )
        try:
            data = json.loads(out["choices"][0]["message"]["content"])
        except (KeyError, IndexError, ValueError, TypeError):
            return None
        return data if isinstance(data, dict) and isinstance(data.get("reply"), str) else None


# --------------------------------------------------------------------------
# NW
# --------------------------------------------------------------------------


class NW:
    def __init__(self, model_path: str | None = None) -> None:
        self.llm: LocalLLM | None = None
        if model_path:
            try:
                self.llm = LocalLLM(model_path)
            except Exception:  # noqa: BLE001 - no model or no llama_cpp: the core tier still works
                self.llm = None

    @property
    def engine(self) -> str:
        return "core+llm" if self.llm else "core"

    def _suggestions(self, kind: str, lang: str) -> list[str]:
        group = kind if kind in ("image", "pdf", "document", "sheet") else "other"
        return SUGGEST[group].get(lang) or SUGGEST[group]["en"]

    def _answer(self, lang: str, reply: str, plan: dict[str, Any] | None, kind: str, engine: str = "core") -> dict[str, Any]:
        return {"lang": lang, "reply": reply, "plan": plan, "suggestions": self._suggestions(kind, lang), "engine": engine}

    def reply(
        self,
        message: str,
        lang_hint: str | None = None,
        files: list[dict[str, Any]] | None = None,
        history: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        files = files or []
        history = history or []
        message = (message or "").strip()
        lang = detect_language(message, lang_hint) if message else (lang_hint if lang_hint in LANGS else "en")
        text = correct_typos(_norm(message))
        earlier = [h.get("text", "") for h in history if h.get("role") == "user" and h.get("text")]

        if not message or (_has(text, GREETINGS) and len(text.split()) <= 3):
            return self._answer(lang, _t("greet", lang), None, _context_kind(files, Facts()))
        # "yes", "ok do it", "haan": confirm the request before.
        if earlier and text.strip(" .!") in CONFIRM:
            plan_reply = self._plan_reply(_conversation_facts(earlier), files, lang)
            if plan_reply:
                plan_reply["reply"] = _t("confirm", lang)
                return plan_reply
        if _has(text, THANKS) and len(text.split()) <= 5:
            return self._answer(lang, _t("thanks", lang), None, _context_kind(files, Facts()))
        for topic, words in OUT_OF_SCOPE.items():
            if _has(text, words):
                return self._answer(lang, _t(topic, lang), None, _context_kind(files, Facts()))

        facts = extract(message)
        # Follow-ups build on what was asked before: "also make it under 100 kb",
        # "make it png instead", "password: abcd" after NW asked for one.
        if earlier and is_refinement(text, facts):
            facts = merge_facts(_conversation_facts(earlier), facts)
        kind = _context_kind(files, facts)

        informational = text.startswith(INFO_STARTS)
        if informational:
            for keywords, answer in FAQ:
                if _has(text, keywords):
                    return self._answer(lang, answer.get(lang) or answer["en"], None, kind)

        plan_reply = self._plan_reply(facts, files, lang)
        if plan_reply:
            return plan_reply

        for keywords, answer in FAQ:
            if _has(text, keywords):
                return self._answer(lang, answer.get(lang) or answer["en"], None, kind)

        if self.llm:
            llm_answer = self._ask_llm(message, lang, files)
            if llm_answer:
                return self._answer(lang, llm_answer[0], llm_answer[1], kind, "llm")
        if files and kind in ("image", "pdf", "document", "sheet"):
            name = files[0].get("name") if len(files) == 1 else f"{len(files)} files"
            return self._answer(lang, _t(f"unknown_{kind}", lang, name=name), None, kind)
        return self._answer(lang, _t("unknown", lang), None, kind)

    def _plan_reply(self, facts: Facts, files: list[dict[str, Any]], lang: str) -> dict[str, Any] | None:
        """A plan answer for `facts`, a question for a missing detail, or None if there's nothing to do."""
        kind = _context_kind(files, facts)
        plan = build_plan(facts, files)
        if plan.missing:
            return self._answer(lang, _t(f"ask_{plan.missing}", lang, fmt=plan.detail), None, kind)
        if not plan.steps:
            return None
        # "Convert to JPG" for a JPG: say so instead of offering a job that can't run.
        exts = {_ext(f) for f in files}
        if len(plan.steps) == 1 and plan.steps[0]["tool"] == "convert" and exts == {plan.steps[0]["params"].get("to")}:
            name = files[0].get("name") if len(files) == 1 else f"{len(files)} files"
            return self._answer(lang, _t("already_format", lang, name=name, fmt=str(plan.steps[0]["params"]["to"]).upper()), None, kind)
        summary =THEN.get(lang, ", ").join(_step_phrase(s, lang) for s in plan.steps)
        summary = summary[0].upper() + summary[1:]
        reply = _t("plan", lang, summary=summary)
        note = _size_note(plan, files, lang)
        if note:
            reply += " " + note
        if not files:
            reply += " " + _t("need_files", lang)
        return self._answer(lang, reply, {"steps": plan.steps, "summary": summary}, kind)

    def _ask_llm(self, message: str, lang: str, files: list[dict[str, Any]]):
        try:
            data = self.llm.ask(message, lang, files) if self.llm else None
        except Exception:  # noqa: BLE001 - a model failure falls back to the core answer
            return None
        if not data:
            return None
        plan = data.get("plan")
        if plan:
            from app.pipeline import validate_plan
            from app.errors import KonError

            try:
                steps = validate_plan(plan)
            except KonError:
                return None
            summary = THEN.get(lang, ", ").join(_step_phrase(s, lang) for s in steps)
            plan = {"steps": steps, "summary": summary[:1].upper() + summary[1:]}
        return str(data["reply"])[:600], plan or None

    def explain(self, code: str, lang: str) -> dict[str, Any]:
        """A longer explanation of an error the app showed."""
        from app.errors import CATALOG, render, why

        if code not in CATALOG and code not in ("SERVER_UNREACHABLE", "SERVER_WAKING", "NO_APP", "FILE_GONE", "TOO_BIG_TO_SEND"):
            code = "INTERNAL"
        if code in CATALOG:
            error = render(code, lang, name="…", max_mb=50, size_mb="?", max=20, src="?", dst="?", pages="?", total="?", expected="…", detail="")
            reply = _t("explain_more", lang, title=error["title"], why=why(code, lang) or "", hint=error.get("hint", ""))
            reply = re.sub(r"\s{2,}", " ", reply).strip()
        else:
            reply = _t("unknown", lang)
        kind = "pdf" if code in ("PASSWORD_REQUIRED", "WRONG_PASSWORD", "PAGE_RANGE_INVALID", "NO_TABLES") else "image"
        return self._answer(lang, reply, None, kind)
