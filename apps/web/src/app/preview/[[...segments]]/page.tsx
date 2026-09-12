import { Hub } from "../../../components/hub";
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
}: {
  params: Promise<{ segments?: string[] }>;
}) {
  const s = (await params).segments || [];
  return (
    <Hub
      demo
      coach={s[0] === "coach"}
      segments={s[0] === "coach" ? s.slice(1) : s}
    />
  );
}
