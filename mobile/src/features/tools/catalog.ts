import type { IconName } from '../../components/ui';
import type { Family } from '../../theme';

/** MIME groups for Android's file picker. */
export const ACCEPT = {
  images: ['image/*'],
  pdf: ['application/pdf'],
  documents: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.oasis.opendocument.text',
    'application/rtf',
    'text/plain',
    'text/markdown',
    'text/html',
  ],
  presentations: [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'application/vnd.oasis.opendocument.presentation',
  ],
  sheets: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.oasis.opendocument.spreadsheet',
    'text/csv',
    'text/comma-separated-values',
    'text/tab-separated-values',
    'application/json',
  ],
  any: ['*/*'],
} as const;

export type ToolScreen = 'Convert' | 'Resize' | 'Enhance' | 'PdfTools' | 'Nw';

export interface ToolDef {
  id: string;
  family: Family;
  title: string;
  subtitle: string;
  icon: IconName;
  screen: ToolScreen;
  accept: readonly string[];
  /** Format picked for you when the files allow it. */
  target?: string;
}

/** Home screen tiles, grouped by section. */
export const SECTIONS: { title: string; tools: ToolDef[] }[] = [
  {
    title: 'Convert',
    tools: [
      {
        id: 'any',
        family: 'nw',
        title: 'Any file',
        subtitle: 'Pick files, choose a format',
        icon: 'convert',
        screen: 'Convert',
        accept: ACCEPT.any,
      },
      {
        id: 'image-convert',
        family: 'image',
        title: 'Image format',
        subtitle: 'JPG · PNG · WEBP · HEIC…',
        icon: 'image',
        screen: 'Convert',
        accept: ACCEPT.images,
        target: 'jpg',
      },
      {
        id: 'images-to-pdf',
        family: 'pdf',
        title: 'Images → PDF',
        subtitle: 'Photos and scans in one PDF',
        icon: 'pdf',
        screen: 'Convert',
        accept: ACCEPT.images,
        target: 'pdf',
      },
      {
        id: 'pdf-to-images',
        family: 'image',
        title: 'PDF → Images',
        subtitle: 'Every page as a picture',
        icon: 'image',
        screen: 'Convert',
        accept: ACCEPT.pdf,
        target: 'jpg',
      },
      {
        id: 'pdf-to-word',
        family: 'document',
        title: 'PDF → Word',
        subtitle: 'Editable DOCX',
        icon: 'doc',
        screen: 'Convert',
        accept: ACCEPT.pdf,
        target: 'docx',
      },
      {
        id: 'word-to-pdf',
        family: 'pdf',
        title: 'Word → PDF',
        subtitle: 'DOCX, ODT, RTF, TXT…',
        icon: 'pdf',
        screen: 'Convert',
        accept: ACCEPT.documents,
        target: 'pdf',
      },
      {
        id: 'sheets',
        family: 'sheet',
        title: 'Sheets',
        subtitle: 'XLSX · CSV · JSON · PDF',
        icon: 'sheet',
        screen: 'Convert',
        accept: ACCEPT.sheets,
        target: 'xlsx',
      },
      {
        id: 'slides-to-pdf',
        family: 'document',
        title: 'Slides → PDF',
        subtitle: 'PPTX, PPT, ODP',
        icon: 'slides',
        screen: 'Convert',
        accept: ACCEPT.presentations,
        target: 'pdf',
      },
    ],
  },
  {
    title: 'Image studio',
    tools: [
      {
        id: 'resize',
        family: 'resize',
        title: 'Resize',
        subtitle: 'Pixels, %, cm, or KB size',
        icon: 'resize',
        screen: 'Resize',
        accept: ACCEPT.images,
      },
      {
        id: 'enhance',
        family: 'enhance',
        title: 'Enhance',
        subtitle: 'Auto fix, filters, scans',
        icon: 'wand',
        screen: 'Enhance',
        accept: ACCEPT.images,
      },
    ],
  },
  {
    title: 'PDF tools',
    tools: [
      {
        id: 'pdf-tools',
        family: 'pdf',
        title: 'PDF tools',
        subtitle: 'Merge, split, compress, lock…',
        icon: 'layers',
        screen: 'PdfTools',
        accept: ACCEPT.pdf,
      },
    ],
  },
];

export const ALL_TOOLS = SECTIONS.flatMap(s => s.tools);

export const findTool = (id: string | undefined) =>
  ALL_TOOLS.find(t => t.id === id);

const SHEETS = ['xlsx', 'xls', 'ods', 'csv', 'tsv', 'json'];
const DOCUMENTS = ['docx', 'doc', 'odt', 'rtf', 'txt', 'md', 'html'];
const SLIDES = ['pptx', 'ppt', 'odp'];

/** Family a format belongs to, for colouring results. */
export function familyOfFormat(format: string): Family {
  if (format === 'pdf') {
    return 'pdf';
  }
  if (SHEETS.includes(format)) {
    return 'sheet';
  }
  if (DOCUMENTS.includes(format) || SLIDES.includes(format)) {
    return 'document';
  }
  return 'image';
}
