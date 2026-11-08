import {NextResponse} from "next/server";
import {stripeConfigured} from "../../../lib/stripe-billing";
export const runtime="nodejs";
export async function GET(){
  return NextResponse.json({
    available:stripeConfigured(),
    publishableKey:stripeConfigured()?process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:null,
    provider:"stripe",
  },{headers:{"Cache-Control":"no-store"}});
}
