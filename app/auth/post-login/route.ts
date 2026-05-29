import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

async function syncWorkosData(accessToken: string | undefined): Promise<void> {
  if (!accessToken) return;

  const headers = { Authorization: `Bearer ${accessToken}` };
  const origin = process.env.NEXT_PUBLIC_API_URL ?? "";

  await Promise.allSettled([
    fetch(`${origin}/auth/sync-session`, {
      method: "POST",
      headers,
      cache: "no-store",
    }),
    fetch(`${origin}/orgs/sync`, {
      method: "POST",
      headers,
      cache: "no-store",
    }),
  ]);
}

export const GET = async () => {
  const { accessToken, organizationId } = await withAuth({
    ensureSignedIn: true,
  });

  await syncWorkosData(accessToken);

  if (organizationId) {
    redirect(`/orgs/${organizationId}`);
  }

  redirect("/");
};
