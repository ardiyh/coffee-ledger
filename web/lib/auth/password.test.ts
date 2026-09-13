import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("hashPassword / verifyPassword", () => {
  it("password yang benar lolos verifikasi", () => {
    const stored = hashPassword("kopi-enak-123");
    expect(verifyPassword("kopi-enak-123", stored)).toBe(true);
  });

  it("password yang salah gagal", () => {
    const stored = hashPassword("kopi-enak-123");
    expect(verifyPassword("password-salah", stored)).toBe(false);
  });

  it("format tersimpan yang bukan salt:hash gagal, bukan melempar", () => {
    expect(verifyPassword("apa saja", "bukan-format-yang-benar")).toBe(false);
    expect(verifyPassword("apa saja", "")).toBe(false);
    expect(verifyPassword("apa saja", "satu:dua:tiga")).toBe(false);
  });

  it("salt/hash yang bukan hex valid gagal, bukan melempar", () => {
    expect(verifyPassword("apa saja", "bukan-hex:juga-bukan-hex")).toBe(false);
  });

  it("dua hash dari password yang sama tidak identik (salt acak)", () => {
    const a = hashPassword("sama-sama");
    const b = hashPassword("sama-sama");
    expect(a).not.toBe(b);
    expect(verifyPassword("sama-sama", a)).toBe(true);
    expect(verifyPassword("sama-sama", b)).toBe(true);
  });
});
