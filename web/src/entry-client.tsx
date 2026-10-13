import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { Layout } from './components/Layout';
import { findRoute } from './routes';
import './styles.css';

const route = findRoute(window.location.pathname);
const app = (
  <StrictMode>
    <Layout path={route.path}>{route.render()}</Layout>
  </StrictMode>
);
const root = document.getElementById('root')!;
// Built pages arrive pre-rendered; the dev server sends an empty shell.
if (root.firstElementChild) {
  hydrateRoot(root, app);
} else {
  document.title = route.title;
  createRoot(root).render(app);
}
