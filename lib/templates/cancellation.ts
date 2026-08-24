import { z } from "zod";
import { Template, cancellationDetailsSchema, userInfoSchema } from "./types";

export const cancellationTemplate: Template<z.infer<typeof cancellationDetailsSchema>> = {
  id: "cancellation",
  label: "Cancellation request",
  detailsSchema: cancellationDetailsSchema,
  buildTask: (details, user) => `
    Call and cancel the following: ${details.serviceName}.
    ${details.accountReference ? `Account/reference: ${details.accountReference}.` : ""}
    ${details.reasonForCancelling ? `If asked for a reason, say: ${details.reasonForCancelling}.` : ""}
    If they offer a discount or retention deal instead of cancelling, politely decline and confirm
    the cancellation should still go through unless explicitly told otherwise.
    If they ask for identity verification or information you don't have, do not guess or invent details —
    note exactly what is still needed.
    ${user.name ? `This request is on behalf of ${user.name}.` : ""}
    ${user.callbackPhone ? `If they need a callback number, use ${user.callbackPhone}.` : ""}
    Confirm clearly whether the cancellation was completed, refused, or needs more information.
  `,
  resultSchema: {
    type: "object",
    required: ["answer", "evidence"],
    properties: {
      answer: { type: "string", enum: ["yes", "no", "not sure"] },
      evidence: { type: "string" },
    },
  },
  recipientResultSchema: {
    type: "object",
    required: ["outcome", "notes"],
    properties: {
      outcome: {
        type: "string",
        enum: ["cancelled", "declined", "needs_more_info", "not_sure"],
      },
      notes: { type: "string" },
    },
  },
};