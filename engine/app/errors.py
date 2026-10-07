"""Friendly errors.

The engine only ever raises `KonError(code, **params)`. A handler in main.py
turns it, and every other failure, into

    {"ok": false, "error": {"code", "title", "message", "hint", "action"}}

in the person's language. People never see a status code, a stack trace or a
library message. The HTTP status is still set correctly for tools, but the app
never shows it.

`why` is a longer, plain explanation NW gives when asked about an error.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .i18n import fill, pick

L = dict[str, str]


@dataclass(frozen=True)
class Entry:
    status: int
    title: L
    message: L
    hint: L
    why: L | None = None
    action: str | None = None


CATALOG: dict[str, Entry] = {
    "FILE_TOO_LARGE": Entry(
        413,
        action="compress",
        title={
            "en": "That file is a bit too big",
            "hi": "यह फ़ाइल थोड़ी बड़ी है",
            "hi-Latn": "Yeh file thodi badi hai",
            "es": "Ese archivo es demasiado grande",
            "fr": "Ce fichier est un peu trop gros",
            "de": "Die Datei ist etwas zu groß",
            "pt": "Esse arquivo é grande demais",
        },
        message={
            "en": "Files can be up to {max_mb} MB. This one is {size_mb} MB.",
            "hi": "फ़ाइल {max_mb} MB तक हो सकती है। यह {size_mb} MB की है।",
            "hi-Latn": "File {max_mb} MB tak ho sakti hai. Yeh {size_mb} MB ki hai.",
            "es": "Los archivos pueden ocupar hasta {max_mb} MB. Este ocupa {size_mb} MB.",
            "fr": "Les fichiers peuvent faire jusqu’à {max_mb} Mo. Celui-ci fait {size_mb} Mo.",
            "de": "Dateien dürfen bis zu {max_mb} MB groß sein. Diese hat {size_mb} MB.",
            "pt": "Os arquivos podem ter até {max_mb} MB. Este tem {size_mb} MB.",
        },
        hint={
            "en": "Try compressing it first, or split it into parts.",
            "hi": "पहले इसे कंप्रेस कीजिए, या हिस्सों में बाँट दीजिए।",
            "hi-Latn": "Pehle compress karo, ya parts mein split kar do.",
            "es": "Prueba a comprimirlo primero o a dividirlo en partes.",
            "fr": "Compressez-le d’abord, ou divisez-le en plusieurs parties.",
            "de": "Komprimiere sie zuerst oder teile sie auf.",
            "pt": "Tente comprimi-lo primeiro ou dividi-lo em partes.",
        },
        why={
            "en": "Very large files take too long to send and process on a phone connection, so KonPDF has a size limit per file.",
            "hi": "बहुत बड़ी फ़ाइलें भेजने और प्रोसेस करने में बहुत समय लेती हैं, इसलिए हर फ़ाइल की एक सीमा है।",
            "hi-Latn": "Bahut badi files bhejne aur process karne mein bahut time lagta hai, isliye har file ki ek limit hai.",
            "es": "Los archivos muy grandes tardan demasiado en enviarse y procesarse, por eso hay un límite por archivo.",
            "fr": "Les très gros fichiers sont trop longs à envoyer et à traiter, d’où une limite par fichier.",
            "de": "Sehr große Dateien brauchen zu lange zum Senden und Verarbeiten, deshalb gibt es ein Limit pro Datei.",
            "pt": "Arquivos muito grandes demoram demais para enviar e processar, por isso há um limite por arquivo.",
        },
    ),
    "TOO_MANY_FILES": Entry(
        413,
        title={
            "en": "That's a lot of files at once",
            "hi": "एक साथ बहुत सारी फ़ाइलें",
            "hi-Latn": "Ek saath bahut saari files",
            "es": "Son muchos archivos a la vez",
            "fr": "Ça fait beaucoup de fichiers d’un coup",
            "de": "Das sind viele Dateien auf einmal",
            "pt": "São muitos arquivos de uma vez",
        },
        message={
            "en": "You can send up to {max} files in one go.",
            "hi": "एक बार में {max} फ़ाइलें तक भेज सकते हैं।",
            "hi-Latn": "Ek baar mein {max} files tak bhej sakte ho.",
            "es": "Puedes enviar hasta {max} archivos a la vez.",
            "fr": "Vous pouvez envoyer jusqu’à {max} fichiers à la fois.",
            "de": "Du kannst bis zu {max} Dateien auf einmal senden.",
            "pt": "Você pode enviar até {max} arquivos de uma vez.",
        },
        hint={
            "en": "Split them into smaller batches.",
            "hi": "इन्हें छोटे-छोटे बैच में भेजिए।",
            "hi-Latn": "Inhe chhote batches mein bhejo.",
            "es": "Divídelos en grupos más pequeños.",
            "fr": "Envoyez-les en plusieurs fois.",
            "de": "Teile sie in kleinere Gruppen auf.",
            "pt": "Divida em grupos menores.",
        },
    ),
    "NO_FILES": Entry(
        400,
        title={
            "en": "No file yet",
            "hi": "अभी कोई फ़ाइल नहीं",
            "hi-Latn": "Abhi koi file nahi",
            "es": "Aún no hay archivo",
            "fr": "Pas encore de fichier",
            "de": "Noch keine Datei",
            "pt": "Ainda não há arquivo",
        },
        message={
            "en": "Choose a file first, then try again.",
            "hi": "पहले एक फ़ाइल चुनिए, फिर दोबारा कोशिश कीजिए।",
            "hi-Latn": "Pehle ek file choose karo, phir try karo.",
            "es": "Elige un archivo primero y vuelve a intentarlo.",
            "fr": "Choisissez d’abord un fichier, puis réessayez.",
            "de": "Wähle zuerst eine Datei und versuche es erneut.",
            "pt": "Escolha um arquivo primeiro e tente de novo.",
        },
        hint={
            "en": "Tap “Choose files”, or share a file to KonPDF from any app.",
            "hi": "“Choose files” दबाइए, या किसी भी ऐप से KonPDF पर शेयर कीजिए।",
            "hi-Latn": "“Choose files” dabao, ya kisi bhi app se KonPDF pe share karo.",
            "es": "Toca “Choose files” o comparte un archivo con KonPDF desde cualquier app.",
            "fr": "Touchez « Choose files » ou partagez un fichier vers KonPDF depuis une app.",
            "de": "Tippe auf „Choose files“ oder teile eine Datei aus einer App mit KonPDF.",
            "pt": "Toque em “Choose files” ou compartilhe um arquivo com o KonPDF.",
        },
    ),
    "EMPTY_FILE": Entry(
        400,
        title={
            "en": "This file is empty",
            "hi": "यह फ़ाइल खाली है",
            "hi-Latn": "Yeh file khaali hai",
            "es": "Este archivo está vacío",
            "fr": "Ce fichier est vide",
            "de": "Diese Datei ist leer",
            "pt": "Este arquivo está vazio",
        },
        message={
            "en": "“{name}” has nothing in it.",
            "hi": "“{name}” में कुछ भी नहीं है।",
            "hi-Latn": "“{name}” mein kuch bhi nahi hai.",
            "es": "“{name}” no tiene contenido.",
            "fr": "« {name} » ne contient rien.",
            "de": "„{name}“ enthält nichts.",
            "pt": "“{name}” não tem conteúdo.",
        },
        hint={
            "en": "Check that the file downloaded fully, then pick it again.",
            "hi": "देखिए कि फ़ाइल पूरी डाउनलोड हुई है, फिर दोबारा चुनिए।",
            "hi-Latn": "Check karo ki file poori download hui hai, phir dobara choose karo.",
            "es": "Comprueba que se descargó completo y elígelo de nuevo.",
            "fr": "Vérifiez qu’il est bien téléchargé, puis choisissez-le à nouveau.",
            "de": "Prüfe, ob die Datei vollständig geladen ist, und wähle sie erneut.",
            "pt": "Confira se o download terminou e escolha de novo.",
        },
    ),
    "UNSUPPORTED_FORMAT": Entry(
        415,
        title={
            "en": "KonPDF can't open this kind of file yet",
            "hi": "KonPDF अभी इस तरह की फ़ाइल नहीं खोल सकता",
            "hi-Latn": "KonPDF abhi is type ki file nahi khol sakta",
            "es": "KonPDF aún no puede abrir este tipo de archivo",
            "fr": "KonPDF ne sait pas encore ouvrir ce type de fichier",
            "de": "KonPDF kann diesen Dateityp noch nicht öffnen",
            "pt": "O KonPDF ainda não abre este tipo de arquivo",
        },
        message={
            "en": "“{name}” isn't an image, PDF, document or sheet we know.",
            "hi": "“{name}” कोई जानी-पहचानी इमेज, PDF, डॉक्यूमेंट या शीट नहीं है।",
            "hi-Latn": "“{name}” koi jaani-pehchaani image, PDF, document ya sheet nahi hai.",
            "es": "“{name}” no es una imagen, PDF, documento u hoja que conozcamos.",
            "fr": "« {name} » n’est pas une image, un PDF, un document ou un tableur connu.",
            "de": "„{name}“ ist kein bekanntes Bild, PDF, Dokument oder Tabelle.",
            "pt": "“{name}” não é uma imagem, PDF, documento ou planilha conhecida.",
        },
        hint={
            "en": "KonPDF works with images, PDFs, Word/Office files and spreadsheets. Video and audio aren't supported.",
            "hi": "KonPDF इमेज, PDF, Word/Office फ़ाइलों और शीट के साथ काम करता है। वीडियो और ऑडियो नहीं।",
            "hi-Latn": "KonPDF images, PDF, Word/Office files aur sheets ke saath kaam karta hai. Video aur audio nahi.",
            "es": "KonPDF trabaja con imágenes, PDF, archivos de Office y hojas de cálculo. No con vídeo ni audio.",
            "fr": "KonPDF gère les images, PDF, fichiers Office et tableurs. Pas la vidéo ni l’audio.",
            "de": "KonPDF arbeitet mit Bildern, PDFs, Office-Dateien und Tabellen. Video und Audio nicht.",
            "pt": "O KonPDF trabalha com imagens, PDFs, arquivos do Office e planilhas. Vídeo e áudio não.",
        },
    ),
    "UNSUPPORTED_CONVERSION": Entry(
        422,
        title={
            "en": "That conversion isn't available",
            "hi": "यह कन्वर्ज़न उपलब्ध नहीं है",
            "hi-Latn": "Yeh conversion available nahi hai",
            "es": "Esa conversión no está disponible",
            "fr": "Cette conversion n’est pas disponible",
            "de": "Diese Umwandlung gibt es nicht",
            "pt": "Essa conversão não está disponível",
        },
        message={
            "en": "{src} files can't be turned into {dst}.",
            "hi": "{src} फ़ाइलें {dst} में नहीं बदली जा सकतीं।",
            "hi-Latn": "{src} files ko {dst} mein nahi badla ja sakta.",
            "es": "Los archivos {src} no se pueden convertir a {dst}.",
            "fr": "Les fichiers {src} ne peuvent pas devenir {dst}.",
            "de": "{src}-Dateien lassen sich nicht in {dst} umwandeln.",
            "pt": "Arquivos {src} não podem virar {dst}.",
        },
        hint={
            "en": "Pick one of the formats KonPDF offers for this file.",
            "hi": "इस फ़ाइल के लिए दिखाए गए फ़ॉर्मैट में से एक चुनिए।",
            "hi-Latn": "Is file ke liye dikhaye gaye formats mein se ek choose karo.",
            "es": "Elige uno de los formatos que KonPDF ofrece para este archivo.",
            "fr": "Choisissez un des formats proposés pour ce fichier.",
            "de": "Wähle eines der Formate, die KonPDF für diese Datei anbietet.",
            "pt": "Escolha um dos formatos que o KonPDF oferece para este arquivo.",
        },
    ),
    "WRONG_KIND": Entry(
        422,
        title={
            "en": "Wrong kind of file for this tool",
            "hi": "इस टूल के लिए ग़लत तरह की फ़ाइल",
            "hi-Latn": "Is tool ke liye galat type ki file",
            "es": "Tipo de archivo equivocado para esta herramienta",
            "fr": "Mauvais type de fichier pour cet outil",
            "de": "Falscher Dateityp für dieses Werkzeug",
            "pt": "Tipo de arquivo errado para esta ferramenta",
        },
        message={
            "en": "This tool works with {expected}, and “{name}” is something else.",
            "hi": "यह टूल {expected} के साथ काम करता है, और “{name}” कुछ और है।",
            "hi-Latn": "Yeh tool {expected} ke saath kaam karta hai, aur “{name}” kuch aur hai.",
            "es": "Esta herramienta trabaja con {expected} y “{name}” es otra cosa.",
            "fr": "Cet outil fonctionne avec {expected}, et « {name} » est autre chose.",
            "de": "Dieses Werkzeug arbeitet mit {expected}, „{name}“ ist etwas anderes.",
            "pt": "Esta ferramenta trabalha com {expected}, e “{name}” é outra coisa.",
        },
        hint={
            "en": "Convert it first, or pick a different tool.",
            "hi": "पहले इसे कन्वर्ट कीजिए, या कोई दूसरा टूल चुनिए।",
            "hi-Latn": "Pehle ise convert karo, ya koi doosra tool choose karo.",
            "es": "Conviértelo primero o elige otra herramienta.",
            "fr": "Convertissez-le d’abord, ou choisissez un autre outil.",
            "de": "Wandle sie zuerst um oder wähle ein anderes Werkzeug.",
            "pt": "Converta primeiro ou escolha outra ferramenta.",
        },
    ),
    "CORRUPT_FILE": Entry(
        422,
        title={
            "en": "This file seems to be damaged",
            "hi": "यह फ़ाइल ख़राब लग रही है",
            "hi-Latn": "Yeh file kharab lag rahi hai",
            "es": "Este archivo parece estar dañado",
            "fr": "Ce fichier semble endommagé",
            "de": "Die Datei scheint beschädigt zu sein",
            "pt": "Este arquivo parece estar danificado",
        },
        message={
            "en": "We couldn't read “{name}”.",
            "hi": "हम “{name}” को पढ़ नहीं पाए।",
            "hi-Latn": "Hum “{name}” ko padh nahi paaye.",
            "es": "No pudimos leer “{name}”.",
            "fr": "Impossible de lire « {name} ».",
            "de": "„{name}“ konnte nicht gelesen werden.",
            "pt": "Não conseguimos ler “{name}”.",
        },
        hint={
            "en": "Open it in another app to check it, or get a fresh copy.",
            "hi": "किसी दूसरे ऐप में खोलकर देखिए, या नई कॉपी लीजिए।",
            "hi-Latn": "Kisi doosre app mein khol ke dekho, ya nayi copy lo.",
            "es": "Ábrelo en otra app para comprobarlo o consigue una copia nueva.",
            "fr": "Ouvrez-le dans une autre app pour vérifier, ou récupérez une nouvelle copie.",
            "de": "Öffne sie in einer anderen App oder hol dir eine neue Kopie.",
            "pt": "Abra em outro app para conferir ou pegue uma cópia nova.",
        },
        why={
            "en": "The file may have been cut off while downloading, or saved with the wrong name ending (like a .pdf that is really a web page).",
            "hi": "हो सकता है डाउनलोड करते समय फ़ाइल अधूरी रह गई हो, या उसका नाम ग़लत एक्सटेंशन के साथ सेव हुआ हो।",
            "hi-Latn": "Ho sakta hai download ke time file adhoori reh gayi ho, ya galat extension ke saath save hui ho.",
            "es": "Puede que se cortara al descargarse o que tenga una extensión equivocada.",
            "fr": "Il a peut-être été coupé au téléchargement, ou porte une mauvaise extension.",
            "de": "Vielleicht wurde der Download abgebrochen oder die Dateiendung stimmt nicht.",
            "pt": "Talvez o download tenha sido interrompido ou a extensão esteja errada.",
        },
    ),
    "IMAGE_TOO_LARGE": Entry(
        413,
        action="resize",
        title={
            "en": "That image has too many pixels",
            "hi": "इस इमेज में बहुत ज़्यादा पिक्सल हैं",
            "hi-Latn": "Is image mein bahut zyada pixels hain",
            "es": "Esa imagen tiene demasiados píxeles",
            "fr": "Cette image a trop de pixels",
            "de": "Das Bild hat zu viele Pixel",
            "pt": "Essa imagem tem pixels demais",
        },
        message={
            "en": "“{name}” is bigger than KonPDF can safely handle.",
            "hi": "“{name}” इतनी बड़ी है कि KonPDF इसे सुरक्षित रूप से नहीं संभाल सकता।",
            "hi-Latn": "“{name}” itni badi hai ki KonPDF ise safely handle nahi kar sakta.",
            "es": "“{name}” es más grande de lo que KonPDF puede manejar con seguridad.",
            "fr": "« {name} » est trop grande pour KonPDF.",
            "de": "„{name}“ ist größer, als KonPDF sicher verarbeiten kann.",
            "pt": "“{name}” é maior do que o KonPDF consegue processar com segurança.",
        },
        hint={
            "en": "Try a smaller copy of the photo.",
            "hi": "फ़ोटो की छोटी कॉपी आज़माइए।",
            "hi-Latn": "Photo ki chhoti copy try karo.",
            "es": "Prueba con una copia más pequeña.",
            "fr": "Essayez une copie plus petite.",
            "de": "Versuche eine kleinere Kopie.",
            "pt": "Tente uma cópia menor.",
        },
    ),
    "PASSWORD_REQUIRED": Entry(
        422,
        action="unlock",
        title={
            "en": "This PDF is locked",
            "hi": "यह PDF लॉक है",
            "hi-Latn": "Yeh PDF lock hai",
            "es": "Este PDF está protegido",
            "fr": "Ce PDF est verrouillé",
            "de": "Dieses PDF ist gesperrt",
            "pt": "Este PDF está bloqueado",
        },
        message={
            "en": "“{name}” needs a password to open.",
            "hi": "“{name}” खोलने के लिए पासवर्ड चाहिए।",
            "hi-Latn": "“{name}” kholne ke liye password chahiye.",
            "es": "“{name}” necesita una contraseña.",
            "fr": "« {name} » demande un mot de passe.",
            "de": "„{name}“ braucht ein Passwort.",
            "pt": "“{name}” precisa de senha para abrir.",
        },
        hint={
            "en": "Use PDF tools → Remove password with the password you know.",
            "hi": "PDF tools → Remove password में अपना पासवर्ड डालिए।",
            "hi-Latn": "PDF tools → Remove password mein apna password daalo.",
            "es": "Usa PDF tools → Remove password con la contraseña que conoces.",
            "fr": "Utilisez PDF tools → Remove password avec le mot de passe.",
            "de": "Nutze PDF tools → Remove password mit deinem Passwort.",
            "pt": "Use PDF tools → Remove password com a senha que você sabe.",
        },
    ),
    "WRONG_PASSWORD": Entry(
        422,
        title={
            "en": "That password didn't work",
            "hi": "यह पासवर्ड नहीं चला",
            "hi-Latn": "Yeh password nahi chala",
            "es": "Esa contraseña no funcionó",
            "fr": "Ce mot de passe n’a pas marché",
            "de": "Das Passwort hat nicht funktioniert",
            "pt": "Essa senha não funcionou",
        },
        message={
            "en": "The password for “{name}” isn't right.",
            "hi": "“{name}” का पासवर्ड सही नहीं है।",
            "hi-Latn": "“{name}” ka password sahi nahi hai.",
            "es": "La contraseña de “{name}” no es correcta.",
            "fr": "Le mot de passe de « {name} » est incorrect.",
            "de": "Das Passwort für „{name}“ stimmt nicht.",
            "pt": "A senha de “{name}” não está certa.",
        },
        hint={
            "en": "Check capital letters and spaces, then try again.",
            "hi": "बड़े-छोटे अक्षर और स्पेस देखिए, फिर दोबारा कोशिश कीजिए।",
            "hi-Latn": "Capital letters aur spaces check karo, phir try karo.",
            "es": "Revisa mayúsculas y espacios y vuelve a intentarlo.",
            "fr": "Vérifiez majuscules et espaces, puis réessayez.",
            "de": "Achte auf Groß-/Kleinschreibung und Leerzeichen.",
            "pt": "Confira maiúsculas e espaços e tente de novo.",
        },
    ),
    "INVALID_OPTIONS": Entry(
        422,
        title={
            "en": "Something in the settings doesn't look right",
            "hi": "सेटिंग्स में कुछ ठीक नहीं लग रहा",
            "hi-Latn": "Settings mein kuch theek nahi lag raha",
            "es": "Algo en los ajustes no está bien",
            "fr": "Un réglage ne semble pas correct",
            "de": "Etwas an den Einstellungen stimmt nicht",
            "pt": "Algo nas configurações não parece certo",
        },
        message={
            "en": "{detail}",
            "hi": "{detail}",
            "hi-Latn": "{detail}",
            "es": "{detail}",
            "fr": "{detail}",
            "de": "{detail}",
            "pt": "{detail}",
        },
        hint={
            "en": "Check the numbers you entered and try again.",
            "hi": "डाले गए नंबर देखिए और फिर कोशिश कीजिए।",
            "hi-Latn": "Daale gaye numbers check karo aur phir try karo.",
            "es": "Revisa los números que escribiste.",
            "fr": "Vérifiez les nombres saisis.",
            "de": "Prüfe die eingegebenen Zahlen.",
            "pt": "Confira os números que você digitou.",
        },
    ),
    "PAGE_RANGE_INVALID": Entry(
        422,
        title={
            "en": "Those pages don't exist in this file",
            "hi": "ये पेज इस फ़ाइल में नहीं हैं",
            "hi-Latn": "Yeh pages is file mein nahi hain",
            "es": "Esas páginas no existen en este archivo",
            "fr": "Ces pages n’existent pas dans ce fichier",
            "de": "Diese Seiten gibt es in der Datei nicht",
            "pt": "Essas páginas não existem neste arquivo",
        },
        message={
            "en": "You asked for “{pages}”, but the file has {total} pages.",
            "hi": "आपने “{pages}” माँगे, पर फ़ाइल में {total} पेज हैं।",
            "hi-Latn": "Aapne “{pages}” maange, par file mein {total} pages hain.",
            "es": "Pediste “{pages}”, pero el archivo tiene {total} páginas.",
            "fr": "Vous avez demandé « {pages} », mais le fichier a {total} pages.",
            "de": "Du hast „{pages}“ angegeben, die Datei hat aber {total} Seiten.",
            "pt": "Você pediu “{pages}”, mas o arquivo tem {total} páginas.",
        },
        hint={
            "en": "Write pages like 1-3, 7. The first page is 1.",
            "hi": "पेज ऐसे लिखिए: 1-3, 7। पहला पेज 1 है।",
            "hi-Latn": "Pages aise likho: 1-3, 7. Pehla page 1 hai.",
            "es": "Escribe las páginas así: 1-3, 7. La primera es la 1.",
            "fr": "Écrivez les pages ainsi : 1-3, 7. La première est la 1.",
            "de": "Schreibe Seiten so: 1-3, 7. Die erste Seite ist 1.",
            "pt": "Escreva assim: 1-3, 7. A primeira página é 1.",
        },
    ),
    "NO_TABLES": Entry(
        422,
        title={
            "en": "No tables found",
            "hi": "कोई टेबल नहीं मिली",
            "hi-Latn": "Koi table nahi mili",
            "es": "No se encontraron tablas",
            "fr": "Aucun tableau trouvé",
            "de": "Keine Tabellen gefunden",
            "pt": "Nenhuma tabela encontrada",
        },
        message={
            "en": "“{name}” has no tables KonPDF can copy into a sheet.",
            "hi": "“{name}” में ऐसी कोई टेबल नहीं है जिसे शीट में डाला जा सके।",
            "hi-Latn": "“{name}” mein aisi koi table nahi jise sheet mein daala ja sake.",
            "es": "“{name}” no tiene tablas que KonPDF pueda pasar a una hoja.",
            "fr": "« {name} » n’a pas de tableau à copier dans un tableur.",
            "de": "„{name}“ hat keine Tabellen, die KonPDF übernehmen kann.",
            "pt": "“{name}” não tem tabelas que o KonPDF consiga copiar.",
        },
        hint={
            "en": "Try converting to Word or text instead.",
            "hi": "इसकी जगह Word या टेक्स्ट में बदलकर देखिए।",
            "hi-Latn": "Iski jagah Word ya text mein convert karke dekho.",
            "es": "Prueba a convertirlo a Word o texto.",
            "fr": "Essayez plutôt Word ou texte.",
            "de": "Versuche stattdessen Word oder Text.",
            "pt": "Tente converter para Word ou texto.",
        },
        why={
            "en": "Tables in scanned pages are pictures, and KonPDF doesn't read text from pictures (no OCR).",
            "hi": "स्कैन किए पेजों की टेबल असल में तस्वीरें होती हैं, और KonPDF तस्वीरों से टेक्स्ट नहीं पढ़ता (OCR नहीं)।",
            "hi-Latn": "Scanned pages ki tables asal mein photos hoti hain, aur KonPDF photos se text nahi padhta (OCR nahi).",
            "es": "Las tablas de páginas escaneadas son imágenes y KonPDF no lee texto en imágenes (sin OCR).",
            "fr": "Les tableaux des pages scannées sont des images, et KonPDF ne lit pas le texte des images (pas d’OCR).",
            "de": "Tabellen auf gescannten Seiten sind Bilder, und KonPDF liest keinen Text aus Bildern (kein OCR).",
            "pt": "Tabelas em páginas digitalizadas são imagens, e o KonPDF não lê texto de imagens (sem OCR).",
        },
    ),
    "NEEDS_FULL_CONVERTER": Entry(
        501,
        title={
            "en": "This needs the full converter",
            "hi": "इसके लिए पूरा कन्वर्टर चाहिए",
            "hi-Latn": "Iske liye full converter chahiye",
            "es": "Esto necesita el conversor completo",
            "fr": "Il faut le convertisseur complet",
            "de": "Dafür braucht es den vollen Konverter",
            "pt": "Isto precisa do conversor completo",
        },
        message={
            "en": "{src} files need LibreOffice, which isn't installed on this converter.",
            "hi": "{src} फ़ाइलों के लिए LibreOffice चाहिए, जो इस कन्वर्टर पर नहीं है।",
            "hi-Latn": "{src} files ke liye LibreOffice chahiye, jo is converter pe nahi hai.",
            "es": "Los archivos {src} necesitan LibreOffice, que no está instalado aquí.",
            "fr": "Les fichiers {src} nécessitent LibreOffice, absent de ce convertisseur.",
            "de": "{src}-Dateien brauchen LibreOffice, das hier nicht installiert ist.",
            "pt": "Arquivos {src} precisam do LibreOffice, que não está instalado aqui.",
        },
        hint={
            "en": "Save it as DOCX, XLSX or PDF in another app first, or use the hosted converter.",
            "hi": "पहले किसी दूसरे ऐप में DOCX, XLSX या PDF के रूप में सेव कीजिए, या होस्टेड कन्वर्टर इस्तेमाल कीजिए।",
            "hi-Latn": "Pehle kisi doosre app mein DOCX, XLSX ya PDF mein save karo, ya hosted converter use karo.",
            "es": "Guárdalo antes como DOCX, XLSX o PDF en otra app, o usa el conversor alojado.",
            "fr": "Enregistrez-le d’abord en DOCX, XLSX ou PDF, ou utilisez le convertisseur hébergé.",
            "de": "Speichere sie zuerst als DOCX, XLSX oder PDF, oder nutze den gehosteten Konverter.",
            "pt": "Salve antes como DOCX, XLSX ou PDF em outro app, ou use o conversor hospedado.",
        },
    ),
    "RESULT_EXPIRED": Entry(
        410,
        title={
            "en": "This result has been cleared for your privacy",
            "hi": "आपकी प्राइवेसी के लिए यह नतीजा हटा दिया गया",
            "hi-Latn": "Aapki privacy ke liye yeh result hata diya gaya",
            "es": "Este resultado se borró por tu privacidad",
            "fr": "Ce résultat a été effacé pour votre vie privée",
            "de": "Das Ergebnis wurde zu deinem Schutz gelöscht",
            "pt": "Este resultado foi apagado pela sua privacidade",
        },
        message={
            "en": "Files are deleted from the converter after a short while.",
            "hi": "फ़ाइलें कुछ देर बाद कन्वर्टर से हटा दी जाती हैं।",
            "hi-Latn": "Files kuch der baad converter se hata di jaati hain.",
            "es": "Los archivos se borran del conversor al poco tiempo.",
            "fr": "Les fichiers sont supprimés du convertisseur peu après.",
            "de": "Dateien werden nach kurzer Zeit vom Konverter gelöscht.",
            "pt": "Os arquivos são apagados do conversor depois de um tempo.",
        },
        hint={
            "en": "Run the conversion again.",
            "hi": "कन्वर्ज़न फिर से चलाइए।",
            "hi-Latn": "Conversion phir se chalao.",
            "es": "Vuelve a hacer la conversión.",
            "fr": "Relancez la conversion.",
            "de": "Starte die Umwandlung erneut.",
            "pt": "Faça a conversão de novo.",
        },
    ),
    "NOT_FOUND": Entry(
        404,
        title={
            "en": "We couldn't find that",
            "hi": "हमें वह नहीं मिला",
            "hi-Latn": "Humein woh nahi mila",
            "es": "No encontramos eso",
            "fr": "Introuvable",
            "de": "Das haben wir nicht gefunden",
            "pt": "Não encontramos isso",
        },
        message={
            "en": "The app asked for something this converter doesn't have.",
            "hi": "ऐप ने कुछ ऐसा माँगा जो इस कन्वर्टर में नहीं है।",
            "hi-Latn": "App ne kuch aisa maanga jo is converter mein nahi hai.",
            "es": "La app pidió algo que este conversor no tiene.",
            "fr": "L’app a demandé quelque chose que ce convertisseur n’a pas.",
            "de": "Die App hat etwas angefragt, das dieser Konverter nicht hat.",
            "pt": "O app pediu algo que este conversor não tem.",
        },
        hint={
            "en": "Try updating the app, or check the converter address in Settings.",
            "hi": "ऐप अपडेट कीजिए, या सेटिंग्स में कन्वर्टर का पता देखिए।",
            "hi-Latn": "App update karo, ya Settings mein converter ka address check karo.",
            "es": "Actualiza la app o revisa la dirección del conversor en Ajustes.",
            "fr": "Mettez l’app à jour ou vérifiez l’adresse du convertisseur.",
            "de": "Aktualisiere die App oder prüfe die Konverter-Adresse.",
            "pt": "Atualize o app ou confira o endereço do conversor.",
        },
    ),
    "RATE_LIMITED": Entry(
        429,
        title={
            "en": "You're going fast!",
            "hi": "आप बहुत तेज़ चल रहे हैं!",
            "hi-Latn": "Aap bahut fast chal rahe ho!",
            "es": "¡Vas muy rápido!",
            "fr": "Vous allez vite !",
            "de": "Du bist schnell!",
            "pt": "Você está indo rápido!",
        },
        message={
            "en": "Give it a few seconds, then try again.",
            "hi": "कुछ सेकंड रुकिए, फिर कोशिश कीजिए।",
            "hi-Latn": "Kuch second ruko, phir try karo.",
            "es": "Espera unos segundos y vuelve a intentarlo.",
            "fr": "Patientez quelques secondes puis réessayez.",
            "de": "Warte ein paar Sekunden und versuche es erneut.",
            "pt": "Espere alguns segundos e tente de novo.",
        },
        hint={"en": "", "hi": "", "hi-Latn": "", "es": "", "fr": "", "de": "", "pt": ""},
    ),
    "BUSY": Entry(
        503,
        title={
            "en": "KonPDF is busy right now",
            "hi": "KonPDF अभी व्यस्त है",
            "hi-Latn": "KonPDF abhi busy hai",
            "es": "KonPDF está ocupado ahora",
            "fr": "KonPDF est occupé",
            "de": "KonPDF ist gerade beschäftigt",
            "pt": "O KonPDF está ocupado agora",
        },
        message={
            "en": "Lots of people are converting at the moment.",
            "hi": "इस समय बहुत लोग कन्वर्ट कर रहे हैं।",
            "hi-Latn": "Is waqt bahut log convert kar rahe hain.",
            "es": "Mucha gente está convirtiendo en este momento.",
            "fr": "Beaucoup de conversions sont en cours.",
            "de": "Gerade wandeln viele Leute Dateien um.",
            "pt": "Muita gente está convertendo agora.",
        },
        hint={
            "en": "Try again in a minute.",
            "hi": "एक मिनट में फिर कोशिश कीजिए।",
            "hi-Latn": "Ek minute mein phir try karo.",
            "es": "Inténtalo de nuevo en un minuto.",
            "fr": "Réessayez dans une minute.",
            "de": "Versuche es in einer Minute erneut.",
            "pt": "Tente de novo em um minuto.",
        },
    ),
    "TIMEOUT": Entry(
        504,
        title={
            "en": "This one is taking too long",
            "hi": "इसमें बहुत समय लग रहा है",
            "hi-Latn": "Isme bahut time lag raha hai",
            "es": "Esto está tardando demasiado",
            "fr": "C’est trop long",
            "de": "Das dauert zu lange",
            "pt": "Isto está demorando demais",
        },
        message={
            "en": "The file was too heavy to finish in time.",
            "hi": "फ़ाइल इतनी भारी थी कि समय पर पूरी नहीं हो पाई।",
            "hi-Latn": "File itni heavy thi ki time pe poori nahi ho paayi.",
            "es": "El archivo era demasiado pesado para terminar a tiempo.",
            "fr": "Le fichier était trop lourd pour finir à temps.",
            "de": "Die Datei war zu schwer, um rechtzeitig fertig zu werden.",
            "pt": "O arquivo era pesado demais para terminar a tempo.",
        },
        hint={
            "en": "Try fewer pages or smaller files.",
            "hi": "कम पेज या छोटी फ़ाइलें आज़माइए।",
            "hi-Latn": "Kam pages ya chhoti files try karo.",
            "es": "Prueba con menos páginas o archivos más pequeños.",
            "fr": "Essayez avec moins de pages ou des fichiers plus petits.",
            "de": "Versuche weniger Seiten oder kleinere Dateien.",
            "pt": "Tente menos páginas ou arquivos menores.",
        },
    ),
    "INTERNAL": Entry(
        500,
        title={
            "en": "Something went wrong on our side",
            "hi": "हमारी तरफ़ से कुछ गड़बड़ हो गई",
            "hi-Latn": "Hamari taraf se kuch gadbad ho gayi",
            "es": "Algo falló por nuestra parte",
            "fr": "Un souci de notre côté",
            "de": "Bei uns ist etwas schiefgelaufen",
            "pt": "Algo deu errado do nosso lado",
        },
        message={
            "en": "That didn't work, and it's not your fault.",
            "hi": "यह नहीं हो पाया, और इसमें आपकी कोई गलती नहीं है।",
            "hi-Latn": "Yeh nahi ho paaya, aur isme aapki koi galti nahi hai.",
            "es": "No funcionó, y no es culpa tuya.",
            "fr": "Ça n’a pas marché, et ce n’est pas de votre faute.",
            "de": "Das hat nicht geklappt, und es liegt nicht an dir.",
            "pt": "Não funcionou, e a culpa não é sua.",
        },
        hint={
            "en": "Please try again. If it keeps happening, try a different file or format.",
            "hi": "कृपया फिर कोशिश कीजिए। बार-बार हो तो दूसरी फ़ाइल या फ़ॉर्मैट आज़माइए।",
            "hi-Latn": "Phir try karo. Baar baar ho to doosri file ya format try karo.",
            "es": "Inténtalo de nuevo. Si se repite, prueba otro archivo o formato.",
            "fr": "Réessayez. Si ça se répète, essayez un autre fichier ou format.",
            "de": "Bitte versuche es erneut. Passiert es öfter, nimm eine andere Datei oder ein anderes Format.",
            "pt": "Tente de novo. Se continuar, tente outro arquivo ou formato.",
        },
    ),
}

# Short notes added to a successful result ("we got close to your target").
NOTES: dict[str, L] = {
    "TARGET_CLOSE": {
        "en": "We got it to {got_kb} KB. {target_kb} KB wasn't possible without ruining the picture.",
        "hi": "हमने इसे {got_kb} KB तक किया। तस्वीर बिगाड़े बिना {target_kb} KB संभव नहीं था।",
        "hi-Latn": "Humne ise {got_kb} KB tak kiya. Photo kharab kiye bina {target_kb} KB possible nahi tha.",
        "es": "Lo dejamos en {got_kb} KB. {target_kb} KB no era posible sin estropear la imagen.",
        "fr": "Nous sommes arrivés à {got_kb} Ko. {target_kb} Ko était impossible sans abîmer l’image.",
        "de": "Wir haben {got_kb} KB erreicht. {target_kb} KB ging nicht, ohne das Bild zu ruinieren.",
        "pt": "Chegamos a {got_kb} KB. {target_kb} KB não era possível sem estragar a imagem.",
    },
    "BELOW_MIN": {
        "en": "The file is {got_kb} KB, under your {min_kb} KB minimum, even at the best quality.",
        "hi": "सबसे अच्छी क्वालिटी पर भी फ़ाइल {got_kb} KB है, आपके {min_kb} KB से कम।",
        "hi-Latn": "Best quality pe bhi file {got_kb} KB hai, aapke {min_kb} KB se kam.",
        "es": "El archivo ocupa {got_kb} KB, menos de tu mínimo de {min_kb} KB, incluso con la mejor calidad.",
        "fr": "Le fichier fait {got_kb} Ko, sous votre minimum de {min_kb} Ko, même en qualité maximale.",
        "de": "Die Datei hat {got_kb} KB, unter deinem Minimum von {min_kb} KB, selbst in bester Qualität.",
        "pt": "O arquivo tem {got_kb} KB, abaixo do seu mínimo de {min_kb} KB, mesmo na melhor qualidade.",
    },
    "SCANNED_PDF": {
        "en": "This PDF looks scanned, so its pages were copied as pictures (KonPDF has no OCR).",
        "hi": "यह PDF स्कैन की हुई लगती है, इसलिए पेज तस्वीरों के रूप में डाले गए (KonPDF में OCR नहीं है)।",
        "hi-Latn": "Yeh PDF scanned lagti hai, isliye pages photos ki tarah daale gaye (KonPDF mein OCR nahi hai).",
        "es": "Este PDF parece escaneado, así que las páginas se copiaron como imágenes (KonPDF no tiene OCR).",
        "fr": "Ce PDF semble scanné : les pages ont été copiées en images (KonPDF n’a pas d’OCR).",
        "de": "Dieses PDF wirkt gescannt, daher wurden die Seiten als Bilder übernommen (KonPDF hat kein OCR).",
        "pt": "Este PDF parece digitalizado, então as páginas foram copiadas como imagens (o KonPDF não tem OCR).",
    },
    "LAYOUT_SIMPLIFIED": {
        "en": "Made with KonPDF's built-in layout: text, tables and pictures are kept, some fancy formatting may look simpler.",
        "hi": "KonPDF के अपने लेआउट से बना: टेक्स्ट, टेबल और तस्वीरें रहीं, कुछ ख़ास फ़ॉर्मैटिंग सादी दिख सकती है।",
        "hi-Latn": "KonPDF ke apne layout se bana: text, tables aur photos rahe, kuch fancy formatting simple dikh sakti hai.",
        "es": "Hecho con el diseño propio de KonPDF: se mantienen textos, tablas e imágenes; algún formato puede verse más simple.",
        "fr": "Créé avec la mise en page de KonPDF : textes, tableaux et images sont gardés, certains styles peuvent être simplifiés.",
        "de": "Mit KonPDFs eigenem Layout erstellt: Text, Tabellen und Bilder bleiben, manche Formatierung wirkt einfacher.",
        "pt": "Feito com o layout do KonPDF: textos, tabelas e imagens ficam; parte da formatação pode ficar mais simples.",
    },
    "NO_GAIN": {
        "en": "“{name}” was already as small as it gets, so we kept the original.",
        "hi": "“{name}” पहले से ही जितनी छोटी हो सकती थी उतनी है, इसलिए असली फ़ाइल रखी।",
        "hi-Latn": "“{name}” pehle se hi kaafi chhoti thi, isliye original rakhi.",
        "es": "“{name}” ya era lo más pequeño posible, así que mantuvimos el original.",
        "fr": "« {name} » était déjà au plus petit, nous avons gardé l’original.",
        "de": "„{name}“ war schon so klein wie möglich, daher bleibt das Original.",
        "pt": "“{name}” já estava o menor possível, então mantivemos o original.",
    },
    "FIRST_FRAME": {
        "en": "“{name}” is animated; KonPDF used its first frame.",
        "hi": "“{name}” एनिमेटेड है; KonPDF ने उसका पहला फ़्रेम लिया।",
        "hi-Latn": "“{name}” animated hai; KonPDF ne uska pehla frame liya.",
        "es": "“{name}” es animado; KonPDF usó el primer fotograma.",
        "fr": "« {name} » est animé ; KonPDF a utilisé la première image.",
        "de": "„{name}“ ist animiert; KonPDF hat das erste Bild verwendet.",
        "pt": "“{name}” é animado; o KonPDF usou o primeiro quadro.",
    },
    "PDF_TARGET_CLOSE": {
        "en": "We got the PDF to {got_kb} KB. Going down to {target_kb} KB would make it hard to read.",
        "hi": "PDF को {got_kb} KB तक किया। {target_kb} KB तक करने से पढ़ना मुश्किल हो जाता।",
        "hi-Latn": "PDF ko {got_kb} KB tak kiya. {target_kb} KB karne se padhna mushkil ho jaata.",
        "es": "Dejamos el PDF en {got_kb} KB. Bajar a {target_kb} KB lo haría difícil de leer.",
        "fr": "Le PDF fait {got_kb} Ko. Descendre à {target_kb} Ko le rendrait illisible.",
        "de": "Das PDF hat jetzt {got_kb} KB. {target_kb} KB würde es schwer lesbar machen.",
        "pt": "Deixamos o PDF com {got_kb} KB. Chegar a {target_kb} KB o deixaria difícil de ler.",
    },
}


class KonError(Exception):
    """The only exception the engine raises on purpose. `params` fill the message."""

    def __init__(self, code: str, **params: Any) -> None:
        super().__init__(code)
        self.code = code if code in CATALOG else "INTERNAL"
        self.params = params

    @property
    def status(self) -> int:
        return CATALOG[self.code].status


# Words for kinds of files, used inside messages ("This tool works with images").
KIND_NAMES: dict[str, L] = {
    "images": {"en": "images", "hi": "इमेज", "hi-Latn": "images", "es": "imágenes", "fr": "images", "de": "Bildern", "pt": "imagens"},
    "pdfs": {"en": "PDFs", "hi": "PDF", "hi-Latn": "PDFs", "es": "PDF", "fr": "PDF", "de": "PDFs", "pt": "PDFs"},
    "pdfs_or_images": {
        "en": "PDFs and images",
        "hi": "PDF और इमेज",
        "hi-Latn": "PDFs aur images",
        "es": "PDF e imágenes",
        "fr": "PDF et images",
        "de": "PDFs und Bildern",
        "pt": "PDFs e imagens",
    },
}


def render(code: str, lang: str, **params: Any) -> dict[str, Any]:
    """The friendly error object in `lang`."""
    entry = CATALOG.get(code, CATALOG["INTERNAL"])
    if code not in CATALOG:
        code = "INTERNAL"
    if params.get("expected") in KIND_NAMES:
        params["expected"] = pick(KIND_NAMES[params["expected"]], lang)
    if code == "INVALID_OPTIONS" and not params.get("detail"):
        params["detail"] = pick(entry.title, lang)
    out: dict[str, Any] = {
        "code": code,
        "title": fill(pick(entry.title, lang), **params),
        "message": fill(pick(entry.message, lang), **params),
    }
    hint = fill(pick(entry.hint, lang), **params)
    if hint:
        out["hint"] = hint
    if entry.action:
        out["action"] = entry.action
    return out


def note(key: str, lang: str, **params: Any) -> str:
    return fill(pick(NOTES[key], lang), **params)


def why(code: str, lang: str) -> str | None:
    entry = CATALOG.get(code)
    return pick(entry.why, lang) if entry and entry.why else None


class Notes:
    """Collects notes during a job; rendered in the person's language at the end."""

    def __init__(self) -> None:
        self.items: list[tuple[str, dict[str, Any]]] = []

    def add(self, key: str, **params: Any) -> None:
        if (key, params) not in self.items:
            self.items.append((key, params))

    def render(self, lang: str) -> list[str]:
        return [note(key, lang, **params) for key, params in self.items]
