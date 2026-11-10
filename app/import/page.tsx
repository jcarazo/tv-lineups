import { PageHeader } from "@/components/page-header";
import { ISO_COUNTRIES } from "@/lib/iso-countries";
import { ImportWizard } from "./import-wizard";

export default function ImportPage() {
  return (
    <>
      <PageHeader
        title="Import"
        description="Load a JSON file to add channels to a country, and optionally create a lineup from it. Channels are matched to existing ones by name."
      />
      <ImportWizard countries={ISO_COUNTRIES} />
    </>
  );
}
