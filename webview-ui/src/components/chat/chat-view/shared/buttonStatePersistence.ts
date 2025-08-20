import { ClineMessage } from "@shared/ExtensionMessage"
import { ButtonConfig } from "./buttonConfig"

/**
 * Snapshot of button state captured before mode switches
 */
export interface ButtonStateSnapshot {
	/** The button configuration that was active */
	buttonConfig: ButtonConfig
	/** Timestamp when the snapshot was taken */
	timestamp: number
	/** The message ID this state was associated with */
	messageId?: string
	/** The mode this state was captured from */
	fromMode: "plan" | "act"
}

/**
 * Captures the current button state for persistence
 */
export function captureButtonState(
	message: ClineMessage,
	mode: "plan" | "act",
	currentButtonConfig: ButtonConfig,
): ButtonStateSnapshot {
	return {
		buttonConfig: { ...currentButtonConfig },
		timestamp: Date.now(),
		messageId: message.ts?.toString(),
		fromMode: mode,
	}
}

/**
 * Restores button state from a snapshot if applicable
 */
export function restoreButtonState(
	snapshot: ButtonStateSnapshot | null,
	currentMessage: ClineMessage,
	currentMode: "plan" | "act",
	fallbackConfig: ButtonConfig,
): ButtonConfig {
	// If no snapshot or snapshot is too old (>5 minutes), use fallback
	if (!snapshot || Date.now() - snapshot.timestamp > 5 * 60 * 1000) {
		return fallbackConfig
	}

	// If switching back to the same mode, don't restore
	if (snapshot.fromMode === currentMode) {
		return fallbackConfig
	}

	// Check if the snapshot is for the same message
	const currentMessageId = currentMessage.ts?.toString()
	if (snapshot.messageId && currentMessageId && snapshot.messageId === currentMessageId) {
		// Restore the button config but adapt it for the current mode
		return {
			...snapshot.buttonConfig,
			// Ensure the restored config is compatible with current mode
			sendingDisabled: fallbackConfig.sendingDisabled,
		}
	}

	return fallbackConfig
}

/**
 * Determines if a button state should be persisted
 */
export function shouldPersistButtonState(buttonConfig: ButtonConfig): boolean {
	// Persist states that represent user-initiated actions or important context
	const persistableTexts = ["Start New Task", "Resume Task", "Retry", "Continue", "Proceed"]

	return !!(buttonConfig.primaryText && persistableTexts.some((text) => buttonConfig.primaryText?.includes(text)))
}
