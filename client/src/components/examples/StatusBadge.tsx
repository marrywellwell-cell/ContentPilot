import { StatusBadge } from "../StatusBadge";

export default function StatusBadgeExample() {
  return (
    <div className="flex flex-wrap gap-3 p-6">
      <StatusBadge status="draft" />
      <StatusBadge status="scheduled" />
      <StatusBadge status="publishing" />
      <StatusBadge status="published" />
      <StatusBadge status="failed" />
    </div>
  );
}
