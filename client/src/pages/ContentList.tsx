import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ContentSet } from "@shared/schema";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Instagram, FileText, MoreVertical, Edit, Trash2, Calendar, Search, Eye, Loader2 } from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    draft: { label: "초안", variant: "secondary" },
    scheduled: { label: "예약됨", variant: "default" },
    publishing: { label: "발행 중", variant: "outline" },
    published: { label: "발행됨", variant: "default" },
    failed: { label: "실패", variant: "destructive" },
  };

  const config = statusConfig[status] || { label: status, variant: "secondary" as const };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export default function ContentList() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
      setDeleteId(null);
    },
    onError: () => {
      toast({
        title: "삭제 실패",
        description: "콘텐츠 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const filteredContent = contentSets.filter((content) =>
    content.keyword.toLowerCase().includes(searchQuery.toLowerCase()) ||
    content.blogTitle?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold" data-testid="text-page-title">
          콘텐츠 리스트
        </h1>
        <p className="text-muted-foreground mt-1">
          저장된 모든 콘텐츠를 관리하고 재사용하세요
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="콘텐츠 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-content"
          />
        </div>
        <Link href="/">
          <Button data-testid="button-create-new">
            새 콘텐츠 생성
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredContent.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">
            {searchQuery ? "검색 결과가 없습니다" : "저장된 콘텐츠가 없습니다"}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery
              ? "다른 검색어로 시도해보세요."
              : "콘텐츠 생성 메뉴에서 새로운 콘텐츠를 만들어보세요."}
          </p>
          {!searchQuery && (
            <Link href="/">
              <Button data-testid="button-create-first">첫 콘텐츠 만들기</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredContent.map((content) => (
            <Card key={content.id} className="overflow-hidden hover-elevate" data-testid={`card-content-${content.id}`}>
              <CardHeader className="p-0">
                <div className="aspect-video bg-muted relative">
                  {content.instagramImageUrls?.[0] ? (
                    <img
                      src={content.instagramImageUrls[0]}
                      alt={content.keyword}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <div className="text-muted-foreground">
                        <Instagram className="h-8 w-8" />
                      </div>
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8"
                          data-testid={`button-actions-${content.id}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <Link href={`/edit/${content.id}`}>
                          <DropdownMenuItem data-testid={`button-view-${content.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            보기
                          </DropdownMenuItem>
                        </Link>
                        <Link href={`/edit/${content.id}`}>
                          <DropdownMenuItem data-testid={`button-edit-${content.id}`}>
                            <Edit className="mr-2 h-4 w-4" />
                            수정
                          </DropdownMenuItem>
                        </Link>
                        <DropdownMenuItem
                          onClick={() => setDeleteId(content.id)}
                          className="text-destructive"
                          data-testid={`button-delete-${content.id}`}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          삭제
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div>
                  <h3 className="font-medium line-clamp-1" data-testid={`text-keyword-${content.id}`}>
                    {content.blogTitle || content.keyword}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {content.createdAt
                      ? new Date(content.createdAt).toLocaleDateString("ko-KR")
                      : "날짜 없음"}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
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
              </CardContent>
              <CardFooter className="p-4 pt-0 flex items-center justify-between gap-2">
                <StatusBadge status={content.status || "draft"} />
                <div className="flex items-center gap-2 ml-auto">
                  {content.scheduledDate && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(content.scheduledDate).toLocaleDateString("ko-KR")}
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteId(content.id)}
                    data-testid={`button-delete-footer-${content.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    삭제
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>콘텐츠를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 되돌릴 수 없습니다. 콘텐츠가 영구적으로 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
