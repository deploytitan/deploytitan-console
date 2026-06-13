import { redirect } from "next/navigation";
import { syncAuthenticatedSessionToConvex } from "@/lib/console/session";

export const GET = async () => {
  const { organizationId } = await syncAuthenticatedSessionToConvex();

  if (organizationId) {
    redirect(`/orgs/${organizationId}`);
  }

  redirect("/onboarding");
};
