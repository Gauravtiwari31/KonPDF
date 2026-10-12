import { isAxiosError } from 'axios';
import type { Lang } from '../i18n/languages';
import { FileActionError } from '../services/files';

/**
 * What the person sees when something goes wrong. Never a status code, a
 * stack trace or a library message: the engine sends this shape for its own
 * errors (already in the person's language), and `toFriendlyError` builds it
 * for everything else.
 */
export interface FriendlyError {
  code: string;
  title: string;
  message: string;
  hint?: string;
  /** Something the screen can offer as a button, e.g. "compress". */
  action?: string;
}

type Text = { title: string; message: string; hint?: string };

/** Problems that happen on the phone, before or instead of reaching the engine. */
const APP_ERRORS: Record<string, Record<Lang, Text>> = {
  SERVER_UNREACHABLE: {
    en: {
      title: "Can't reach the converter",
      message: 'Check that you are online and try again.',
      hint: 'If you use your own engine, check its address in Settings.',
    },
    hi: {
      title: 'कन्वर्टर तक नहीं पहुँच पाए',
      message: 'देखिए कि इंटरनेट चालू है, फिर दोबारा कोशिश कीजिए।',
      hint: 'अगर आप अपना इंजन चलाते हैं, तो सेटिंग्स में उसका पता देखिए।',
    },
    'hi-Latn': {
      title: 'Converter tak nahi pahunch paaye',
      message: 'Internet on hai ya nahi dekh lo, phir dobara try karo.',
      hint: 'Apna engine use kar rahe ho to Settings mein uska address check karo.',
    },
    es: {
      title: 'No podemos conectar con el conversor',
      message: 'Comprueba tu conexión e inténtalo de nuevo.',
      hint: 'Si usas tu propio motor, revisa su dirección en Ajustes.',
    },
    fr: {
      title: 'Impossible de joindre le convertisseur',
      message: 'Vérifiez votre connexion et réessayez.',
      hint: 'Si vous utilisez votre propre moteur, vérifiez son adresse dans Réglages.',
    },
    de: {
      title: 'Konverter nicht erreichbar',
      message: 'Prüfe deine Internetverbindung und versuche es erneut.',
      hint: 'Nutzt du eine eigene Engine, prüfe ihre Adresse in den Einstellungen.',
    },
    pt: {
      title: 'Não conseguimos falar com o conversor',
      message: 'Verifique sua conexão e tente de novo.',
      hint: 'Se usa seu próprio motor, confira o endereço em Ajustes.',
    },
  },
  SERVER_WAKING: {
    en: {
      title: 'Waking up the converter',
      message: 'It was resting and needs a few seconds. Please try again.',
    },
    hi: {
      title: 'कन्वर्टर जाग रहा है',
      message: 'यह आराम कर रहा था, कुछ सेकंड लगेंगे। कृपया फिर से कोशिश करें।',
    },
    'hi-Latn': {
      title: 'Converter jaag raha hai',
      message: 'Thoda aaram kar raha tha, kuch second lagenge. Phir se try karo.',
    },
    es: {
      title: 'Despertando el conversor',
      message: 'Estaba en reposo y necesita unos segundos. Vuelve a intentarlo.',
    },
    fr: {
      title: 'Réveil du convertisseur',
      message: 'Il se reposait et a besoin de quelques secondes. Réessayez.',
    },
    de: {
      title: 'Konverter wird geweckt',
      message: 'Er hat geruht und braucht ein paar Sekunden. Bitte erneut versuchen.',
    },
    pt: {
      title: 'Acordando o conversor',
      message: 'Ele estava descansando e precisa de alguns segundos. Tente de novo.',
    },
  },
  NO_APP: {
    en: {
      title: 'No app can open this',
      message: 'Your phone has no app for this kind of file.',
      hint: 'Use Share or Save instead.',
    },
    hi: {
      title: 'इसे खोलने वाला कोई ऐप नहीं',
      message: 'आपके फ़ोन में इस तरह की फ़ाइल के लिए कोई ऐप नहीं है।',
      hint: 'इसकी जगह शेयर या सेव कीजिए।',
    },
    'hi-Latn': {
      title: 'Isse kholne wala koi app nahi',
      message: 'Phone mein is type ki file ke liye koi app nahi hai.',
      hint: 'Share ya Save use karo.',
    },
    es: {
      title: 'Ninguna app puede abrirlo',
      message: 'Tu teléfono no tiene una app para este tipo de archivo.',
      hint: 'Usa Compartir o Guardar.',
    },
    fr: {
      title: 'Aucune app ne peut l’ouvrir',
      message: 'Votre téléphone n’a pas d’app pour ce type de fichier.',
      hint: 'Utilisez Partager ou Enregistrer.',
    },
    de: {
      title: 'Keine App kann das öffnen',
      message: 'Auf deinem Handy gibt es keine App für diesen Dateityp.',
      hint: 'Nutze stattdessen Teilen oder Speichern.',
    },
    pt: {
      title: 'Nenhum app abre isto',
      message: 'Seu telefone não tem um app para este tipo de arquivo.',
      hint: 'Use Compartilhar ou Salvar.',
    },
  },
  FILE_GONE: {
    en: {
      title: 'That file is gone',
      message: 'It was cleared from this phone.',
      hint: 'Run the conversion again to get it back.',
    },
    hi: {
      title: 'वह फ़ाइल अब नहीं है',
      message: 'उसे इस फ़ोन से हटा दिया गया।',
      hint: 'उसे वापस पाने के लिए फिर से कन्वर्ट कीजिए।',
    },
    'hi-Latn': {
      title: 'Woh file ab nahi hai',
      message: 'Woh is phone se hata di gayi.',
      hint: 'Wapas paane ke liye dobara convert karo.',
    },
    es: {
      title: 'Ese archivo ya no está',
      message: 'Se borró de este teléfono.',
      hint: 'Vuelve a convertirlo para recuperarlo.',
    },
    fr: {
      title: 'Ce fichier n’existe plus',
      message: 'Il a été effacé de ce téléphone.',
      hint: 'Relancez la conversion pour le récupérer.',
    },
    de: {
      title: 'Die Datei ist weg',
      message: 'Sie wurde von diesem Handy entfernt.',
      hint: 'Starte die Umwandlung erneut, um sie zurückzubekommen.',
    },
    pt: {
      title: 'Esse arquivo sumiu',
      message: 'Ele foi apagado deste telefone.',
      hint: 'Converta de novo para recuperá-lo.',
    },
  },
  TOO_BIG_TO_SEND: {
    en: {
      title: 'That file is a bit too big',
      message: 'Files can be up to 50 MB each, and up to 20 at a time.',
      hint: 'Try fewer or smaller files.',
    },
    hi: {
      title: 'फ़ाइल थोड़ी बड़ी है',
      message: 'हर फ़ाइल 50 MB तक, और एक बार में 20 फ़ाइलें तक हो सकती हैं।',
      hint: 'कम या छोटी फ़ाइलें आज़माइए।',
    },
    'hi-Latn': {
      title: 'File thodi badi hai',
      message: 'Har file 50 MB tak, aur ek baar mein 20 files tak chalengi.',
      hint: 'Kam ya chhoti files try karo.',
    },
    es: {
      title: 'Ese archivo es demasiado grande',
      message: 'Hasta 50 MB por archivo y 20 archivos a la vez.',
      hint: 'Prueba con menos archivos o más pequeños.',
    },
    fr: {
      title: 'Ce fichier est un peu trop gros',
      message: 'Jusqu’à 50 Mo par fichier et 20 fichiers à la fois.',
      hint: 'Essayez avec moins de fichiers ou des fichiers plus petits.',
    },
    de: {
      title: 'Die Datei ist etwas zu groß',
      message: 'Bis zu 50 MB pro Datei und 20 Dateien auf einmal.',
      hint: 'Versuche es mit weniger oder kleineren Dateien.',
    },
    pt: {
      title: 'Esse arquivo é grande demais',
      message: 'Até 50 MB por arquivo e 20 arquivos de cada vez.',
      hint: 'Tente menos arquivos ou arquivos menores.',
    },
  },
  SCANNER_UNAVAILABLE: {
    en: {
      title: "The scanner isn't available",
      message: 'It needs Google Play services, which this phone is missing or needs to update.',
      hint: 'You can still pick photos of your pages and turn them into a PDF.',
    },
    hi: {
      title: 'स्कैनर उपलब्ध नहीं है',
      message: 'इसे Google Play services चाहिए, जो इस फ़ोन में नहीं है या अपडेट माँग रहा है।',
      hint: 'आप पन्नों की फ़ोटो चुनकर भी PDF बना सकते हैं।',
    },
    'hi-Latn': {
      title: 'Scanner available nahi hai',
      message: 'Ise Google Play services chahiye, jo is phone mein nahi hai ya update maang raha hai.',
      hint: 'Pages ki photos chun ke bhi PDF bana sakte ho.',
    },
    es: {
      title: 'El escáner no está disponible',
      message: 'Necesita Google Play services, que falta en este teléfono o debe actualizarse.',
      hint: 'Aún puedes elegir fotos de tus páginas y convertirlas en PDF.',
    },
    fr: {
      title: 'Le scanner n’est pas disponible',
      message: 'Il a besoin des services Google Play, absents de ce téléphone ou à mettre à jour.',
      hint: 'Vous pouvez quand même choisir des photos de vos pages et en faire un PDF.',
    },
    de: {
      title: 'Der Scanner ist nicht verfügbar',
      message: 'Er braucht die Google Play-Dienste, die auf diesem Handy fehlen oder ein Update brauchen.',
      hint: 'Du kannst trotzdem Fotos deiner Seiten wählen und ein PDF daraus machen.',
    },
    pt: {
      title: 'O scanner não está disponível',
      message: 'Ele precisa do Google Play services, que falta neste celular ou precisa de atualização.',
      hint: 'Você ainda pode escolher fotos das páginas e transformá-las em PDF.',
    },
  },
  READER_NOT_READY: {
    en: {
      title: 'The text reader is getting ready',
      message: 'Your phone is downloading it from Google Play services (a few MB). Try again in a minute.',
      hint: 'Make sure you are online the first time.',
    },
    hi: {
      title: 'टेक्स्ट रीडर तैयार हो रहा है',
      message: 'आपका फ़ोन इसे Google Play services से डाउनलोड कर रहा है (कुछ MB)। एक मिनट बाद फिर कोशिश कीजिए।',
      hint: 'पहली बार इंटरनेट चालू रखिए।',
    },
    'hi-Latn': {
      title: 'Text reader taiyaar ho raha hai',
      message: 'Phone ise Google Play services se download kar raha hai (kuch MB). Ek minute baad phir try karo.',
      hint: 'Pehli baar internet on rakho.',
    },
    es: {
      title: 'El lector de texto se está preparando',
      message: 'Tu teléfono lo está descargando de Google Play services (unos MB). Inténtalo en un minuto.',
      hint: 'La primera vez necesitas conexión.',
    },
    fr: {
      title: 'Le lecteur de texte se prépare',
      message: 'Votre téléphone le télécharge depuis les services Google Play (quelques Mo). Réessayez dans une minute.',
      hint: 'La première fois, restez connecté.',
    },
    de: {
      title: 'Der Textleser wird vorbereitet',
      message: 'Dein Handy lädt ihn über die Google Play-Dienste (ein paar MB). Versuch es in einer Minute erneut.',
      hint: 'Beim ersten Mal brauchst du Internet.',
    },
    pt: {
      title: 'O leitor de texto está ficando pronto',
      message: 'Seu celular está baixando pelo Google Play services (alguns MB). Tente de novo em um minuto.',
      hint: 'Na primeira vez, fique online.',
    },
  },
  PDF_LOCKED: {
    en: {
      title: 'This PDF has a password',
      message: 'We can’t read the pages of a locked PDF on the phone.',
      hint: 'Unlock it first with PDF tools → Unlock.',
    },
    hi: {
      title: 'इस PDF पर पासवर्ड है',
      message: 'लॉक PDF के पन्ने फ़ोन पर नहीं पढ़ सकते।',
      hint: 'पहले PDF tools → Unlock से इसे खोलिए।',
    },
    'hi-Latn': {
      title: 'Is PDF pe password hai',
      message: 'Lock PDF ke pages phone pe nahi padh sakte.',
      hint: 'Pehle PDF tools → Unlock se ise kholo.',
    },
    es: {
      title: 'Este PDF tiene contraseña',
      message: 'No podemos leer páginas de un PDF bloqueado en el teléfono.',
      hint: 'Desbloquéalo primero con PDF tools → Unlock.',
    },
    fr: {
      title: 'Ce PDF a un mot de passe',
      message: 'Impossible de lire les pages d’un PDF verrouillé sur le téléphone.',
      hint: 'Déverrouillez-le d’abord avec PDF tools → Unlock.',
    },
    de: {
      title: 'Dieses PDF hat ein Passwort',
      message: 'Seiten eines gesperrten PDFs können wir auf dem Handy nicht lesen.',
      hint: 'Entsperre es zuerst mit PDF tools → Unlock.',
    },
    pt: {
      title: 'Este PDF tem senha',
      message: 'Não conseguimos ler páginas de um PDF bloqueado no celular.',
      hint: 'Desbloqueie primeiro em PDF tools → Unlock.',
    },
  },
  CANT_READ_FILE: {
    en: {
      title: 'We couldn’t open this file',
      message: 'Your phone can’t read it as a picture or PDF. It may be damaged or in an unusual format.',
      hint: 'Try converting it to JPG or PDF first.',
    },
    hi: {
      title: 'यह फ़ाइल नहीं खुली',
      message: 'फ़ोन इसे फ़ोटो या PDF की तरह नहीं पढ़ पा रहा। शायद यह खराब है या अलग फ़ॉर्मैट में है।',
      hint: 'पहले इसे JPG या PDF में बदलकर देखिए।',
    },
    'hi-Latn': {
      title: 'Yeh file nahi khuli',
      message: 'Phone ise photo ya PDF ki tarah nahi padh paa raha. Shayad kharaab hai ya alag format mein hai.',
      hint: 'Pehle ise JPG ya PDF mein badal ke dekho.',
    },
    es: {
      title: 'No pudimos abrir este archivo',
      message: 'Tu teléfono no lo lee como imagen o PDF. Puede estar dañado o en un formato poco común.',
      hint: 'Prueba a convertirlo antes a JPG o PDF.',
    },
    fr: {
      title: 'Impossible d’ouvrir ce fichier',
      message: 'Votre téléphone ne le lit pas comme image ou PDF. Il est peut-être abîmé ou dans un format inhabituel.',
      hint: 'Essayez d’abord de le convertir en JPG ou PDF.',
    },
    de: {
      title: 'Diese Datei ließ sich nicht öffnen',
      message: 'Dein Handy kann sie nicht als Bild oder PDF lesen. Sie ist vielleicht beschädigt oder ungewöhnlich.',
      hint: 'Wandle sie zuerst in JPG oder PDF um.',
    },
    pt: {
      title: 'Não conseguimos abrir este arquivo',
      message: 'Seu celular não o lê como imagem ou PDF. Pode estar danificado ou num formato incomum.',
      hint: 'Tente convertê-lo antes para JPG ou PDF.',
    },
  },
  AI_READER_FAILED: {
    en: {
      title: 'The AI reader stopped',
      message: 'Your phone ran short of memory, or the model files need a fresh download.',
      hint: 'Close other apps and try again, use the Standard reader, or re-download the model in Developer Mode.',
    },
    hi: {
      title: 'AI रीडर रुक गया',
      message: 'फ़ोन की मेमोरी कम पड़ गई, या मॉडल फ़ाइलें दोबारा डाउनलोड करनी होंगी।',
      hint: 'दूसरे ऐप बंद करके फिर कोशिश कीजिए, Standard रीडर चुनिए, या Developer Mode में मॉडल दोबारा डाउनलोड कीजिए।',
    },
    'hi-Latn': {
      title: 'AI reader ruk gaya',
      message: 'Phone ki memory kam pad gayi, ya model files dobara download karni hongi.',
      hint: 'Dusre apps band karke phir try karo, Standard reader chuno, ya Developer Mode mein model dobara download karo.',
    },
    es: {
      title: 'El lector con IA se detuvo',
      message: 'Al teléfono le faltó memoria, o los archivos del modelo deben descargarse de nuevo.',
      hint: 'Cierra otras apps e inténtalo de nuevo, usa el lector Standard o vuelve a descargar el modelo en Developer Mode.',
    },
    fr: {
      title: 'Le lecteur IA s’est arrêté',
      message: 'Le téléphone a manqué de mémoire, ou les fichiers du modèle sont à retélécharger.',
      hint: 'Fermez d’autres apps et réessayez, utilisez le lecteur Standard ou retéléchargez le modèle dans Developer Mode.',
    },
    de: {
      title: 'Der KI-Leser hat gestoppt',
      message: 'Dem Handy ging der Speicher aus, oder die Modelldateien müssen neu geladen werden.',
      hint: 'Schließe andere Apps und versuch es erneut, nimm den Standard-Leser oder lade das Modell im Developer Mode neu.',
    },
    pt: {
      title: 'O leitor com IA parou',
      message: 'Faltou memória no celular, ou os arquivos do modelo precisam ser baixados de novo.',
      hint: 'Feche outros apps e tente de novo, use o leitor Standard ou baixe o modelo outra vez no Developer Mode.',
    },
  },
  DRIVE_UNAVAILABLE: {
    en: {
      title: "Google Drive backup isn't available",
      message: 'It needs Google Play services, which this phone is missing or needs to update.',
      hint: 'Everything else in KonPDF works as usual. You can still Share or Save your files.',
    },
    hi: {
      title: 'Google Drive बैकअप उपलब्ध नहीं है',
      message: 'इसे Google Play services चाहिए, जो इस फ़ोन में नहीं है या अपडेट माँग रहा है।',
      hint: 'KonPDF का बाकी सब पहले जैसा चलता है। आप फ़ाइलें शेयर या सेव कर सकते हैं।',
    },
    'hi-Latn': {
      title: 'Google Drive backup available nahi hai',
      message: 'Ise Google Play services chahiye, jo is phone mein nahi hai ya update maang raha hai.',
      hint: 'KonPDF ka baaki sab pehle jaisa chalta hai. Files Share ya Save kar sakte ho.',
    },
    es: {
      title: 'La copia en Google Drive no está disponible',
      message: 'Necesita Google Play services, que falta en este teléfono o debe actualizarse.',
      hint: 'Todo lo demás de KonPDF funciona igual. Puedes Compartir o Guardar tus archivos.',
    },
    fr: {
      title: 'La sauvegarde Google Drive n’est pas disponible',
      message: 'Elle a besoin des services Google Play, absents de ce téléphone ou à mettre à jour.',
      hint: 'Le reste de KonPDF fonctionne normalement. Vous pouvez toujours Partager ou Enregistrer vos fichiers.',
    },
    de: {
      title: 'Google-Drive-Sicherung ist nicht verfügbar',
      message: 'Sie braucht die Google Play-Dienste, die auf diesem Handy fehlen oder ein Update brauchen.',
      hint: 'Alles andere in KonPDF funktioniert wie gewohnt. Du kannst deine Dateien weiter teilen oder speichern.',
    },
    pt: {
      title: 'O backup no Google Drive não está disponível',
      message: 'Ele precisa do Google Play services, que falta neste celular ou precisa de atualização.',
      hint: 'O resto do KonPDF funciona normalmente. Você ainda pode Compartilhar ou Salvar seus arquivos.',
    },
  },
  DRIVE_NOT_SET_UP: {
    en: {
      title: "Google Drive isn't set up in this version",
      message: "This copy of KonPDF isn't registered with Google yet, so it can't connect to Drive.",
      hint: "That's on our side, not yours. Your files are safe on this phone.",
    },
    hi: {
      title: 'इस वर्ज़न में Google Drive सेट नहीं है',
      message: 'KonPDF की यह कॉपी अभी Google के साथ रजिस्टर नहीं है, इसलिए Drive से नहीं जुड़ सकती।',
      hint: 'यह हमारी तरफ़ की बात है, आपकी नहीं। आपकी फ़ाइलें इस फ़ोन पर सुरक्षित हैं।',
    },
    'hi-Latn': {
      title: 'Is version mein Google Drive set nahi hai',
      message: 'KonPDF ki yeh copy abhi Google ke saath register nahi hai, isliye Drive se nahi jud sakti.',
      hint: 'Yeh hamari taraf ki baat hai, aapki nahi. Aapki files is phone pe safe hain.',
    },
    es: {
      title: 'Google Drive no está configurado en esta versión',
      message: 'Esta copia de KonPDF aún no está registrada con Google, así que no puede conectarse a Drive.',
      hint: 'Es cosa nuestra, no tuya. Tus archivos están a salvo en este teléfono.',
    },
    fr: {
      title: 'Google Drive n’est pas configuré dans cette version',
      message: 'Cette copie de KonPDF n’est pas encore enregistrée auprès de Google : elle ne peut pas se connecter à Drive.',
      hint: 'Le problème vient de nous, pas de vous. Vos fichiers sont en sécurité sur ce téléphone.',
    },
    de: {
      title: 'Google Drive ist in dieser Version nicht eingerichtet',
      message: 'Diese KonPDF-Kopie ist noch nicht bei Google registriert und kann sich daher nicht mit Drive verbinden.',
      hint: 'Das liegt an uns, nicht an dir. Deine Dateien sind auf diesem Handy sicher.',
    },
    pt: {
      title: 'O Google Drive não está configurado nesta versão',
      message: 'Esta cópia do KonPDF ainda não está registrada no Google, então não consegue se conectar ao Drive.',
      hint: 'O problema é do nosso lado, não seu. Seus arquivos estão seguros neste celular.',
    },
  },
  DRIVE_SIGNED_OUT: {
    en: {
      title: 'Reconnect Google Drive',
      message: "KonPDF's access to your Drive has ended, so backups are paused.",
      hint: 'Open Settings → Google Drive and tap Reconnect.',
    },
    hi: {
      title: 'Google Drive दोबारा जोड़िए',
      message: 'आपकी Drive तक KonPDF की पहुँच खत्म हो गई है, इसलिए बैकअप रुका हुआ है।',
      hint: 'सेटिंग्स → Google Drive खोलकर Reconnect दबाइए।',
    },
    'hi-Latn': {
      title: 'Google Drive dobara connect karo',
      message: 'Aapki Drive tak KonPDF ka access khatam ho gaya hai, isliye backup ruka hua hai.',
      hint: 'Settings → Google Drive kholo aur Reconnect dabao.',
    },
    es: {
      title: 'Vuelve a conectar Google Drive',
      message: 'KonPDF ya no tiene acceso a tu Drive, así que las copias están en pausa.',
      hint: 'Abre Ajustes → Google Drive y toca Reconnect.',
    },
    fr: {
      title: 'Reconnectez Google Drive',
      message: 'KonPDF n’a plus accès à votre Drive : les sauvegardes sont en pause.',
      hint: 'Ouvrez Réglages → Google Drive et touchez Reconnect.',
    },
    de: {
      title: 'Google Drive neu verbinden',
      message: 'KonPDF hat keinen Zugriff mehr auf dein Drive, die Sicherung pausiert.',
      hint: 'Öffne Einstellungen → Google Drive und tippe auf Reconnect.',
    },
    pt: {
      title: 'Conecte o Google Drive de novo',
      message: 'O KonPDF perdeu o acesso ao seu Drive, então os backups estão pausados.',
      hint: 'Abra Ajustes → Google Drive e toque em Reconnect.',
    },
  },
  DRIVE_UNREACHABLE: {
    en: {
      title: "Can't reach Google Drive",
      message: 'Check that you are online. Your file is safe on this phone.',
      hint: 'Backups try again by themselves the next time you open KonPDF.',
    },
    hi: {
      title: 'Google Drive तक नहीं पहुँच पाए',
      message: 'देखिए कि इंटरनेट चालू है। आपकी फ़ाइल इस फ़ोन पर सुरक्षित है।',
      hint: 'अगली बार KonPDF खोलने पर बैकअप अपने आप फिर कोशिश करेगा।',
    },
    'hi-Latn': {
      title: 'Google Drive tak nahi pahunch paaye',
      message: 'Internet on hai ya nahi dekh lo. Aapki file is phone pe safe hai.',
      hint: 'Agli baar KonPDF kholne pe backup apne aap phir try karega.',
    },
    es: {
      title: 'No podemos conectar con Google Drive',
      message: 'Comprueba tu conexión. Tu archivo está a salvo en este teléfono.',
      hint: 'La copia se reintenta sola la próxima vez que abras KonPDF.',
    },
    fr: {
      title: 'Impossible de joindre Google Drive',
      message: 'Vérifiez votre connexion. Votre fichier est en sécurité sur ce téléphone.',
      hint: 'La sauvegarde réessaiera d’elle-même à la prochaine ouverture de KonPDF.',
    },
    de: {
      title: 'Google Drive nicht erreichbar',
      message: 'Prüfe deine Internetverbindung. Deine Datei ist auf diesem Handy sicher.',
      hint: 'Die Sicherung versucht es beim nächsten Öffnen von KonPDF von selbst erneut.',
    },
    pt: {
      title: 'Não conseguimos falar com o Google Drive',
      message: 'Verifique sua conexão. Seu arquivo está seguro neste celular.',
      hint: 'O backup tenta de novo sozinho na próxima vez que você abrir o KonPDF.',
    },
  },
  DRIVE_FULL: {
    en: {
      title: 'Your Google Drive is full',
      message: "There's no room left in your Drive for this file.",
      hint: 'Free up space in Google Drive, then try again.',
    },
    hi: {
      title: 'आपकी Google Drive भर गई है',
      message: 'इस फ़ाइल के लिए आपकी Drive में जगह नहीं बची।',
      hint: 'Google Drive में जगह खाली करके फिर कोशिश कीजिए।',
    },
    'hi-Latn': {
      title: 'Aapki Google Drive bhar gayi hai',
      message: 'Is file ke liye aapki Drive mein jagah nahi bachi.',
      hint: 'Google Drive mein jagah khaali karke phir try karo.',
    },
    es: {
      title: 'Tu Google Drive está lleno',
      message: 'No queda espacio en tu Drive para este archivo.',
      hint: 'Libera espacio en Google Drive y vuelve a intentarlo.',
    },
    fr: {
      title: 'Votre Google Drive est plein',
      message: 'Il n’y a plus de place dans votre Drive pour ce fichier.',
      hint: 'Libérez de l’espace dans Google Drive, puis réessayez.',
    },
    de: {
      title: 'Dein Google Drive ist voll',
      message: 'In deinem Drive ist kein Platz mehr für diese Datei.',
      hint: 'Schaffe Platz in Google Drive und versuche es dann erneut.',
    },
    pt: {
      title: 'Seu Google Drive está cheio',
      message: 'Não há mais espaço no seu Drive para este arquivo.',
      hint: 'Libere espaço no Google Drive e tente de novo.',
    },
  },
  DRIVE_BUSY: {
    en: {
      title: 'Google Drive is busy',
      message: 'It asked us to slow down for a moment.',
      hint: 'Please try again in a minute.',
    },
    hi: {
      title: 'Google Drive व्यस्त है',
      message: 'उसने थोड़ी देर रुकने को कहा है।',
      hint: 'कृपया एक मिनट बाद फिर कोशिश करें।',
    },
    'hi-Latn': {
      title: 'Google Drive busy hai',
      message: 'Usne thodi der rukne ko kaha hai.',
      hint: 'Ek minute baad phir try karo.',
    },
    es: {
      title: 'Google Drive está ocupado',
      message: 'Nos pidió esperar un momento.',
      hint: 'Inténtalo de nuevo en un minuto.',
    },
    fr: {
      title: 'Google Drive est occupé',
      message: 'Il nous demande de patienter un instant.',
      hint: 'Réessayez dans une minute.',
    },
    de: {
      title: 'Google Drive ist ausgelastet',
      message: 'Es hat uns gebeten, kurz zu warten.',
      hint: 'Bitte versuche es in einer Minute erneut.',
    },
    pt: {
      title: 'O Google Drive está ocupado',
      message: 'Ele pediu para esperarmos um pouco.',
      hint: 'Tente de novo daqui a um minuto.',
    },
  },
  INTERNAL: {
    en: {
      title: 'Something went wrong',
      message: "That didn't work, and it's not your fault.",
      hint: 'Please try again in a moment.',
    },
    hi: {
      title: 'कुछ गड़बड़ हो गई',
      message: 'यह नहीं हो पाया, और इसमें आपकी कोई गलती नहीं है।',
      hint: 'कृपया थोड़ी देर में फिर कोशिश करें।',
    },
    'hi-Latn': {
      title: 'Kuch gadbad ho gayi',
      message: 'Yeh nahi ho paaya, aur isme aapki koi galti nahi hai.',
      hint: 'Thodi der mein phir try karo.',
    },
    es: {
      title: 'Algo salió mal',
      message: 'No funcionó, y no es culpa tuya.',
      hint: 'Inténtalo de nuevo en un momento.',
    },
    fr: {
      title: 'Un problème est survenu',
      message: 'Ça n’a pas marché, et ce n’est pas de votre faute.',
      hint: 'Réessayez dans un instant.',
    },
    de: {
      title: 'Etwas ist schiefgelaufen',
      message: 'Das hat nicht geklappt, und es liegt nicht an dir.',
      hint: 'Bitte versuche es gleich noch einmal.',
    },
    pt: {
      title: 'Algo deu errado',
      message: 'Não funcionou, e a culpa não é sua.',
      hint: 'Tente de novo daqui a pouco.',
    },
  },
};

export type AppErrorCode = keyof typeof APP_ERRORS;

export function appError(code: AppErrorCode, lang: Lang): FriendlyError {
  return { code, ...APP_ERRORS[code][lang] };
}

/** A FriendlyError code kept for later (a failed Drive backup), in the person's language now. */
export function appErrorByCode(code: string, lang: Lang): FriendlyError {
  const known = Object.prototype.hasOwnProperty.call(APP_ERRORS, code);
  return appError(known ? (code as AppErrorCode) : 'INTERNAL', lang);
}

const isFriendly = (value: unknown): value is FriendlyError =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as FriendlyError).code === 'string' &&
  typeof (value as FriendlyError).title === 'string' &&
  typeof (value as FriendlyError).message === 'string';

/** The engine's error body ({ ok: false, error }) as a FriendlyError, if it is one. */
function fromBody(body: unknown): FriendlyError | null {
  let data = body;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  const error = (data as { error?: unknown } | null)?.error;
  return isFriendly(error) ? error : null;
}

/** Status codes a sleeping or restarting host answers with before the engine is up. */
const WAKING_STATUSES = new Set([502, 503, 504]);

/** Turns anything thrown while talking to the engine or handling files into a FriendlyError. */
export function toFriendlyError(error: unknown, lang: Lang): FriendlyError {
  if (isFriendly(error)) {
    return error;
  }
  if (isAxiosError(error)) {
    const fromEngine = fromBody(error.response?.data);
    if (fromEngine) {
      return fromEngine;
    }
    if (!error.response) {
      return error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
        ? appError('SERVER_WAKING', lang)
        : appError('SERVER_UNREACHABLE', lang);
    }
    return WAKING_STATUSES.has(error.response.status)
      ? appError('SERVER_WAKING', lang)
      : appError('INTERNAL', lang);
  }
  if (error instanceof FileActionError) {
    if (error.code.startsWith('http_')) {
      const status = Number(error.code.slice(5));
      return (
        fromBody(error.message) ??
        appError(WAKING_STATUSES.has(status) ? 'SERVER_WAKING' : 'FILE_GONE', lang)
      );
    }
    switch (error.code) {
      case 'network':
        return appError('SERVER_UNREACHABLE', lang);
      case 'no_app':
        return appError('NO_APP', lang);
      case 'missing':
        return appError('FILE_GONE', lang);
      case 'scanner_unavailable':
        return appError('SCANNER_UNAVAILABLE', lang);
      case 'reader_unavailable':
        return appError('READER_NOT_READY', lang);
      case 'pdf_locked':
        return appError('PDF_LOCKED', lang);
      case 'unreadable':
        return appError('CANT_READ_FILE', lang);
      case 'ai_failed':
        return appError('AI_READER_FAILED', lang);
      case 'drive_unavailable':
        return appError('DRIVE_UNAVAILABLE', lang);
      case 'drive_not_configured':
        return appError('DRIVE_NOT_SET_UP', lang);
      case 'drive_signed_out':
      case 'drive_auth':
        return appError('DRIVE_SIGNED_OUT', lang);
      case 'drive_network':
        return appError('DRIVE_UNREACHABLE', lang);
      case 'drive_full':
        return appError('DRIVE_FULL', lang);
      case 'drive_busy':
        return appError('DRIVE_BUSY', lang);
    }
  }
  return appError('INTERNAL', lang);
}
