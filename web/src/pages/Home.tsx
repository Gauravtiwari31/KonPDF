import { Icon } from '../components/Icon';
import { FAMILY_COLOR, SECTIONS } from '../lib/catalog';

const STEPS = [
  { title: 'Pick your files', text: 'Photos, PDFs, Word, Excel, PowerPoint, up to 50 MB each.' },
  { title: 'Choose what you need', text: 'A format, a size in KB or pixels, a cleanup, or a PDF job.' },
  { title: 'Download', text: 'Your files are ready in seconds, and deleted from the converter after 30 minutes.' },
];

const FAQ = [
  {
    q: 'Is KonPDF free?',
    a: 'Yes. Every tool on this website is free, with no sign-up and no watermark on your files. Ads keep it running.',
  },
  {
    q: 'What happens to my files?',
    a: 'They are sent over an encrypted connection to the KonPDF converter, processed, and deleted automatically after 30 minutes (or straight away when you tap “Delete from the converter now”). Nobody looks at them, and they are never used to train anything.',
  },
  {
    q: 'How do I get a photo under 50 KB or 20 KB for a form?',
    a: 'Open Resize, choose “File size (KB)” and type the most the form allows, for example 50. If the form also has a minimum, fill in “At least” too. The presets cover common ones such as passport photos and signatures.',
  },
  {
    q: 'Can it read the text in a photo or a scanned PDF?',
    a: 'That happens in the KonPDF Android app, right on your phone, together with the document scanner. The website does everything else: converting, resizing, enhancing and PDF tools.',
  },
  {
    q: 'Who is NW?',
    a: 'NW is KonPDF’s assistant. Tell it what you need in plain words, in English, Hindi, Hinglish, Spanish, French, German or Portuguese, and it sets up the steps for you to run with one click. It only sees your files’ names and sizes, never what is inside.',
  },
];

export function Home() {
  return (
    <>
      <section className="hero">
        <p className="kicker">Free online file tools</p>
        <h1>
          Convert anything.
          <br />
          <em>Resize</em> everything.
        </h1>
        <p className="lead">
          Turn photos into PDFs, PDFs into Word, shrink an image to the exact KB a form asks for, clean up scans, and
          merge, split, compress or lock PDFs. No sign-up, nothing to install.
        </p>
        <div className="row">
          <a className="btn btn-primary" href="/convert">
            <Icon name="convert" size={20} />
            <span>Convert a file</span>
          </a>
          <a className="btn btn-secondary" href="/nw">
            <Icon name="chat" size={20} />
            <span>Just ask NW</span>
          </a>
        </div>
      </section>

      {SECTIONS.map(section => (
        <section key={section.title} className="block">
          <h2 className="label">{section.title}</h2>
          <div className="tiles">
            {section.tools.map(tool => (
              <a key={tool.id} className="tile" href={tool.href}>
                <span className="tile-icon" style={{ background: FAMILY_COLOR[tool.family] }}>
                  <Icon name={tool.icon} />
                </span>
                <strong>{tool.title}</strong>
                <span className="muted">{tool.subtitle}</span>
              </a>
            ))}
          </div>
        </section>
      ))}

      <section className="block nw-promo card">
        <div>
          <p className="kicker">Meet NW</p>
          <h2>Say it in your own words.</h2>
          <p>
            “Make this photo under 50 KB”, “isko PDF bana do”, “merge these and add page numbers”. NW understands
            plain requests in seven languages and turns them into steps you run with one click.
          </p>
        </div>
        <a className="btn btn-primary" href="/nw">
          <Icon name="chat" size={20} />
          <span>Open NW</span>
        </a>
      </section>

      <section className="block">
        <h2 className="label">How it works</h2>
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card">
              <span className="step-no mono">{String(i + 1).padStart(2, '0')}</span>
              <strong>{s.title}</strong>
              <p className="muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="block app-promo card">
        <Icon name="phone" size={36} />
        <div>
          <h2>Scan and read text on your phone</h2>
          <p>
            The KonPDF Android app adds a document scanner and reads the words on photos and scans, right on the phone. Everything
            else from this website is in there too.
          </p>
        </div>
        <a className="btn btn-secondary" href="/download">
          <span>Get the app</span>
          <Icon name="arrow" size={20} />
        </a>
      </section>

      <section className="block">
        <h2 className="label">Questions</h2>
        <div className="faq">
          {FAQ.map(item => (
            <details key={item.q} className="card">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
