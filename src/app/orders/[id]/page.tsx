import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { FileText, MapPin, Phone, RotateCcw, XCircle } from "lucide-react";
import { db } from "@/db";
import { orderItems, orders, productVariants, products, stores } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { cancelOrder, requestReturn } from "@/actions/orders";
import { resolveThumbnail } from "@/lib/media-resolver";
import { cn, formatDate, formatINR, statusStyle } from "@/lib/utils";
import SubmitButton from "@/components/SubmitButton";
import OrderTimeline from "@/components/orders/OrderTimeline";
import WhatsAppOrderButton from "@/components/orders/WhatsAppOrderButton";
import WhatsAppDispatchButton from "@/components/admin/WhatsAppDispatchButton";
import PushNotificationPrompt from "@/components/notifications/PushNotificationPrompt";
import GenerateAwbButton from "@/components/admin/GenerateAwbButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Order details" };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const isUuid = /^[0-9a-f-]{36}$/i.test(id);
  if (!isUuid) notFound();

  const where = user.role === "admin" ? eq(orders.id, id) : and(eq(orders.id, id), eq(orders.customerId, user.id));
  const [row] = await db
    .select({
      order: orders,
      store: stores,
      canReturn: sql<boolean>`CASE WHEN ${orders.status} = 'delivered' AND ${orders.updatedAt} >= NOW() - INTERVAL '7 days' THEN true ELSE false END`,
    })
    .from(orders)
    .leftJoin(stores, eq(orders.storeId, stores.id))
    .where(where)
    .limit(1);
  if (!row) notFound();
  const { order, store, canReturn } = row;

  const items = await db
    .select({ item: orderItems, product: products, variant: productVariants })
    .from(orderItems)
    .leftJoin(products, eq(orderItems.productId, products.id))
    .leftJoin(productVariants, eq(orderItems.variantId, productVariants.id))
    .where(eq(orderItems.orderId, order.id));

  const addr = order.shippingAddress;
  const canCancel = ["pending", "confirmed", "processing"].includes(order.status);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/orders" className="text-sm font-semibold text-maroon-700 dark:text-gold-400 hover:underline">
        ← All orders
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-maroon-900 dark:text-stone-50">Order {order.orderNumber}</h1>
          <p className="text-sm text-slate-500 dark:text-stone-400">
            Placed {formatDate(order.createdAt)} · Sold by{" "}
            {store ? (
              <Link href={`/stores/${store.slug}`} className="text-maroon-700 dark:text-gold-400 hover:underline">
                {store.storeName}
              </Link>
            ) : (
              "—"
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Link
            href={`/orders/${order.id}/invoice`}
            className="inline-flex items-center gap-1.5 rounded-full border border-maroon-300 dark:border-stone-700 bg-cream-50 dark:bg-stone-800 px-3 py-1.5 text-xs font-semibold text-maroon-800 dark:text-stone-100 hover:bg-maroon-100 dark:hover:bg-stone-700 hover:border-maroon-400 dark:hover:border-stone-600 transition-colors shadow-xs"
          >
            <FileText className="h-3.5 w-3.5 text-maroon-700 dark:text-gold-400" />
            <span>Tax Invoice / कर इनवॉइस</span>
          </Link>
          <WhatsAppOrderButton
            orderNumber={order.orderNumber}
            total={order.total}
            itemsSummary={items.map((i) => i.product?.title).filter(Boolean).slice(0, 2).join(", ")}
          />
          <span className={cn("badge px-3 py-1 text-xs capitalize", statusStyle(order.status))}>{order.status}</span>
        </div>
      </div>

      {/* Visual Order Timeline */}
      <div className="mt-6 space-y-4">
        {order.status !== "delivered" && order.status !== "cancelled" && (
          <PushNotificationPrompt />
        )}
        <OrderTimeline
          status={order.status}
          createdAt={order.createdAt}
          trackingNumber={order.trackingNumber}
          courier={order.courier}
        />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_300px]">
        <section className="card divide-y divide-cream-200 dark:divide-stone-800">
          {items.map(({ item, product, variant }) => (
            <div key={item.id} className="flex gap-4 p-4">
              <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-cream-100 dark:bg-stone-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resolveThumbnail(product?.images?.[0])} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="flex-1 text-sm">
                {product ? (
                  <Link href={`/products/${product.slug}`} className="font-medium text-slate-900 dark:text-stone-100 hover:text-maroon-800 dark:hover:text-gold-300">
                    {product.title}
                  </Link>
                ) : (
                  <p className="font-medium text-slate-800 dark:text-stone-200">Product unavailable</p>
                )}
                {variant && (
                  <p className="text-xs text-slate-500 dark:text-stone-400">
                    {variant.size && `Size: ${variant.size}`} {variant.color && `· Colour: ${variant.color}`}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-500 dark:text-stone-400">
                  {formatINR(item.price)} × {item.quantity}
                </p>
                {order.status === "delivered" && product && (
                  <Link href={`/products/${product.slug}#reviews`} className="mt-1 inline-block text-xs font-semibold text-maroon-700 dark:text-gold-400 hover:underline">
                    Write a review
                  </Link>
                )}
              </div>
              <p className="font-semibold text-slate-900 dark:text-stone-100">{formatINR(item.total)}</p>
            </div>
          ))}
          <dl className="space-y-1.5 p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600 dark:text-stone-400">Subtotal</dt>
              <dd className="text-slate-900 dark:text-stone-200">{formatINR(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600 dark:text-stone-400">Delivery</dt>
              <dd className="text-slate-900 dark:text-stone-200">{order.shippingFee === 0 ? "Free" : formatINR(order.shippingFee)}</dd>
            </div>
            {order.subtotal + order.shippingFee > order.total && (
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                <dt>Coupon discount</dt>
                <dd>-{formatINR(order.subtotal + order.shippingFee - order.total)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-cream-200 dark:border-stone-800 pt-2 text-base font-bold text-maroon-900 dark:text-rose-300">
              <dt>Total</dt>
              <dd>{formatINR(order.total)}</dd>
            </div>
            <p className="pt-1 text-xs text-slate-500 dark:text-stone-400">
              Payment: <span className="uppercase text-slate-700 dark:text-stone-300">{order.paymentMethod}</span> · {order.paymentStatus}
            </p>
            <div className="pt-3 border-t border-cream-200 dark:border-stone-800">
              <Link
                href={`/orders/${order.id}/invoice`}
                className="flex items-center justify-center gap-2 rounded-xl border border-cream-300 dark:border-stone-700 bg-cream-100/70 dark:bg-stone-800 py-2.5 px-3 text-xs font-semibold text-maroon-900 dark:text-stone-100 hover:bg-cream-200 dark:hover:bg-stone-700 transition-colors shadow-xs"
              >
                <FileText className="h-4 w-4 text-maroon-800 dark:text-gold-400" />
                <span>Download / Print Tax Invoice (कर इनवॉइस)</span>
              </Link>
            </div>
          </dl>
        </section>

        <aside className="space-y-4">
          <div className="card p-4 text-sm">
            <p className="mb-2 flex items-center gap-1.5 font-semibold text-maroon-900 dark:text-gold-400">
              <MapPin className="h-4 w-4" /> Delivery address
            </p>
            <p className="font-medium text-slate-900 dark:text-stone-100">{addr.fullName}</p>
            <p className="text-slate-600 dark:text-stone-400">
              {addr.addressLine}
              {addr.landmark ? `, ${addr.landmark}` : ""}
            </p>
            <p className="text-slate-600 dark:text-stone-400">
              {addr.city}, {addr.state} – {addr.pincode}
            </p>
            <p className="mt-1 flex items-center gap-1 text-slate-600 dark:text-stone-400">
              <Phone className="h-3 w-3" /> {addr.phone}
            </p>
          </div>

          {(user.role === "admin" || user.role === "seller") && (
            <div className="card p-4 text-sm space-y-3">
              <div>
                <p className="font-semibold text-slate-800 dark:text-stone-200">Logistics & AWB Generation</p>
                <p className="text-xs text-slate-500 dark:text-stone-400">Generate Shiprocket / Delhivery shipping labels</p>
              </div>
              <div>
                <GenerateAwbButton
                  orderId={order.id}
                  existingAwb={order.trackingNumber}
                  existingCourier={order.courier}
                />
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-stone-800">
                <WhatsAppDispatchButton
                  customerName={addr.fullName}
                  customerPhone={addr.phone}
                  orderNumber={order.orderNumber}
                  courier={order.courier}
                  trackingNumber={order.trackingNumber}
                  className="w-full"
                />
              </div>
            </div>
          )}

          {order.notes && (
            <div className="card p-4 text-sm">
              <p className="font-semibold text-maroon-900 dark:text-gold-400">Notes</p>
              <p className="mt-1 text-slate-600 dark:text-stone-400">{order.notes}</p>
            </div>
          )}

          {canCancel && (
            <form action={cancelOrder} className="card p-4">
              <input type="hidden" name="orderId" value={order.id} />
              <p className="text-sm text-slate-600 dark:text-stone-400">Changed your mind? You can cancel before the order is shipped.</p>
              <SubmitButton variant="outline" className="mt-3 w-full" pendingText="Cancelling…">
                <XCircle className="h-4 w-4" /> Cancel order
              </SubmitButton>
            </form>
          )}

          {canReturn && (
            <form action={requestReturn} className="card p-4">
              <input type="hidden" name="orderId" value={order.id} />
              <p className="text-sm font-semibold text-maroon-900 dark:text-gold-400">7-day easy return</p>
              <p className="mt-1 text-xs text-slate-600 dark:text-stone-400">Not happy with the fit or quality? Request a return and we&apos;ll arrange a pickup.</p>
              <textarea name="reason" className="input mt-3 min-h-16" placeholder="Reason (optional)" maxLength={300} />
              <SubmitButton variant="outline" className="mt-3 w-full" pendingText="Requesting…">
                <RotateCcw className="h-4 w-4" /> Request return
              </SubmitButton>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
