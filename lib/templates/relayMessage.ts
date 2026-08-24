import { z } from "zod";
import { Template, relayMessageDetailsSchema, userInfoSchema } from "./types";

export const relayMessageTemplate: Template<z.infer<typeof relayMessageDetailsSchema>> = {
  id: "relay_message",
  label: "Relay message",
  detailsSchema: relayMessageDetailsSchema,
  buildTask: (details, user) => `
    Call ${details.contactName}${details.relationship ? ` (${details.relationship})` : ""}
    and pass along the following message on behalf of ${user.name ?? "the caller"}.

    Message to relay: "${details.messageToRelay}"

    ${details.locationConsent && details.location
      ? `Also share this location information: "${details.location}". Repeat it clearly once, and offer to repeat it again if asked.`
      : ""}

    Speak in a warm, friendly, ordinary tone — this is a routine message delivery, not urgent.
    Confirm the message was heard and understood before ending the call.

    ${user.callbackPhone ? `If they'd like to reach ${user.name ?? "the caller"} directly, this number may work: ${user.callbackPhone}.` : ""}
  `,
  resultSchema: {
    type: "object",
    required: ["answer", "evidence"],
    properties: {
      answer: { type: "string", enum: ["yes", "no", "not sure"] },
      evidence: { type: "string" },
    },
    additionalProperties: false,
  },
  recipientResultSchema: {
    type: "object",
    required: ["outcome", "notes"],
    properties: {
      outcome: {
        type: "string",
        enum: ["message_delivered", "no_answer", "not_sure"],
      },
      notes: { type: "string" },
    },
    additionalProperties: false,
  },
};