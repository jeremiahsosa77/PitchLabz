import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="loading-page">
      <section className="panel">
        <h1>This page is off the field.</h1>
        <p>The page you’re looking for could not be found.</p>
        <Link className="button" href="/">
          Back to Pitch Lab
        </Link>
      </section>
    </main>
  );
}
