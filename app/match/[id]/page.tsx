import MatchScreen from "@/components/MatchScreen";

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MatchScreen fixtureId={Number(id)} />;
}
