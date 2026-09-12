import Link from "next/link";
export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="Pitch Lab Athletics home">
      <span className="brand-mark">P</span>
      <span>
        PITCH<span className="brand-light">LAB</span>
        <small>ATHLETICS</small>
      </span>
    </Link>
  );
}
