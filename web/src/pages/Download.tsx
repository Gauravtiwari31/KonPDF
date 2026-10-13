import site from '../../site.config.json';
import { Icon, type IconName } from '../components/Icon';

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'image', title: 'Document scanner', text: 'Scan paper with the camera into clean, straight PDFs.' },
  { icon: 'doc', title: 'Read text', text: 'Copy the words from photos and scanned PDFs, or save them as Word.' },
  { icon: 'chat', title: 'NW on your phone', text: 'The same assistant, with files straight from your gallery.' },
  { icon: 'clock', title: 'History', text: 'Your recent results, kept on your phone.' },
  { icon: 'upload', title: 'Google Drive backup', text: 'Optional: keep what you make in a KonPDF folder in your Drive.' },
  { icon: 'convert', title: 'Every web tool', text: 'Convert, resize, enhance and all the PDF tools.' },
];

export function Download() {
  return (
    <>
      <header className="tool-head">
        <p className="kicker">Android app</p>
        <h1>KonPDF for Android</h1>
        <p className="lead">
          Everything on this website, plus a document scanner and text reading that work right on your phone. Free,
          Android 7.0 and newer.
        </p>
      </header>

      <div className="row">
        <a className="btn btn-primary" href={`${site.repo}/releases/latest`}>
          <Icon name="download" size={20} />
          <span>Download the APK</span>
        </a>
        <span className="badge soon">Google Play: coming soon</span>
      </div>
      <p className="hint">
        From the Releases page on GitHub, download the file ending in <span className="mono">.apk</span> and open it.
        Android asks once to allow installing from your browser.
      </p>

      <section className="block">
        <div className="features">
          {FEATURES.map(f => (
            <div key={f.title} className="card feature">
              <Icon name={f.icon} />
              <strong>{f.title}</strong>
              <p className="muted">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="muted">
        How the app handles your information: <a href="/app-privacy">app privacy policy</a>.
      </p>
    </>
  );
}
