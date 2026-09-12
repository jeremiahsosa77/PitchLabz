import { Hub } from "../../../components/hub";
export default async function Page({
  params,
}: {
  params: Promise<{ segments?: string[] }>;
}) {
  return <Hub coach segments={(await params).segments} />;
}
