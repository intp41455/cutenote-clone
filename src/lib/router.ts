import { useState, useEffect } from 'react';

export type Route =
  | { page: 'home' }
  | { page: 'explore' }
  | { page: 'pricing' }
  | { page: 'ai-skill' }
  | { page: 'my-notes' }
  | { page: 'new-note' }
  | { page: 'edit-note'; id: string }
  | { page: 'note'; id: string };

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, '');
  if (h.startsWith('/edit/')) return { page: 'edit-note', id: decodeURIComponent(h.slice('/edit/'.length)) };
  if (h.startsWith('/notes/')) return { page: 'note', id: decodeURIComponent(h.slice('/notes/'.length)) };
  if (h === '/new-note') return { page: 'new-note' };
  if (h === '/my-notes') return { page: 'my-notes' };
  if (h === '/explore') return { page: 'explore' };
  if (h === '/pricing') return { page: 'pricing' };
  if (h === '/ai-skill') return { page: 'ai-skill' };
  return { page: 'home' };
}

export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (r: Route) => {
    const target =
      r.page === 'note' ? `#/notes/${r.id}` :
      r.page === 'edit-note' ? `#/edit/${r.id}` :
      r.page === 'home' ? '#/' : `#/${r.page}`;
    if (window.location.hash === target) {
      setRoute(r);
    } else {
      window.location.hash = target;
    }
  };

  return [route, navigate];
}
