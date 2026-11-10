import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { listCategories } from "@/lib/data/categories";
import { getDb } from "@/lib/db/client";
import { AddCategory, CategoryRow } from "./category-forms";

export default function CategoriesPage() {
  const categories = listCategories(getDb());
  return (
    <>
      <PageHeader
        title="Categories"
        description="Shared by every country. A category in use by channels cannot be deleted."
        actions={<AddCategory />}
      />
      <Card className="max-w-2xl">
        <CardContent className="divide-y p-0">
          {categories.map((c, i) => (
            <CategoryRow key={c.id} category={c} first={i === 0} last={i === categories.length - 1} />
          ))}
        </CardContent>
      </Card>
    </>
  );
}
