import { PaywallSuccessView } from "@/components/PaywallSuccessView";

export default async function PaywallSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId = null } = await searchParams;
  return <PaywallSuccessView sessionId={sessionId} />;
}
