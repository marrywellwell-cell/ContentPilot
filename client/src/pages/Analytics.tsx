import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Heart,
  MessageCircle,
  Eye,
  TrendingUp,
  Instagram,
  FileText,
} from "lucide-react";

export default function Analytics() {
  //todo: remove mock functionality
  const topContent = [
    {
      id: 1,
      title: "건강한 아침 식사 레시피",
      views: 12500,
      engagement: 8.2,
      platform: "instagram",
    },
    {
      id: 2,
      title: "기업가를 위한 생산성 팁",
      views: 9800,
      engagement: 6.5,
      platform: "blog",
    },
    {
      id: 3,
      title: "아침 운동 루틴",
      views: 8200,
      engagement: 7.8,
      platform: "instagram",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold" data-testid="text-page-title">
          분석
        </h1>
        <p className="text-muted-foreground mt-1">
          콘텐츠 성과 및 참여도 추적
        </p>
      </div>

      <Tabs defaultValue="all" className="space-y-6">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">
            전체 플랫폼
          </TabsTrigger>
          <TabsTrigger value="instagram" data-testid="tab-instagram">
            <Instagram className="mr-2 h-4 w-4" />
            인스타그램
          </TabsTrigger>
          <TabsTrigger value="blog" data-testid="tab-blog">
            <FileText className="mr-2 h-4 w-4" />
            블로그
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="총 조회수"
              value="45.2K"
              icon={Eye}
              trend={{ value: 12, isPositive: true }}
              description="전월 대비"
            />
            <MetricCard
              title="참여도"
              value="4.8%"
              icon={TrendingUp}
              trend={{ value: 15, isPositive: true }}
              description="전월 대비"
            />
            <MetricCard
              title="좋아요"
              value="8.5K"
              icon={Heart}
              trend={{ value: 8, isPositive: true }}
              description="전월 대비"
            />
            <MetricCard
              title="댓글"
              value="1.2K"
              icon={MessageCircle}
              trend={{ value: 5, isPositive: false }}
              description="전월 대비"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>인기 콘텐츠</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topContent.map((content) => (
                  <div
                    key={content.id}
                    className="flex items-center justify-between p-4 rounded-md border hover-elevate"
                    data-testid={`content-rank-${content.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                        {content.id}
                      </div>
                      <div>
                        <div className="font-medium">{content.title}</div>
                        <div className="flex items-center gap-2 mt-1">
                          {content.platform === "instagram" ? (
                            <Instagram className="h-3 w-3 text-muted-foreground" />
                          ) : (
                            <FileText className="h-3 w-3 text-muted-foreground" />
                          )}
                          <span className="text-sm text-muted-foreground capitalize">
                            {content.platform}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {content.views.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        참여도 {content.engagement}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="instagram" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="도달"
              value="28.5K"
              icon={Eye}
              trend={{ value: 18, isPositive: true }}
              description="전월 대비"
            />
            <MetricCard
              title="참여율"
              value="5.2%"
              icon={TrendingUp}
              trend={{ value: 12, isPositive: true }}
              description="전월 대비"
            />
            <MetricCard
              title="좋아요"
              value="8.5K"
              icon={Heart}
              trend={{ value: 8, isPositive: true }}
              description="전월 대비"
            />
            <MetricCard
              title="저장"
              value="2.1K"
              icon={MessageCircle}
              trend={{ value: 25, isPositive: true }}
              description="전월 대비"
            />
          </div>
        </TabsContent>

        <TabsContent value="blog" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="페이지 조회수"
              value="16.7K"
              icon={Eye}
              trend={{ value: 8, isPositive: true }}
              description="전월 대비"
            />
            <MetricCard
              title="평균 체류 시간"
              value="3분 24초"
              icon={TrendingUp}
              trend={{ value: 5, isPositive: true }}
              description="전월 대비"
            />
            <MetricCard
              title="이탈률"
              value="42%"
              icon={Heart}
              trend={{ value: 3, isPositive: false }}
              description="전월 대비"
            />
            <MetricCard
              title="댓글"
              value="1.2K"
              icon={MessageCircle}
              trend={{ value: 12, isPositive: true }}
              description="전월 대비"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
