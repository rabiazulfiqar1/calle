import { z } from "zod";
import { Template, userInfoSchema, appointmentDetailsSchema } from "./types";

export const appointmentTemplate: Template<z.infer<typeof appointmentDetailsSchema>> = {
  id: "appointment",
  label: "Appointment scheduling",
  detailsSchema: appointmentDetailsSchema,
  buildTask: (details, user) => `
    Call and book a ${details.bookingType}.
    Reason: ${details.purpose}.
    Preferred time: ${details.preferredTimeRange}.
    ${user.name ? `This booking is on behalf of ${user.name}.` : ""}
    ${user.callbackPhone ? `If they need a callback number, use ${user.callbackPhone}.` : ""}
    Confirm the exact date and time they offer, or explain why it couldn't be booked.
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
    required: ["confirmed", "scheduledTime", "notes"],
    properties: {
      confirmed: { type: "string", enum: ["yes", "no", "not sure"] },
      scheduledTime: { type: "string" },
      notes: { type: "string" },
    },
  },
};