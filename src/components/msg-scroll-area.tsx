"use client";

import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { ChevronDownIcon } from "lucide-react";

const MsgScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & {
    scrollToBottom?: boolean;
  }
>(({ className, children, scrollToBottom, ...props }, ref) => {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = React.useState(true);

  // Scroll to bottom when component mounts
  React.useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, []);

  // Check if the user is near the bottom of the scroll area
  const isNearBottom = () => {
    const viewport = viewportRef.current;
    if (!viewport) return false;
    const threshold = 100;
    return (
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <
      threshold
    );
  };

  // Update the isAtBottom state when the user scrolls
  const handleScroll = () => {
    setIsAtBottom(isNearBottom());
  };

  // Scroll to bottom when scrollToBottom prop is true
  React.useEffect(() => {
    if (scrollToBottom && viewportRef.current && isNearBottom()) {
      viewportRef.current.scrollTo({
        top: viewportRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [scrollToBottom, children]);

  return (
    <ScrollAreaPrimitive.Root
      ref={ref}
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        onScroll={handleScroll}
        className="h-full w-full rounded-[inherit]"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>

      {/* Scroll to bottom button appears when not at bottom */}
      {!isAtBottom && (
        <Button
          onClick={() => {
            viewportRef.current?.scrollTo({
              top: viewportRef.current.scrollHeight,
              behavior: "smooth",
            });
          }}
          className="absolute bottom-4 right-4 rounded-full shadow-lg"
          size="icon"
        >
          <ChevronDownIcon className="h-4 w-4" />
        </Button>
      )}
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
});
MsgScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" &&
        "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" &&
        "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { MsgScrollArea, ScrollBar };
