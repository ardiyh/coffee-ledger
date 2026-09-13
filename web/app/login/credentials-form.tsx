"use client";

import { useActionState } from "react";
import { credentialsSignInAction, type CredentialsActionState } from "./actions";

const initialActionState: CredentialsActionState = {};

const inputClass =
  "w-full rounded-md border border-line bg-panel-2 px-3 py-2 font-body text-sm text-ink placeholder:text-ink-faint focus:border-amber focus:outline-none";
const labelClass = "font-body text-xs uppercase tracking-wide text-ink-faint";

export function CredentialsForm() {
  const [state, formAction, pending] = useActionState(
    credentialsSignInAction,
    initialActionState,
  );

  return (
    <form action={formAction} className="mt-4 text-left">
      <fieldset disabled={pending} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="flex h-11 w-full items-center justify-center rounded-full border border-line font-body text-sm font-semibold text-ink transition-colors hover:border-amber hover:text-amber disabled:opacity-50"
        >
          {pending ? "Memeriksa..." : "Masuk"}
        </button>
        {state.error ? (
          <p className="font-body text-sm text-clay-ink" role="alert">
            {state.error}
          </p>
        ) : null}
      </fieldset>
    </form>
  );
}
