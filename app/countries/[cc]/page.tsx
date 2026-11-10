import { redirect } from "next/navigation";

export default async function CountryPage(props: PageProps<"/countries/[cc]">) {
  const { cc } = await props.params;
  redirect(`/countries/${cc.toLowerCase()}/lineups`);
}
