import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDefaultCampaignId } from "@/lib/queries";

/**
 * Forwards to the most relevant campaign: an active one the user is in, failing
 * that any active one, failing that anything at all.
 *
 * The header no longer sends anyone here — it resolves the same id server-side
 * and links straight to it, because a redirect costs a second round trip with
 * nothing to paint in between, which reads as a flash. This remains for typed
 * URLs and old bookmarks.
 */
export default async function CampaignIndexPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const id = await getDefaultCampaignId(user.id);
  redirect(id ? `/campaigns/${id}` : "/");
}
