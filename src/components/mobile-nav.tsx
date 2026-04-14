"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/components/nav-config";

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Link
          href="/"
          className="flex items-center gap-2 font-bold tracking-tight"
          onClick={() => setOpen(false)}
        >
          <Zap className="h-6 w-6 text-primary" />
          <span className="text-lg">Experidium</span>
        </Link>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="flex h-full w-[min(100vw-2rem,20rem)] flex-col gap-0 p-0"
        >
          <SheetHeader className="border-b px-4 py-3 text-left">
            <SheetTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Menu
            </SheetTitle>
          </SheetHeader>
          <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">Outreach CRM v1.0</p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
