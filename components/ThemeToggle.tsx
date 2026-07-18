"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    const c = document.documentElement.classList;
    c.toggle("dark", next);
    c.toggle("light", !next);
    try {
      localStorage.setItem("torq-theme", next ? "dark" : "light");
    } catch {
      // private browsing
    }
  };

  return (
    <Button
      isIconOnly
      size="sm"
      radius="full"
      variant="light"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onPress={toggle}
    >
      <Icon
        icon={dark ? "solar:sun-2-bold-duotone" : "solar:moon-bold-duotone"}
        width={17}
        className="text-default-500"
      />
    </Button>
  );
}
