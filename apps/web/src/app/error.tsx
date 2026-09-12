"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="loading-page">
      <section className="panel">
        <h1>Let’s try that again.</h1>
        <p>
          This page could not load. Your saved coaching information is
          unchanged.
        </p>
        <button className="button" onClick={reset}>
          Try Again
        </button>
      </section>
    </main>
  );
}
