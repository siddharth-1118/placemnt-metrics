"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Bell, BellOff, Info, Loader2 } from "lucide-react";
import { Button, Card, CardContent } from "@/components/ui";

interface NotificationDto {
  id: string;
  title: string;
  body: string;
  kind: string;
  readAt: string | null;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

/**
 * Student-side notification surface: a prominent banner for unread items
 * (document removed by coordinator, password reset, …) plus the full recent
 * history. Marks everything read when the student has seen them.
 */
export function NotificationBell() {
  const [items, setItems] = useState<NotificationDto[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.ok) {
        const b = await res.json();
        setItems(b.notifications ?? []);
        if ((b.unread ?? 0) > 0) {
          fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
            .then(() => {})
            .catch(() => {});
        }
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (items === null) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 pt-5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking notifications…
        </CardContent>
      </Card>
    );
  }

  const unread = items.filter((n) => !n.readAt);
  const visible = expanded ? items : unread.length > 0 ? unread : items.slice(0, 1);

  if (items.length === 0) return null;

  return (
    <Card className={unread.length > 0 ? "border-warning/40" : undefined}>
      <CardContent className="space-y-2 pt-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            {unread.length > 0 ? (
              <>
                <span className="relative flex h-5 w-5 items-center justify-center">
                  <Bell className="h-4 w-4 text-warning" />
                  <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
                    {unread.length}
                  </span>
                </span>
                {unread.length === 1 ? "1 new notice" : `${unread.length} new notices`}
              </>
            ) : (
              <>
                <BellOff className="h-4 w-4 text-muted-foreground" /> Recent notices
              </>
            )}
          </div>
          {items.length > visible.length && (
            <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Show less" : "Show all"}
            </Button>
          )}
        </div>

        <ul className="space-y-2">
          {visible.map((n) => (
            <li
              key={n.id}
              className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm ${
                n.kind === "WARNING" ? "border-warning/40 bg-warning/10" : "bg-accent/30"
              } ${n.readAt ? "opacity-70" : ""}`}
            >
              {n.kind === "WARNING" ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              ) : (
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-tight">{n.title}</p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{n.body}</p>
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
