import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ChevronLeft, ChevronRight, Edit2, Check, X } from "lucide-react";
import {
  Instagram, Send, Clock, CheckCircle, Loader2,
  Image as ImageIcon, Hash, AlignLeft, Calendar, Save,
} from "lucide-react";

interface PublishReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentSetId: string;
  keyword: string;
  instagramSlides?: string[];
  instagramCaption?: string;
  instagramHashtags?: string[];
  instagramImageUrls?: string[];
  platforms?: string[];
}

export default function PublishReviewDialog({
  open, onOpenChange, contentSetId, keyword,
  instagramSlides = [], instagramCaption = "",
  instagramHashtags = [], instagramImageUrls = [],
  platforms = [],
}: PublishReviewDialogProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"now" | "schedule">("now");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [publishResult, setPublishResult] = useState<any[] | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  // 편집 상태
  const [isEditing, setIsEditing] = useState(false);
  const [editSlides, setEditSlides] = useState<string[]>(instagramSlides);
  const [editCaption, setEditCaption] = useState(instagramCaption);
  const [editHashtags, setEditHashtags] = useState(instagramHashtags.map(h => `#${h.replace(/^#/, "")}`).join(" "));

  // props 변경 시 편집 상태 동기화
  useEffect(() => {
    setEditSlides(instagramSlides);
    setEditCaption(instagramCaption);
    setEditHashtags(instagramHashtags.map(h => `#${h.replace(/^#/, "")}`).join(" "));
  }, [instagramSlides, instagramCaption, instagramHashtags]);

  const allImages = instagramImageUrls.length > 0 ? instagramImageUrls : [];
  const totalSlides = Math.max(allImages.length, editSlides.length, 1);

  const prevSlide = () => setCurrentSlide(i => Math.max(0, i - 1));
  const nextSlide = () => setCurrentSlide(i => Math.min(totalSlides - 1, i + 1));

  // 편집 내용 DB 저장
  const saveMutation = useMutation({
    mutationFn: async () => {
      const hashtagArray = editHashtags
        .split(/[\s,]+/)
        .map(t => t.replace(/^#/, "").trim())
        .filter(Boolean);
      return apiRequest(`/api/content-sets/${contentSetId}`, {
        method: "PATCH",
        body: JSON.stringify({
          instagramSlides: editSlides,
          instagramCaption: editCaption,
          instagramHashtags: hashtagArray,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-sets"] });
      setIsEditing(false);
      toast({ title: "저장 완료", description: "발행 전 수정 내용이 저장되었습니다." });
    },
    onError: (e: Error) => {
      toast({ title: "저장 실패", description: e.message, variant: "destructive" });
    },
  });

  // 즉시 발행
  const publishNowMutation = useMutation({
    mutationFn: async () => {
      if (!contentSetId) throw new Error("콘텐츠가 아직 저장되지 않았습니다. 잠시 후 다시 시도해주세요.");
      return apiRequest(`/api/publish/${contentSetId}`, {
        method: "POST",
        body: JSON.stringify({
          platforms,
          instagramImageUrls,  // 메모리 이미지 함께 전송
        }),
      });
    },
    onSuccess: (data: any) => {
      setPublishResult(data.results || []);
      const success = data.results?.filter((r: any) => r.success) || [];
      toast({
        title: success.length > 0 ? "발행 완료!" : "발행 실패",
        description: success.length > 0
          ? `${success.map((r: any) => r.platform).join(", ")} 발행 성공`
          : "Instagram 연결 설정을 확인해주세요.",
        variant: success.length > 0 ? "default" : "destructive",
      });
    },
    onError: (e: Error) => {
      toast({ title: "발행 실패", description: e.message, variant: "destructive" });
    },
  });

  // 예약 발행
  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!scheduleDate) throw new Error("날짜를 선택해주세요.");
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}:00`);
      return apiRequest(`/api/content-sets/${contentSetId}`, {
        method: "PATCH",
        body: JSON.stringify({
          scheduledDate: scheduledAt.toISOString(),
          status: "scheduled",
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "예약 완료!", description: `${scheduleDate} ${scheduleTime}에 자동 발행됩니다.` });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast({ title: "예약 실패", description: e.message, variant: "destructive" });
    },
  });

  const displayHashtags = editHashtags;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Instagram className="w-5 h-5 text-pink-500" />
            Instagram 발행 검토
          </DialogTitle>
          <DialogDescription>
            발행 전 내용을 확인하고 수정하세요. 캡션 줄바꿈은 그대로 발행됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 콘텐츠 미리보기 */}
          <div className="border rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
            {/* Instagram 헤더 */}
            <div className="flex items-center justify-between p-3 border-b">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Instagram className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold">marrywellonoff</p>
                  <p className="text-xs text-muted-foreground">Instagram Business</p>
                </div>
              </div>
              {/* 편집 토글 */}
              {!publishResult && (
                <div className="flex gap-1.5">
                  {isEditing ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => { setIsEditing(false); setEditSlides(instagramSlides); setEditCaption(instagramCaption); setEditHashtags(instagramHashtags.map(h=>`#${h.replace(/^#/,"")}`).join(" ")); }}>
                        <X className="w-3.5 h-3.5 mr-1" />취소
                      </Button>
                      <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                        {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                        저장
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                      <Edit2 className="w-3.5 h-3.5 mr-1" />수정
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* 이미지 + 슬라이드 네비게이션 */}
            <div className="aspect-square bg-muted flex items-center justify-center relative overflow-hidden">
              {allImages[currentSlide] ? (
                <img
                  src={allImages[currentSlide]}
                  alt={`슬라이드 ${currentSlide + 1}`}
                  className="w-full h-full object-cover transition-all duration-300"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground w-full h-full">
                  {editSlides[currentSlide] ? (
                    <div className="bg-gradient-to-br from-purple-600 to-blue-600 w-full h-full flex items-center justify-center p-8">
                      <p className="text-white text-xl font-bold text-center whitespace-pre-line">{editSlides[currentSlide]}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-2">
                      <ImageIcon className="w-12 h-12 opacity-30" />
                      <p className="text-sm">이미지 없음</p>
                    </div>
                  )}
                </div>
              )}

              {/* 슬라이드 텍스트 오버레이 (이미지 위) */}
              {allImages[currentSlide] && editSlides[currentSlide] && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                  <p className="text-white text-sm font-bold text-center whitespace-pre-line leading-relaxed">
                    {editSlides[currentSlide]}
                  </p>
                </div>
              )}

              {/* 이전/다음 버튼 */}
              {totalSlides > 1 && (
                <>
                  <button onClick={prevSlide} disabled={currentSlide === 0}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-8 h-8 flex items-center justify-center disabled:opacity-30 transition-all">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={nextSlide} disabled={currentSlide === totalSlides - 1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-8 h-8 flex items-center justify-center disabled:opacity-30 transition-all">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <div className="absolute top-2 left-0 right-0 flex justify-center gap-1.5">
                    {Array.from({ length: totalSlides }).map((_, i) => (
                      <button key={i} onClick={() => setCurrentSlide(i)}
                        className={`h-1.5 rounded-full transition-all ${i === currentSlide ? "bg-white w-4" : "bg-white/50 w-1.5"}`} />
                    ))}
                  </div>
                  <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                    {currentSlide + 1} / {totalSlides}
                  </div>
                </>
              )}
            </div>

            {/* 슬라이드 텍스트 편집 영역 */}
            <div className="p-3 border-b space-y-2">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-xs font-medium text-muted-foreground">슬라이드 {currentSlide + 1} 텍스트</span>
                <span className="text-xs text-muted-foreground">(이미지에 합성되어 발행됩니다)</span>
              </div>
              {isEditing ? (
                <Textarea
                  value={editSlides[currentSlide] || ""}
                  onChange={(e) => {
                    const next = [...editSlides];
                    next[currentSlide] = e.target.value;
                    setEditSlides(next);
                  }}
                  rows={4}
                  className="text-sm resize-none"
                  placeholder="슬라이드 텍스트 입력..."
                />
              ) : (
                <div className="bg-muted/40 rounded-md p-2 min-h-[60px]">
                  <p className="text-sm whitespace-pre-line">{editSlides[currentSlide] || <span className="text-muted-foreground text-xs">텍스트 없음</span>}</p>
                </div>
              )}

              {/* 슬라이드 썸네일 목록 */}
              {editSlides.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto pt-1">
                  {editSlides.map((slide, i) => (
                    <button key={i} onClick={() => setCurrentSlide(i)}
                      className={`flex-shrink-0 w-10 h-10 rounded text-[7px] font-bold text-white text-center leading-tight px-1 line-clamp-3 transition-all ${i === currentSlide ? "ring-2 ring-pink-500" : "opacity-70"} bg-gradient-to-br from-purple-500 to-blue-500`}>
                      {slide.split("\n")[0].slice(0, 12)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 캡션 편집 */}
            <div className="p-3 space-y-2 border-b">
              <div className="flex items-center gap-1">
                <AlignLeft className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">캡션 (줄바꿈 그대로 발행됨)</span>
              </div>
              {isEditing ? (
                <Textarea
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  rows={6}
                  className="text-sm resize-none"
                  placeholder="캡션 입력..."
                />
              ) : (
                <p className="text-sm whitespace-pre-line line-clamp-6">{editCaption || "캡션 없음"}</p>
              )}
            </div>

            {/* 해시태그 편집 */}
            <div className="p-3 space-y-2">
              <div className="flex items-center gap-1">
                <Hash className="w-4 h-4 flex-shrink-0 text-blue-500" />
                <span className="text-xs font-medium text-muted-foreground">해시태그</span>
              </div>
              {isEditing ? (
                <Textarea
                  value={editHashtags}
                  onChange={(e) => setEditHashtags(e.target.value)}
                  rows={2}
                  className="text-sm resize-none"
                  placeholder="#해시태그 #공백으로구분"
                />
              ) : (
                <p className="text-xs text-blue-500 line-clamp-2">{displayHashtags || "해시태그 없음"}</p>
              )}
            </div>
          </div>

          {/* 발행 결과 */}
          {publishResult && (
            <div className="space-y-2">
              {publishResult.map((r, i) => (
                <div key={i} className={`flex items-center gap-2 p-3 rounded-lg ${r.success ? "bg-green-50 dark:bg-green-950" : "bg-red-50 dark:bg-red-950"}`}>
                  {r.success
                    ? <CheckCircle className="w-4 h-4 text-green-600" />
                    : <span className="text-red-500">✗</span>}
                  <span className="text-sm font-medium">{r.platform}</span>
                  {r.success
                    ? <a href={r.postUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline ml-auto">게시물 보기</a>
                    : <span className="text-xs text-red-500 ml-auto">{r.error}</span>}
                </div>
              ))}
            </div>
          )}

          {/* 발행 옵션 */}
          {!publishResult && (
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList className="w-full">
                <TabsTrigger value="now" className="flex-1 gap-2">
                  <Send className="w-4 h-4" />지금 바로 발행
                </TabsTrigger>
                <TabsTrigger value="schedule" className="flex-1 gap-2">
                  <Clock className="w-4 h-4" />예약 발행
                </TabsTrigger>
              </TabsList>

              <TabsContent value="now" className="space-y-4 mt-4">
                {isEditing && (
                  <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-200">
                    ℹ️ 수정 중입니다. 발행 전에 <strong>저장</strong>을 먼저 눌러주세요.
                  </div>
                )}
                <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium mb-1">⚠️ 발행 전 확인</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>슬라이드 텍스트가 이미지에 합성되어 발행됩니다.</li>
                    <li>캡션 줄바꿈은 Instagram에 그대로 반영됩니다.</li>
                    <li>Settings에서 Instagram 계정이 연결되어 있어야 합니다.</li>
                  </ul>
                </div>
                <Button
                  className="w-full gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  size="lg"
                  onClick={() => publishNowMutation.mutate()}
                  disabled={publishNowMutation.isPending || isEditing}
                >
                  {publishNowMutation.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin" />발행 중...</>
                    : <><Instagram className="w-4 h-4" />Instagram에 지금 발행</>}
                </Button>
              </TabsContent>

              <TabsContent value="schedule" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>발행 날짜</Label>
                    <Input type="date" value={scheduleDate}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setScheduleDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>발행 시간</Label>
                    <Input type="time" value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)} />
                  </div>
                </div>
                {scheduleDate && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted rounded-lg p-3">
                    <Calendar className="w-4 h-4" />
                    <span>{scheduleDate} {scheduleTime}에 자동 발행 예약됩니다.</span>
                  </div>
                )}
                <Button className="w-full gap-2" size="lg"
                  onClick={() => scheduleMutation.mutate()}
                  disabled={scheduleMutation.isPending || !scheduleDate || isEditing}>
                  {scheduleMutation.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin" />예약 중...</>
                    : <><Clock className="w-4 h-4" />예약 발행 등록</>}
                </Button>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
