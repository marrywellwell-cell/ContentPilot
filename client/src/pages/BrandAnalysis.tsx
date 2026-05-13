import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Sparkles, Target, Users, AlertCircle, Lightbulb, Edit2, Save, X } from "lucide-react";
import type { BrandAnalysis } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function BrandAnalysisPage() {
  const [activeTab, setActiveTab] = useState("list");
  const [brandName, setBrandName] = useState("");
  const [productService, setProductService] = useState("");
  const [generatedAnalysis, setGeneratedAnalysis] = useState<{
    usp: string;
    customerPersona: string;
    painPoints: string;
    solution: string;
  } | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<BrandAnalysis | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<BrandAnalysis>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [analysisToDelete, setAnalysisToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: brandAnalyses, isLoading } = useQuery<BrandAnalysis[]>({
    queryKey: ["/api/brand-analyses"],
  });

  const generateMutation = useMutation({
    mutationFn: async ({ brandName, productService }: { brandName: string; productService: string }) => {
      const response = await apiRequest("/api/brand-analyses/generate", {
        method: "POST",
        body: JSON.stringify({ brandName, productService }),
      });
      return response as {
        usp: string;
        customerPersona: string;
        painPoints: string;
        solution: string;
      };
    },
    onSuccess: (data) => {
      setGeneratedAnalysis(data);
      toast({
        title: "분석 완료",
        description: "브랜드 마케팅 전략 분석이 완료되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "분석 실패",
        description: error.message || "브랜드 분석에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("/api/brand-analyses", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brand-analyses"] });
      toast({
        title: "저장 완료",
        description: "브랜드 분석이 저장되었습니다.",
      });
      resetForm();
      setActiveTab("list");
    },
    onError: (error: Error) => {
      toast({
        title: "저장 실패",
        description: error.message || "저장에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<BrandAnalysis> }) => {
      const response = await apiRequest(`/api/brand-analyses/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brand-analyses"] });
      toast({
        title: "수정 완료",
        description: "브랜드 분석이 수정되었습니다.",
      });
      setIsEditing(false);
      setSelectedAnalysis(null);
    },
    onError: (error: Error) => {
      toast({
        title: "수정 실패",
        description: error.message || "수정에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/brand-analyses/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brand-analyses"] });
      toast({
        title: "삭제 완료",
        description: "브랜드 분석이 삭제되었습니다.",
      });
      setSelectedAnalysis(null);
    },
    onError: (error: Error) => {
      toast({
        title: "삭제 실패",
        description: error.message || "삭제에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setBrandName("");
    setProductService("");
    setGeneratedAnalysis(null);
  };

  const handleGenerate = () => {
    if (!brandName.trim() || !productService.trim()) {
      toast({
        title: "입력 필요",
        description: "브랜드명과 제품/서비스를 모두 입력해주세요.",
        variant: "destructive",
      });
      return;
    }
    generateMutation.mutate({ brandName, productService });
  };

  const handleSave = () => {
    if (!generatedAnalysis) return;
    
    saveMutation.mutate({
      brandName,
      productService,
      usp: generatedAnalysis.usp,
      customerPersona: generatedAnalysis.customerPersona,
      painPoints: generatedAnalysis.painPoints,
      solution: generatedAnalysis.solution,
    });
  };

  const handleSelectAnalysis = (analysis: BrandAnalysis) => {
    setSelectedAnalysis(analysis);
    setEditForm({
      usp: analysis.usp || "",
      customerPersona: analysis.customerPersona || "",
      painPoints: analysis.painPoints || "",
      solution: analysis.solution || "",
    });
    setIsEditing(false);
  };

  const handleUpdateAnalysis = () => {
    if (!selectedAnalysis) return;
    updateMutation.mutate({
      id: selectedAnalysis.id,
      data: editForm,
    });
  };

  const handleDeleteClick = (id: string) => {
    setAnalysisToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (analysisToDelete) {
      deleteMutation.mutate(analysisToDelete);
    }
    setDeleteDialogOpen(false);
    setAnalysisToDelete(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">브랜드 분석</h1>
        <p className="text-muted-foreground">브랜드를 분석하고 마케팅 전략을 수립하세요</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list" data-testid="tab-list">저장된 분석</TabsTrigger>
          <TabsTrigger value="new" data-testid="tab-new">새 분석</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : brandAnalyses && brandAnalyses.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-1 space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground mb-2">브랜드 목록</h3>
                {brandAnalyses.map((analysis) => (
                  <Card
                    key={analysis.id}
                    className={`cursor-pointer transition-colors hover-elevate ${
                      selectedAnalysis?.id === analysis.id ? "border-primary" : ""
                    }`}
                    onClick={() => handleSelectAnalysis(analysis)}
                    data-testid={`card-brand-${analysis.id}`}
                  >
                    <CardHeader className="p-4">
                      <CardTitle className="text-base">{analysis.brandName}</CardTitle>
                      <CardDescription className="text-sm truncate">
                        {analysis.productService}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>

              <div className="lg:col-span-2">
                {selectedAnalysis ? (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle>{selectedAnalysis.brandName}</CardTitle>
                        <CardDescription>{selectedAnalysis.productService}</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {isEditing ? (
                          <>
                            <Button
                              size="sm"
                              onClick={handleUpdateAnalysis}
                              disabled={updateMutation.isPending}
                              data-testid="button-save-edit"
                            >
                              {updateMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Save className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setIsEditing(false)}
                              data-testid="button-cancel-edit"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setIsEditing(true)}
                              data-testid="button-edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteClick(selectedAnalysis.id)}
                              data-testid="button-delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <AnalysisSection
                        icon={<Target className="w-5 h-5 text-blue-500" />}
                        title="USP (고유 판매 제안)"
                        content={isEditing ? editForm.usp || "" : selectedAnalysis.usp || ""}
                        isEditing={isEditing}
                        onChange={(value) => setEditForm({ ...editForm, usp: value })}
                      />
                      <AnalysisSection
                        icon={<Users className="w-5 h-5 text-green-500" />}
                        title="고객 페르소나"
                        content={isEditing ? editForm.customerPersona || "" : selectedAnalysis.customerPersona || ""}
                        isEditing={isEditing}
                        onChange={(value) => setEditForm({ ...editForm, customerPersona: value })}
                      />
                      <AnalysisSection
                        icon={<AlertCircle className="w-5 h-5 text-red-500" />}
                        title="고객 Pain Point"
                        content={isEditing ? editForm.painPoints || "" : selectedAnalysis.painPoints || ""}
                        isEditing={isEditing}
                        onChange={(value) => setEditForm({ ...editForm, painPoints: value })}
                      />
                      <AnalysisSection
                        icon={<Lightbulb className="w-5 h-5 text-yellow-500" />}
                        title="브랜드 Solution"
                        content={isEditing ? editForm.solution || "" : selectedAnalysis.solution || ""}
                        isEditing={isEditing}
                        onChange={(value) => setEditForm({ ...editForm, solution: value })}
                      />
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex items-center justify-center h-64 text-muted-foreground">
                    브랜드를 선택하면 상세 분석을 볼 수 있습니다
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Target className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">저장된 브랜드 분석이 없습니다</p>
                <Button onClick={() => setActiveTab("new")} data-testid="button-create-first">
                  <Plus className="w-4 h-4 mr-2" />
                  첫 브랜드 분석 시작
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="new" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>브랜드 정보 입력</CardTitle>
              <CardDescription>
                브랜드명과 제품/서비스를 입력하면 AI가 마케팅 전략을 분석합니다
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="brandName">브랜드명</Label>
                  <Input
                    id="brandName"
                    placeholder="예: 스타벅스, 나이키, 삼성"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    data-testid="input-brand-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="productService">제품/서비스</Label>
                  <Input
                    id="productService"
                    placeholder="예: 프리미엄 커피, 스포츠 의류, 스마트폰"
                    value={productService}
                    onChange={(e) => setProductService(e.target.value)}
                    data-testid="input-product-service"
                  />
                </div>
              </div>
              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending || !brandName.trim() || !productService.trim()}
                className="w-full"
                data-testid="button-generate"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    AI 분석 중...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    AI로 마케팅 전략 분석
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {generatedAnalysis && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{brandName} 분석 결과</CardTitle>
                  <CardDescription>{productService}</CardDescription>
                </div>
                <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save">
                  {saveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "저장하기"
                  )}
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                <AnalysisSection
                  icon={<Target className="w-5 h-5 text-blue-500" />}
                  title="USP (고유 판매 제안)"
                  content={generatedAnalysis.usp}
                />
                <AnalysisSection
                  icon={<Users className="w-5 h-5 text-green-500" />}
                  title="고객 페르소나"
                  content={generatedAnalysis.customerPersona}
                />
                <AnalysisSection
                  icon={<AlertCircle className="w-5 h-5 text-red-500" />}
                  title="고객 Pain Point"
                  content={generatedAnalysis.painPoints}
                />
                <AnalysisSection
                  icon={<Lightbulb className="w-5 h-5 text-yellow-500" />}
                  title="브랜드 Solution"
                  content={generatedAnalysis.solution}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>브랜드 분석 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 브랜드 분석을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AnalysisSection({
  icon,
  title,
  content,
  isEditing = false,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  content: string;
  isEditing?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-semibold">{title}</h3>
      </div>
      {isEditing && onChange ? (
        <Textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[120px]"
          data-testid={`textarea-${title.replace(/\s+/g, "-").toLowerCase()}`}
        />
      ) : (
        <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 p-4 rounded-lg">
          {content}
        </div>
      )}
    </div>
  );
}
