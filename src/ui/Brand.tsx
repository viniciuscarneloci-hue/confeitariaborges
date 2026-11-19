import logo from './logo-borges.jpg'
export function Brand({ sub }: { sub: string }) {
  return (
    <div className="brand">
      <img className="brand-logo" src={logo} alt="" width={42} height={42} />
      <span className="brand-words"><span className="brand-name">Confeitaria Borges</span><span className="brand-sub">{sub}</span></span>
    </div>
  )
}
