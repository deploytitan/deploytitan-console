import { handleAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

export const GET = handleAuth({
  onSuccess(params) {
    const orgId = params.organizationId;
    if (!orgId) return redirect("/overview");
    return redirect(`/orgs/${orgId}`);
  },
});
