import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSchedule: (date: Date, platforms: string[]) => void;
  platforms: string[];
}

export function ScheduleDialog({
  open,
  onOpenChange,
  onSchedule,
  platforms: availablePlatforms,
}: ScheduleDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState("09:00");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(availablePlatforms);

  const handleSchedule = () => {
    if (selectedDate) {
      const [hours, minutes] = time.split(":").map(Number);
      const scheduledDate = new Date(selectedDate);
      scheduledDate.setHours(hours, minutes);
      onSchedule(scheduledDate, selectedPlatforms);
      onOpenChange(false);
    }
  };

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>콘텐츠 예약</DialogTitle>
          <DialogDescription>
            콘텐츠를 발행할 날짜와 시간을 선택하세요
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>날짜 선택</Label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
              disabled={(date) => date < new Date()}
              data-testid="calendar-schedule"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="time">시간 선택</Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              data-testid="input-schedule-time"
            />
          </div>
          <div className="space-y-3">
            <Label>발행 플랫폼</Label>
            {availablePlatforms.includes("instagram") && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="schedule-instagram"
                  checked={selectedPlatforms.includes("instagram")}
                  onCheckedChange={() => togglePlatform("instagram")}
                  data-testid="checkbox-schedule-instagram"
                />
                <label htmlFor="schedule-instagram" className="text-sm font-medium">
                  Instagram
                </label>
              </div>
            )}
            {availablePlatforms.includes("blog") && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="schedule-blog"
                  checked={selectedPlatforms.includes("blog")}
                  onCheckedChange={() => togglePlatform("blog")}
                  data-testid="checkbox-schedule-blog"
                />
                <label htmlFor="schedule-blog" className="text-sm font-medium">
                  블로그
                </label>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-schedule">
            취소
          </Button>
          <Button
            onClick={handleSchedule}
            disabled={!selectedDate || selectedPlatforms.length === 0}
            data-testid="button-confirm-schedule"
          >
            예약하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
