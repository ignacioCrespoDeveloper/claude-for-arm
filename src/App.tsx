import { useEffect, useState } from 'react';
import Home from './Home';
import ProductBuilder from './ProductBuilder';
import SkillDoc from './SkillDoc';
import Guide from './Guide';
import { APPS } from './data/tools';

/**
 * Hash routing rather than a router library: the app is static, and `#/product-builder`
 * survives a refresh and a copy-pasted link without needing any server rewrite rules.
 */
function useRoute() {
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || '/');
  useEffect(() => {
    const onChange = () => setRoute(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

const go = (route: string) => {
  window.location.hash = route;
  window.scrollTo(0, 0);
};

export default function App() {
  const route = useRoute();

  if (route === APPS[0].route) return <ProductBuilder go={go} />;

  if (route === '/install') return <Guide go={go} />;

  if (route.startsWith('/skills/')) {
    return <SkillDoc command={route.slice('/skills/'.length)} go={go} />;
  }

  return <Home go={go} />;
}
