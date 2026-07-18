"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useSound } from "@/lib/sound";

export default function SoundToggle() {
  const { on, toggle } = useSound();

  return (
    <Button
      size="sm"
      radius="full"
      variant={on ? "flat" : "bordered"}
      color={on ? "primary" : "default"}
      className={on ? "" : "border-default-300 text-default-500"}
      startContent={
        <Icon icon={on ? "solar:music-note-2-bold" : "solar:muted-linear"} width={15} />
      }
      onPress={toggle}
    >
      Stadium
    </Button>
  );
}
