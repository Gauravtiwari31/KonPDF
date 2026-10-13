import type { IconName } from '../components/Icon';

export type Family = 'image' | 'pdf' | 'document' | 'sheet' | 'resize' | 'enhance' | 'nw';

/** Sticker colour of each tool family, as in the app (text on them is always ink). */
export const FAMILY_COLOR: Record<Family, string> = {
  image: 'var(--coral)',
  pdf: 'var(--rose)',
  document: 'var(--sky)',
  sheet: 'var(--mint)',
  resize: 'var(--volt)',
  enhance: 'var(--lavender)',
  nw: 'var(--aqua)',
};

/** `accept` lists for the file picker. */
export const ACCEPT = {
  images: 'image/*,.heic,.heif,.avif',
  pdf: '.pdf,application/pdf',
  documents: '.docx,.doc,.odt,.rtf,.txt,.md,.html,.htm',
  presentations: '.pptx,.ppt,.odp',
  sheets: '.xlsx,.xls,.ods,.csv,.tsv,.json',
  any: '',
};

export interface Tool {
  id: string;
  family: Family;
  title: string;
  subtitle: string;
  icon: IconName;
  href: string;
  accept: string;
  /** Format chosen for you when the files allow it. */
  target?: string;
}

const convert = (id: string, rest: Omit<Tool, 'id' | 'href'>): Tool => ({
  id,
  href: `/convert?tool=${id}`,
  ...rest,
});

export const SECTIONS: { title: string; tools: Tool[] }[] = [
  {
    title: 'Convert',
    tools: [
      convert('any', { family: 'nw', title: 'Any file', subtitle: 'Pick files, choose a format', icon: 'convert', accept: ACCEPT.any }),
      convert('image-convert', { family: 'image', title: 'Image format', subtitle: 'JPG · PNG · WEBP · HEIC…', icon: 'image', accept: ACCEPT.images, target: 'jpg' }),
      convert('images-to-pdf', { family: 'pdf', title: 'Images → PDF', subtitle: 'Photos and scans in one PDF', icon: 'pdf', accept: ACCEPT.images, target: 'pdf' }),
      convert('pdf-to-images', { family: 'image', title: 'PDF → Images', subtitle: 'Every page as a picture', icon: 'image', accept: ACCEPT.pdf, target: 'jpg' }),
      convert('pdf-to-word', { family: 'document', title: 'PDF → Word', subtitle: 'Editable DOCX', icon: 'doc', accept: ACCEPT.pdf, target: 'docx' }),
      convert('word-to-pdf', { family: 'pdf', title: 'Word → PDF', subtitle: 'DOCX, ODT, RTF, TXT…', icon: 'pdf', accept: ACCEPT.documents, target: 'pdf' }),
      convert('sheets', { family: 'sheet', title: 'Sheets', subtitle: 'XLSX · CSV · JSON · PDF', icon: 'sheet', accept: ACCEPT.sheets, target: 'xlsx' }),
      convert('slides-to-pdf', { family: 'document', title: 'Slides → PDF', subtitle: 'PPTX, PPT, ODP', icon: 'slides', accept: ACCEPT.presentations, target: 'pdf' }),
    ],
  },
  {
    title: 'Image studio',
    tools: [
      { id: 'resize', family: 'resize', title: 'Resize', subtitle: 'Pixels, %, cm, or KB size', icon: 'resize', href: '/resize', accept: ACCEPT.images },
      { id: 'enhance', family: 'enhance', title: 'Enhance', subtitle: 'Auto fix, filters, scans', icon: 'wand', href: '/enhance', accept: ACCEPT.images },
    ],
  },
  {
    title: 'PDF tools',
    tools: [
      { id: 'merge', family: 'pdf', title: 'Merge PDF', subtitle: 'Join PDFs and images', icon: 'layers', href: '/pdf-tools?tool=merge', accept: ACCEPT.pdf },
      { id: 'compress', family: 'pdf', title: 'Compress PDF', subtitle: 'Smaller, or under a size', icon: 'compress', href: '/pdf-tools?tool=compress', accept: ACCEPT.pdf },
      { id: 'split', family: 'pdf', title: 'Split PDF', subtitle: 'Pages or ranges', icon: 'scissors', href: '/pdf-tools?tool=split', accept: ACCEPT.pdf },
      { id: 'pdf-tools', family: 'pdf', title: 'More PDF tools', subtitle: 'Lock, rotate, watermark…', icon: 'sliders', href: '/pdf-tools', accept: ACCEPT.pdf },
    ],
  },
];

export const CONVERT_TOOLS = SECTIONS[0].tools;

const SHEETS = ['xlsx', 'xls', 'ods', 'csv', 'tsv', 'json'];
const DOCUMENTS = ['docx', 'doc', 'odt', 'rtf', 'txt', 'md', 'html', 'pptx', 'ppt', 'odp'];

export function familyOfFormat(format: string): Family {
  if (format === 'pdf') {
    return 'pdf';
  }
  if (SHEETS.includes(format)) {
    return 'sheet';
  }
  return DOCUMENTS.includes(format) ? 'document' : 'image';
}

/** Resize presets: ids match the engine (engine/app/tools/resize.py). */
export const PRESET_GROUPS: { title: string; presets: { id: string; label: string; detail: string }[] }[] = [
  {
    title: 'ID and forms',
    presets: [
      { id: 'passport', label: 'Passport photo', detail: '35 × 45 mm' },
      { id: 'us_visa', label: 'US visa', detail: '2 × 2 in' },
      { id: 'india_form_photo', label: 'Govt. form photo', detail: '3.5 × 4.5 cm · 20–50 KB' },
      { id: 'signature', label: 'Signature', detail: '140 × 60 px · 10–20 KB' },
      { id: 'id_scan', label: 'ID card scan', detail: 'Under 300 KB' },
    ],
  },
  {
    title: 'Social',
    presets: [
      { id: 'instagram_square', label: 'Instagram post', detail: '1080 × 1080' },
      { id: 'instagram_portrait', label: 'Instagram portrait', detail: '1080 × 1350' },
      { id: 'instagram_story', label: 'Story / Reel', detail: '1080 × 1920' },
      { id: 'whatsapp_dp', label: 'WhatsApp DP', detail: '500 × 500' },
      { id: 'youtube_thumb', label: 'YouTube thumbnail', detail: '1280 × 720' },
      { id: 'linkedin_banner', label: 'LinkedIn banner', detail: '1584 × 396' },
      { id: 'x_header', label: 'X header', detail: '1500 × 500' },
    ],
  },
  {
    title: 'Screens, print, email',
    presets: [
      { id: 'hd', label: 'HD', detail: '1280 × 720' },
      { id: 'full_hd', label: 'Full HD', detail: '1920 × 1080' },
      { id: 'uhd_4k', label: '4K', detail: '3840 × 2160' },
      { id: 'a4_300dpi', label: 'A4 print', detail: '300 DPI' },
      { id: 'email', label: 'Small for email', detail: '1280 px · < 500 KB' },
    ],
  },
];
