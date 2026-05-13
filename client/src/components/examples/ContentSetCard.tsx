import { ContentSetCard } from "../ContentSetCard";

export default function ContentSetCardExample() {
  return (
    <div className="grid gap-4 p-6 max-w-sm">
      <ContentSetCard
        id="1"
        keyword="Healthy Breakfast Recipes"
        platforms={["instagram", "blog"]}
        scheduledDate={new Date(2025, 0, 25, 9, 0)}
        status="scheduled"
        onEdit={() => console.log("Edit clicked")}
        onDelete={() => console.log("Delete clicked")}
        onSchedule={() => console.log("Schedule clicked")}
      />
      <ContentSetCard
        id="2"
        keyword="Digital Marketing Tips"
        platforms={["instagram"]}
        status="draft"
        onEdit={() => console.log("Edit clicked")}
        onDelete={() => console.log("Delete clicked")}
        onSchedule={() => console.log("Schedule clicked")}
      />
    </div>
  );
}
