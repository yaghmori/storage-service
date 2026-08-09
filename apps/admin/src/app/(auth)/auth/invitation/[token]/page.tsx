import { AcceptInviteView } from "@/features/members/components/accept-invite-view";

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <AcceptInviteView token={token} />;
}
