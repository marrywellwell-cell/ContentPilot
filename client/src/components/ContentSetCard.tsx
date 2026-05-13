import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Instagram, FileText, MoreVertical, Calendar, Edit, Trash2 } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";

interface ContentSetCardProps {
  id: string;
  keyword: string;
  platforms: string[];
  scheduledDate?: Date;
  status: "draft" | "scheduled" | "publishing" | "published" | "failed";
  imageUrl?: string;
  blogTitle?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onSchedule?: () => void;
}

export function ContentSetCard({
  keyword,
  platforms,
  scheduledDate,
  status,
  imageUrl,
  blogTitle,
  onEdit,
  onDelete,
  onSchedule,
}: ContentSetCardProps) {
  return (
    <Card className="overflow-hidden hover-elevate">
      <CardHeader className="p-0">
        <div className="aspect-video bg-muted relative">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={keyword}
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
                  data-testid="button-content-actions"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit} data-testid="button-edit-content">
                  <Edit className="mr-2 h-4 w-4" />
                  수정
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onSchedule} data-testid="button-schedule-content">
                  <Calendar className="mr-2 h-4 w-4" />
                  예약
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive"
                  data-testid="button-delete-content"
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
          <h3 className="font-semibold line-clamp-1" data-testid="text-content-keyword">
            {keyword}
          </h3>
          {blogTitle && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-1" data-testid="text-blog-title">
              {blogTitle}
            </p>
          )}
          {scheduledDate && (
            <p className="text-sm text-muted-foreground mt-1">
              <Calendar className="inline h-3 w-3 mr-1" />
              {format(scheduledDate, "MMM d, yyyy 'at' h:mm a")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {platforms.includes("instagram") && (
            <Badge variant="secondary">
              <Instagram className="mr-1 h-3 w-3" />
              Instagram
            </Badge>
          )}
          {platforms.includes("blog") && (
            <Badge variant="secondary">
              <FileText className="mr-1 h-3 w-3" />
              Blog
            </Badge>
          )}
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <StatusBadge status={status} />
      </CardFooter>
    </Card>
  );
}
