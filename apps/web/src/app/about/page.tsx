import { Header } from "../../components/header";
import { Coach, Closing, Footer } from "../../components/marketing";
export const metadata = {
  title: "Meet Coach Jacob",
  alternates: { canonical: "/about" },
};
export default function Page() {
  return (
    <>
      <Header />
      <main id="main">
        <div className="page-intro">
          <p className="eyebrow">PITCH LAB ATHLETICS</p>
          <h1>
            Coaching with purpose.
            <br />
            Development with intent.
          </h1>
          <p>A personal approach to pitching development in Corpus Christi.</p>
        </div>
        <Coach />
        <section className="content-section">
          <h2>Build the habits behind the results.</h2>
          <p>
            Every athlete starts in a different place. Jacob’s approach combines
            movement, command work, and honest feedback into a plan an athlete
            can understand and take onto the field.
          </p>
          <div className="three-grid">
            <article>
              <span className="step-number">01</span>
              <h3>Understand</h3>
              <p>
                Begin with your goals, current mechanics, and the areas you want
                to develop.
              </p>
            </article>
            <article>
              <span className="step-number">02</span>
              <h3>Build</h3>
              <p>
                Train with purposeful drills, individualized throwing work, and
                clear adjustments.
              </p>
            </article>
            <article>
              <span className="step-number">03</span>
              <h3>Refine</h3>
              <p>
                Review progress with your coach and give the next session a
                clear direction.
              </p>
            </article>
          </div>
        </section>
        <Closing />
      </main>
      <Footer />
    </>
  );
}
