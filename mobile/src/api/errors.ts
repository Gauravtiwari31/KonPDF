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

export function appError(code: keyof typeof APP_ERRORS, lang: Lang): FriendlyError {
  return { code, ...APP_ERRORS[code][lang] };
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
    }
  }
  return appError('INTERNAL', lang);
}
