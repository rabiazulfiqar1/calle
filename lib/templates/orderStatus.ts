import { z } from "zod";
import { Template, orderStatusDetailsSchema, userInfoSchema } from "./types";

export const orderStatusTemplate: Template<z.infer<typeof orderStatusDetailsSchema>> = {
  id: "order_status",
  label: "Order/delivery status check",
  detailsSchema: orderStatusDetailsSchema,
  buildTask: (details, user) => `
    Call ${details.orderedFrom} and ask for the status of an order.
    What was ordered: ${details.whatWasOrdered}.
    Order reference: ${details.orderReference}.
    Confirm this order reference matches something they can find before proceeding —
    if they can't find it or say it doesn't match, note that clearly rather than guessing.
    Ask for an estimated delivery time if the order hasn't arrived yet.
    ${user.name ? `This inquiry is on behalf of ${user.name}.` : ""}
    ${user.callbackPhone ? `If they need a callback number, use ${user.callbackPhone}.` : ""}
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
        enum: ["on_the_way_with_eta", "delayed_no_eta", "order_not_found", "not_sure"],
      },
      notes: { type: "string" },
    },
  },
};