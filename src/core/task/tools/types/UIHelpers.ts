import type { ClineAsk, ClineSay } from "@shared/ExtensionMessage"
import type { ClineAskResponse } from "@shared/WebviewMessage"
import type { ToolParamName, ToolUse, ToolUseName } from "../../../assistant-message"
import type { TaskConfig } from "./TaskConfig"

/**
 * Strongly-typed UI helper functions for tool handlers
 */
export interface StronglyTypedUIHelpers {
	// Core UI methods
	say: (type: ClineSay, text?: string, images?: string[], files?: string[], partial?: boolean) => Promise<number | undefined>

	ask: (
		type: ClineAsk,
		text?: string,
		partial?: boolean,
	) => Promise<{
		response: ClineAskResponse
		text?: string
		images?: string[]
		files?: string[]
	}>

	// Utility methods
	removeClosingTag: (block: ToolUse, tag: ToolParamName, text?: string) => string
	removeLastPartialMessageIfExistsWithType: (type: "ask" | "say", askOrSay: ClineAsk | ClineSay) => Promise<void>

	// Approval methods
	shouldAutoApproveTool: (toolName: ToolUseName) => boolean | [boolean, boolean]
	shouldAutoApproveToolWithPath: (toolName: ToolUseName, path?: string) => Promise<boolean>
	askApproval: (messageType: ClineAsk, message: string) => Promise<boolean>

	// Telemetry and notifications
	captureTelemetry: (toolName: ToolUseName, autoApproved: boolean, approved: boolean) => void
	showNotificationIfEnabled: (message: string) => void

	// Config access - returns the proper typed config
	getConfig: () => TaskConfig
}

/**
 * Creates strongly-typed UI helpers from a TaskConfig
 */
export function createUIHelpers(config: TaskConfig): StronglyTypedUIHelpers {
	return {
		say: config.callbacks.say,
		ask: config.callbacks.ask,
		removeClosingTag: (block: ToolUse, tag: ToolParamName, text?: string) => {
			if (!block.partial) {
				return text || ""
			}
			if (!text) {
				return ""
			}
			// This regex dynamically constructs a pattern to match the closing tag:
			// - Optionally matches whitespace before the tag
			// - Matches '<' or '</' optionally followed by any subset of characters from the tag name
			const tagRegex = new RegExp(
				`\\s?<\/?${tag
					.split("")
					.map((char) => `(?:${char})?`)
					.join("")}$`,
				"g",
			)
			return text.replace(tagRegex, "")
		},
		removeLastPartialMessageIfExistsWithType: config.callbacks.removeLastPartialMessageIfExistsWithType,
		shouldAutoApproveTool: (toolName: ToolUseName) => config.autoApprover.shouldAutoApproveTool(toolName),
		shouldAutoApproveToolWithPath: config.callbacks.shouldAutoApproveToolWithPath,
		askApproval: async (messageType: ClineAsk, message: string): Promise<boolean> => {
			const { response } = await config.callbacks.ask(messageType, message, false)
			return response === "yesButtonClicked"
		},
		captureTelemetry: (toolName: ToolUseName, autoApproved: boolean, approved: boolean) => {
			// Import telemetry service dynamically to avoid circular dependencies
			const { telemetryService } = require("@services/posthog/PostHogClientProvider")
			telemetryService.captureToolUsage(config.ulid, toolName, config.api.getModel().id, autoApproved, approved)
		},
		showNotificationIfEnabled: (message: string) => {
			// Import notification function dynamically to avoid circular dependencies
			const { showNotificationForApprovalIfAutoApprovalEnabled } = require("../../utils")
			showNotificationForApprovalIfAutoApprovalEnabled(
				message,
				config.autoApprovalSettings.enabled,
				config.autoApprovalSettings.enableNotifications,
			)
		},
		getConfig: () => config,
	}
}
