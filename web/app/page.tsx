import { redirect } from "next/navigation";

// Sementara. Diganti halaman portofolio di Task 5; ditaruh sekarang supaya
// app tetap utuh sepanjang rencana ini, bukan cuma di akhir.
export default function Home() {
  redirect("/dashboard");
}
