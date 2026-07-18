import MatchScreen from "@/components/MatchScreen";

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ replay?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  return <MatchScreen fixtureId={Number(id)} autoReplay={sp.replay === "1"} />;
}
