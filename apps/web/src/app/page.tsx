import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Header } from "../components/header";
import {
  Coach,
  Programs,
  Footer,
  Closing,
  loadProducts,
} from "../components/marketing";
export default async function Home() {
  const products = await loadProducts();
  return (
    <>
      <Header />
      <main id="main">
        <section className="hero">
          <div className="hero-content">
            <p className="eyebrow">
              <span />
              CORPUS CHRISTI PITCHING DEVELOPMENT
            </p>
            <h1>
              Build the pitcher you’re
              <br className="wide-break" /> capable of becoming.
            </h1>
            <p className="hero-copy">
              Individualized coaching. Intentional development.
              <br />
              Private lessons, throwing plans, and honest feedback
              <br className="wide-break" /> from Coach Jacob — built around you.
            </p>
            <div className="hero-actions">
              <Link className="button" href="/programs">
                View Coaching Plans <ArrowRight size={18} />
              </Link>
              <Link className="text-link" href="/app">
                Explore Athlete Hub <ArrowUpRight size={18} />
              </Link>
            </div>
            <div className="hero-stats">
              <div>
                <strong>1:1</strong>
                <span>Focused coaching</span>
              </div>
              <div>
                <strong>Every week</strong>
                <span>A plan with purpose</span>
              </div>
              <div>
                <strong>Local + remote</strong>
                <span>Flexible development</span>
              </div>
            </div>
          </div>
          <span className="hero-number" aria-hidden="true">
            90
          </span>
        </section>
        <section className="trust-strip">
          <p>
            PERSONAL COACHING.
            <br />
            <strong>REAL RELATIONSHIPS.</strong>
          </p>
          <p className="placeholder-label">
            PLACEHOLDER TESTIMONIAL
            <br />
            <span>
              Verified athlete and parent stories will appear here.
              <br />
              Replace with approved customer quotes before launch.
            </span>
          </p>
          <Link href="/about">
            Get to know Jacob <ArrowUpRight size={16} />
          </Link>
        </section>
        <Coach />
        <Programs products={products} />
        <Closing />
      </main>
      <Footer />
    </>
  );
}
