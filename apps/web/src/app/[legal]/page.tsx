import { notFound } from "next/navigation";
import { Header } from "../../components/header";
import { Footer } from "../../components/marketing";
const pages: Record<string, { title: string; paragraphs: string[] }> = {
  privacy: {
    title: "Privacy Policy",
    paragraphs: [
      "Pitch Lab uses account, athlete, booking, and coaching information to provide coaching services. Parents control minor athlete profiles.",
      "Pitch Lab does not host pitching video files. Videos are sent directly through your own email or messaging provider. Stripe handles payment credentials.",
      "Before launch, this page must identify the business contact, data retention periods, deletion process, service providers, and applicable parent consent procedures.",
    ],
  },
  terms: {
    title: "Terms of Service",
    paragraphs: [
      "Pitch Lab provides private pitching coaching, throwing programming, and written feedback. Services are tied to a specific athlete.",
      "A parent or guardian owns the coaching relationship for minors. Athletes under 13 do not independently register.",
      "Final terms require review of participation consent, coaching scope, subscription renewal, dispute procedures, and business contact information.",
    ],
  },
  cancellation: {
    title: "Cancellation Policy",
    paragraphs: [
      "Draft launch policy: rescheduling at least 48 hours before a lesson is free. Later rescheduling requires a $10 fee.",
      "Cancelling a lesson requires a $10 administrative fee. The original training credit is restored with its original expiration. A no-show forfeits the scheduled credit.",
      "Fees are configurable. The application shows the required fee before checkout. A paid change that can no longer be fulfilled requires coach follow-up and fee resolution.",
    ],
  },
  refund: {
    title: "Refund Policy",
    paragraphs: [
      "Draft launch policy: completed coaching is normally non-refundable. Accidental duplicate payments can be reviewed for a refund.",
      "If Pitch Lab cancels, the coach may restore a credit or arrange a refund. Customer cancellation generally restores the underlying credit according to the cancellation policy.",
      "Contact details and the final exception and refund procedures must be approved before accepting real customers.",
    ],
  },
};
export function generateStaticParams() {
  return Object.keys(pages).map((legal) => ({ legal }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ legal: string }>;
}) {
  const { legal } = await params;
  const page = pages[legal];
  if (!page) notFound();
  return (
    <>
      <Header />
      <main id="main" className="legal-page">
        <p className="eyebrow">DRAFT · LEGAL REVIEW REQUIRED</p>
        <h1>{page.title}</h1>
        <p className="notice">
          This page is a development draft and has not been approved for
          production.
        </p>
        {page.paragraphs.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </main>
      <Footer />
    </>
  );
}
