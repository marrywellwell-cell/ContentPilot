import { useState } from "react";
import { ScheduleDialog } from "../ScheduleDialog";
import { Button } from "@/components/ui/button";

export default function ScheduleDialogExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-6">
      <Button onClick={() => setOpen(true)}>Open Schedule Dialog</Button>
      <ScheduleDialog
        open={open}
        onOpenChange={setOpen}
        platforms={["instagram", "blog"]}
        onSchedule={(date, platforms) => {
          console.log("Scheduled:", { date, platforms });
        }}
      />
    </div>
  );
}
