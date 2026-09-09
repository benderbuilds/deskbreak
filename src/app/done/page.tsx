import { DoneView } from "@/components/DoneView";

export default async function DonePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <DoneView nextPaywall={next === "paywall"} />;
}
