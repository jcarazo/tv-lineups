import { PageHeader } from "@/components/page-header";
import { listCategories } from "@/lib/data/categories";
import { getDb } from "@/lib/db/client";
import { ChannelForm } from "../channel-form";

export default async function NewChannelPage(props: PageProps<"/countries/[cc]/channels/new">) {
  const { cc } = await props.params;
  return (
    <>
      <PageHeader title="New channel" description="All fields are required." />
      <ChannelForm
        cc={cc}
        channelId={null}
        initial={{ name: "", logo: "", keywords: [], epgIds: [], categoryId: "" }}
        categories={listCategories(getDb())}
      />
    </>
  );
}
