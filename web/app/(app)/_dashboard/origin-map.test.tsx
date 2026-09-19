// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OriginMap } from "./origin-map";

// Mock react-simple-maps: the tests below exercise coverage/fallback text
// and pan/zoom state wiring, not real SVG projection math or world-atlas
// geometry, so the map primitives are replaced with plain DOM stand-ins.
// ZoomableGroup's mock exposes the props OriginMap passes it (center/zoom)
// as data attributes, and a hidden button to simulate the library calling
// onMoveEnd after a drag/pinch gesture.
vi.mock("react-simple-maps", () => ({
  ComposableMap: (props: { children: React.ReactNode }) => (
    <svg data-testid="map">{props.children}</svg>
  ),
  Geographies: () => null,
  Geography: () => null,
  Marker: (props: { coordinates: [number, number]; children: React.ReactNode }) => (
    <g data-testid="marker" data-coordinates={JSON.stringify(props.coordinates)}>
      {props.children}
    </g>
  ),
  ZoomableGroup: (props: {
    center: [number, number];
    zoom: number;
    onMoveEnd?: (event: { coordinates?: [number, number]; zoom: number }) => void;
    children: React.ReactNode;
  }) => (
    <g
      data-testid="zoomable-group"
      data-center={JSON.stringify(props.center)}
      data-zoom={props.zoom}
    >
      <button
        type="button"
        data-testid="simulate-move-end"
        onClick={() => props.onMoveEnd?.({ coordinates: [12, 34], zoom: 7 })}
      >
        simulate move end
      </button>
      {props.children}
    </g>
  ),
  useZoomPanContext: () => ({ k: 1 }),
}));

// Small fixture lists instead of the real ~177-country / 38-province data --
// matchOrigin's own matching logic is covered by lib/geo/match-origin.test.ts;
// this file only needs enough entries to exercise coverage/fallback.
vi.mock("@/lib/geo/world-countries", () => ({
  WORLD_COUNTRIES: [{ name: "El Salvador", lat: 13.79, lon: -88.9 }],
  WORLD_COUNTRIES_GEOJSON: {},
}));
vi.mock("@/lib/geo/provinces", () => ({
  INDONESIA_PROVINCES: [
    { name: "Aceh", lat: 4.7, lon: 96.7 },
    { name: "Jawa Barat", lat: -6.9, lon: 107.6 },
  ],
}));

afterEach(cleanup);

const mixedLots = [
  { name: "Lot Aceh", stock: 100, origin: "Gayo, Aceh" },
  { name: "Lot Jabar", stock: 50, origin: "Preanger, Jawa Barat" },
  { name: "Lot ES", stock: 40, origin: "El Salvador" },
  { name: "Lot Misteri", stock: 25, origin: "Planet Mars" },
];

describe("OriginMap coverage", () => {
  it("menampilkan cakupan, origin tak dikenal, dan gram lot yang gak terpetakan", () => {
    render(<OriginMap lots={mixedLots} />);
    expect(screen.getByText("3 dari 4 lot terpetakan")).toBeDefined();
    expect(screen.getByText(/Planet Mars/)).toBeDefined();
    expect(screen.getByText(/25 g/)).toBeDefined();
    // Lot names for placed lots are grouped into the marker list, so the
    // fallback list should only carry the unplaced one.
    expect(screen.getByText(/Lot Misteri/)).toBeDefined();
  });

  it("semua lot cocok: gak ada daftar fallback", () => {
    const allMatched = [
      { name: "Lot Aceh", stock: 100, origin: "Aceh" },
      { name: "Lot ES", stock: 40, origin: "El Salvador" },
    ];
    render(<OriginMap lots={allMatched} />);
    expect(screen.getByText("2 dari 2 lot terpetakan")).toBeDefined();
    expect(screen.queryByText("Lot Aceh")).toBeNull(); // digrup, bukan per-lot
    expect(screen.queryByText(/Belum terpetakan/)).toBeNull();
  });

  it("semua lot gak cocok: cakupan 0, daftar fallback berisi semuanya", () => {
    const noneMatched = [
      { name: "Lot X", stock: 10, origin: "Antah Berantah" },
      { name: "Lot Y", stock: 20, origin: "Negeri Dongeng" },
    ];
    render(<OriginMap lots={noneMatched} />);
    expect(screen.getByText("0 dari 2 lot terpetakan")).toBeDefined();
    expect(screen.getByText(/Lot X/)).toBeDefined();
    expect(screen.getByText(/Antah Berantah/)).toBeDefined();
    expect(screen.getByText(/Lot Y/)).toBeDefined();
    expect(screen.getByText(/Negeri Dongeng/)).toBeDefined();
  });

  it("input kosong: pesan Belum ada lot aktif, bukan pembagian kosong", () => {
    render(<OriginMap lots={[]} />);
    expect(screen.getByText("Belum ada lot aktif")).toBeDefined();
    expect(screen.queryByText(/dari 0 lot terpetakan/)).toBeNull();
  });

  it("menampilkan copy disclaimer lokasi perkiraan", () => {
    render(<OriginMap lots={mixedLots} />);
    expect(
      screen.getByText(
        "Lokasi perkiraan tingkat provinsi atau negara, bukan lokasi kebun.",
      ),
    ).toBeDefined();
  });
});

describe("OriginMap zoom/pan controls", () => {
  it("Perbesar menaikkan zoom, Perkecil menurunkannya, dibatasi 1-20", async () => {
    const user = userEvent.setup();
    render(<OriginMap lots={mixedLots} />);
    const group = screen.getByTestId("zoomable-group");
    const initialZoom = Number(group.dataset.zoom);

    await user.click(screen.getByRole("button", { name: "Perbesar" }));
    expect(Number(group.dataset.zoom)).toBeGreaterThan(initialZoom);

    await user.click(screen.getByRole("button", { name: "Perkecil" }));
    expect(Number(group.dataset.zoom)).toBeCloseTo(initialZoom);

    // Spam Perkecil past the floor -- should clamp at 1, never go below.
    for (let i = 0; i < 20; i++) {
      await user.click(screen.getByRole("button", { name: "Perkecil" }));
    }
    expect(Number(group.dataset.zoom)).toBeGreaterThanOrEqual(1);

    // Spam Perbesar past the ceiling -- should clamp at 20.
    for (let i = 0; i < 30; i++) {
      await user.click(screen.getByRole("button", { name: "Perbesar" }));
    }
    expect(Number(group.dataset.zoom)).toBeLessThanOrEqual(20);
  });

  it("Reset peta mengembalikan framing awal setelah zoom/pan", async () => {
    const user = userEvent.setup();
    render(<OriginMap lots={mixedLots} />);
    const group = screen.getByTestId("zoomable-group");
    const initialZoom = group.dataset.zoom;
    const initialCenter = group.dataset.center;

    await user.click(screen.getByRole("button", { name: "Perbesar" }));
    await user.click(screen.getByTestId("simulate-move-end"));
    expect(group.dataset.zoom).not.toBe(initialZoom);
    expect(group.dataset.center).not.toBe(initialCenter);

    await user.click(screen.getByRole("button", { name: "Reset peta" }));
    expect(group.dataset.zoom).toBe(initialZoom);
    expect(group.dataset.center).toBe(initialCenter);
  });

  it("onMoveEnd dari drag/pinch menyinkronkan state center dan zoom", async () => {
    const user = userEvent.setup();
    render(<OriginMap lots={mixedLots} />);
    const group = screen.getByTestId("zoomable-group");

    await user.click(screen.getByTestId("simulate-move-end"));
    expect(group.dataset.zoom).toBe("7");
    expect(group.dataset.center).toBe(JSON.stringify([12, 34]));
  });

  it("ketiga tombol bisa dioperasikan lewat keyboard", async () => {
    const user = userEvent.setup();
    render(<OriginMap lots={mixedLots} />);
    const group = screen.getByTestId("zoomable-group");
    const initialZoom = Number(group.dataset.zoom);

    const zoomInBtn = screen.getByRole("button", { name: "Perbesar" });
    zoomInBtn.focus();
    await user.keyboard("{Enter}");
    expect(Number(group.dataset.zoom)).toBeGreaterThan(initialZoom);

    const zoomOutBtn = screen.getByRole("button", { name: "Perkecil" });
    zoomOutBtn.focus();
    await user.keyboard(" ");
    expect(Number(group.dataset.zoom)).toBeCloseTo(initialZoom);

    await user.click(screen.getByRole("button", { name: "Perbesar" }));
    const resetBtn = screen.getByRole("button", { name: "Reset peta" });
    resetBtn.focus();
    await user.keyboard("{Enter}");
    expect(Number(group.dataset.zoom)).toBeCloseTo(initialZoom);
  });

  it("petunjuk Ctrl/⌘ + scroll untuk zoom wheel ada di layar", () => {
    render(<OriginMap lots={mixedLots} />);
    expect(screen.getByText(/Ctrl.*⌘|⌘.*Ctrl/)).toBeDefined();
  });
});
