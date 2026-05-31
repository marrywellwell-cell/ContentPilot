import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sparkles, RefreshCw, Download, Copy, Check, Save,
  Loader2, Image as ImageIcon, Hash, Trash2, Calendar,
  Edit2, CheckCircle, ChevronRight,
} from "lucide-react";

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface QuoteStyle { id: string; label: string; quote: string; fullText: string; }
interface GeneratedContent { styles: QuoteStyle[]; hashtags: string[]; rawImageBase64: string | null; imageBase64: string | null; }
interface SavedContent { id: string; month: string; quote: string; caption: string; hashtags: string[]; imageBase64: string | null; createdAt: string; }

// ── 상수 ──────────────────────────────────────────────────────────────────────

const buildMonths = () => {
  const now = new Date();
  const months = [];
  for (const year of [now.getFullYear(), now.getFullYear() + 1]) {
    for (let m = 1; m <= 12; m++) {
      months.push({ value: `${year}-${String(m).padStart(2, "0")}`, label: `${year}년 ${m}월`, month: m });
    }
  }
  return months;
};
const MONTHS = buildMonths();

const SEASON: Record<number, string> = {
  1:"❄️ 새해", 2:"🌱 입춘", 3:"🌸 봄", 4:"🌷 벚꽃", 5:"🌿 가정의달",
  6:"☀️ 초여름", 7:"🌊 여름", 8:"🌻 한여름", 9:"🍂 초가을",
  10:"🍁 단풍", 11:"🌫️ 만추", 12:"⛄ 연말",
};

const STYLE_BADGE: Record<string, { color: string; emoji: string }> = {
  emotional:   { color: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300", emoji: "🌿" },
  hopeful:     { color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300", emoji: "✨" },
  short:       { color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300", emoji: "🌱" },
  quote_style: { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", emoji: "☘️" },
  insta:       { color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", emoji: "💚" },
};

// ── **bold** 마크다운 렌더러 ──────────────────────────────────────────────────

function FormattedText({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let paraLines: React.ReactNode[] = [];

  const flushPara = () => {
    if (paraLines.length > 0) {
      result.push(
        <p key={result.length} className="leading-relaxed">
          {paraLines.map((l, i) => (i < paraLines.length - 1 ? <>{l}<br /></> : l))}
        </p>
      );
      paraLines = [];
    }
  };

  for (const line of lines) {
    if (!line.trim()) {
      flushPara();
      continue;
    }
    // **bold** 파싱
    const parts = line.split(/\*\*(.*?)\*\*/g);
    const rendered = parts.map((part, i) =>
      i % 2 === 1 ? <strong key={i} className="font-bold">{part}</strong> : <span key={i}>{part}</span>
    );
    paraLines.push(<>{rendered}</>);
  }
  flushPara();

  return <div className={`space-y-2 text-sm ${className}`}>{result}</div>;
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function MonthlyHopeContent() {
  const { toast } = useToast();
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [generated, setGenerated] = useState<GeneratedContent | null>(null);
  const [activeStyleId, setActiveStyleId] = useState<string>("");
  const [editingQuote, setEditingQuote] = useState(false);
  const [quoteText, setQuoteText] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const monthNum = parseInt(selectedMonth.split("-")[1]);
  const savedQuery = useQuery<SavedContent[]>({ queryKey: ["/api/monthly-content"] });
  const activeStyle = generated?.styles.find(s => s.id === activeStyleId) ?? generated?.styles[0] ?? null;

  const copy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast({ title: "복사 완료!" });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const downloadImage = (base64: string, month: string) => {
    const a = document.createElement("a"); a.href = base64; a.download = `hope-${month}.jpg`; a.click();
  };

  // ── Mutations ──────────────────────────────────────────────────────────────

  const generateMutation = useMutation({
    mutationFn: () => apiRequest("/api/monthly-content/generate", {
      method: "POST", body: JSON.stringify({ month: selectedMonth }),
    }) as Promise<GeneratedContent>,
    onSuccess: (data) => {
      setGenerated(data);
      setActiveStyleId(data.styles[0]?.id ?? "");
      setQuoteText(data.styles[0]?.quote ?? "");
      setEditingQuote(false);
      toast({ title: "생성 완료! 스타일을 선택하세요." });
    },
    onError: (e: Error) => toast({ title: "생성 실패", description: e.message, variant: "destructive" }),
  });

  const applyStyleMutation = useMutation({
    mutationFn: (styleId: string) => {
      const style = generated!.styles.find(s => s.id === styleId)!;
      return apiRequest("/api/monthly-content/apply-text", {
        method: "POST",
        body: JSON.stringify({ imageBase64: generated!.rawImageBase64, quote: style.quote, style, month: selectedMonth }),
      }) as Promise<{ imageBase64: string }>;
    },
    onSuccess: (data, styleId) => {
      setGenerated(prev => prev ? { ...prev, imageBase64: data.imageBase64 } : prev);
      setActiveStyleId(styleId);
      setQuoteText(generated!.styles.find(s => s.id === styleId)?.quote ?? "");
      setEditingQuote(false);
    },
    onError: (e: Error) => toast({ title: "이미지 생성 실패", description: e.message, variant: "destructive" }),
  });

  const applyEditMutation = useMutation({
    mutationFn: () => apiRequest("/api/monthly-content/apply-text", {
      method: "POST",
      body: JSON.stringify({ imageBase64: generated!.rawImageBase64, quote: quoteText, month: selectedMonth }),
    }) as Promise<{ imageBase64: string }>,
    onSuccess: (data) => {
      setGenerated(prev => prev ? { ...prev, imageBase64: data.imageBase64 } : prev);
      setEditingQuote(false);
      toast({ title: "이미지 적용 완료!" });
    },
    onError: (e: Error) => toast({ title: "적용 실패", description: e.message, variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("/api/monthly-content/save", {
      method: "POST",
      body: JSON.stringify({
        month: selectedMonth,
        quote: activeStyle?.fullText ?? "",
        caption: activeStyle?.fullText ?? "",
        hashtags: generated!.hashtags,
        imageBase64: generated!.imageBase64,
      }),
    }),
    onSuccess: () => { toast({ title: "저장 완료!" }); queryClient.invalidateQueries({ queryKey: ["/api/monthly-content"] }); },
    onError: (e: Error) => toast({ title: "저장 실패", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/monthly-content/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "삭제 완료" }); queryClient.invalidateQueries({ queryKey: ["/api/monthly-content"] }); },
  });

  const isApplying = applyStyleMutation.isPending || applyEditMutation.isPending;

  // ── 렌더 ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* 헤더 */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl mb-1">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold">월간 희망 콘텐츠</h1>
        <p className="text-sm text-muted-foreground">5가지 스타일의 희망 메시지와 인스타그램 이미지를 한번에 생성합니다</p>
      </div>

      {/* 월 선택 + 생성 */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-500" />월 선택
            </label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label} · {SEASON[m.month]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-amber-600 dark:text-amber-400 pl-1">{SEASON[monthNum]} 테마 · 5가지 스타일 동시 생성</p>
          </div>
          <Button
            className="w-full gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold"
            size="lg"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending
              ? <><Loader2 className="w-5 h-5 animate-spin" />AI 생성 중 (30~60초)...</>
              : <><Sparkles className="w-5 h-5" />콘텐츠 생성하기</>}
          </Button>
        </CardContent>
      </Card>

      {/* 생성 결과 */}
      {generated && (
        <div className="space-y-5">

          {/* 상단 액션 */}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" className="gap-1.5"
              onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
              <RefreshCw className="w-3.5 h-3.5" />전체 재생성
            </Button>
            <Button size="sm"
              className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !activeStyle}>
              {saveMutation.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />저장 중...</> : <><Save className="w-3.5 h-3.5" />저장</>}
            </Button>
          </div>

          {/* ── 5가지 스타일 카드 ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold">스타일 선택</h3>
              <span className="text-xs text-muted-foreground">클릭하면 이미지에 적용됩니다</span>
            </div>

            {generated.styles.length === 0 && (
              <div className="text-center py-6 text-sm text-muted-foreground border rounded-xl border-dashed">
                스타일 생성에 실패했습니다 — 전체 재생성을 눌러주세요
              </div>
            )}

            {generated.styles.map((style) => {
              const isActive = style.id === activeStyleId;
              const badge = STYLE_BADGE[style.id] || { color: "bg-gray-100 text-gray-700", emoji: "💡" };
              return (
                <div
                  key={style.id}
                  className={`rounded-xl border-2 cursor-pointer transition-all overflow-hidden
                    ${isActive
                      ? "border-amber-400 shadow-md bg-amber-50/60 dark:bg-amber-950/20"
                      : "border-border hover:border-amber-200 hover:shadow-sm bg-card"}`}
                  onClick={() => {
                    if (!isApplying) {
                      if (generated.rawImageBase64 || generated.imageBase64) {
                        applyStyleMutation.mutate(style.id);
                      } else {
                        setActiveStyleId(style.id);
                        setQuoteText(style.quote);
                      }
                    }
                  }}
                >
                  {/* 스타일 헤더 */}
                  <div className={`flex items-center justify-between px-4 py-2.5 ${isActive ? "bg-amber-100/60 dark:bg-amber-900/20" : "bg-muted/40"} border-b`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${badge.color}`}>
                        {badge.emoji} {style.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* 복사 버튼 */}
                      <button
                        className="p-1 rounded hover:bg-white/60 transition-colors"
                        onClick={(e) => { e.stopPropagation(); copy(style.fullText, `style-${style.id}`); }}
                      >
                        {copiedField === `style-${style.id}`
                          ? <Check className="w-3.5 h-3.5 text-green-500" />
                          : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                      </button>
                      {/* 선택 표시 */}
                      {isApplying && isActive
                        ? <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                        : isActive
                          ? <CheckCircle className="w-4 h-4 text-amber-500" />
                          : <ChevronRight className="w-4 h-4 text-muted-foreground/40" />}
                    </div>
                  </div>

                  {/* 본문 텍스트 */}
                  <div className="px-5 py-4">
                    <FormattedText text={style.fullText} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── 이미지 미리보기 ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-500" />
                인스타그램 이미지 <span className="text-xs font-normal text-muted-foreground">1080×1350</span>
                {activeStyle && <Badge variant="outline" className="text-[10px] ml-1">{activeStyle.label}</Badge>}
              </h3>
              {generated.imageBase64 && (
                <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs"
                  onClick={() => downloadImage(generated.imageBase64!, selectedMonth)}>
                  <Download className="w-3.5 h-3.5" />다운로드
                </Button>
              )}
            </div>

            {isApplying ? (
              <div className="flex items-center justify-center h-56 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 rounded-xl border border-amber-100">
                <div className="text-center space-y-2">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto" />
                  <p className="text-sm font-medium">AI 디자인 이미지 생성 중...</p>
                  <p className="text-xs text-muted-foreground">gpt-image-1 고급 합성 (20~40초)</p>
                </div>
              </div>
            ) : generated.imageBase64 ? (
              <div className="flex justify-center">
                <img src={generated.imageBase64} alt="희망 이미지"
                  className="w-full max-w-[300px] rounded-2xl shadow-xl"
                  style={{ aspectRatio: "1080/1350", objectFit: "cover" }} />
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 bg-muted rounded-xl border-2 border-dashed">
                <p className="text-sm text-muted-foreground">이미지 없음 — 스타일 카드를 클릭해 생성</p>
              </div>
            )}

            {/* 이미지 텍스트 직접 수정 */}
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
                <span className="text-xs text-muted-foreground font-medium">이미지 텍스트 직접 수정</span>
                <div className="flex gap-1">
                  {!editingQuote ? (
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1" onClick={() => setEditingQuote(true)}>
                      <Edit2 className="w-3 h-3" />수정
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"
                        onClick={() => { setEditingQuote(false); setQuoteText(activeStyle?.quote ?? ""); }}>취소</Button>
                      <Button size="sm"
                        className="h-6 px-2 text-xs gap-1 bg-amber-500 hover:bg-amber-600 text-white"
                        onClick={() => applyEditMutation.mutate()}
                        disabled={applyEditMutation.isPending}>
                        {applyEditMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                        이미지 적용
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {editingQuote ? (
                <Textarea value={quoteText} onChange={e => setQuoteText(e.target.value)}
                  className="border-0 rounded-none resize-none text-sm focus-visible:ring-0 leading-relaxed" rows={3} />
              ) : (
                <div className="px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap font-medium min-h-[56px]">
                  {quoteText || activeStyle?.quote}
                </div>
              )}
            </div>
          </div>

          {/* ── 해시태그 ── */}
          {generated.hashtags.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Hash className="w-4 h-4 text-amber-500" />해시태그 ({generated.hashtags.length}개)
                </h3>
                <Button size="sm" variant="ghost" className="h-7 px-2"
                  onClick={() => copy(generated.hashtags.join(" "), "hashtags")}>
                  {copiedField === "hashtags" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 p-3 bg-muted/30 rounded-lg">
                {generated.hashtags.map((tag, i) => (
                  <Badge key={i} variant="secondary"
                    className="text-xs cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                    onClick={() => copy(tag, `t${i}`)}>
                    {tag.startsWith("#") ? tag : `#${tag}`}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* 전체 복사 */}
          <Button variant="outline" className="w-full gap-2"
            onClick={() => copy(`${activeStyle?.fullText ?? ""}\n\n${generated.hashtags.join(" ")}`, "all")}>
            {copiedField === "all" ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            전체 복사 (캡션 + 해시태그)
          </Button>
        </div>
      )}

      {/* ── 저장된 목록 ── */}
      {(savedQuery.data?.length ?? 0) > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-500" />저장된 콘텐츠
            </h2>
            {savedQuery.data?.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-3">
                  <div className="flex gap-3">
                    {item.imageBase64 ? (
                      <img src={item.imageBase64} alt="희망 이미지" className="w-14 h-[70px] rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-14 h-[70px] rounded-lg bg-gradient-to-br from-amber-100 to-orange-200 flex-shrink-0 flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-amber-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">{item.month}</Badge>
                        <span className="text-xs text-muted-foreground">{SEASON[parseInt(item.month.split("-")[1])]}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 whitespace-pre-wrap">{item.quote}</p>
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 px-2"
                        onClick={() => copy(`${item.quote}\n\n${item.hashtags?.join(" ")}`, `s${item.id}`)}>
                        {copiedField === `s${item.id}` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                      {item.imageBase64 && (
                        <Button size="sm" variant="ghost" className="h-7 px-2"
                          onClick={() => downloadImage(item.imageBase64!, item.month)}>
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => deleteMutation.mutate(item.id)}>
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
