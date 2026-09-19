"use client";

import { useActionState, useState } from "react";
import { credentialsSignInAction, type CredentialsActionState } from "./actions";

const initialActionState: CredentialsActionState = {};

const inputClass = "min-h-11 w-full rounded-md border border-line bg-panel-2 px-3 py-2 font-body text-base sm:text-sm text-ink placeholder:text-ink-faint focus:border-amber focus:outline-none";
const labelClass = "font-body text-xs uppercase tracking-wide text-ink-faint";
const toggleButtonClass = "h-11 shrink-0 rounded-full border border-line px-3 font-body text-xs text-ink-dim transition-colors hover:border-amber hover:text-amber";

export function CredentialsForm() {
  const [state, formAction, pending] = useActionState(credentialsSignInAction, initialActionState);
  // Controlled so a failed submit doesn't wipe what was typed: React resets
  // uncontrolled form fields after a form action completes (mirroring
  // native form-reset behavior), which would otherwise clear the email the
  // moment a login attempt fails -- exactly when the user most needs it
  // still there to fix a typo and retry.
  const [email, setEmail] = useState("");
  // Password deliberately stays uncontrolled (native DOM value only) -- it
  // is never lifted into React state, logged, or persisted anywhere. This
  // toggle only flips the input's `type` attribute between "password" and
  // "text"; it doesn't need to read or hold the value to do that.
  const [passwordVisible, setPasswordVisible] = useState(false);

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
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Password</span>
          <div className="flex items-center gap-2">
            <input
              name="password"
              type={passwordVisible ? "text" : "password"}
              required
              autoComplete="current-password"
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              onClick={() => setPasswordVisible((visible) => !visible)}
              className={toggleButtonClass}
            >
              {passwordVisible ? "Sembunyikan password" : "Tampilkan password"}
            </button>
          </div>
        </label>
        <button type="submit" disabled={pending} className="flex h-11 w-full items-center justify-center rounded-full border border-line font-body text-sm font-semibold text-ink transition-colors hover:border-amber hover:text-amber disabled:opacity-50">
          {pending ? "Memeriksa..." : "Masuk"}
        </button>
        {state.error ? (
          <p className="font-body text-sm text-clay-ink" role="alert">{state.error}</p>
        ) : null}
      </fieldset>
    </form>
  );
}
