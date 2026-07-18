"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

/** Shows only when the browser offers a real install prompt. */
export default function InstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !deferred) return null;

  return (
    <Button
      size="lg"
      radius="full"
      variant="light"
      className="text-default-500"
      startContent={<Icon icon="solar:download-minimalistic-linear" width={18} />}
      onPress={async () => {
        await deferred.prompt();
        setDeferred(null);
      }}
    >
      Install app
    </Button>
  );
}
