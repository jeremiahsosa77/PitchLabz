import { Hub } from "../../../components/hub";
export default async function Page({
  params,
}: {
  params: Promise<{ segments?: string[] }>;
}) {
  return <Hub segments={(await params).segments} />;
}
