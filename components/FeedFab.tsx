"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";

/** Floating entry to the vertical moments feed. */
export default function FeedFab() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center">
      <Button
        as={Link}
        href="/feed"
        radius="full"
        className="font-pixel pointer-events-auto bg-foreground text-background shadow-lg"
        startContent={<Icon icon="solar:play-stream-bold" width={17} />}
      >
        Moments
      </Button>
    </div>
  );
}
