import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Shield, Users, Loader2 } from "lucide-react";
import type { User } from "@shared/schema";

export default function Admin() {
  const { user: currentUser, isAdmin } = useAuth();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAdmin,
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ id, isAdmin }: { id: string; isAdmin: boolean }) => {
      return await apiRequest(`/api/admin/users/${id}/admin`, {
        method: "PATCH",
        body: JSON.stringify({ isAdmin }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "권한 변경 완료",
        description: "사용자 권한이 변경되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "오류",
        description: error.message || "권한 변경에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/admin/users/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setDeletingId(null);
      toast({
        title: "삭제 완료",
        description: "사용자가 삭제되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "오류",
        description: error.message || "사용자 삭제에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Shield className="w-16 h-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">접근 권한 없음</h1>
        <p className="text-muted-foreground">이 페이지는 관리자만 접근할 수 있습니다.</p>
      </div>
    );
  }

  const getInitials = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  const getDisplayName = (user: User) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
    }
    return user.email ?? user.id;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="w-8 h-8" />
        <div>
          <h1 className="text-3xl font-bold">사용자 관리</h1>
          <p className="text-muted-foreground">등록된 사용자를 관리합니다</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>사용자 목록</CardTitle>
          <CardDescription>
            총 {users.length}명의 사용자가 등록되어 있습니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>사용자</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>가입일</TableHead>
                  <TableHead className="text-center">관리자</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={user.profileImageUrl ?? undefined} />
                          <AvatarFallback>{getInitials(user)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{getDisplayName(user)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.email ?? "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.createdAt 
                        ? new Date(user.createdAt).toLocaleDateString("ko-KR")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={user.isAdmin ?? false}
                        onCheckedChange={(checked) => 
                          toggleAdminMutation.mutate({ id: user.id, isAdmin: checked })
                        }
                        disabled={
                          user.id === currentUser?.id || 
                          toggleAdminMutation.isPending
                        }
                        data-testid={`switch-admin-${user.id}`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog open={deletingId === user.id} onOpenChange={(open) => !open && setDeletingId(null)}>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={user.id === currentUser?.id}
                            onClick={() => setDeletingId(user.id)}
                            data-testid={`button-delete-${user.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>사용자 삭제</AlertDialogTitle>
                            <AlertDialogDescription>
                              {getDisplayName(user)} 사용자를 정말 삭제하시겠습니까?
                              이 작업은 되돌릴 수 없습니다.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>취소</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteUserMutation.mutate(user.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              data-testid="button-confirm-delete"
                            >
                              {deleteUserMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                "삭제"
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
