import { marked } from 'marked';

/** A page written in Markdown (privacy policies, terms, about). */
export function Doc({ markdown }: { markdown: string }) {
  return <article className="doc" dangerouslySetInnerHTML={{ __html: marked.parse(markdown, { async: false }) }} />;
}

export function NotFound() {
  return (
    <header className="tool-head">
      <p className="kicker">404</p>
      <h1>This page isn’t here</h1>
      <p className="lead">
        It may have moved. Try the <a href="/">tools</a> or <a href="/nw">ask NW</a>.
      </p>
    </header>
  );
}
