"use client";

import { Button, Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

interface VerifyResult {
  verified: boolean;
  programId?: string;
  merkleRootsAccount?: string;
  computeUnits?: number;
  error?: string;
  score?: {
    proven: boolean;
    scoreline?: string;
    participant1?: string;
    participant2?: string;
  };
}

export default function ProofBadge({ fixtureId }: { fixtureId: number }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "failed">("idle");
  const [result, setResult] = useState<VerifyResult | null>(null);

  const verify = async () => {
    setState("loading");
    try {
      const res = await fetch(`/api/verify/${fixtureId}`);
      const body = (await res.json()) as VerifyResult;
      setResult(body);
      setState(body.verified ? "done" : "failed");
    } catch {
      setResult({ verified: false, error: "network error" });
      setState("failed");
    }
  };

  return (
    <Card shadow="sm" className="border-small border-default-200">
      <CardBody className="flex-row flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex items-center justify-center rounded-medium border border-primary-100 bg-primary-50 p-2">
            <Icon
              icon={state === "done" ? "solar:shield-check-bold-duotone" : "solar:shield-keyhole-bold-duotone"}
              className="text-primary"
              width={20}
            />
          </div>
          <div className="flex min-w-0 flex-col">
            <p className="text-small font-semibold">Provably real</p>
            {state === "done" && result ? (
              <p className="truncate text-tiny text-default-400">
                {result.score?.proven
                  ? `Verified. The ${result.score.scoreline} scoreline is proven on Solana, not just reported.`
                  : "Verified. This match data matches Solana's public record."}
              </p>
            ) : state === "failed" ? (
              <p className="truncate text-tiny text-danger">
                Could not verify right now. Try again in a moment.
              </p>
            ) : (
              <p className="truncate text-tiny text-default-400">
                Check this match against Solana&apos;s public record
              </p>
            )}
          </div>
        </div>
        {state === "done" && result?.programId ? (
          <Button
            as="a"
            href={`https://explorer.solana.com/address/${result.programId}?cluster=devnet`}
            target="_blank"
            size="sm"
            radius="full"
            variant="bordered"
            className="border-default-300"
            startContent={<Icon icon="solar:link-linear" width={14} />}
          >
            See the record
          </Button>
        ) : (
          <Button
            size="sm"
            radius="full"
            color="primary"
            isLoading={state === "loading"}
            startContent={
              state === "loading" ? undefined : <Icon icon="solar:shield-check-bold" width={16} />
            }
            onPress={verify}
          >
            {state === "failed" ? "Retry" : "Verify on Solana"}
          </Button>
        )}
      </CardBody>
    </Card>
  );
}
