import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

export const GET = async () => {
  const { organizationId } = await withAuth({ ensureSignedIn: true });

  if (organizationId) {
    redirect(`/orgs/${organizationId}`);
  }

  redirect("/");
};
