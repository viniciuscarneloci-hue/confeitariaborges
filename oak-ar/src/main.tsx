import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MenuApp } from './menu/MenuApp'
import { AdminApp } from './admin/AdminApp'
import { useDB } from './data/db'
import { Icon } from './ui/Icon'
import './styles.css'

/**
 * Rotas (hash, para funcionar em qualquer hospedagem estática):
 *   #/                 apresentação da demonstração
 *   #/r/<slug>?mesa=12 cardápio do cliente (um link/QR por restaurante)
 *   #/admin            painel do dono
 */
function useHash() {
  const [h, setH] = useState(location.hash)
  useEffect(() => { const f = () => { setH(location.hash); window.scrollTo(0, 0) }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  return h
}

function App() {
  const h = useHash().replace(/^#/, '') || '/'
  const [path, qs] = h.split('?')
  const params = new URLSearchParams(qs)
  const m = path.match(/^\/r\/([^/]+)/)
  if (m) return <MenuApp slug={decodeURIComponent(m[1])} table={params.get('mesa') ?? undefined} />
  if (path.startsWith('/admin')) return <AdminApp />
  return <Home />
}

function Home() {
  const data = useDB()
  useEffect(() => { document.title = 'Oak AR · Cardápio em realidade aumentada' }, [])
  return (
    <div className="home">
      <header><span className="brand"><span className="brand-mark">◆</span> Oak AR</span></header>
      <section className="home-hero">
        <h1>O prato na mesa do cliente, antes do pedido.</h1>
        <p>Cardápio digital com pratos em 3D e realidade aumentada no navegador, sem instalar nada. O restaurante escaneia o prato com o celular e publica em minutos.</p>
      </section>
      <div className="home-grid">
        <div className="home-card">
          <Icon name="bag" size={26} />
          <h2>Tela do cliente</h2>
          <p>Abra pelo celular para ver os pratos em tamanho real sobre a mesa.</p>
          {data.restaurants.map((r) => <a key={r.id} className="btn block" href={`#/r/${r.slug}?mesa=7`}>{r.name}<small>{r.cuisine}</small></a>)}
        </div>
        <div className="home-card">
          <Icon name="cube" size={26} />
          <h2>Painel do restaurante</h2>
          <p>Cadastre pratos, crie o 3D a partir do scan e acompanhe o desempenho.</p>
          <a className="btn primary block" href="#/admin">Abrir o painel</a>
        </div>
      </div>
      <p className="muted center small">Protótipo de demonstração. Os dados ficam salvos neste navegador.</p>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
