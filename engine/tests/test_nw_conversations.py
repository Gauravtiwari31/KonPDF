"""NW end to end: what people actually type, run for real on real files.

Each request goes through /api/nw/chat; the plan NW proposes is then run
through /api/run on a sample file of the right kind. A request "works" only
if the run produces files.
"""

from __future__ import annotations

import json

import pytest

IMG, PDF, DOCX, XLSX = "jpg", "pdf", "docx", "xlsx"

REQUESTS = [
    # Images: format, size, look
    ("convert to pdf", IMG), ("convert this image to pdf", IMG), ("make pdf", IMG), ("pdf", IMG), ("jpg to png", IMG),
    ("reduce size", IMG), ("reduce the size of this image", IMG), ("compress image", IMG), ("make it smaller", IMG),
    ("resize image to 500x500", IMG), ("make it 200kb", IMG), ("under 200kb", IMG), ("less than 1mb", IMG),
    ("change format to png", IMG), ("enhance", IMG), ("make photo clear", IMG), ("increase quality", IMG),
    ("rotate this image", IMG), ("turn it left", IMG), ("flip it", IMG), ("mirror the photo", IMG), ("crop to square", IMG),
    ("crop 16:9", IMG), ("black and white", IMG), ("grayscale this photo", IMG), ("passport size photo", IMG),
    ("make it passport size", IMG), ("signature 20kb", IMG), ("photo for ssc form", IMG), ("convert to webp", IMG),
    ("to png", IMG), ("png", IMG), ("make it hd", IMG), ("scale to 50%", IMG), ("instagram story size", IMG),
    ("this photo is too dark", IMG), ("remove location from photo", IMG),
    # PDFs
    ("compress pdf", PDF), ("make pdf smaller", PDF), ("pdf under 2mb", PDF), ("reduce pdf size to 500kb", PDF),
    ("add password 1234", PDF), ("unlock pdf password is abcd", PDF), ("add page numbers", PDF),
    ("watermark confidential", PDF), ("extract page 2", PDF), ("delete page 3", PDF), ("remove first page", PDF),
    ("remove the last page", PDF), ("keep first 2 pages", PDF), ("pdf to word", PDF), ("convert to word", PDF),
    ("pdf to jpg", PDF), ("convert to images", PDF), ("split pdf", PDF), ("split into pages", PDF), ("rotate", PDF),
    ("lock it with 98765", PDF), ("tables to excel", PDF),
    # Documents and sheets
    ("word to pdf", DOCX), ("convert docx to pdf", DOCX), ("make it pdf", DOCX), ("convert to text", DOCX),
    ("excel to pdf", XLSX), ("xlsx to csv", XLSX), ("convert to csv", XLSX), ("to json", XLSX),
    # Hinglish, Hindi, other languages
    ("isko chhota kar do", IMG), ("size kam karo", IMG), ("pdf me convert karo", IMG), ("photo ko 50kb ka kar do", IMG),
    ("isko word me badlo", PDF), ("password laga do 1234", PDF), ("photo saaf karo", IMG), ("passport size bana do", IMG),
    ("पीडीएफ बना दो", IMG), ("इसे छोटा करो", IMG), ("convierte a pdf", IMG), ("comprime el pdf a 1 mb", PDF),
    ("convertis en png", IMG), ("in PDF umwandeln", IMG), ("converta para word", PDF),
    # Typos, politeness, casual
    ("convert to pfd", IMG), ("compres this", IMG), ("make it under 100 kb pls", IMG), ("can you make this a pdf?", IMG),
    ("could you compress this pdf please", PDF), ("i need this as a png", IMG), ("need it below 300 kb for upload", IMG),
    ("pls convrt to jpg", PDF), ("resise to 800 px wide", IMG),
    # A second, independent batch (written after the first one passed)
    ("shrink this photo to 150kb", IMG), ("i want a pdf of this", IMG), ("save as png please", IMG), ("change it to jpeg", PDF),
    ("give me the word version", PDF), ("make this file lighter", PDF), ("i need to upload this on a govt site, max 50kb", IMG),
    ("convert to a smaller pdf", PDF), ("sharpen the image", IMG), ("brighten this pic", IMG), ("can u reduce it to 1 mb", PDF),
    ("separate every page", PDF), ("only keep page 1", PDF), ("get rid of page 2", PDF), ("put a password on it: secret99", PDF),
    ("number the pages", PDF), ("stamp DRAFT on it", PDF), ("make it A4 size", IMG), ("photo ka size 20 kb karna hai", IMG),
    ("isko jpg me chahiye", PDF), ("pdf ko chhota karo 1mb tak", PDF), ("isko ghuma do", IMG), ("मुझे इसकी PDF चाहिए", IMG),
    ("fais-en un pdf", IMG), ("hazlo más pequeño", IMG), ("mach es kleiner", IMG), ("quero em pdf", IMG), ("make it square", IMG),
    ("rotate 180", IMG), ("convert it into excel", PDF), ("turn this doc into a pdf", DOCX), ("csv please", XLSX),
    ("compress to 70%", IMG), ("1200 px width", IMG), ("make it 4x6 inch print", IMG), ("clean up this scanned page", IMG),
    ("make this document black and white", IMG), ("i want hd quality", IMG),
    # A third batch: vaguer, messier, more conversational
    ("this is too big", IMG), ("its too heavy to send on whatsapp", IMG), ("upload karna hai portal pe, size zyada hai", IMG),
    ("file size kam karna hai", PDF), ("need small size", IMG), ("make it lighter for email", PDF), ("optimize this", IMG),
    ("make it look better", IMG), ("photo bahut dark hai", IMG), ("pic blur hai thoda clear karo", IMG), ("fix this scan", IMG),
    ("convert to pdf and make it under 500kb", IMG), ("resize to 600x600 and convert to png", IMG),
    ("make it black and white and under 100kb", IMG), ("compress and add password 4321", PDF), ("rotate left and save as png", IMG),
    ("crop square then 200kb", IMG), ("pdf to jpg high quality", PDF), ("pdf to png 300 dpi", PDF), ("only pages 2 to 3 as images", PDF),
    ("ssc photo 20 to 50 kb", IMG), ("upsc form signature size", IMG), ("aadhar card pdf under 200kb", PDF),
    ("pan card photo 3.5x4.5 cm", IMG), ("neet photo banana hai", IMG), ("passport photo 600 x 600", IMG),
    ("resume ko pdf banana hai", DOCX), ("marksheet ko pdf me", IMG), ("under 0.5 mb", IMG), ("less than 500 KB please", IMG),
    ("max size 2MB", PDF), ("100kb tak", IMG), ("50 k", IMG), ("half the size", IMG), ("make it 1920 wide", IMG),
    ("width 800", IMG), ("height 1080", IMG), ("into word doc", PDF), ("as an excel sheet", PDF), ("give me a txt file", DOCX),
    ("to markdown", DOCX), ("webp me badlo", IMG), ("jpeg chahiye", PDF), ("in PNG format", IMG), ("export as csv", XLSX),
    ("json format", XLSX), ("remove pages 2 and 3", PDF), ("delete the second page", PDF), ("i only need the first page", PDF),
    ("break this pdf into separate files", PDF), ("put page 3 first", PDF), ("rotate page 2 by 180", PDF), ("add page no", PDF),
    ("add confidential watermark", PDF), ("remove the password, it's 1234abcd", PDF), ("protect with password hello123", PDF),
    ("convierte esta imagen en pdf", IMG), ("reduce el tamaño a 100 kb", IMG), ("transforme en word", PDF),
    ("compresse ce pdf", PDF), ("mets un mot de passe 1234", PDF), ("Bild auf 200 KB verkleinern", IMG),
    ("PDF in Word umwandeln", PDF), ("Seitenzahlen hinzufügen", PDF), ("transformar em pdf", IMG), ("diminuir para 300 kb", IMG),
    ("girar a imagem", IMG), ("इसका साइज़ 100 केबी करो", IMG), ("इस पीडीएफ को छोटा करो", PDF), ("फोटो को साफ़ करो", IMG),
    ("इसे वर्ड में बदलो", PDF),
]  # fmt: skip


def _meta(path):
    return [{"name": path.name, "mime": "", "size": path.stat().st_size}]


def _run(client, path, plan):
    with open(path, "rb") as fh:
        r = client.post("/api/run", files=[("files", (path.name, fh.read(), "application/octet-stream"))], data={"plan": json.dumps(plan)})
    return r.json()


@pytest.mark.parametrize("message,kind", REQUESTS)
def test_request_becomes_a_plan_that_runs(client, samples, message, kind):
    path = samples[kind]
    reply = client.post("/api/nw/chat", json={"message": message, "files": _meta(path)}).json()
    assert reply["plan"], f"no plan for {message!r}: {reply['reply']}"
    result = _run(client, path, reply["plan"])
    assert result.get("ok"), f"{message!r}: {result.get('error')}"
    assert result["files"]


CONVERSATIONS = [
    # (file kind, messages, tools of the final plan, params that must be in it)
    (IMG, ["convert to pdf", "also make it under 100 kb"], ["resize", "convert"], {"max_kb": 100.0, "to": "pdf"}),
    (IMG, ["convert to pdf", "make it png instead"], ["convert"], {"to": "png"}),
    (PDF, ["compress this pdf", "under 500 kb"], ["compress_pdf"], {"target_kb": 500.0}),
    (IMG, ["make it passport size", "and convert to pdf"], ["resize", "convert"], {"preset": "passport", "to": "pdf"}),
    (IMG, ["isko pdf bana do", "aur 200kb se kam bhi"], ["resize", "convert"], {"max_kb": 200.0}),
    (PDF, ["lock this pdf", "password: abcd1234"], ["protect"], {"password": "abcd1234"}),
    (PDF, ["delete some pages", "pages 2-3"], ["delete"], {"pages": "2-3"}),
    (IMG, ["resize to 1080x1080", "yes"], ["resize"], {"width": 1080}),
    (IMG, ["rotate this photo", "now make it png"], ["resize"], {"rotate": 90, "format": "png"}),
]


@pytest.mark.parametrize("kind,messages,tools,params", CONVERSATIONS)
def test_follow_ups_build_on_the_request_before(client, samples, kind, messages, tools, params):
    path = samples[kind]
    history: list[dict] = []
    reply: dict = {}
    for message in messages:
        reply = client.post("/api/nw/chat", json={"message": message, "files": _meta(path), "history": history}).json()
        history += [{"role": "user", "text": message}, {"role": "nw", "text": reply["reply"]}]
    assert reply["plan"], reply["reply"]
    steps = reply["plan"]["steps"]
    assert [s["tool"] for s in steps] == tools
    merged = {k: v for s in steps for k, v in s["params"].items()}
    for key, value in params.items():
        assert merged.get(key) == value, (key, steps)
    assert _run(client, path, reply["plan"]).get("ok")


@pytest.mark.parametrize("message", ["pdf", "reduce size", "compress pdf", "split pdf", "make it smaller", "png"])
def test_short_english_stays_english(client, message):
    reply = client.post("/api/nw/chat", json={"message": message}, headers={"Accept-Language": "en"}).json()
    assert reply["lang"] == "en", reply["reply"]


def test_short_message_follows_the_phone_language(client):
    reply = client.post("/api/nw/chat", json={"message": "pdf"}, headers={"Accept-Language": "es"}).json()
    assert reply["lang"] == "es"


def test_already_the_right_format(client, samples):
    reply = client.post("/api/nw/chat", json={"message": "turn into jpeg", "files": _meta(samples[IMG])}).json()
    assert reply["plan"] is None and "already" in reply["reply"]


def test_already_small_enough(client, samples):
    reply = client.post("/api/nw/chat", json={"message": "under 50 mb", "files": _meta(samples[IMG])}).json()
    assert reply["plan"] and "already" in reply["reply"]


def test_unclear_request_offers_what_fits_the_file(client, samples):
    reply = client.post("/api/nw/chat", json={"message": "hmm do something nice", "files": _meta(samples[PDF])}).json()
    assert reply["plan"] is None
    assert "report.pdf" in reply["reply"] and "compress" in reply["reply"]
    assert "Compress to 1 MB" in reply["suggestions"]


def test_background_removal_is_declined_kindly(client, samples):
    reply = client.post("/api/nw/chat", json={"message": "remove background", "files": _meta(samples[IMG])}).json()
    assert reply["plan"] is None and "background" in reply["reply"]


def test_how_to_questions_still_get_answers(client):
    reply = client.post("/api/nw/chat", json={"message": "are my files private?"}).json()
    assert "30 minutes" in reply["reply"]
    reply = client.post("/api/nw/chat", json={"message": "what can you do?"}).json()
    assert reply["plan"] is None and "convert" in reply["reply"]


def test_cannot_save_to_formats_it_only_reads(client, samples):
    reply = client.post("/api/nw/chat", json={"message": "convert to heic", "files": _meta(samples[IMG])}).json()
    assert reply["plan"] is None and "HEIC" in reply["reply"] and "JPG" in reply["reply"]


def test_merge_with_one_pdf_asks_for_more(client, samples):
    reply = client.post("/api/nw/chat", json={"message": "join all pages into one", "files": _meta(samples[PDF])}).json()
    assert reply["plan"] is None and "two or more" in reply["reply"]


def test_watermark_text_from_plain_words(client, samples):
    reply = client.post("/api/nw/chat", json={"message": "stamp DRAFT on it", "files": _meta(samples[PDF])}).json()
    assert reply["plan"]["steps"] == [{"tool": "watermark", "params": {"text": "DRAFT", "style": "diagonal", "opacity": 0.3}}]


@pytest.mark.parametrize(
    "message,kind,steps",
    [
        # What people mean, not just something that runs.
        ("its too heavy to send on whatsapp", IMG, [("resize", {"mode": "compress"})]),
        ("pic blur hai thoda clear karo", IMG, [("enhance", {"preset": "auto"})]),
        ("upsc form signature size", IMG, [("resize", {"preset": "signature"})]),
        ("pan card photo 3.5x4.5 cm", IMG, [("resize", {"mode": "print"})]),
        ("passport photo 600 x 600", IMG, [("resize", {"mode": "pixels", "width": 600, "height": 600})]),
        ("pdf to png 300 dpi", PDF, [("convert", {"to": "png", "dpi": 300})]),
        ("only pages 2 to 3 as images", PDF, [("convert", {"to": "jpg", "pages": "2-3"})]),
        ("delete page 2 and convert to word", PDF, [("delete", {"pages": "2"}), ("convert", {"to": "docx"})]),
        ("half the size", IMG, [("resize", {"mode": "percent", "percent": 50.0})]),
        ("make it 1920 wide", IMG, [("resize", {"width": 1920})]),
        ("put page 3 first", PDF, [("reorder", {"order": "3"})]),
        ("protect with password hello123", PDF, [("protect", {"password": "hello123"})]),
        ("neet photo banana hai", IMG, [("resize", {"preset": "india_form_photo"})]),
    ],
)
def test_plans_match_what_people_mean(client, samples, message, kind, steps):
    reply = client.post("/api/nw/chat", json={"message": message, "files": _meta(samples[kind])}).json()
    assert reply["plan"], reply["reply"]
    got = reply["plan"]["steps"]
    assert [s["tool"] for s in got] == [t for t, _ in steps]
    for (_, expected), step in zip(steps, got):
        for key, value in expected.items():
            assert step["params"].get(key) == value, (key, got)
    assert "format" not in got[0]["params"] or message != "neet photo banana hai"
