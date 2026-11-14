import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Landing from './Landing.jsx';
import './styles.css';

function Root() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => { setHash(window.location.hash); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash.startsWith('#/demo') ? <App /> : <Landing />;
}

createRoot(document.getElementById('root')).render(<StrictMode><Root /></StrictMode>);
