"use server";

import { revalidatePath } from "next/cache";

import { apiPost } from "@/lib/api";

export async function submitLead(formData: FormData) {
  const trusted = String(formData.get("trusted_form_cert_url") || "");
  const payload = {
    first_name: String(formData.get("first_name") || ""),
    last_name: String(formData.get("last_name") || ""),
    phone: String(formData.get("phone") || ""),
    email: String(formData.get("email") || ""),
    state: String(formData.get("state") || ""),
    vertical: String(formData.get("vertical") || ""),
    source: String(formData.get("source") || ""),
    trusted_form_cert_url: trusted || null,
  };
  await apiPost("/leads", payload);
  revalidatePath("/");
}

export async function returnLead(formData: FormData) {
  const leadId = String(formData.get("lead_id") || "");
  const reason = String(formData.get("reason") || "");
  await apiPost(`/leads/${leadId}/return`, { reason });
  revalidatePath("/");
}

export async function resetDemo() {
  await apiPost("/dev/reset");
  revalidatePath("/");
}

export async function seedLeads() {
  await apiPost("/dev/seed-leads");
  revalidatePath("/");
}
