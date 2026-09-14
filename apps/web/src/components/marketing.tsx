import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, ArrowUpRight } from "lucide-react";
import type { Product } from "@pitch/contracts";
import { catalog } from "@pitch/config";
import { Brand } from "./brand";
export async function loadProducts(): Promise<Product[]> {
  try {
    const response = await fetch(
      `${process.env.API_URL || "http://localhost:4000"}/api/v1/products`,
      { next: { revalidate: 60 }, signal: AbortSignal.timeout(2000) },
    );
    if (response.ok) return (await response.json()).data;
  } catch {
    /* A catalog preview is permitted only outside configured production. */
  }
  return process.env.NODE_ENV === "production" &&
    process.env.PITCH_PREVIEW_BUILD !== "1"
    ? []
    : catalog;
}
export function Coach() {
  return (
    <section className="coach-section" id="coach">
      <div className="coach-photo">
        <Image
          src="/coach-jacob.jpeg"
          alt="Coach Jacob Sosa"
          width={220}
          height={220}
        />
      </div>
      <div>
        <p className="eyebrow">MEET YOUR COACH</p>
        <h2>Coach Jacob Sosa</h2>
        <p>
          I want to give back by helping young athletes in our community build
          confidence, discipline, and healthier pitching habits. Every lesson
          uses a structured, data-informed approach to improve velocity,
          durability, command, and efficiency.
        </p>
        <p>
          Training combines plyo ball work, mobility, flat-ground progressions,
          mound work, live bullpens, and video analysis. Each athlete receives
          clear adjustments they can take into practice and games.
        </p>
        <div className="tags">
          <span>Plyo + mobility</span>
          <span>Command + bullpens</span>
          <span>Video analysis</span>
        </div>
      </div>
    </section>
  );
}
export function Programs({ products }: { products: Product[] }) {
  return (
    <section className="program-section" id="programs">
      <div className="section-title">
        <div>
          <p className="eyebrow">COACHING OPTIONS</p>
          <h2>Choose your development path.</h2>
        </div>
        <p>
          Individual coaching. A clear plan.
          <br />
          Progress that belongs to you.
        </p>
      </div>
      <div className="program-grid">
        {products.map((p) => (
          <article
            className={`product-card ${p.product_type === "premium" ? "premium" : ""}`}
            key={p.id}
          >
            {p.product_type === "premium" && (
              <div className="premium-ribbon">
                THE COMPLETE COACHING RELATIONSHIP
              </div>
            )}
            <p className="eyebrow">
              {p.product_type === "premium"
                ? "ONGOING DEVELOPMENT"
                : p.product_type === "video"
                  ? "TRAIN FROM ANYWHERE"
                  : "INDIVIDUAL COACHING"}
            </p>
            <h3>{p.name}</h3>
            <p className="product-description">{p.description}</p>
            <p className="price">
              ${p.price_cents / 100}
              <span>
                {" "}
                /{" "}
                {p.billing_interval === "month"
                  ? "month"
                  : p.product_type === "video"
                    ? "review"
                    : "session"}
              </span>
            </p>
            <ul>
              {p.benefits.map((b) => (
                <li key={b}>
                  <Check size={16} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <Link
              className={`button ${p.product_type === "premium" ? "light" : "outline"}`}
              href={`/app/billing?product=${p.id}`}
            >
              {p.full
                ? "Join Waitlist"
                : p.product_type === "premium"
                  ? "Join Premium"
                  : "Choose Program"}
              <ArrowUpRight size={16} />
            </Link>
          </article>
        ))}
      </div>
      {!products.length && (
        <p role="status">
          Programs are temporarily unavailable. Please check back shortly.
        </p>
      )}
      <div className="booking-info">
        <div>
          <strong>Local + remote</strong>
          <p>
            Training location will be coordinated with Coach Jacob after
            booking. Online sessions by arrangement.
          </p>
        </div>
        <div>
          <strong>Built around your athlete</strong>
          <p>
            Parents manage coaching for minors. Adult athletes can create their
            own account.
          </p>
        </div>
        <div>
          <strong>Know your next step</strong>
          <p>
            Purchase credits, then choose a time. Premium credits include one
            billing cycle of rollover.
          </p>
        </div>
      </div>
    </section>
  );
}
export function Footer() {
  return (
    <footer>
      <Brand />
      <p>Develop with intent. Compete with confidence.</p>
      <div>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/cancellation">Cancellation</Link>
        <Link href="/refund">Refunds</Link>
      </div>
      <small>© {new Date().getFullYear()} Pitch Lab Athletics</small>
    </footer>
  );
}
export function Closing() {
  return (
    <section className="closing">
      <p className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>
      <h2>
        Bring your goals.
        <br />
        Let’s get to work.
      </h2>
      <Link className="button light" href="/signup">
        Start Your Development <ArrowRight size={18} />
      </Link>
    </section>
  );
}
