import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { categories, orderItems, orders, productVariants, products, stores } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { buildGstInvoice, SUPPLIER_ORIGIN } from "@/lib/gst-invoice";
import { formatINR } from "@/lib/utils";
import InvoicePrintButton from "@/components/orders/InvoicePrintButton";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Tax Invoice | Order #${id.slice(0, 8).toUpperCase()} | Aalm Vastralay`,
    description: "Statutory Rule 46 GST Tax Invoice for Aalm Vastralay order",
  };
}

export default async function OrderTaxInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const isUuid = /^[0-9a-f-]{36}$/i.test(id);
  if (!isUuid) notFound();

  const [orderRow] = await db
    .select({
      order: orders,
      store: stores,
    })
    .from(orders)
    .leftJoin(stores, eq(orders.storeId, stores.id))
    .where(eq(orders.id, id))
    .limit(1);

  if (!orderRow) notFound();

  const isCustomer = orderRow.order.customerId === user.id;
  const isAdmin = user.role === "admin";
  const isSellerOwner = user.role === "seller" && orderRow.store?.ownerId === user.id;

  if (!isCustomer && !isAdmin && !isSellerOwner) {
    notFound();
  }

  const items = await db
    .select({
      item: orderItems,
      product: products,
      variant: productVariants,
      category: categories,
    })
    .from(orderItems)
    .leftJoin(products, eq(orderItems.productId, products.id))
    .leftJoin(productVariants, eq(orderItems.variantId, productVariants.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(orderItems.orderId, orderRow.order.id));

  let customGstin: string | null = null;
  try {
    customGstin = await getSetting("commerce.gstin", SUPPLIER_ORIGIN.defaultGstin);
  } catch {
    customGstin = SUPPLIER_ORIGIN.defaultGstin;
  }

  const invoice = buildGstInvoice({
    order: orderRow.order,
    items: items.map((i) => ({
      title: i.product?.title || "Handcrafted Ethnic Wear",
      quantity: i.item.quantity,
      price: i.item.price,
      total: i.item.total,
      categoryName: i.category?.name,
      categorySlug: i.category?.slug,
      tags: i.product?.tags,
      variantSize: i.variant?.size,
      variantColor: i.variant?.color,
    })),
    storeGstin: orderRow.store?.gstNumber,
    customGstin,
  });

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-stone-950 py-6 px-4 print:bg-white print:p-0">
      {/* Top action toolbar - hidden when printing */}
      <div className="mx-auto max-w-4xl mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <Link
          href={`/orders/${orderRow.order.id}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-maroon-800 dark:text-rose-300 hover:text-maroon-900 dark:hover:text-rose-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Order Details</span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 dark:text-stone-400">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Statutory Rule 46 Compliant</span>
          </div>
          <InvoicePrintButton />
        </div>
      </div>

      {/* Invoice Document Box - Always renders as high-contrast official paper bill */}
      <div className="mx-auto max-w-4xl rounded-2xl border border-stone-200 bg-white text-slate-900 p-6 shadow-md sm:p-10 print:max-w-none print:border-none print:p-0 print:shadow-none">
        {/* Header */}
        <div className="border-b-2 border-maroon-900 pb-6 print:pb-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif text-3xl font-extrabold tracking-wide text-maroon-900">
                  AALM VASTRALAY
                </span>
                <span className="rounded bg-maroon-100 px-2 py-0.5 text-xs font-semibold text-maroon-800 print:border print:border-maroon-800">
                  आलम वस्त्रालय
                </span>
              </div>
              <p className="mt-1 text-xs font-medium text-slate-600">
                Royal Indian Wedding & Luxury Ethnic Wear · Bihar, India
              </p>
              <p className="text-xs text-slate-500">
                Proprietor: {invoice.supplier.proprietor} · {invoice.supplier.addressLine}, {invoice.supplier.city},{" "}
                {invoice.supplier.district}, {invoice.supplier.state} – {invoice.supplier.pincode}
              </p>
              <p className="text-xs text-slate-500">
                Email: {invoice.supplier.email} · Phone: {invoice.supplier.phone}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-900">
                GSTIN: <span className="font-mono tracking-wider">{invoice.supplier.gstin}</span> (State Code:{" "}
                {invoice.supplier.stateCode})
              </p>
            </div>

            <div className="text-left sm:text-right">
              <span className="inline-block rounded-md bg-maroon-900 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white print:bg-slate-900">
                TAX INVOICE / कर इनवॉइस
              </span>
              <p className="mt-1 text-[11px] font-medium text-slate-500">
                (Original for Recipient — Rule 46 CGST Rules, 2017)
              </p>
              <div className="mt-3 space-y-1 text-xs">
                <p>
                  <span className="text-slate-500">Invoice No:</span>{" "}
                  <strong className="font-mono font-bold text-slate-900">{invoice.invoice.invoiceNumber}</strong>
                </p>
                <p>
                  <span className="text-slate-500">Invoice Date:</span>{" "}
                  <strong className="text-slate-900">{invoice.invoice.invoiceDate}</strong>
                </p>
                <p>
                  <span className="text-slate-500">Order Ref:</span>{" "}
                  <strong className="font-mono text-slate-900">{invoice.invoice.orderNumber}</strong>
                </p>
                <p>
                  <span className="text-slate-500">Place of Supply:</span>{" "}
                  <strong className="text-slate-900">{invoice.invoice.placeOfSupply}</strong>
                </p>
                <p>
                  <span className="text-slate-500">Reverse Charge:</span>{" "}
                  <strong className="text-slate-900">{invoice.invoice.reverseCharge}</strong>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Customer & Delivery Address Grid */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6 rounded-xl bg-cream-50/60 p-4 border border-cream-200 print:bg-transparent print:border-slate-300 print:mt-4 print:p-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-maroon-900">Billed & Shipped To (Recipient)</p>
            <p className="mt-1 font-semibold text-slate-900 text-sm">{invoice.recipient.fullName}</p>
            <p className="text-xs text-slate-700 leading-relaxed">
              {invoice.recipient.addressLine}
              {invoice.recipient.landmark ? `, ${invoice.recipient.landmark}` : ""}
            </p>
            <p className="text-xs text-slate-700">
              {invoice.recipient.city}, {invoice.recipient.state} – {invoice.recipient.pincode}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              State: <strong>{invoice.recipient.state}</strong> (Code: <strong>{invoice.recipient.stateCode}</strong>)
            </p>
            <p className="text-xs text-slate-600">Phone: {invoice.recipient.phone}</p>
          </div>

          <div className="sm:border-l sm:border-cream-200 sm:pl-6 print:border-slate-300">
            <p className="text-[11px] font-bold uppercase tracking-wider text-maroon-900">Payment & Fulfilment Details</p>
            <div className="mt-1 space-y-1.5 text-xs text-slate-700">
              <p>
                Payment Mode: <strong className="uppercase">{invoice.invoice.paymentMethod}</strong>
              </p>
              <p>
                Payment Status: <strong className="capitalize">{invoice.invoice.paymentStatus}</strong>
              </p>
              <p>
                Supply Type:{" "}
                <strong>
                  {invoice.invoice.isIntraState ? "Intra-State (CGST + SGST)" : "Inter-State (IGST)"}
                </strong>
              </p>
              {orderRow.order.courier && (
                <p>
                  Courier / Logistics: <strong>{orderRow.order.courier}</strong>
                </p>
              )}
              {orderRow.order.trackingNumber && (
                <p>
                  AWB / Tracking: <span className="font-mono font-medium">{orderRow.order.trackingNumber}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Itemized Tax Invoice Table */}
        <div className="mt-6 overflow-x-auto print:mt-4">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-y-2 border-slate-800 bg-cream-100/80 font-bold text-slate-900 print:bg-slate-100">
                <th className="py-2.5 px-2 text-center w-8">#</th>
                <th className="py-2.5 px-3">Item Description</th>
                <th className="py-2.5 px-2 text-center">HSN</th>
                <th className="py-2.5 px-2 text-center">Qty</th>
                <th className="py-2.5 px-2 text-right">Taxable Value</th>
                {invoice.invoice.isIntraState ? (
                  <>
                    <th className="py-2.5 px-2 text-right">CGST (2.5%)</th>
                    <th className="py-2.5 px-2 text-right">SGST (2.5%)</th>
                  </>
                ) : (
                  <th className="py-2.5 px-2 text-right">IGST (5.0%)</th>
                )}
                <th className="py-2.5 px-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {invoice.items.map((it) => (
                <tr key={it.itemIndex} className="hover:bg-slate-50/50">
                  <td className="py-3 px-2 text-center text-slate-500 font-mono">{it.itemIndex}</td>
                  <td className="py-3 px-3">
                    <p className="font-semibold text-slate-900">{it.description}</p>
                    {it.variantInfo && <p className="text-[11px] text-slate-500">{it.variantInfo}</p>}
                  </td>
                  <td className="py-3 px-2 text-center font-mono font-semibold text-slate-700">{it.hsnCode}</td>
                  <td className="py-3 px-2 text-center font-semibold text-slate-900">{it.quantity}</td>
                  <td className="py-3 px-2 text-right font-mono text-slate-800">{formatINR(it.taxableValue)}</td>
                  {invoice.invoice.isIntraState ? (
                    <>
                      <td className="py-3 px-2 text-right font-mono text-slate-700">{formatINR(it.cgstAmount)}</td>
                      <td className="py-3 px-2 text-right font-mono text-slate-700">{formatINR(it.sgstAmount)}</td>
                    </>
                  ) : (
                    <td className="py-3 px-2 text-right font-mono text-slate-700">{formatINR(it.igstAmount)}</td>
                  )}
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">{formatINR(it.grossAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary and Statutory Totals */}
        <div className="mt-4 border-t-2 border-slate-800 pt-4 flex flex-col sm:flex-row justify-between gap-6 print:mt-3 print:pt-3">
          {/* Statutory HSN Breakdown Table */}
          <div className="flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-2">
              Statutory Tax Summary (By HSN)
            </p>
            <table className="w-full text-[11px] border border-slate-200">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-200">
                  <th className="py-1 px-2 text-left">HSN</th>
                  <th className="py-1 px-2 text-right">Taxable</th>
                  {invoice.invoice.isIntraState ? (
                    <>
                      <th className="py-1 px-2 text-right">CGST</th>
                      <th className="py-1 px-2 text-right">SGST</th>
                    </>
                  ) : (
                    <th className="py-1 px-2 text-right">IGST</th>
                  )}
                  <th className="py-1 px-2 text-right">Tax Amt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.hsnSummary.map((h) => (
                  <tr key={h.hsnCode}>
                    <td className="py-1 px-2 font-mono">{h.hsnCode}</td>
                    <td className="py-1 px-2 text-right font-mono">{formatINR(h.taxableValue)}</td>
                    {invoice.invoice.isIntraState ? (
                      <>
                        <td className="py-1 px-2 text-right font-mono">{formatINR(h.cgstAmount)}</td>
                        <td className="py-1 px-2 text-right font-mono">{formatINR(h.sgstAmount)}</td>
                      </>
                    ) : (
                      <td className="py-1 px-2 text-right font-mono">{formatINR(h.igstAmount)}</td>
                    )}
                    <td className="py-1 px-2 text-right font-mono font-medium">{formatINR(h.totalTax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Amount Totals */}
          <div className="w-full sm:w-72 space-y-1.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">Total Taxable Value:</span>
              <span className="font-mono font-medium text-slate-900">{formatINR(invoice.summary.taxableAmount)}</span>
            </div>
            {invoice.invoice.isIntraState ? (
              <>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">CGST (2.5%):</span>
                  <span className="font-mono text-slate-800">{formatINR(invoice.summary.totalCgst)}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-100 pb-1">
                  <span className="text-slate-600">SGST (2.5%):</span>
                  <span className="font-mono text-slate-800">{formatINR(invoice.summary.totalSgst)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between py-0.5 border-b border-slate-100 pb-1">
                <span className="text-slate-600">IGST (5.0%):</span>
                <span className="font-mono text-slate-800">{formatINR(invoice.summary.totalIgst)}</span>
              </div>
            )}
            {invoice.summary.discount > 0 && (
              <div className="flex justify-between py-1 text-emerald-700">
                <span>Promotional Discount:</span>
                <span className="font-mono">-{formatINR(invoice.summary.discount)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-t-2 border-slate-900 text-sm font-bold text-maroon-900">
              <span>Invoice Total:</span>
              <span className="font-mono text-base">{formatINR(invoice.summary.grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Amount in words */}
        <div className="mt-4 rounded-lg bg-cream-50 p-3 border border-cream-200 text-xs print:bg-transparent print:border-slate-300">
          <p className="text-slate-600">
            Total Amount in Words:{" "}
            <strong className="font-semibold text-slate-900">{invoice.summary.amountInWords}</strong>
          </p>
        </div>

        {/* Footer Declaration & Authorized Signature */}
        <div className="mt-8 pt-6 border-t border-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-6 items-end print:mt-6 print:pt-4">
          <div className="text-[11px] text-slate-500 space-y-1">
            <p className="font-semibold text-slate-700">Statutory Declaration & Conditions of Sale:</p>
            <p>
              1. Certified that the particulars given above are true and correct and the amount indicated represents the price
              actually charged under the CGST Act, 2017.
            </p>
            <p>
              2. Goods are subject to the 7-day royal exchange & return policy of Aalm Vastralay.
            </p>
            <p className="text-[10px] text-slate-400">
              This is a digitally verified GST Tax Invoice generated pursuant to Rule 46 of Central Goods and Services Tax Rules.
            </p>
          </div>

          <div className="text-center sm:text-right">
            <p className="text-xs font-bold text-maroon-900">For {invoice.supplier.legalName.toUpperCase()}</p>
            <div className="my-2 inline-flex items-center justify-center rounded-xl border border-amber-300 bg-amber-50/50 px-4 py-2 print:border-slate-400 print:bg-transparent">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-maroon-900">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 inline" />
                  <span>{invoice.supplier.legalName.toUpperCase()} · FULFILLMENT</span>
                </div>
                <p className="text-[10px] text-slate-600">Authorized Merchant Partner</p>
                <p className="text-[9px] font-mono text-slate-500">GSTIN: {invoice.supplier.gstin}</p>
              </div>
            </div>
            <p className="text-xs font-semibold text-slate-800">Authorized Signatory</p>
          </div>
        </div>
      </div>
    </div>
  );
}
