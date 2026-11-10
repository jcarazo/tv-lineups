import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckLogosButton } from "@/components/check-logos-button";
import { DeleteChannelButton } from "@/components/delete-channel-button";
import { PageHeader } from "@/components/page-header";
import { FlagBadge, IssuesBadge, LogoStatusBadge } from "@/components/status-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listCategories } from "@/lib/data/categories";
import { channelUsage, getChannel } from "@/lib/data/channels";
import { getDb } from "@/lib/db/client";
import { ChannelForm } from "../channel-form";
import { LogoFlagForm } from "./logo-flag-form";

export default async function EditChannelPage(props: PageProps<"/countries/[cc]/channels/[id]">) {
  const { cc, id } = await props.params;
  const db = getDb();
  const channel = getChannel(db, Number(id));
  if (!channel || channel.countryCode !== cc.toUpperCase()) notFound();
  const usage = channelUsage(db, channel.id);

  return (
    <>
      <PageHeader
        title={channel.name}
        description={
          <span className="flex flex-wrap gap-1">
            <LogoStatusBadge status={channel.logoStatus} error={channel.logoError} checkedAt={channel.logoCheckedAt} />
            <FlagBadge flagged={channel.logoFlagged} note={channel.logoFlagNote} />
            <IssuesBadge issues={channel.issues} />
          </span>
        }
        actions={<DeleteChannelButton id={channel.id} name={channel.name} iconOnly={false} />}
      />
      {channel.issues.length > 0 && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          <strong>Incomplete:</strong> {channel.issues.join(", ")}. Lineups that contain this channel can&apos;t be exported until it is fixed.
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <ChannelForm
          // Remount after save so the form shows the normalized values.
          key={channel.updatedAt.getTime()}
          cc={cc}
          channelId={channel.id}
          initial={{
            name: channel.name,
            logo: channel.logo ?? "",
            keywords: channel.keywords,
            epgIds: channel.epgIds,
            categoryId: channel.categoryId ? String(channel.categoryId) : "",
          }}
          categories={listCategories(db)}
        />
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Logo check</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-muted-foreground">Status</dt>
                <dd>{channel.logoStatus}</dd>
                <dt className="text-muted-foreground">HTTP</dt>
                <dd>{channel.logoHttpStatus ?? "—"}</dd>
                <dt className="text-muted-foreground">Type</dt>
                <dd className="truncate">{channel.logoContentType ?? "—"}</dd>
                <dt className="text-muted-foreground">Error</dt>
                <dd className="break-words">{channel.logoError ?? "—"}</dd>
                <dt className="text-muted-foreground">Checked</dt>
                <dd>{channel.logoCheckedAt?.toLocaleString() ?? "never"}</dd>
              </dl>
              <CheckLogosButton scope={{ channelId: channel.id }} label="Re-check now" size="sm" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Manual review</CardTitle>
            </CardHeader>
            <CardContent>
              <LogoFlagForm id={channel.id} flagged={channel.logoFlagged} note={channel.logoFlagNote} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Used in {usage.length} lineup(s)</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {usage.length === 0 ? (
                <p className="text-muted-foreground">Not in any lineup yet.</p>
              ) : (
                <ul className="space-y-1">
                  {usage.map((u) => (
                    <li key={u.lineupId} className="flex justify-between">
                      <Link className="hover:underline" href={`/countries/${cc}/lineups/${u.slug}`}>{u.lineupName}</Link>
                      <span className="text-muted-foreground">dial {u.dial}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
