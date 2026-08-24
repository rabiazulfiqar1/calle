"use client";

import { useState } from "react";

export default function TestEmergencyPage() {
  const [phone, setPhone] = useState("+923092122250");
  const [region, setRegion] = useState("PK");
  const [locale, setLocale] = useState("en");
  const [contactName, setContactName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [situationNote, setSituationNote] = useState("");
  const [userName, setUserName] = useState("");
  const [shareLocation, setShareLocation] = useState(false);
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<any>(null);

  async function captureLocation() {
    setStatus("Requesting location permission...");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setStatus("Reverse geocoding...");
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await res.json();
          setLocation(data.display_name ?? `${latitude}, ${longitude}`);
          setStatus("Location captured.");
        } catch {
          setLocation(`${latitude}, ${longitude}`);
          setStatus("Reverse geocode failed, using raw coordinates.");
        }
      },
      (error) => {
        setStatus(`Location error: ${error.message}`);
      }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Calling...");
    setResult(null);

    const body = {
      templateId: "relay_message",
      recipient: { phone, region, locale },
      user: userName ? { name: userName } : {},
      details: {
        contactName,
        relationship: relationship || undefined,
        messageToRelay: situationNote || undefined,
        location: shareLocation ? location : undefined,
        locationConsent: shareLocation,
      },
    };

    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setResult(data);
      setStatus(res.ok ? "Done." : "Error — see result below.");
    } catch (err) {
      setStatus(`Request failed: ${String(err)}`);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Test: Emergency Contact Call</h1>

      <form onSubmit={handleSubmit}>
        <label>Recipient phone (E.164)</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />

        <label>Region</label>
        <input value={region} onChange={(e) => setRegion(e.target.value)} style={inputStyle} />

        <label>Locale</label>
        <input value={locale} onChange={(e) => setLocale(e.target.value)} style={inputStyle} />

        <hr />

        <label>Contact name (required)</label>
        <input value={contactName} onChange={(e) => setContactName(e.target.value)} style={inputStyle} />

        <label>Relationship (optional)</label>
        <input value={relationship} onChange={(e) => setRelationship(e.target.value)} style={inputStyle} />

        <label>Situation note (optional)</label>
        <textarea value={situationNote} onChange={(e) => setSituationNote(e.target.value)} style={inputStyle} />

        <label>Your name (optional)</label>
        <input value={userName} onChange={(e) => setUserName(e.target.value)} style={inputStyle} />

        <hr />

        <label>
          <input
            type="checkbox"
            checked={shareLocation}
            onChange={(e) => setShareLocation(e.target.checked)}
          />
          {" "}Share my current location
        </label>

        {shareLocation && (
          <div style={{ marginTop: 8 }}>
            <button type="button" onClick={captureLocation}>
              Capture location
            </button>
            {location && <p style={{ fontSize: 13, color: "#555" }}>{location}</p>}
          </div>
        )}

        <button type="submit" style={{ marginTop: 16, padding: "8px 16px" }}>
          Make the call
        </button>
      </form>

      <p style={{ marginTop: 16 }}>{status}</p>

      {result && (
        <pre style={{ background: "#f5f5f5", padding: 12, overflowX: "auto" }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginBottom: 12,
  padding: 6,
};