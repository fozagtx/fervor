"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useSound } from "@/lib/sound";

/** Global voice/sound switch: stadium effects and the pundit voice. */
export default function MuteButton() {
  const { on, toggle } = useSound();
  return (
    <Button
      isIconOnly
      size="sm"
      radius="full"
      variant="light"
      aria-label={on ? "Mute all sound" : "Unmute sound"}
      onPress={toggle}
    >
      <Icon
        icon={on ? "solar:volume-loud-bold-duotone" : "solar:muted-bold-duotone"}
        width={17}
        className={on ? "text-primary" : "text-default-400"}
      />
    </Button>
  );
}
