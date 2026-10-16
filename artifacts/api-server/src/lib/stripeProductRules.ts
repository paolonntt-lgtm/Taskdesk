import type Stripe from "stripe";

/**
 * Billing plans are the products managed by TaskDesk's plan selector:
 * they declare the included seat count. Add-on products use separate metadata.
 */
export function isTaskDeskPlanProduct(
  product: Pick<Stripe.Product, "metadata"> | null | undefined,
): boolean {
  const seats = product?.metadata?.seats;
  return !!product
    && product.metadata?.addon !== "seat"
    && (seats === "unlimited" || (typeof seats === "string" && /^[1-9]\d*$/.test(seats)));
}

export async function subscriptionHasTaskDeskPlan(
  stripe: Pick<Stripe, "products">,
  subscription: Pick<Stripe.Subscription, "items">,
): Promise<boolean> {
  for (const item of subscription.items.data) {
    const price = item.price as Stripe.Price;
    if (!price.recurring || !["month", "year"].includes(price.recurring.interval)) continue;
    const product = typeof price.product === "string"
      ? await stripe.products.retrieve(price.product)
      : price.product;
    if (isTaskDeskPlanProduct(product as Stripe.Product | null)) return true;
  }
  return false;
}
