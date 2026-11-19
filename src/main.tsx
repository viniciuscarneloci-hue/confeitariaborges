import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MenuApp } from './menu/MenuApp'
import { PanelApp } from './panel/PanelApp'
import './styles.css'

/** Rota discreta: o painel fica em #painel e não tem link no cardápio. */
function App() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => { const f = () => setHash(location.hash); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f) }, [])
  return hash === '#painel' ? <PanelApp /> : <MenuApp />
}
createRoot(document.getElementById('root')!).render(<App />)
