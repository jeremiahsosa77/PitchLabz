import { Header } from "../../components/header";
import {
  Programs,
  Closing,
  Footer,
  loadProducts,
} from "../../components/marketing";
export const metadata = {
  title: "Coaching Programs",
  alternates: { canonical: "/programs" },
};
export default async function Page() {
  return (
    <>
      <Header />
      <main id="main">
        <Programs products={await loadProducts()} />
        <section className="content-section">
          <h2>A coaching relationship with clarity.</h2>
          <p>
            Game-Day Coaching Support includes preparation, warm-up guidance,
            and feedback by arrangement. In-person game attendance is arranged
            separately.
          </p>
          <p>
            Premium provides four training credits each paid billing cycle. Each
            batch lasts through that cycle plus one additional billing cycle.
            Video feedback targets approximately 24 hours; weekends and holidays
            may affect turnaround.
          </p>
          <p>
            Rescheduling is free at least 48 hours before your session. Later
            changes have a configurable $10 launch fee. Cancellation has a $10
            launch fee and restores the original credit with its original
            expiration. No-shows forfeit the credit.
          </p>
        </section>
        <Closing />
      </main>
      <Footer />
    </>
  );
}
