"use client";

import { useState, useTransition } from "react";
import { useShot } from "@/components/shot-provider";
import { createStarterAccounts, type CreateResult } from "./actions";

export function CreateAccountsButton({ count }: { count: number }) {
  const shoot = useShot();
  const [result, setResult] = useState<CreateResult | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const res = await createStarterAccounts();
      setResult(res);
      if (res.ok && res.created > 0) shoot("Accounts created", `${res.created} starter accounts are ready`);
    });
  }

  return (
    <div className="field">
      <button type="button" className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={run} disabled={pending || count === 0}>
        {pending && <span className="spinner" aria-hidden="true" />}
        {pending ? "Creating…" : `Create ${count} starter account${count === 1 ? "" : "s"}`}
      </button>
      {result && !result.ok && <p className="error" role="alert">{result.message}</p>}
      {result?.ok && (
        <div className="small" role="status">
          <p style={{ margin: 0 }}>
            Created {result.created}.{result.remaining > 0 && ` ${result.remaining} still to go: tap the button again.`}
          </p>
          {result.failed.length > 0 && (
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {result.failed.map((f) => (
                <li key={f.student_id}>{f.student_id}: {f.reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function CopyText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      style={{ alignSelf: "flex-start" }}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Copied" : "Copy message"}
    </button>
  );
}
