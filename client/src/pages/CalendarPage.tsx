import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Instagram, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, isSameDay } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import type { ContentSet } from "@shared/schema";

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data: contentSets = [] } = useQuery<ContentSet[]>({
    queryKey: ["/api/content-sets"],
  });

  const scheduledContent = contentSets.filter((c) => c.scheduledDate && c.status === "scheduled");

  const contentOnSelectedDate = scheduledContent.filter(
    (content) => selectedDate && content.scheduledDate && isSameDay(new Date(content.scheduledDate), selectedDate)
  );

  const hasContentOnDate = (date: Date) => {
    return scheduledContent.some(
      (content) => content.scheduledDate && isSameDay(new Date(content.scheduledDate), date)
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold" data-testid="text-page-title">
          콘텐츠 캘린더
        </h1>
        <p className="text-muted-foreground mt-1">
          콘텐츠 게시물 스케줄 관리
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle>{format(currentMonth, "MMMM yyyy")}</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setCurrentMonth(
                      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
                    )
                  }
                  data-testid="button-prev-month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setCurrentMonth(
                      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
                    )
                  }
                  data-testid="button-next-month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                className="w-full"
                modifiers={{
                  hasContent: (date) => hasContentOnDate(date),
                }}
                modifiersStyles={{
                  hasContent: {
                    fontWeight: "bold",
                    backgroundColor: "hsl(var(--primary) / 0.1)",
                  },
                }}
                data-testid="calendar-main"
              />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedDate
                  ? format(selectedDate, "yyyy년 M월 d일", { locale: undefined })
                  : "날짜를 선택하세요"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {contentOnSelectedDate.length > 0 ? (
                contentOnSelectedDate.map((content) => (
                  <div
                    key={content.id}
                    className="space-y-2 p-3 rounded-md border"
                    data-testid={`content-item-${content.id}`}
                  >
                    <div className="font-medium">{content.keyword}</div>
                    {content.scheduledDate && (
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(content.scheduledDate), "h:mm a")}
                      </div>
                    )}
                    <div className="flex gap-2">
                      {content.platforms?.includes("instagram") && (
                        <Badge variant="secondary">
                          <Instagram className="mr-1 h-3 w-3" />
                          Instagram
                        </Badge>
                      )}
                      {content.platforms?.includes("blog") && (
                        <Badge variant="secondary">
                          <FileText className="mr-1 h-3 w-3" />
                          Blog
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>이 날짜에 예약된 콘텐츠가 없습니다</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
