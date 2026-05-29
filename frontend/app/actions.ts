"use server";

import { revalidatePath } from "next/cache";

import { apiGet, apiPost } from "@/lib/api";

// Submit a lead through the real pipeline, then fetch its full detail so the
// routing-trace drawer has everything (lead fields + evaluations + attempts).
export async function submitLead(payload: Record<string, unknown>) {
  const result = await apiPost("/leads", payload);
  let detail: any = null;
  try {
    if (result?.lead_id) detail = await apiGet(`/leads/${result.lead_id}`);
  } catch {
    detail = null;
  }
  revalidatePath("/");
  return { result, detail };
}

export async function getLeadDetail(leadId: string) {
  return apiGet(`/leads/${encodeURIComponent(leadId)}`);
}

export async function returnLead(leadId: string, reason: string) {
  const result = await apiPost(`/leads/${encodeURIComponent(leadId)}/return`, { reason });
  revalidatePath("/");
  return result;
}

export async function resetDemo() {
  await apiPost("/dev/reset");
  revalidatePath("/");
}

export async function seedLeads() {
  const result = await apiPost("/dev/seed-leads");
  revalidatePath("/");
  return result;
}
