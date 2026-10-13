import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { Layout } from './components/Layout';
import { NOT_FOUND, ROUTES, type Route } from './routes';

/** Used at build time by scripts/prerender.mjs: one HTML page per route. */
export const pages = [...ROUTES, NOT_FOUND].map((route: Route) => ({
  path: route.path,
  title: route.title,
  description: route.description,
  html: renderToString(
    <StrictMode>
      <Layout path={route.path}>{route.render()}</Layout>
    </StrictMode>,
  ),
}));
