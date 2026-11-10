
"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface CheckoutOrder {
  id: string;
  totalAmount: string | number;
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const productId = searchParams.get("productId") || "";
  const productName = searchParams.get("productName") || "Kamar Hotel";
  const price = Number(searchParams.get("price") || 0);

  const [checkIn, setCheckIn] = useState(
    searchParams.get("checkIn") || ""
  );

  const [checkOut, setCheckOut] = useState(
    searchParams.get("checkOut") || ""
  );

  const [quantity, setQuantity] = useState(
    Math.max(1, Number(searchParams.get("quantity") || 1))
  );

  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const [paymentProof, setPaymentProof] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Validasi tanggal. Jumlah malam tidak memengaruhi harga.
  const nights =
    checkIn && checkOut
      ? Math.ceil(
          (new Date(`${checkOut}T00:00:00`).getTime() -
            new Date(`${checkIn}T00:00:00`).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;

  // Total pembayaran hanya berdasarkan jumlah kamar.
  const estimatedTotal = price * quantity;

  const formatRupiah = (amount: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(amount);

  const getToken = () => {
    return localStorage.getItem("accessToken");
  };

  // ======================================================
  // CREATE CHECKOUT
  // ======================================================

  async function handleCreateCheckout(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!productId) {
      setError("ID kamar tidak ditemukan. Silakan pilih kamar kembali.");
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      setError("Harga kamar tidak ditemukan. Silakan pilih kamar kembali.");
      return;
    }

    if (!checkIn || !checkOut || nights <= 0) {
      setError("Tanggal check-in dan check-out tidak valid.");
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      setError("Jumlah kamar minimal 1.");
      return;
    }

    const token = getToken();

    if (!token) {
      setError("Silakan login terlebih dahulu.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/api/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          checkIn,
          checkOut,
          items: [
            {
              productId,
              quantity,
            },
          ],
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Checkout gagal dibuat.");
      }

      const checkoutData =
        result.order || result.data?.order || result.data;

      if (
        !checkoutData?.id ||
        checkoutData.totalAmount === undefined
      ) {
        throw new Error("Data pesanan dari server tidak lengkap.");
      }

      const newOrder: CheckoutOrder = {
        id: checkoutData.id,
        totalAmount: checkoutData.totalAmount,
      };

      setOrder(newOrder);

      sessionStorage.setItem(
        "hotel_checkout_order",
        JSON.stringify(newOrder)
      );

      setMessage("Pesanan berhasil dibuat. Silakan lakukan pembayaran.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Terjadi kesalahan."
      );
    } finally {
      setLoading(false);
    }
  }

  // ======================================================
  // UPLOAD PAYMENT PROOF
  // ======================================================

  async function handleUploadProof(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!order) {
      setError("Buat pesanan terlebih dahulu.");
      return;
    }

    if (!paymentProof) {
      setError("Pilih bukti pembayaran terlebih dahulu.");
      return;
    }

    if (paymentProof.size > 5 * 1024 * 1024) {
      setError("Ukuran file maksimal 5 MB.");
      return;
    }

    if (
      !["image/jpeg", "image/png", "image/webp"].includes(
        paymentProof.type
      )
    ) {
      setError("File harus berformat JPG, PNG, atau WEBP.");
      return;
    }

    const token = getToken();

    if (!token) {
      setError("Silakan login kembali.");
      return;
    }

    const formData = new FormData();
    formData.append("paymentProof", paymentProof);

    try {
      setUploading(true);

      const response = await fetch(
        `${API_URL}/api/checkout/${order.id}/payment-proof`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Upload bukti pembayaran gagal."
        );
      }

      sessionStorage.removeItem("hotel_checkout_order");

      alert(
        "Bukti pembayaran berhasil diunggah! Silakan tunggu verifikasi admin."
      );

      router.replace("/products");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Terjadi kesalahan."
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0B0B0D] px-4 py-12 text-[#F4F0E8]">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-10">
          <p className="mb-2 text-sm font-medium uppercase tracking-[0.3em] text-[#D6A85F]">
            Hotel Reservation
          </p>

          <h1 className="text-3xl font-bold md:text-4xl">
            Checkout Pesanan
          </h1>

          <p className="mt-3 text-sm text-gray-400">
            Lengkapi informasi pemesanan dan lakukan pembayaran.
          </p>
        </div>

        {/* Notifikasi */}
        {(error || message) && (
          <div
            className={`mb-6 rounded-xl border p-4 text-sm ${
              error
                ? "border-red-500/30 bg-red-500/10 text-red-300"
                : "border-green-500/30 bg-green-500/10 text-green-300"
            }`}
          >
            {error || message}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">

          {/* Form Checkout */}
          <section>
            {!order ? (
              <form
                onSubmit={handleCreateCheckout}
                className="rounded-2xl border border-[#292930] bg-[#121216] p-6 md:p-8"
              >
                <h2 className="mb-6 text-xl font-semibold">
                  Informasi Pemesanan
                </h2>

                {/* Nama kamar */}
                <div className="mb-6">
                  <label className="mb-2 block text-sm text-gray-300">
                    Nama kamar
                  </label>

                  <div className="rounded-xl border border-[#292930] bg-[#1C1C22] px-4 py-3">
                    {productName}
                  </div>
                </div>

                {/* Harga kamar */}
                <div className="mb-6">
                  <label className="mb-2 block text-sm text-gray-300">
                    Harga kamar
                  </label>

                  <div className="rounded-xl border border-[#292930] bg-[#1C1C22] px-4 py-3 font-semibold text-[#D6A85F]">
                    {formatRupiah(price)}
                  </div>
                </div>

                {/* Tanggal */}
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm text-gray-300">
                      Check-in
                    </label>

                    <input
                      type="date"
                      value={checkIn}
                      min={new Date().toLocaleDateString("en-CA")}
                      onChange={(e) => {
                        setCheckIn(e.target.value);

                        if (
                          checkOut &&
                          e.target.value >= checkOut
                        ) {
                          setCheckOut("");
                        }
                      }}
                      required
                      className="w-full rounded-xl border border-[#292930] bg-[#1C1C22] px-4 py-3 text-white outline-none focus:border-[#D6A85F]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-gray-300">
                      Check-out
                    </label>

                    <input
                      type="date"
                      value={checkOut}
                      min={
                        checkIn ||
                        new Date().toLocaleDateString("en-CA")
                      }
                      onChange={(e) => setCheckOut(e.target.value)}
                      required
                      className="w-full rounded-xl border border-[#292930] bg-[#1C1C22] px-4 py-3 text-white outline-none focus:border-[#D6A85F]"
                    />
                  </div>
                </div>

                {/* Jumlah kamar */}
                <div className="mt-6">
                  <label className="mb-2 block text-sm text-gray-300">
                    Jumlah kamar
                  </label>

                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(Number(e.target.value))
                    }
                    required
                    className="w-full rounded-xl border border-[#292930] bg-[#1C1C22] px-4 py-3 text-white outline-none focus:border-[#D6A85F]"
                  />
                </div>

                {/* Total */}
                <div className="mt-8 rounded-xl bg-[#1C1C22] p-5">
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>Harga kamar</span>
                    <span>{formatRupiah(price)}</span>
                  </div>

                  <div className="mt-3 flex justify-between text-sm text-gray-400">
                    <span>Jumlah kamar</span>
                    <span>{quantity}</span>
                  </div>

                  <div className="my-4 border-t border-[#292930]" />

                  <div className="flex justify-between gap-4 font-semibold">
                    <span>Total pembayaran</span>

                    <span className="text-right text-[#D6A85F]">
                      {formatRupiah(estimatedTotal)}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={
                    loading ||
                    !productId ||
                    !Number.isFinite(price) ||
                    price <= 0
                  }
                  className="mt-6 w-full rounded-xl bg-[#C62828] px-5 py-4 font-semibold transition hover:bg-[#E5484D] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Memproses..." : "Buat Pesanan"}
                </button>
              </form>
            ) : (
              /* Pembayaran */
              <div className="rounded-2xl border border-[#292930] bg-[#121216] p-6 md:p-8">
                <p className="text-sm text-green-400">
                  Pesanan berhasil dibuat
                </p>

                <h2 className="mt-2 text-xl font-semibold">
                  Selesaikan Pembayaran
                </h2>

                <p className="mt-2 break-all text-sm text-gray-400">
                  ID Pesanan: {order.id}
                </p>

                {/* Detail pembayaran */}
                <div className="mt-6 rounded-xl border border-[#292930] bg-[#1C1C22] p-5">
                  <p className="text-sm text-gray-400">
                    Total pembayaran
                  </p>

                  <p className="mt-2 text-2xl font-bold text-[#D6A85F]">
                    {formatRupiah(Number(order.totalAmount))}
                  </p>

                  <div className="mt-5 border-t border-[#292930] pt-5">
                    <p className="font-semibold">
                      Instruksi Transfer
                    </p>

                    <p className="mt-3 text-sm text-gray-400">
                      Silakan transfer sesuai total pembayaran ke
                      rekening resmi hotel.
                    </p>

                    <div className="mt-4 space-y-2 text-sm">
                      <p>
                        Bank:{" "}
                        <span className="text-[#D6A85F]">
                          BRI
                        </span>
                      </p>

                      <p>
                        Nomor rekening:{" "}
                        <span className="text-[#D6A85F]">
                          08123456789
                        </span>
                      </p>

                      <p>
                        Atas nama:{" "}
                        <span className="text-[#D6A85F]">
                          Hotel
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Upload bukti pembayaran */}
                <form
                  onSubmit={handleUploadProof}
                  className="mt-7"
                >
                  <label
                    htmlFor="paymentProof"
                    className="mb-3 block text-sm font-medium"
                  >
                    Upload Bukti Pembayaran
                  </label>

                  <input
                    id="paymentProof"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) =>
                      setPaymentProof(
                        e.target.files?.[0] || null
                      )
                    }
                    className="w-full rounded-xl border border-[#292930] bg-[#1C1C22] p-3 text-sm text-gray-300 file:mr-4 file:rounded-lg file:border-0 file:bg-[#D6A85F] file:px-4 file:py-2 file:font-semibold file:text-black"
                  />

                  <p className="mt-2 text-xs text-gray-500">
                    JPG, PNG, atau WEBP. Maksimal 5 MB.
                  </p>

                  {paymentProof && (
                    <p className="mt-3 break-all text-sm text-[#D6A85F]">
                      File: {paymentProof.name}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={uploading || !paymentProof}
                    className="mt-6 w-full rounded-xl bg-[#C62828] px-5 py-4 font-semibold transition hover:bg-[#E5484D] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {uploading
                      ? "Mengunggah bukti..."
                      : "Kirim Bukti Pembayaran"}
                  </button>
                </form>
              </div>
            )}
          </section>

          {/* Ringkasan Pesanan */}
          <aside className="h-fit rounded-2xl border border-[#292930] bg-[#121216] p-6">
            <h2 className="mb-6 text-lg font-semibold">
              Ringkasan Pesanan
            </h2>

            <div className="space-y-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-gray-400">Kamar</span>
                <span className="text-right">{productName}</span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-gray-400">Harga kamar</span>
                <span className="text-right">
                  {formatRupiah(price)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-400">Check-in</span>
                <span>{checkIn || "-"}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-400">Check-out</span>
                <span>{checkOut || "-"}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-400">Jumlah kamar</span>
                <span>{quantity}</span>
              </div>

              <div className="border-t border-[#292930] pt-4">
                <div className="flex justify-between gap-4 font-semibold">
                  <span>Total</span>

                  <span className="text-right text-[#D6A85F]">
                    {formatRupiah(
                      order
                        ? Number(order.totalAmount)
                        : estimatedTotal
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-7 rounded-xl border border-[#D6A85F]/20 bg-[#D6A85F]/5 p-4">
              <p className="text-sm font-medium text-[#D6A85F]">
                Informasi Pembayaran
              </p>

              <p className="mt-2 text-xs leading-6 text-gray-400">
                Stok kamar akan dikurangi setelah bukti pembayaran
                berhasil diunggah dan diproses oleh server.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0B0B0D] text-white">
          Memuat halaman checkout...
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
