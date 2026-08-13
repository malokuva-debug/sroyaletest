import { cookies } from "next/headers";
import LandingPageView from "@/components/landing-page-view";
import { getPublishedContent, getDraftContent } from "@/lib/site-content-server";

// Always fetch fresh content — publishing from /editor should show up
// immediately without a redeploy.
export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const sp = await searchParams;
  let content;

  if (sp.preview === "1") {
    // Draft preview is only ever shown to someone holding a valid editor
    // session cookie — everyone else on ?preview=1 just sees the live site.
    const cookieStore = await cookies();
    const auth = cookieStore.get("editor_auth")?.value;
    content = auth && auth === process.env.EDITOR_PASSCODE ? await getDraftContent() : await getPublishedContent();
  } else {
    content = await getPublishedContent();
  }

  return <LandingPageView content={content} />;
}
