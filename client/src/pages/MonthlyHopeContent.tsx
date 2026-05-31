import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sparkles, RefreshCw, Download, Copy, Check, Save,
  Loader2, Image as ImageIcon, Hash, MessageSquare, Quote,
  Trash2, Calendar, Edit2, CheckCircle,
} from "lucide-react";

interface GeneratedContent {
  quote: string;
  caption: string;
  hashtags: string[];
  rawImageBase64: string | null;
  imageBase64: string | null;
}

interface SavedContent {
  id: string;
  month: string;
  quote: string;
  caption: string;
  hashtags: string[];
  imageBase64: string | null;
  status: string;
  createdAt: string;
}

// 올해 1~12월 + 내년 1~12월 (총 24개)
const buildMonths = () => {
  const now = new Date();
  const thisYear = now.getFullYear();
  const months = [];
  for (const year of [thisYear, thisYear + 1]) {
    for (let m = 1; m <= 12; m++) {
      const value = `${year}-${String(m).padStart(2, "0")}`;
      const label = `${year}년 ${m}월`;
      months.push({ value, label, month: m });
    }
  }
  return months;
};
const MONTHS = buildMonths();

const MONTH_SEASON: Record<number, string> = {
  1:"❄️ 새해·겨울", 2:"🌱 입춘·봄준비", 3:"🌸 봄", 4:"🌷 벚꽃", 5:"🌿 가정의달",
  6:"☀️ 초여름", 7:"🌊 여름", 8:"🌻 한여름", 9:"🍂 초가을", 10:"🍁 단풍",
  11:"🌫️ 만추", 12:"⛄ 연말·겨울",
};

export default function MonthlyHopeContent() {
  const { toast } = useToast();
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [generated, setGenerated] = useState<GeneratedContent | null>(null);
  const [editingQuote, setEditingQuote] = useState(false);
  const [quoteText, setQuoteText] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const monthNum = parseInt(selectedMonth.split("-")[1]);
  const seasonLabel = MONTH_SEASON[monthNum] || "";

  // 저장된 목록
  const savedQuery = useQuery<SavedContent[]>({ queryKey: ["/api/monthly-content"] });

  // 전체 생성
  const generateMutation = useMutation({
    mutationFn: () => apiRequest("/api/monthly-content/generate", {
      method: "POST",
      body: JSON.stringify({ month: selectedMonth }),
    }) as Promise<GeneratedContent>,
    onSuccess: (data) => {
      setGenerated(data);
      setQuoteText(data.quote);
      setEditingQuote(false);
      toast({ title: "콘텐츠 생성 완료!" });
    },
    onError: (e: Error) => toast({ title: "생성 실패", description: e.message, variant: "destructive" }),
  });

  // 글귀 수정 후 이미지 재적용
  const applyTextMutation = useMutation({
    mutationFn: () => apiRequest("/api/monthly-content/apply-text", {
      method: "POST",
      body: JSON.stringify({ imageBase64: generated!.rawImageBase64, quote: quoteText }),
    }) as Promise<{ imageBase64: string }>,
    onSuccess: (data) => {
      setGenerated(prev => prev ? { ...prev, quote: quoteText, imageBase64: data.imageBase64 } : prev);
      setEditingQuote(false);
      toast({ title: "이미지 적용 완료!" });
    },
    onError: (e: Error) => toast({ title: "적용 실패", description: e.message, variant: "destructive" }),
  });

  // 재생성 (전체)
  const regenMutation = useMutation({
    mutationFn: () => apiRequest("/api/monthly-content/generate", {
      method: "POST",
      body: JSON.stringify({ month: selectedMonth }),
    }) as Promise<GeneratedContent>,
    onSuccess: (data) => {
      setGenerated(data);
      setQuoteText(data.quote);
      setEditingQuote(false);
      toast({ title: "재생성 완료!" });
    },
    onError: (e: Error) => toast({ title: "재생성 실패", description: e.message, variant: "destructive" }),
  });

  // 저장
  const saveMutation = useMutation({
    mutationFn: () => apiRequest("/api/monthly-content/save", {
      method: "POST",
      body: JSON.stringify({
        month: selectedMonth,
        quote: generated!.quote,
        caption: generated!.caption,
        hashtags: generated!.hashtags,
        imageBase64: generated!.imageBase64,
      }),
    }),
    onSuccess: () => {
      toast({ title: "저장 완료!" });
      queryClient.invalidateQueries({ queryKey: ["/api/monthly-content"] });
    },
    onError: (e: Error) => toast({ title: "저장 실패", description: e.message, variant: "destructive" }),
  });

  // 삭제
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/monthly-content/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "삭제 완료" });
      queryClient.invalidateQueries({ queryKey: ["/api/monthly-content"] });
    },
  });

  const copy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const downloadImage = (base64: string, month: string) => {
    const a = document.createElement("a");
    a.href = base64;
    a.download = `monthly-hope-${month}.jpg`;
    a.click();
  };

  const isGenerating = generateMutation.isPending || regenMutation.isPending;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl mb-2">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold">월간 희망 콘텐츠</h1>
        <p className="text-sm text-muted-foreground">월을 선택하면 그 달에 맞는 글귀·이미지·캡션을 생성합니다</p>
      </div>

      {/* 월 선택 + 생성 */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-500" />월 선택
            </label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    <span className="flex items-center gap-2">
                      <span>{m.label}</span>
                      <span className="text-xs text-muted-foreground">{MONTH_SEASON[m.month]}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedMonth && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {seasonLabel} 테마로 생성됩니다
              </p>
            )}
          </div>

          <Button
            className="w-full gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
            size="lg"
            onClick={() => generateMutation.mutate()}
            disabled={isGenerating}
          >
            {isGenerating
              ? <><Loader2 className="w-5 h-5 animate-spin" />AI 생성 중...</>
              : <><Sparkles className="w-5 h-5" />콘텐츠 생성하기</>
            }
          </Button>
        </CardContent>
      </Card>

      {/* 생성 결과 */}
      {generated && (
        <div className="space-y-4">
          {/* 상단 액션 */}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" className="gap-1.5"
              onClick={() => regenMutation.mutate()} disabled={isGenerating}>
              <RefreshCw className="w-3.5 h-3.5" />전체 재생성
            </Button>
            <Button
              className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />저장 중...</>
                : <><Save className="w-3.5 h-3.5" />저장하기</>
              }
            </Button>
          </div>

          {/* 이미지 + 글귀 편집 */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-amber-500" />
                  이미지 <span className="text-xs font-normal text-muted-foreground">(1080×1350 · 글귀 포함)</span>
                </CardTitle>
                <div className="flex gap-1.5">
                  {generated.imageBase64 && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs"
                      onClick={() => downloadImage(generated.imageBase64!, selectedMonth)}>
                      <Download className="w-3.5 h-3.5" />다운로드
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 이미지 */}
              {generated.imageBase64 ? (
                <div className="flex justify-center">
                  <img
                    src={generated.imageBase64}
                    alt="희망 이미지"
                    className="w-full max-w-xs rounded-xl shadow-lg"
                    style={{ aspectRatio: "1080/1350", objectFit: "cover" }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 bg-muted rounded-xl border-2 border-dashed">
                  <p className="text-sm text-muted-foreground">이미지 생성 실패 — 재생성해주세요</p>
                </div>
              )}

              {/* 글귀 편집 영역 */}
              <div className="border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border-b">
                  <span className="text-xs font-medium flex items-center gap-1.5">
                    <Quote className="w-3.5 h-3.5 text-amber-500" />글귀 (클릭해서 수정)
                  </span>
                  <div className="flex gap-1.5">
                    {!editingQuote ? (
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1"
                        onClick={() => { setEditingQuote(true); setQuoteText(generated.quote); }}>
                        <Edit2 className="w-3 h-3" />수정
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"
                          onClick={() => { setEditingQuote(false); setQuoteText(generated.quote); }}>
                          취소
                        </Button>
                        <Button size="sm"
                          className="h-6 px-2 text-xs gap-1 bg-amber-500 hover:bg-amber-600 text-white"
                          onClick={() => applyTextMutation.mutate()}
                          disabled={applyTextMutation.isPending || !generated.rawImageBase64}>
                          {applyTextMutation.isPending
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <CheckCircle className="w-3 h-3" />}
                          이미지 적용
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {editingQuote ? (
                  <Textarea
                    value={quoteText}
                    onChange={(e) => setQuoteText(e.target.value)}
                    className="border-0 rounded-none resize-none text-sm leading-relaxed focus-visible:ring-0"
                    rows={3}
                    placeholder="글귀를 수정하세요 (줄바꿈 가능)"
                  />
                ) : (
                  <div className="px-3 py-3 text-sm leading-relaxed font-medium whitespace-pre-wrap">
                    {generated.quote}
                  </div>
                )}
              </div>

              {!generated.rawImageBase64 && editingQuote && (
                <p className="text-xs text-muted-foreground text-center">
                  원본 이미지가 없어 텍스트 재적용이 불가합니다. 전체 재생성해주세요.
                </p>
              )}
            </CardContent>
          </Card>

          {/* 캡션 */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-amber-500" />캡션
                </CardTitle>
                <Button size="sm" variant="ghost" className="h-7 px-2"
                  onClick={() => copy(generated.caption, "caption")}>
                  {copiedField === "caption" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-muted rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap">
                {generated.caption}
              </div>
            </CardContent>
          </Card>

          {/* 해시태그 */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Hash className="w-4 h-4 text-amber-500" />해시태그 ({generated.hashtags.length}개)
                </CardTitle>
                <Button size="sm" variant="ghost" className="h-7 px-2"
                  onClick={() => copy(generated.hashtags.join(" "), "hashtags")}>
                  {copiedField === "hashtags" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {generated.hashtags.map((tag, i) => (
                  <Badge key={i} variant="secondary" className="text-xs cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/40"
                    onClick={() => copy(tag, `tag-${i}`)}>
                    {tag.startsWith("#") ? tag : `#${tag}`}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 전체 복사 */}
          <Button variant="outline" className="w-full gap-2"
            onClick={() => copy(`${generated.quote}\n\n${generated.caption}\n\n${generated.hashtags.join(" ")}`, "all")}>
            {copiedField === "all" ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            전체 복사 (글귀 + 캡션 + 해시태그)
          </Button>
        </div>
      )}

      {/* 저장된 목록 */}
      {(savedQuery.data?.length ?? 0) > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-500" />저장된 콘텐츠
            </h2>
            {savedQuery.data?.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    {item.imageBase64 ? (
                      <img src={item.imageBase64} alt="희망 이미지"
                        className="w-16 h-20 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-16 h-20 rounded-lg bg-gradient-to-br from-amber-100 to-orange-200 flex-shrink-0 flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-amber-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{item.month}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {MONTH_SEASON[parseInt(item.month.split("-")[1])]}
                        </span>
                      </div>
                      <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap line-clamp-3">{item.quote}</p>
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 px-2"
                        onClick={() => copy(`${item.quote}\n\n${item.caption}\n\n${item.hashtags?.join(" ")}`, `s-${item.id}`)}>
                        {copiedField === `s-${item.id}` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                      {item.imageBase64 && (
                        <Button size="sm" variant="ghost" className="h-7 px-2"
                          onClick={() => downloadImage(item.imageBase64!, item.month)}>
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 px-2"
                        onClick={() => deleteMutation.mutate(item.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
