import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, CalendarDays, Trash2, Sparkles, Instagram, FileText, ChevronLeft, ChevronRight, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { MonthlyPlan, BrandAnalysis, ContentItem } from "@shared/schema";
import { useLocation } from "wouter";

const MONTHS = [
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"
];

const CONTENT_TYPE_COLORS: Record<string, string> = {
  "정보형": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "스토리형": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "프로모션": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "트렌드": "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  "교육": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "Q&A": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
};

export default function MonthlyPlanPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((currentDate.getMonth() + 1).toString());
  const [focusTopics, setFocusTopics] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState<string | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: plans = [], isLoading: plansLoading } = useQuery<MonthlyPlan[]>({
    queryKey: ["/api/monthly-plans"],
  });

  const { data: brandAnalyses = [] } = useQuery<BrandAnalysis[]>({
    queryKey: ["/api/brand-analyses"],
  });

  const generateMutation = useMutation({
    mutationFn: async (data: { year: string; month: string; brandAnalysisId?: string; focusTopics?: string }) => {
      return apiRequest("/api/monthly-plans/generate", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monthly-plans"] });
      toast({
        title: "플랜 생성 완료",
        description: "월간 콘텐츠 플랜이 생성되었습니다.",
      });
      setIsGenerating(false);
    },
    onError: (error: Error) => {
      toast({
        title: "플랜 생성 실패",
        description: error.message,
        variant: "destructive",
      });
      setIsGenerating(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/monthly-plans/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monthly-plans"] });
      toast({
        title: "삭제 완료",
        description: "플랜이 삭제되었습니다.",
      });
    },
  });

  const handleGenerate = () => {
    setIsGenerating(true);
    generateMutation.mutate({
      year: selectedYear,
      month: selectedMonth,
      brandAnalysisId: selectedBrandId,
      focusTopics: focusTopics || undefined,
    });
  };

  const handleContentClick = (topic: string) => {
    navigate(`/?keyword=${encodeURIComponent(topic)}`);
  };

  const currentPlan = plans.find(
    (p) => p.year === selectedYear && p.month === selectedMonth
  );

  const goToPreviousMonth = () => {
    let year = parseInt(selectedYear);
    let month = parseInt(selectedMonth);
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    setSelectedYear(year.toString());
    setSelectedMonth(month.toString());
  };

  const goToNextMonth = () => {
    let year = parseInt(selectedYear);
    let month = parseInt(selectedMonth);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    setSelectedYear(year.toString());
    setSelectedMonth(month.toString());
  };

  const contentItems = currentPlan?.contentItems as ContentItem[] | undefined;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">월간 콘텐츠 플랜</h1>
          <p className="text-muted-foreground mt-1">
            AI가 한 달치 콘텐츠 계획을 자동으로 생성합니다
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5" />
            플랜 생성
          </CardTitle>
          <CardDescription>
            년월을 선택하고 AI가 콘텐츠 플랜을 생성하도록 하세요
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>년도</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger data-testid="select-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[currentDate.getFullYear() - 1, currentDate.getFullYear(), currentDate.getFullYear() + 1].map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}년
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>월</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger data-testid="select-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month) => (
                    <SelectItem key={month} value={month}>
                      {month}월
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>브랜드 (선택)</Label>
              <Select value={selectedBrandId || "none"} onValueChange={(v) => setSelectedBrandId(v === "none" ? undefined : v)}>
                <SelectTrigger data-testid="select-brand">
                  <SelectValue placeholder="브랜드 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">브랜드 선택 안함</SelectItem>
                  {brandAnalyses.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.brandName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>집중 주제/키워드 (선택)</Label>
            <Textarea
              placeholder="이번 달에 집중할 주제나 키워드를 입력하세요 (예: 겨울 시즌, 신제품 출시, 할인 이벤트)"
              value={focusTopics}
              onChange={(e) => setFocusTopics(e.target.value)}
              rows={2}
              data-testid="input-focus-topics"
            />
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full"
            data-testid="button-generate-plan"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                플랜 생성 중...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                AI로 월간 플랜 생성
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              {selectedYear}년 {selectedMonth}월 플랜
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={goToPreviousMonth} data-testid="button-prev-month">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={goToNextMonth} data-testid="button-next-month">
                <ChevronRight className="w-4 h-4" />
              </Button>
              {currentPlan && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteMutation.mutate(currentPlan.id)}
                  data-testid="button-delete-plan"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  삭제
                </Button>
              )}
            </div>
          </div>
          {currentPlan && (
            <div className="flex flex-wrap gap-2 mt-2">
              {(currentPlan.themes as string[] || []).map((theme, index) => (
                <Badge key={index} variant="secondary">
                  {theme}
                </Badge>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {plansLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : currentPlan && contentItems ? (
            <div className="space-y-3">
              {contentItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-4 rounded-lg border hover-elevate cursor-pointer transition-colors"
                  onClick={() => handleContentClick(item.topic)}
                  data-testid={`content-item-${index}`}
                >
                  <div className="text-center min-w-[60px]">
                    <div className="text-2xl font-bold">{item.date.split("-")[2]}</div>
                    <div className="text-xs text-muted-foreground">{item.dayOfWeek}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.topic}</div>
                    {item.notes && (
                      <div className="text-sm text-muted-foreground truncate">{item.notes}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {item.platforms.includes("instagram") && (
                      <Badge variant="outline" className="gap-1">
                        <Instagram className="w-3 h-3" />
                        Instagram
                      </Badge>
                    )}
                    {item.platforms.includes("blog") && (
                      <Badge variant="outline" className="gap-1">
                        <FileText className="w-3 h-3" />
                        Blog
                      </Badge>
                    )}
                  </div>
                  <Badge className={CONTENT_TYPE_COLORS[item.contentType] || "bg-gray-100 text-gray-800"}>
                    {item.contentType}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>이 달의 플랜이 없습니다.</p>
              <p className="text-sm">위에서 AI로 플랜을 생성해보세요!</p>
            </div>
          )}
        </CardContent>
      </Card>

      {plans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>저장된 플랜</CardTitle>
            <CardDescription>이전에 생성한 모든 월간 플랜</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <Card
                  key={plan.id}
                  className={`cursor-pointer hover-elevate transition-colors ${
                    plan.year === selectedYear && plan.month === selectedMonth
                      ? "ring-2 ring-primary"
                      : ""
                  }`}
                  onClick={() => {
                    setSelectedYear(plan.year);
                    setSelectedMonth(plan.month);
                  }}
                  data-testid={`plan-card-${plan.id}`}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">
                      {plan.year}년 {plan.month}월
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {(plan.themes as string[] || []).slice(0, 2).map((theme, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {theme}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {(plan.contentItems as ContentItem[])?.length || 0}개 콘텐츠
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
