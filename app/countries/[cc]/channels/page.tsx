import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { listCategories } from "@/lib/data/categories";
import { listChannels } from "@/lib/data/channels";
import { getDb } from "@/lib/db/client";
import { ChannelTable } from "./channel-table";
import { CheckLogosButton } from "@/components/check-logos-button";

export default async function ChannelsPage(props: PageProps<"/countries/[cc]/channels">) {
  const { cc } = await props.params;
  const code = cc.toUpperCase();
  const db = getDb();
  const channels = listChannels(db, code);

  return (
    <>
      <PageHeader
        title="Channels"
        description="Channels belong to this country only. Lineups pick from this list."
        actions={
          <>
            <CheckLogosButton scope={{ countryCode: code }} label="Check all logos" />
            <Link href={`/countries/${cc}/channels/new`} className={buttonVariants()}>
              New channel
            </Link>
          </>
        }
      />
      <ChannelTable cc={cc} channels={channels} categories={listCategories(db).map((c) => c.name)} />
    </>
  );
}
