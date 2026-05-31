import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sparkles, RefreshCw, Download, Copy, Check, Save,
  Loader2, Image as ImageIcon, Hash, MessageSquare, Quote,
  Trash2, Calendar,
} from "lucide-react";

interface GeneratedContent {
  quote: string;
  caption: string;
  hashtags: string[];
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

export default function MonthlyHopeContent() {
  const { toast } = useToast();
  const [generated, setGenerated] = useState<GeneratedContent | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const currentMonth = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long" });

  // 저장된 목록 조회
  const savedQuery = useQuery<SavedContent[]>({
    queryKey: ["/api/monthly-content"],
  });

  // 전체 생성
  const generateMutation = useMutation({
    mutationFn: () => apiRequest("/api/monthly-content/generate", { method: "POST" }) as Promise<GeneratedContent>,
    onSuccess: (data) => {
      setGenerated(data);
      toast({ title: "콘텐츠 생성 완료!" });
    },
    onError: (e: Error) => toast({ title: "생성 실패", description: e.message, variant: "destructive" }),
  });

  // 글귀만 재생성
  const regenQuoteMutation = useMutation({
    mutationFn: () => apiRequest("/api/monthly-content/generate", { method: "POST" }) as Promise<GeneratedContent>,
    onSuccess: (data) => {
      setGenerated(prev => prev ? { ...prev, quote: data.quote } : data);
      toast({ title: "글귀 재생성 완료!" });
    },
    onError: (e: Error) => toast({ title: "재생성 실패", description: e.message, variant: "destructive" }),
  });

  // 캡션만 재생성
  const regenCaptionMutation = useMutation({
    mutationFn: () => apiRequest("/api/monthly-content/generate", { method: "POST" }) as Promise<GeneratedContent>,
    onSuccess: (data) => {
      setGenerated(prev => prev ? { ...prev, caption: data.caption } : data);
      toast({ title: "캡션 재생성 완료!" });
    },
    onError: (e: Error) => toast({ title: "재생성 실패", description: e.message, variant: "destructive" }),
  });

  // 해시태그만 재생성
  const regenHashtagMutation = useMutation({
    mutationFn: () => apiRequest("/api/monthly-content/generate", { method: "POST" }) as Promise<GeneratedContent>,
    onSuccess: (data) => {
      setGenerated(prev => prev ? { ...prev, hashtags: data.hashtags } : data);
      toast({ title: "해시태그 재생성 완료!" });
    },
    onError: (e: Error) => toast({ title: "재생성 실패", description: e.message, variant: "destructive" }),
  });

  // 이미지만 재생성
  const regenImageMutation = useMutation({
    mutationFn: () => apiRequest("/api/monthly-content/generate", { method: "POST" }) as Promise<GeneratedContent>,
    onSuccess: (data) => {
      setGenerated(prev => prev ? { ...prev, imageBase64: data.imageBase64 } : data);
      toast({ title: "이미지 재생성 완료!" });
    },
    onError: (e: Error) => toast({ title: "재생성 실패", description: e.message, variant: "destructive" }),
  });

  // 저장
  const saveMutation = useMutation({
    mutationFn: () => apiRequest("/api/monthly-content/save", {
      method: "POST",
      body: JSON.stringify({
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
    toast({ title: "복사 완료!" });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const downloadImage = (base64: string) => {
    const a = document.createElement("a");
    a.href = base64;
    a.download = `monthly-hope-${new Date().toISOString().slice(0, 7)}.jpg`;
    a.click();
  };

  const isGenerating = generateMutation.isPending;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* 헤더 */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl mb-2">
          <Sparkles className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-3xl font-bold">월간 희망 콘텐츠</h1>
        <p className="text-muted-foreground">{currentMonth} · AI가 희망 글귀와 인스타그램 콘텐츠를 자동 생성합니다</p>
      </div>

      {/* 생성 버튼 */}
      {!generated && (
        <Card className="border-2 border-dashed border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <p className="text-muted-foreground text-sm">버튼을 누르면 글귀 · 이미지 · 캡션 · 해시태그가 한번에 생성됩니다</p>
            <Button
              size="lg"
              className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-8"
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
      )}

      {/* 생성 결과 */}
      {generated && (
        <div className="space-y-5">
          {/* 상단 액션 */}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => { setGenerated(null); }} className="gap-2">
              <RefreshCw className="w-4 h-4" />새로 만들기
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
            >
              {saveMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" />저장 중...</>
                : <><Save className="w-4 h-4" />저장하기</>
              }
            </Button>
          </div>

          {/* 글귀 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Quote className="w-4 h-4 text-amber-500" />희망 글귀
                </CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="h-8 px-2"
                    onClick={() => copy(generated.quote, "quote")}>
                    {copiedField === "quote" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 gap-1 text-xs"
                    onClick={() => regenQuoteMutation.mutate()}
                    disabled={regenQuoteMutation.isPending}>
                    {regenQuoteMutation.isPending
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <RefreshCw className="w-3 h-3" />}
                    재생성
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-xl p-6 border border-amber-100 dark:border-amber-900">
                <p className="text-lg font-medium leading-relaxed text-center whitespace-pre-wrap">{generated.quote}</p>
              </div>
            </CardContent>
          </Card>

          {/* 이미지 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ImageIcon className="w-4 h-4 text-amber-500" />인스타그램 이미지 <span className="text-xs font-normal text-muted-foreground">(1080×1350)</span>
                </CardTitle>
                <div className="flex gap-2">
                  {generated.imageBase64 && (
                    <Button size="sm" variant="ghost" className="h-8 px-2 gap-1 text-xs"
                      onClick={() => downloadImage(generated.imageBase64!)}>
                      <Download className="w-3.5 h-3.5" />다운로드
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-8 gap-1 text-xs"
                    onClick={() => regenImageMutation.mutate()}
                    disabled={regenImageMutation.isPending}>
                    {regenImageMutation.isPending
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <RefreshCw className="w-3 h-3" />}
                    재생성
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {regenImageMutation.isPending ? (
                <div className="flex items-center justify-center h-64 bg-muted rounded-xl">
                  <div className="text-center space-y-2">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto" />
                    <p className="text-sm text-muted-foreground">이미지 생성 중...</p>
                  </div>
                </div>
              ) : generated.imageBase64 ? (
                <div className="flex justify-center">
                  <img
                    src={generated.imageBase64}
                    alt="생성된 희망 이미지"
                    className="w-full max-w-xs rounded-xl shadow-md object-cover"
                    style={{ aspectRatio: "1080/1350" }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 bg-muted rounded-xl border-2 border-dashed">
                  <p className="text-sm text-muted-foreground">이미지 생성 실패 — 재생성 버튼을 눌러주세요</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 캡션 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="w-4 h-4 text-amber-500" />인스타그램 캡션
                </CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="h-8 px-2"
                    onClick={() => copy(generated.caption, "caption")}>
                    {copiedField === "caption" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 gap-1 text-xs"
                    onClick={() => regenCaptionMutation.mutate()}
                    disabled={regenCaptionMutation.isPending}>
                    {regenCaptionMutation.isPending
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <RefreshCw className="w-3 h-3" />}
                    재생성
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{generated.caption}</p>
              </div>
            </CardContent>
          </Card>

          {/* 해시태그 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Hash className="w-4 h-4 text-amber-500" />해시태그 ({generated.hashtags.length}개)
                </CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="h-8 px-2"
                    onClick={() => copy(generated.hashtags.join(" "), "hashtags")}>
                    {copiedField === "hashtags" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 gap-1 text-xs"
                    onClick={() => regenHashtagMutation.mutate()}
                    disabled={regenHashtagMutation.isPending}>
                    {regenHashtagMutation.isPending
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <RefreshCw className="w-3 h-3" />}
                    재생성
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {generated.hashtags.map((tag, i) => (
                  <Badge key={i} variant="secondary" className="text-xs cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900"
                    onClick={() => copy(tag, `tag-${i}`)}>
                    {tag.startsWith("#") ? tag : `#${tag}`}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 전체 복사 */}
          <Button variant="outline" className="w-full gap-2"
            onClick={() => copy(
              `${generated.quote}\n\n${generated.caption}\n\n${generated.hashtags.join(" ")}`,
              "all"
            )}>
            {copiedField === "all" ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            전체 복사 (글귀 + 캡션 + 해시태그)
          </Button>
        </div>
      )}

      {/* 저장된 목록 */}
      {(savedQuery.data?.length ?? 0) > 0 && (
        <>
          <Separator />
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-500" />저장된 콘텐츠
            </h2>
            <div className="grid gap-4">
              {savedQuery.data?.map((item) => (
                <Card key={item.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {item.imageBase64 ? (
                        <img src={item.imageBase64} alt="희망 이미지" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-amber-100 to-orange-200 flex-shrink-0 flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-amber-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{item.month}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(item.createdAt).toLocaleDateString("ko-KR")}
                          </span>
                        </div>
                        <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap line-clamp-2">{item.quote}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{item.caption}</p>
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <Button size="sm" variant="ghost" className="h-7 px-2"
                          onClick={() => copy(`${item.quote}\n\n${item.caption}\n\n${item.hashtags.join(" ")}`, `saved-${item.id}`)}>
                          {copiedField === `saved-${item.id}` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                        {item.imageBase64 && (
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => downloadImage(item.imageBase64!)}>
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
          </div>
        </>
      )}
    </div>
  );
}
