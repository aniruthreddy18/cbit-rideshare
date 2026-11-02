/** Vertical "from -> to" route indicator used on ride cards. */
export default function RouteLine({ from, to }) {
  return (
    <div className="route-line">
      <div className="route-stop">
        <span className="route-dot route-dot-start" />
        <span className="route-text" title={from}>{from}</span>
      </div>
      <div className="route-stop">
        <span className="route-dot route-dot-end" />
        <span className="route-text" title={to}>{to}</span>
      </div>
    </div>
  );
}
