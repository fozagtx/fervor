"use client";

import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";
import { Icon } from "@iconify/react";
import { shortAddress, useWallet } from "@/lib/useWallet";

export default function WalletButton() {
  const { address, available, connect, disconnect } = useWallet();

  if (!available) return null;

  if (!address) {
    return (
      <Button
        size="sm"
        radius="full"
        variant="bordered"
        aria-label="Connect wallet"
        className="border-default-300 text-default-600"
        startContent={<Icon icon="solar:wallet-linear" width={15} />}
        onPress={connect}
      >
        <span className="hidden sm:inline">Connect</span>
      </Button>
    );
  }

  return (
    <Dropdown>
      <DropdownTrigger>
        <Button
          size="sm"
          radius="full"
          variant="flat"
          color="primary"
          className="font-mono"
          startContent={<Icon icon="solar:wallet-bold" width={15} />}
        >
          {shortAddress(address)}
        </Button>
      </DropdownTrigger>
      <DropdownMenu aria-label="Wallet options">
        <DropdownItem key="saved" isReadOnly className="text-tiny text-default-400">
          Your call record is saved to this wallet
        </DropdownItem>
        <DropdownItem
          key="disconnect"
          color="danger"
          startContent={<Icon icon="solar:logout-2-linear" width={15} />}
          onPress={disconnect}
        >
          Disconnect
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
