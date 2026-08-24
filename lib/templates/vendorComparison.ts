import { z } from "zod";
import { NextResponse } from "next/server";
import { CalleClient } from "@call-e/calle";
import { vendorComparisonDetailsSchema, userInfoSchema } from "./types";
import fs from "fs/promises";
import path from "path";

type VendorRecipientResult = {
  outcome: "responded" | "unavailable" | "not_sure";
  notes: string;
  [key: string]: string; // field_0, field_1, etc.
};

type ComparisonResult = {
  method: "deterministic" | "llm" | "none";
  winner: string | null;      // business name
  reasoning: string;
};

function buildVendorResultSchema(fieldsToAsk: string[]) {
  const properties: Record<string, any> = {
    outcome: { type: "string", enum: ["responded", "unavailable", "not_sure"] },
  };
  const fieldKeys: string[] = [];

  fieldsToAsk.forEach((label, i) => {
    const key = `field_${i}`;
    properties[key] = { type: "string", description: label };
    fieldKeys.push(key);
  });

  properties.notes = { type: "string" };

  return {
    type: "object",
    required: ["outcome", ...fieldKeys, "notes"],
    properties,
    additionalProperties: false,
  };
}

function buildVendorTask(details: z.infer<typeof vendorComparisonDetailsSchema>) {
  return `
    Call and ask about the following job: ${details.service}.
    ${details.preferredTiming ? `Preferred timing: ${details.preferredTiming}.` : ""}
    Ask specifically for: ${details.fieldsToAsk.join(", ")}.
    If they can't provide one of these, note that clearly rather than guessing.
  `;
}

async function llmComparison(
  vendorNames: string[],
  results: VendorRecipientResult[],
  fieldLabels: string[],
  service: string
): Promise<ComparisonResult> {
  const responded = results
    .map((r, i) => ({ name: vendorNames[i], result: r }))
    .filter((v) => v.result.outcome === "responded");

  if (responded.length === 0) {
    return { method: "none", winner: null, reasoning: "No vendor responded with usable information." };
  }

  const summary = responded.map((v) => {
    const fields = fieldLabels.map((label, i) => `${label}: ${v.result[`field_${i}`] ?? "not provided"}`).join(", ");
    return `${v.name} — ${fields}. Notes: ${v.result.notes}`;
  }).join("\n");

  const prompt = `Job needed: ${service}\n\nVendor responses:\n${summary}\n\nPick the single best vendor considering all the information given. Respond with only the vendor's exact name on the first line, then one short sentence explaining why on the second line.`;

  const apiKey = process.env.GEMINI_API_KEY!;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const [winnerLine, ...reasonLines] = text.trim().split("\n");

  const winner = responded.find((v) => winnerLine.includes(v.name))?.name ?? responded[0].name;

  return {
    method: "llm",
    winner,
    reasoning: reasonLines.join(" ").trim() || "Selected based on overall response quality.",
  };
}

export async function compareVendors(
  vendorNames: string[],
  results: VendorRecipientResult[],
  fieldLabels: string[],
  service: string
): Promise<ComparisonResult> {
  return llmComparison(vendorNames, results, fieldLabels, service);
}

export async function handleVendorComparisonRequest(body: any) {
  const details = vendorComparisonDetailsSchema.safeParse(body.details);
  if (!details.success) {
    return NextResponse.json({ error: details.error.flatten() }, { status: 400 });
  }

  const user = userInfoSchema.safeParse(body.user ?? {});

  const client = new CalleClient({ apiKey: process.env.CALLE_API_KEY! });
  const recipientResultSchema = buildVendorResultSchema(details.data.fieldsToAsk);

  try {
    const call = await client.calls.createAndWait({
      task: buildVendorTask(details.data),
      recipients: details.data.vendors.map((v) => ({
        phones: [v.contact.phone],
        region: v.contact.region,
        locale: v.contact.locale,
      })),
      resultSchema: {
        type: "object",
        required: ["answer", "evidence"],
        properties: {
          answer: { type: "string", enum: ["yes", "no", "not sure"] },
          evidence: { type: "string" },
        },
        additionalProperties: false,
      },
      recipientResultSchema,
    });

    const responsePayload = {
        result: call,
        fieldLabels: details.data.fieldsToAsk,
        vendorNames: details.data.vendors.map((v) => v.businessName),
    };

    // extract per-recipient results from the call object — adjust this line
    // once you see the actual shape of `call.recipients` in your test output
    const recipientResults = call.recipients.map((r: any) => r.structuredResult);

    const comparison = await compareVendors(
        responsePayload.vendorNames,
        recipientResults,
        details.data.fieldsToAsk,
        details.data.service
    );

    await fs.writeFile(
      path.join(process.cwd(), "tmp-vendor-comparison-result.json"),
      JSON.stringify({ ...responsePayload, comparison }, null, 2)
    );

    return NextResponse.json({ ...responsePayload, comparison });
  } catch (err) {
    await fs.writeFile(
      path.join(process.cwd(), "tmp-vendor-comparison-error.json"),
      JSON.stringify({ error: String(err) }, null, 2)
    );
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}