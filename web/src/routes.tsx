import type { ReactNode } from 'react';
import appPrivacy from '../../docs/privacy-policy.md?raw';
import about from '../content/about.md?raw';
import privacy from '../content/privacy.md?raw';
import terms from '../content/terms.md?raw';
import site from '../site.config.json';
import { Convert } from './pages/Convert';
import { Doc, NotFound } from './pages/Doc';
import { Download } from './pages/Download';
import { Enhance } from './pages/Enhance';
import { Home } from './pages/Home';
import { Nw } from './pages/Nw';
import { PdfTools } from './pages/PdfTools';
import { Resize } from './pages/Resize';

export interface Route {
  path: string;
  title: string;
  description: string;
  render: () => ReactNode;
}

const contact = [
  site.contactEmail ? `Email [${site.contactEmail}](mailto:${site.contactEmail}), or open` : 'Open',
  `an issue at [github.com/NotWork-world/KonPDF/issues](${site.repo}/issues).`,
].join(' ');
const md = (text: string) => () => <Doc markdown={text.replace('{{contact}}', contact)} />;

export const ROUTES: Route[] = [
  {
    path: '/',
    title: 'KonPDF: free PDF converter, image resizer and PDF tools',
    description:
      'Convert images, PDFs, Word, Excel and PowerPoint, resize photos to an exact KB or pixel size, enhance scans, and merge, split, compress or lock PDFs. Free, no sign-up.',
    render: () => <Home />,
  },
  {
    path: '/convert',
    title: 'Convert files online: PDF, Word, JPG, PNG, Excel | KonPDF',
    description: 'Convert images, PDFs, documents, spreadsheets and slides in any direction the file allows. Free, no sign-up.',
    render: () => <Convert />,
  },
  {
    path: '/resize',
    title: 'Resize image to KB, pixels or cm online | KonPDF',
    description:
      'Shrink a photo to the exact KB a form asks for, or resize to pixels, a percentage, a print size, passport or signature presets. Free.',
    render: () => <Resize />,
  },
  {
    path: '/enhance',
    title: 'Enhance photos and scans online | KonPDF',
    description: 'Fix dark photos, clean up paper scans, upscale, and apply filters with a live preview. Free, no sign-up.',
    render: () => <Enhance />,
  },
  {
    path: '/pdf-tools',
    title: 'PDF tools: merge, split, compress, lock, watermark | KonPDF',
    description:
      'Merge, split, compress, rotate, reorder, lock, unlock, watermark and number PDFs online. Free, no sign-up.',
    render: () => <PdfTools />,
  },
  {
    path: '/nw',
    title: 'Ask NW, the KonPDF assistant',
    description: 'Say what you need in plain words, in seven languages, and NW sets up the steps for your files.',
    render: () => <Nw />,
  },
  {
    path: '/download',
    title: 'KonPDF for Android: scanner, text reader and file tools',
    description: 'The KonPDF Android app: document scanner, text reading and every file tool on your phone.',
    render: () => <Download />,
  },
  {
    path: '/privacy',
    title: 'Privacy policy | KonPDF',
    description: 'How the KonPDF website handles your files and information.',
    render: md(privacy),
  },
  {
    path: '/app-privacy',
    title: 'App privacy policy | KonPDF for Android',
    description: 'How the KonPDF Android app handles your files and information.',
    render: md(appPrivacy),
  },
  {
    path: '/terms',
    title: 'Terms of use | KonPDF',
    description: 'The terms for using the KonPDF website.',
    render: md(terms),
  },
  {
    path: '/about',
    title: 'About and contact | KonPDF',
    description: 'What KonPDF is, who makes it, and how to get in touch.',
    render: md(about),
  },
];

export const NOT_FOUND: Route = {
  path: '/404',
  title: 'Page not found | KonPDF',
  description: 'This page isn’t here.',
  render: () => <NotFound />,
};

export const findRoute = (path: string) =>
  ROUTES.find(r => r.path === (path.replace(/\/+$/, '').replace(/\.html$/, '') || '/')) ?? NOT_FOUND;
