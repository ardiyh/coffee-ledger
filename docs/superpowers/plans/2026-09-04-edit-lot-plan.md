# Edit Lot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Habiskan" button on each `/rak` lot row with an "Edit" button that lets the owner correct a lot's descriptive fields (name, origin, varietal, processMethod, roastDate, notes) inline, without touching stock.

**Architecture:** New `updateLot` at repository → service → Server Action layers (mirrors the existing `addLot` path exactly). New `EditLotForm` client component, toggled inline inside `LotRow` the same way the page already toggles "Tambah lot baru" via `<details>`. `finishLotAction` and `finish-lot-button.tsx` are deleted — zeroing stock stays possible through the existing "Koreksi turun" transaction action.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM (`drizzle-orm/pg-core`), Vitest + PGlite.

**Spec:** `docs/superpowers/specs/2026-09-03-edit-lot-design.md`

---

### Task 1: Data layer — `updateLot` (repository + service)

**Files:**
- Modify: `web/lib/ledger/repository.ts` (add `updateLot`, right after `listLots`, currently line 113)
- Modify: `web/lib/ledger/service.ts` (add `updateLot`, right after `addLot`, currently line 49)
- Test: `web/lib/ledger/ledger.test.ts` (add `describe("updateLot", ...)`, right after the `describe("finishLot", ...)` block, currently ending line 259)

- [ ] **Step 1: Write the failing test**

Insert this new `describe` block into `web/lib/ledger/ledger.test.ts`, right after the closing
`});` of `describe("finishLot", ...)` (currently line 259) and before
`describe("addLotWithInitialStock", ...)`:

```ts
describe("updateLot", () => {
  it("mengubah field lot yang ada", async () => {
    const db = await freshDb();
    const created = await service.addLot(db, {
      name: "Gayo Wine",
      origin: "Gayo, Aceh",
      varietal: "Typica",
      roastDate: "2026-06-20",
    });

    const updated = await service.updateLot(db, created.id, {
      name: "Gayo Wine Natural",
      origin: "Gayo, Aceh",
      varietal: "Bourbon",
      roastDate: "2026-06-21",
      processMethod: "Natural",
      notes: "typo dibetulin",
    });

    expect(updated.name).toBe("Gayo Wine Natural");
    expect(updated.varietal).toBe("Bourbon");
    expect(updated.roastDate).toBe("2026-06-21");
    expect(updated.processMethod).toBe("Natural");
    expect(updated.notes).toBe("typo dibetulin");

    const stored = (await service.listLots(db)).find((l) => l.id === created.id);
    expect(stored?.name).toBe("Gayo Wine Natural");
  });

  it("lot yang gak ada melempar LotNotFoundError", async () => {
    const db = await freshDb();
    await expect(
      service.updateLot(db, 999, {
        name: "x",
        origin: "y",
        varietal: "z",
        roastDate: "2026-01-01",
      }),
    ).rejects.toThrow(LotNotFoundError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `web/`): `npm test -- --run -t updateLot`
Expected: FAIL — `service.updateLot is not a function` (or a TypeScript error if you run
`npx tsc --noEmit` instead — either way, it must not pass).

- [ ] **Step 3: Write minimal implementation**

In `web/lib/ledger/repository.ts`, add this function right after `listLots` (after line 113,
before `addTransaction`):

```ts
export async function updateLot(
  db: LedgerDb,
  lotId: number,
  fields: NewLot,
): Promise<Lot | null> {
  const [row] = await db
    .update(lot)
    .set({
      name: fields.name,
      origin: fields.origin,
      varietal: fields.varietal,
      processMethod: fields.processMethod ?? null,
      roastDate: fields.roastDate,
      notes: fields.notes ?? null,
    })
    .where(eq(lot.id, lotId))
    .returning();
  return row ? mapLot(row) : null;
}
```

(`eq` is already imported at the top of this file — no new import needed.)

In `web/lib/ledger/service.ts`, add this function right after `addLot` (after line 49, before
`addLotWithInitialStock`):

```ts
export async function updateLot(
  db: LedgerDb,
  lotId: number,
  args: NewLotArgs,
): Promise<Lot> {
  const fields: NewLot = {
    name: args.name,
    origin: args.origin,
    varietal: args.varietal,
    processMethod: args.processMethod ?? null,
    roastDate: args.roastDate,
    notes: args.notes ?? null,
  };
  const updated = await repo.updateLot(db, lotId, fields);
  if (updated === null) {
    throw new LotNotFoundError(`Lot id=${lotId} gak ditemukan`);
  }
  return updated;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `web/`): `npm test -- --run`
Expected: all tests pass, including the two new `updateLot` tests (total count goes from 38 to
40).

- [ ] **Step 5: Commit**

```bash
cd /Users/hilmi/orca/workspaces/Coffee/CoffeeData
git add web/lib/ledger/repository.ts web/lib/ledger/service.ts web/lib/ledger/ledger.test.ts
git commit -m "$(cat <<'EOF'
feat: updateLot di repository dan service

Fungsi buat ubah field deskriptif lot yang sudah ada (name, origin,
varietal, processMethod, roastDate, notes). Lot gak ketemu -> lempar
LotNotFoundError, sama seperti pola record()/finishLot() yang ada.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6
EOF
)"
```

---

### Task 2: Server Action — `editLotAction`

No automated test for this task — `addLotAction` and `recordAction` (the two existing Server
Actions this mirrors) don't have one either, since Server Actions in this codebase are
verified through `npx tsc --noEmit` plus the manual browser check in Task 5, not Vitest.

**Files:**
- Modify: `web/app/(app)/actions.ts`

- [ ] **Step 1: Add `editLotAction`**

In `web/app/(app)/actions.ts`, change the import block (currently lines 7-14) from:

```ts
import {
  addLotWithInitialStock,
  recordAcquire,
  recordBrew,
  recordGift,
  recordAdjust,
  finishLot,
} from "@/lib/ledger/service";
```

to:

```ts
import {
  addLotWithInitialStock,
  recordAcquire,
  recordBrew,
  recordGift,
  recordAdjust,
  finishLot,
  updateLot,
} from "@/lib/ledger/service";
```

(`finishLot` stays imported for now — `finishLotAction` is only removed in Task 4, together
with its sole caller.)

Then add this new action at the end of the file, after `finishLotAction`'s closing `}`
(currently line 153):

```ts

export async function editLotAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Real auth boundary for this action — see addLotAction above.
  await requireSession();

  const lotId = Number(formData.get("lotId"));
  const name = String(formData.get("name") ?? "").trim();
  const origin = String(formData.get("origin") ?? "").trim();
  const varietal = String(formData.get("varietal") ?? "").trim();
  const processMethod = String(formData.get("processMethod") ?? "").trim();
  const roastDate = String(formData.get("roastDate") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!Number.isFinite(lotId) || lotId <= 0) {
    return { error: "Lot gak dikenal." };
  }
  if (!name || !origin || !varietal || !processMethod || !roastDate) {
    return {
      error: "Nama, origin, varietal, proses, dan tanggal roast wajib diisi.",
    };
  }

  try {
    await updateLot(db, lotId, {
      name,
      origin,
      varietal,
      processMethod,
      roastDate,
      notes: notes || null,
    });
  } catch (err) {
    if (err instanceof LedgerError) return { error: err.message };
    throw err;
  }

  // Fresh numbers/names on Rak's rows, history, and the dashboard.
  revalidatePath("/rak");
  revalidatePath("/history");
  revalidatePath("/dashboard");
  return { success: true };
}
```

- [ ] **Step 2: Type-check**

Run (from `web/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the full test suite (regression check)**

Run (from `web/`): `npm test -- --run`
Expected: all 40 tests still pass (this task doesn't touch anything the tests cover, so this
just confirms nothing broke).

- [ ] **Step 4: Commit**

```bash
cd /Users/hilmi/orca/workspaces/Coffee/CoffeeData
git add web/app/\(app\)/actions.ts
git commit -m "$(cat <<'EOF'
feat: editLotAction — Server Action buat ubah data lot

Sejajar addLotAction: requireSession, validasi field wajib, panggil
service.updateLot, LedgerError jadi pesan di form.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6
EOF
)"
```

---

### Task 3: `EditLotForm` component

**Files:**
- Create: `web/app/(app)/rak/edit-lot-form.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useActionState } from "react";
import { editLotAction, type ActionState } from "../actions";

const initialActionState: ActionState = {};

const inputClass =
  "w-full rounded-md border border-line bg-panel-2 px-3 py-2 font-body text-sm text-ink placeholder:text-ink-faint focus:border-amber focus:outline-none";
const labelClass = "font-body text-xs uppercase tracking-wide text-ink-faint";

interface LotSuggestions {
  origins: string[];
  varietals: string[];
  processMethods: string[];
}

export interface EditLotFormProps {
  lotId: number;
  initial: {
    name: string;
    origin: string;
    varietal: string;
    processMethod: string | null;
    roastDate: string;
    notes: string | null;
  };
  suggestions: LotSuggestions;
  onCancel: () => void;
  onSaved: () => void;
}

/**
 * Form edit data deskriptif lot, dipasang inline di dalam LotRow saat mode
 * edit aktif. Tidak punya logic penyusunan nama otomatis seperti AddLotForm:
 * "kata khusus" yang dipakai composeLotName tidak disimpan sebagai kolom,
 * jadi begitu lot tersimpan, name cuma teks bebas biasa.
 */
export function EditLotForm({
  lotId,
  initial,
  suggestions,
  onCancel,
  onSaved,
}: EditLotFormProps) {
  // Sama seperti AddLotForm: keluar dari mode edit terjadi di sini, setelah
  // tahu tulisannya sukses -- bukan lewat useEffect yang mengamati state.success.
  async function submit(prevState: ActionState, formData: FormData) {
    const result = await editLotAction(prevState, formData);
    if (result.success) onSaved();
    return result;
  }

  const [state, formAction, pending] = useActionState(submit, initialActionState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <input type="hidden" name="lotId" value={lotId} />

      <label className="flex flex-col gap-1">
        <span className={labelClass}>Nama</span>
        <input
          name="name"
          type="text"
          required
          defaultValue={initial.name}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClass}>Origin</span>
        <input
          name="origin"
          type="text"
          required
          list={`edit-origins-${lotId}`}
          defaultValue={initial.origin}
          className={inputClass}
        />
        <datalist id={`edit-origins-${lotId}`}>
          {suggestions.origins.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClass}>Varietal</span>
        <input
          name="varietal"
          type="text"
          required
          list={`edit-varietals-${lotId}`}
          defaultValue={initial.varietal}
          className={inputClass}
        />
        <datalist id={`edit-varietals-${lotId}`}>
          {suggestions.varietals.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClass}>Proses pasca panen</span>
        <input
          name="processMethod"
          type="text"
          required
          list={`edit-process-${lotId}`}
          defaultValue={initial.processMethod ?? ""}
          className={inputClass}
        />
        <datalist id={`edit-process-${lotId}`}>
          {suggestions.processMethods.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClass}>Tanggal roast</span>
        <input
          name="roastDate"
          type="date"
          required
          defaultValue={initial.roastDate}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className={labelClass}>Catatan (opsional)</span>
        <textarea
          name="notes"
          rows={2}
          defaultValue={initial.notes ?? ""}
          className={inputClass}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-amber px-5 py-2 font-body text-sm font-semibold text-ground transition-colors hover:bg-amber-dim disabled:opacity-50"
        >
          {pending ? "Menyimpan..." : "Simpan"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-line px-5 py-2 font-body text-sm text-ink-dim transition-colors hover:border-clay hover:text-clay"
        >
          Batal
        </button>
        {state.error ? (
          <p className="w-full font-body text-sm text-clay" role="alert">
            {state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
```

Note the `list={`edit-origins-${lotId}`}` / matching `datalist id`: multiple `LotRow`s can be
in edit mode on the page at once, each rendering its own `EditLotForm`, so the datalist ids
must be unique per lot — a plain `"edit-origins"` id repeated across rows would collide in the
DOM.

- [ ] **Step 2: Type-check and lint**

Run (from `web/`): `npx tsc --noEmit && npx eslint app/\(app\)/rak/edit-lot-form.tsx`
Expected: no errors. (The component isn't wired into any page yet, so there's nothing to
exercise at runtime until Task 4 — this step only confirms it compiles cleanly.)

- [ ] **Step 3: Commit**

```bash
cd /Users/hilmi/orca/workspaces/Coffee/CoffeeData
git add web/app/\(app\)/rak/edit-lot-form.tsx
git commit -m "$(cat <<'EOF'
feat: komponen EditLotForm

Form inline buat ubah data deskriptif lot (name/origin/varietal/
processMethod/roastDate/notes). Belum dipasang ke LotRow -- itu di
task berikutnya.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6
EOF
)"
```

---

### Task 4: Wire it up — `LotRow`, `RakPage`, delete `finish-lot-button.tsx`

This is one task/commit because the pieces are coupled: `LotRow` needs a new required
`suggestions` prop that only `RakPage` can supply, and `finishLotAction` can only be deleted
once its sole caller (`FinishLotButton`) is gone. Splitting these across commits would leave a
commit where the app doesn't type-check.

**Files:**
- Modify: `web/app/(app)/rak/lot-row.tsx`
- Modify: `web/app/(app)/rak/page.tsx`
- Modify: `web/app/(app)/actions.ts` (remove `finishLotAction`)
- Delete: `web/app/(app)/rak/finish-lot-button.tsx`

- [ ] **Step 1: Rewrite `lot-row.tsx`**

Replace the entire contents of `web/app/(app)/rak/lot-row.tsx` with:

```tsx
"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { recordAction, type ActionState } from "../actions";
import { daysSince, formatGrams } from "@/lib/format";
import { EditLotForm } from "./edit-lot-form";

const initialActionState: ActionState = {};

const inputClass =
  "rounded-md border border-line bg-panel-2 px-2 py-1.5 font-body text-sm text-ink placeholder:text-ink-faint focus:border-amber focus:outline-none";
const labelClass = "font-body text-xs uppercase tracking-wide text-ink-faint";

const ACTION_OPTIONS = [
  { value: "ACQUIRE", label: "Masuk / beli" },
  { value: "BREW", label: "Seduh" },
  { value: "GIFT", label: "Kasih orang" },
  { value: "ADJUST_IN", label: "Koreksi naik" },
  { value: "ADJUST_OUT", label: "Koreksi turun" },
] as const;

interface LotSuggestions {
  origins: string[];
  varietals: string[];
  processMethods: string[];
}

export interface LotRowProps {
  lotId: number;
  name: string;
  origin: string;
  varietal: string;
  processMethod: string | null;
  roastDate: string;
  notes: string | null;
  stock: number;
  suggestions: LotSuggestions;
}

export function LotRow({
  lotId,
  name,
  origin,
  varietal,
  processMethod,
  roastDate,
  notes,
  stock,
  suggestions,
}: LotRowProps) {
  const [state, formAction, pending] = useActionState(
    recordAction,
    initialActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      {editing ? (
        <EditLotForm
          lotId={lotId}
          initial={{ name, origin, varietal, processMethod, roastDate, notes }}
          suggestions={suggestions}
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      ) : (
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-body text-base text-ink">{name}</p>
            <p className="mt-1 font-body text-xs text-ink-faint">
              {origin} · {varietal} · {processMethod ?? "proses tidak dicatat"}
              {" · "}
              {daysSince(roastDate)} hari sejak roast
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="font-mono text-lg tabular-nums text-ink">
              {formatGrams(stock)}
            </span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-full border border-line px-3 py-1 font-body text-xs text-ink-dim transition-colors hover:border-amber hover:text-amber"
            >
              Edit
            </button>
          </div>
        </div>
      )}

      <form
        ref={formRef}
        action={formAction}
        className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4"
      >
        <input type="hidden" name="lotId" value={lotId} />

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Aksi</span>
          <select
            name="kind"
            required
            defaultValue="ACQUIRE"
            className={inputClass}
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Gram</span>
          <input
            name="grams"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            required
            className={`${inputClass} w-24`}
            placeholder="250"
          />
        </label>

        <label className="flex flex-1 min-w-[10rem] flex-col gap-1">
          <span className={labelClass}>Catatan (opsional)</span>
          <input
            name="note"
            type="text"
            className={inputClass}
            placeholder="Catatan tambahan..."
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-amber px-5 py-2 font-body text-sm font-semibold text-ground transition-colors hover:bg-amber-dim disabled:opacity-50"
        >
          {pending ? "Menyimpan..." : "Catat"}
        </button>

        {state.error ? (
          <p className="w-full font-body text-sm text-clay" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="w-full font-body text-sm text-teal">Tercatat.</p>
        ) : null}
      </form>
    </div>
  );
}
```

(Only changes from the current file: new `suggestions`/`notes` props, `editing` state, the
header block conditionally rendering `EditLotForm` instead of always rendering the
name/origin display, and the `Edit` button replacing the conditional `FinishLotButton`. The
transaction form at the bottom is untouched.)

- [ ] **Step 2: Update `rak/page.tsx` to pass `notes` and `suggestions` to each row**

In `web/app/(app)/rak/page.tsx`, replace the `<LotRow ... />` call (currently lines 55-64):

```tsx
            <LotRow
              key={lot.id}
              lotId={lot.id}
              name={lot.name}
              origin={lot.origin}
              varietal={lot.varietal}
              processMethod={lot.processMethod}
              roastDate={lot.roastDate}
              stock={stock}
            />
```

with:

```tsx
            <LotRow
              key={lot.id}
              lotId={lot.id}
              name={lot.name}
              origin={lot.origin}
              varietal={lot.varietal}
              processMethod={lot.processMethod}
              roastDate={lot.roastDate}
              notes={lot.notes}
              stock={stock}
              suggestions={suggestions}
            />
```

(`suggestions` is already computed earlier in this file for `AddLotForm` — it's the same
object, reused as-is.)

- [ ] **Step 3: Delete `finish-lot-button.tsx`**

```bash
rm "/Users/hilmi/orca/workspaces/Coffee/CoffeeData/web/app/(app)/rak/finish-lot-button.tsx"
```

- [ ] **Step 4: Remove `finishLotAction` from `actions.ts`**

In `web/app/(app)/actions.ts`, remove `finishLot` from the service import block (added back to
plain, since nothing needs it anymore):

```ts
import {
  addLotWithInitialStock,
  recordAcquire,
  recordBrew,
  recordGift,
  recordAdjust,
  updateLot,
} from "@/lib/ledger/service";
```

Then delete the entire `finishLotAction` function (the block between `addLotAction`'s
sibling functions — currently starts at `export async function finishLotAction(` and ends
at its closing `}`, right before `editLotAction`):

```ts
export async function finishLotAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();

  const lotId = Number(formData.get("lotId"));
  if (!Number.isFinite(lotId) || lotId <= 0) return { error: "Lot gak dikenal." };

  try {
    await finishLot(db, lotId);
  } catch (err) {
    if (err instanceof LedgerError) return { error: err.message };
    throw err;
  }

  revalidatePath("/rak");
  revalidatePath("/history");
  revalidatePath("/dashboard");
  return { success: true };
}
```

Delete that whole block (leave `editLotAction`, added in Task 2, in place after it).

- [ ] **Step 5: Type-check, lint, and run the full test suite**

Run (from `web/`):

```bash
npx tsc --noEmit
npx eslint .
npm test -- --run
```

Expected: no type errors, no eslint errors, all 40 tests pass (test count unchanged from Task
1 — this task doesn't add or remove any Vitest tests, only UI/action wiring).

- [ ] **Step 6: Commit**

```bash
cd /Users/hilmi/orca/workspaces/Coffee/CoffeeData
git add web/app/\(app\)/rak/lot-row.tsx web/app/\(app\)/rak/page.tsx web/app/\(app\)/actions.ts
git rm "web/app/(app)/rak/finish-lot-button.tsx"
git commit -m "$(cat <<'EOF'
feat: ganti Habiskan jadi Edit di baris lot Rak

LotRow sekarang toggle ke EditLotForm inline saat "Edit" diklik,
sama seperti pola <details> "Tambah lot baru" yang sudah ada. Tombol
"Habiskan" dan finishLotAction dihapus -- zero-out stok tetap bisa
lewat aksi "Koreksi turun" yang sudah ada di form transaksi tiap
baris.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6
EOF
)"
```

---

### Task 5: Manual verification in the browser

No code changes in this task — it's a gate before calling the feature done. Frontend changes
in this codebase are verified by hand in the running app, not just by tests, since there's no
component-test coverage for `/rak`.

- [ ] **Step 1: Start the dev server**

Run (from `web/`): `npm run dev`
Expected: server starts on `http://localhost:3000` with no errors in the terminal.

- [ ] **Step 2: Exercise the Edit flow**

In a browser, log in and go to `/rak`.

- Pick a lot row with existing data. Click **Edit**. Confirm the header area is replaced by a
  form pre-filled with that lot's current name, origin, varietal, process, roast date, and
  notes — and that the transaction form below is still visible and unchanged.
- Change the varietal (simulate fixing a typo) and click **Simpan**. Confirm the row collapses
  back to the normal view showing the corrected varietal, and the stock number is unchanged.
- Click **Edit** again, then **Batal** without changing anything. Confirm the row collapses
  back with no changes.
- Click **Edit**, clear the **Nama** field, and try to submit. Confirm the browser's native
  `required` validation blocks submission (empty name should never reach the server).
- Confirm there is no "Habiskan" button anywhere on the page anymore, and that "Koreksi turun"
  in the transaction form still works to zero out a lot's stock.

- [ ] **Step 3: Confirm the edited name propagates**

Visit `/history` and `/dashboard`. Confirm the lot's new name (from Step 2) shows up there too
— both pages read the lot's current name by joining on `lot_id`, so this should be immediate
without any extra work, but it's worth eyeballing once.

- [ ] **Step 4: Report result**

If everything above matches, the feature is done — no commit needed for this task. If
something doesn't match, note exactly what's wrong and fix it as a small follow-up commit
before considering the plan complete.
