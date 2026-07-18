"use client";

import { Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";

export default function TopBar({ live }: { live?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-large border-small border-default-200 bg-content1 px-4 py-3 shadow-sm">
      <Link href="/" className="flex items-center gap-3">
        <div className="flex items-center justify-center rounded-medium border border-primary-100 bg-primary-50 p-2">
          <Icon icon="solar:heart-pulse-bold-duotone" className="text-primary" width={22} />
        </div>
        <div className="flex flex-col">
          <p className="text-medium font-semibold leading-tight">Match Pulse</p>
          <p className="text-tiny text-default-400 leading-tight">World Cup, second by second</p>
        </div>
      </Link>
      <div className="flex items-center gap-2">
        {live && (
          <Chip
            size="sm"
            variant="flat"
            color="primary"
            startContent={<span className="live-dot ml-1 inline-block h-2 w-2 rounded-full bg-primary" />}
          >
            LIVE
          </Chip>
        )}
        <Chip size="sm" variant="bordered" className="border-default-300 text-default-500">
          <span className="flex items-center gap-1">
            <Icon icon="solar:bolt-linear" width={13} />
            TxLINE
          </span>
        </Chip>
      </div>
    </div>
  );
}
