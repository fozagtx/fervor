import MiniScore from "@/components/MiniScore";

export default async function MiniPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MiniScore fixtureId={Number(id)} />;
}
