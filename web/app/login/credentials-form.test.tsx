// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CredentialsForm } from "./credentials-form";
import { credentialsSignInAction, type CredentialsActionState } from "./actions";

// Network boundary in the browser -- same pattern as rak/forms.test.tsx
// (mocks ../actions), just one directory over.
vi.mock("./actions", () => ({
  credentialsSignInAction: vi.fn(),
}));

afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());

describe("CredentialsForm", () => {
  it("mempertahankan email yang sudah diisi setelah login ditolak", async () => {
    const user = userEvent.setup();
    vi.mocked(credentialsSignInAction).mockResolvedValueOnce({
      error: "Email atau password salah.",
    });
    render(<CredentialsForm />);

    await user.type(screen.getByLabelText("Email"), "hilmi@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Masuk" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Email atau password salah.",
    );
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe(
      "hilmi@example.com",
    );
  });

  it("toggle tampilkan/sembunyikan password tidak mengirim form", async () => {
    const user = userEvent.setup();
    render(<CredentialsForm />);

    const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
    expect(passwordInput.type).toBe("password");

    const toggle = screen.getByRole("button", { name: "Tampilkan password" });
    expect(toggle.getAttribute("type")).toBe("button");

    await user.click(toggle);
    expect(passwordInput.type).toBe("text");
    expect(
      screen.getByRole("button", { name: "Sembunyikan password" }),
    ).toBeDefined();
    expect(credentialsSignInAction).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Sembunyikan password" }));
    expect(passwordInput.type).toBe("password");
    expect(
      screen.getByRole("button", { name: "Tampilkan password" }),
    ).toBeDefined();
  });

  it("menonaktifkan tombol submit selama pending", async () => {
    const user = userEvent.setup();
    let resolveAction!: (result: CredentialsActionState) => void;
    vi.mocked(credentialsSignInAction).mockImplementation(
      () => new Promise((resolve) => { resolveAction = resolve; }),
    );
    render(<CredentialsForm />);

    await user.type(screen.getByLabelText("Email"), "hilmi@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Masuk" }));

    expect(
      (screen.getByRole("button", { name: "Memeriksa..." }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    await act(async () => resolveAction({}));
  });
});
