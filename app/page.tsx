import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const { user, organizationId } = await withAuth();

  if (user && organizationId) {
    redirect(`/orgs/${organizationId}`);
  }

  return (
    <main>
      <h1>Welcome</h1>
      <p>Please sign in to continue.</p>
      <a href="/login">Sign in</a>
      {" | "}
      <a href="/signup">Sign up</a>
    </main>
  );
}
