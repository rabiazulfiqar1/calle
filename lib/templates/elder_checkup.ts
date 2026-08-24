import { z } from "zod";
import { elderCheckupDetailsSchema, Template, userInfoSchema } from "./types";

export const elderCheckupTemplate: Template<z.infer<typeof elderCheckupDetailsSchema>> = {
	id: "elder_checkup",
	label: "Elder check-in",
	detailsSchema: elderCheckupDetailsSchema,
    buildTask: (details, user) => `
    Have a warm, respectful, and natural conversation with ${details.personName}.
    
    Use these as conversation topics, not a strict questionnaire:
    ${details.thingsToAsk.map((item) => `- ${item}`).join("\n    ")}

    Bring them up naturally, one at a time. Listen to their responses, acknowledge what they say,
    and ask relevant follow-up questions when appropriate. Don't repeat questions they've already answered
    or rush through the topics.

    ${details.reminder ? `When appropriate, gently mention: ${details.reminder}` : ""}
    If relevant, naturally check whether they have taken their medicine or need help remembering it.
    ${user.name ? `You are calling on behalf of ${user.name}.` : ""}

    Keep the conversation caring, calm, interactive, and unscripted.
    Before ending, briefly confirm any important follow-up and end warmly.
    `,
	resultSchema: {
		type: "object",
		required: ["answer", "notes"],
		properties: {
			answer: { type: "string", enum: ["yes", "no", "not sure"] },
			notes: { type: "string" },
		},
	},
	recipientResultSchema: {
		type: "object",
		required: ["confirmed", "notes"],
		properties: {
			confirmed: { type: "string", enum: ["yes", "no", "not sure"] },
			notes: { type: "string" },
		},
	},
};
