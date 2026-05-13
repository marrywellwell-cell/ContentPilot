import { MetricCard } from "@/components/MetricCard";
import { ContentSetCard } from "@/components/ContentSetCard";
import { FileText, Calendar, TrendingUp, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ContentSet } from "@shared/schema";

export default function Dashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: contentSets = [], isLoading } = useQuery<ContentSet[]>({
    queryKey: ["/api/content-sets"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/content-sets/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-sets"] });
      toast({
        title: "콘텐츠 삭제 완료",
        description: "콘텐츠가 성공적으로 삭제되었습니다.",
      });
    },
  });

  const recentContent = contentSets.slice(0, 6);
  const scheduledCount = contentSets.filter((c) => c.status === "scheduled").length;
  const publishedCount = contentSets.filter((c) => c.status === "published").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold" data-testid="text-page-title">
          대시보드
        </h1>
        <p className="text-muted-foreground mt-1">
          콘텐츠 성과 개요
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="전체 콘텐츠"
          value={contentSets.length}
          icon={FileText}
          trend={{ value: 12, isPositive: true }}
          description="전월 대비"
        />
        <MetricCard
          title="예약됨"
          value={scheduledCount}
          icon={Calendar}
          trend={{ value: 8, isPositive: true }}
          description="이번 주"
        />
        <MetricCard
          title="발행됨"
          value={publishedCount}
          icon={TrendingUp}
          trend={{ value: 15, isPositive: true }}
          description="지난주 대비"
        />
        <MetricCard
          title="총 조회수"
          value="45.2K"
          icon={Eye}
          trend={{ value: 3, isPositive: false }}
          description="전월 대비"
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">최근 콘텐츠</h2>
          <Link href="/calendar">
            <Button variant="outline" data-testid="button-view-all">
              전체 보기
            </Button>
          </Link>
        </div>
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            로딩 중...
          </div>
        ) : recentContent.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentContent.map((content) => (
              <ContentSetCard
                key={content.id}
                id={content.id}
                keyword={content.keyword}
                platforms={content.platforms || []}
                scheduledDate={content.scheduledDate ? new Date(content.scheduledDate) : undefined}
                status={content.status as any}
                imageUrl={content.instagramImageUrls?.[0] || content.blogImageUrls?.[0] || undefined}
                blogTitle={content.blogTitle || undefined}
                onEdit={() => setLocation(`/edit/${content.id}`)}
                onDelete={() => deleteMutation.mutate(content.id)}
                onSchedule={() => console.log("Schedule", content.id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p className="mb-4">콘텐츠가 없습니다. 지금 생성해보세요!</p>
            <Link href="/generate">
              <Button data-testid="button-create-first">
                첫 콘텐츠 만들기
              </Button>
            </Link>
          </div>
        )}
      </div>

      {recentContent.length > 0 && (
        <div className="flex items-center justify-center py-8">
          <Link href="/generate">
            <Button size="lg" data-testid="button-create-content">
              새 콘텐츠 만들기
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
