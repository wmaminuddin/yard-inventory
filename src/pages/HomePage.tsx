import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <div className="home">
      <h1>Finished goods yards</h1>
      <p className="lede">
        Scan cars IN/OUT at external yards, run stock take, and watch live stock on the office TV.
      </p>
      <div className="home-grid">
        <Link className="home-card" to="/scan">
          <strong>Scan IN / OUT</strong>
          <span>Phone camera · offline queue supported</span>
        </Link>
        <Link className="home-card" to="/stocktake">
          <strong>Stock take</strong>
          <span>Single or multi-person count + confirm</span>
        </Link>
        <Link className="home-card" to="/admin">
          <strong>Admin</strong>
          <span>Transactions, yards, CSV export</span>
        </Link>
        <Link className="home-card" to="/dashboard">
          <strong>TV dashboard</strong>
          <span>Stock level per yard</span>
        </Link>
      </div>
    </div>
  )
}
