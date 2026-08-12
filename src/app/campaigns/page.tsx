import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDefaultCampaignId } from "@/lib/queries";

/**
 * The header's "Campaign" link has no campaign id of its own, so it lands here
 * and forwards to the most relevant one: an active campaign the user is in,
 * failing that any active campaign, failing that anything at all.
 */
export default async function CampaignIndexPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const id = await getDefaultCampaignId(user.id);
  redirect(id ? `/campaigns/${id}` : "/");
}
