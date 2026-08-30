"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type FieldDef = {
  key: string;
  label: string;
  type: "text" | "textarea" | "checkbox" | "list";
  optional?: boolean;
};

const TEMPLATES: Record<string, { label: string; fields: FieldDef[] }> = {
  appointment: {
    label: "Book an appointment",
    fields: [
      { key: "bookingType", label: "Booking type (e.g. dentist checkup)", type: "text" },
      { key: "purpose", label: "Purpose", type: "textarea" },
      { key: "preferredTimeRange", label: "Preferred time range", type: "text" },
    ],
  },
  cancellation: {
    label: "Cancellation request",
    fields: [
      { key: "serviceName", label: "Service name", type: "text" },
      { key: "accountReference", label: "Account/reference", type: "text", optional: true },
      { key: "reasonForCancelling", label: "Reason for cancelling", type: "textarea", optional: true },
    ],
  },
  order_status: {
    label: "Order/delivery status check",
    fields: [
      { key: "orderReference", label: "Order reference", type: "text" },
      { key: "whatWasOrdered", label: "What was ordered", type: "text" },
      { key: "orderedFrom", label: "Ordered from", type: "text" },
    ],
  },
  relay_message: {
    label: "Relay a message",
    fields: [
      { key: "contactName", label: "Contact name", type: "text" },
      { key: "relationship", label: "Relationship", type: "text", optional: true },
      { key: "messageToRelay", label: "Message to relay", type: "textarea" },
      { key: "location", label: "Location (optional)", type: "text", optional: true },
      { key: "locationConsent", label: "Share location", type: "checkbox" },
    ],
  },
  elder_checkup: {
    label: "Elder check-in",
    fields: [
      { key: "personName", label: "Person's name", type: "text" },
      { key: "thingsToAsk", label: "Things to ask (one per line)", type: "list" },
      { key: "reminder", label: "Reminder (optional)", type: "text", optional: true },
    ],
  },
};

export default function TemplatesPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState("appointment");
  const [phone, setPhone] = useState("+92");
  const [region, setRegion] = useState("PK");
  const [locale, setLocale] = useState("en");
  const [callerName, setCallerName] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string | boolean>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, []);

  const template = TEMPLATES[templateId];

  function updateField(key: string, value: string | boolean) {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  }

  function switchTemplate(id: string) {
    setTemplateId(id);
    setFieldValues({});
    setResult(null);
    setError(null);
  }

  async function submit() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const details: Record<string, unknown> = {};
      for (const f of template.fields) {
        const raw = fieldValues[f.key];
        if (f.type === "checkbox") {
          details[f.key] = Boolean(raw);
        } else if (f.type === "list") {
          details[f.key] = String(raw ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
        } else if (raw) {
          details[f.key] = raw;
        }
      }

      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          recipient: { phone, region, locale },
          user: callerName ? { name: callerName } : {},
          details,
        }),
      });

      const rawText = await res.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        setError(`Non-JSON response (status ${res.status}): ${rawText.slice(0, 300)}`);
        return;
      }

      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
        return;
      }
      setResult(data.result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "2rem", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Templates</h1>
        {userEmail && (
          <div style={{ fontSize: 13, color: "#666" }}>
            {userEmail} · <a href="/auth/signout" style={{ color: "#4a90d9" }}>Log out</a>
          </div>
        )}
      </div>

      <fieldset style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <legend style={{ fontWeight: 600 }}>Choose a template</legend>
        <select value={templateId} onChange={(e) => switchTemplate(e.target.value)} style={{ width: "100%", padding: 8, marginBottom: 12 }}>
          {Object.entries(TEMPLATES).map(([id, t]) => (
            <option key={id} value={id}>{t.label}</option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <label style={{ flex: 2 }}>
            Phone (E.164)
            <input value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: "100%", padding: 6, marginTop: 4 }} />
          </label>
          <label style={{ flex: 1 }}>
            Region
            <input value={region} onChange={(e) => setRegion(e.target.value)} style={{ width: "100%", padding: 6, marginTop: 4 }} />
          </label>
          <label style={{ flex: 1 }}>
            Locale
            <input value={locale} onChange={(e) => setLocale(e.target.value)} style={{ width: "100%", padding: 6, marginTop: 4 }} />
          </label>
        </div>

        <label style={{ display: "block", marginBottom: 12 }}>
          On behalf of (optional)
          <input value={callerName} onChange={(e) => setCallerName(e.target.value)} style={{ width: "100%", padding: 6, marginTop: 4 }} />
        </label>

        {template.fields.map((f) => (
          <label key={f.key} style={{ display: "block", marginBottom: 12 }}>
            {f.label}
            {f.type === "textarea" && (
              <textarea
                rows={2}
                value={(fieldValues[f.key] as string) ?? ""}
                onChange={(e) => updateField(f.key, e.target.value)}
                style={{ width: "100%", padding: 6, marginTop: 4 }}
              />
            )}
            {f.type === "list" && (
              <textarea
                rows={3}
                placeholder="One per line"
                value={(fieldValues[f.key] as string) ?? ""}
                onChange={(e) => updateField(f.key, e.target.value)}
                style={{ width: "100%", padding: 6, marginTop: 4 }}
              />
            )}
            {f.type === "text" && (
              <input
                value={(fieldValues[f.key] as string) ?? ""}
                onChange={(e) => updateField(f.key, e.target.value)}
                style={{ width: "100%", padding: 6, marginTop: 4 }}
              />
            )}
            {f.type === "checkbox" && (
              <input
                type="checkbox"
                checked={Boolean(fieldValues[f.key])}
                onChange={(e) => updateField(f.key, e.target.checked)}
                style={{ marginLeft: 8 }}
              />
            )}
          </label>
        ))}

        <button onClick={submit} disabled={loading} style={{ padding: "8px 16px", fontWeight: 600 }}>
          {loading ? "Calling..." : "Place Call"}
        </button>
      </fieldset>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {result && (
        <fieldset style={{ border: "1px solid #4a90d9", borderRadius: 8, padding: 16 }}>
          <legend style={{ fontWeight: 600 }}>Result</legend>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{JSON.stringify(result, null, 2)}</pre>
        </fieldset>
      )}
    </main>
  );
}