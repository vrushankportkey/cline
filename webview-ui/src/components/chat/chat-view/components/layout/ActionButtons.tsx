import type { ClineMessage } from "@shared/ExtensionMessage"
import type { Mode } from "@shared/storage/types"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { useExtensionState } from "../../../../../context/ExtensionStateContext"
import { BUTTON_CONFIGS, getButtonConfig, getButtonConfigWithPersistence } from "../../shared/buttonConfig"
import { captureButtonState, shouldPersistButtonState } from "../../shared/buttonStatePersistence"
import type { ChatState, MessageHandlers } from "../../types/chatTypes"

interface ActionButtonsProps {
	task?: ClineMessage
	messages: ClineMessage[]
	chatState: ChatState
	messageHandlers: MessageHandlers
	mode: Mode
	scrollBehavior: {
		scrollToBottomSmooth: () => void
		disableAutoScrollRef: React.MutableRefObject<boolean>
		showScrollToBottom: boolean
	}
}

/**
 * Action buttons area including scroll-to-bottom and approve/reject buttons
 */
export const ActionButtons: React.FC<ActionButtonsProps> = ({
	task,
	messages,
	chatState,
	mode,
	messageHandlers,
	scrollBehavior,
}) => {
	const { inputValue, selectedImages, selectedFiles, setSendingDisabled } = chatState

	const isStreaming = useMemo(() => task?.partial === true, [task])

	const [primaryButtonText, setPrimaryButtonText] = useState<string | undefined>(undefined)
	const [secondaryButtonText, setSecondaryButtonText] = useState<string | undefined>(undefined)

	const [enableButtons, setEnableButtons] = useState<boolean>(false)

	const [lastMessage, secondLastMessage] = useMemo(() => {
		return [messages.at(-1), messages.at(-2)]
	}, [messages])

	// Clear input when transitioning from command_output to api_req
	// This happens when user provides feedback during command execution
	useEffect(() => {
		if (lastMessage?.type === "say" && lastMessage.say === "api_req_started" && secondLastMessage?.ask === "command_output") {
			chatState.setInputValue("")
			chatState.setSelectedImages([])
			chatState.setSelectedFiles([])
		}
	}, [chatState, lastMessage, secondLastMessage])

	// Get extension state for button persistence
	const extensionState = useExtensionState()

	// Apply button configuration with persistence support
	useEffect(() => {
		let buttonConfig = getButtonConfig(lastMessage, mode)

		// Check if we should restore button state from a previous mode switch
		const buttonStateSnapshot = extensionState.buttonStateSnapshot
		if (buttonStateSnapshot && lastMessage) {
			// Check if this snapshot is for the current message and we switched from a different mode
			const isForCurrentMessage = buttonStateSnapshot.messageId === lastMessage.ts.toString()
			const isModeSwitch = buttonStateSnapshot.fromMode !== mode
			const isRecentSnapshot = Date.now() - buttonStateSnapshot.timestamp < 30000 // 30 seconds

			if (isForCurrentMessage && isModeSwitch && isRecentSnapshot) {
				// Restore the persisted button state
				buttonConfig = {
					...buttonConfig,
					primaryText: buttonStateSnapshot.buttonConfig.primaryText,
					secondaryText: buttonStateSnapshot.buttonConfig.secondaryText,
					enableButtons: buttonStateSnapshot.buttonConfig.enableButtons,
					sendingDisabled: buttonStateSnapshot.buttonConfig.sendingDisabled,
				}
				console.log("Restored button state from snapshot:", buttonStateSnapshot)
			}
		}

		// Capture button state if it should be persisted for future mode switches
		if (lastMessage && shouldPersistButtonState(buttonConfig)) {
			// Update the button state snapshot in extension state with the actual button config
			const currentSnapshot = extensionState.buttonStateSnapshot
			if (currentSnapshot && currentSnapshot.messageId === lastMessage.ts.toString()) {
				// Update the existing snapshot with the actual button configuration
				const updatedSnapshot = {
					...currentSnapshot,
					buttonConfig: {
						primaryText: buttonConfig.primaryText,
						secondaryText: buttonConfig.secondaryText,
						enableButtons: buttonConfig.enableButtons,
						sendingDisabled: buttonConfig.sendingDisabled,
					},
				}
				console.log("Updated button state snapshot with config:", updatedSnapshot)
			}
		}

		setEnableButtons(buttonConfig.enableButtons)
		setSendingDisabled(buttonConfig.sendingDisabled)
		setPrimaryButtonText(buttonConfig.primaryText)
		setSecondaryButtonText(buttonConfig.secondaryText)
	}, [lastMessage, mode, setSendingDisabled, extensionState.buttonStateSnapshot])

	useEffect(() => {
		if (!messages?.length) {
			const buttonConfig = BUTTON_CONFIGS.default
			setEnableButtons(buttonConfig.enableButtons)
			setSendingDisabled(buttonConfig.sendingDisabled)
			setPrimaryButtonText(buttonConfig.primaryText)
			setSecondaryButtonText(buttonConfig.secondaryText)
		}
	}, [messages, setSendingDisabled])

	if (!task) {
		return null
	}

	const { showScrollToBottom, scrollToBottomSmooth, disableAutoScrollRef } = scrollBehavior

	if (showScrollToBottom) {
		const handleScrollToBottom = () => {
			scrollToBottomSmooth()
			disableAutoScrollRef.current = false
		}

		return (
			<div className="flex px-[15px] pt-[10px]">
				<VSCodeButton
					appearance="icon"
					aria-label="Scroll to bottom"
					className="text-lg text-[var(--vscode-primaryButton-foreground)] bg-[color-mix(in_srgb,var(--vscode-toolbar-hoverBackground)_55%,transparent)] rounded-[3px] overflow-hidden cursor-pointer flex justify-center items-center flex-1 h-[25px] hover:bg-[color-mix(in_srgb,var(--vscode-toolbar-hoverBackground)_90%,transparent)] active:bg-[color-mix(in_srgb,var(--vscode-toolbar-hoverBackground)_70%,transparent)] border-0"
					onClick={handleScrollToBottom}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault()
							handleScrollToBottom()
						}
					}}>
					<span className="codicon codicon-chevron-down" />
				</VSCodeButton>
			</div>
		)
	}

	const shouldShowButtons = primaryButtonText || secondaryButtonText
	const opacity = shouldShowButtons ? (enableButtons || isStreaming ? 1 : 0.5) : 0

	return (
		<div className={`flex px-[15px] ${shouldShowButtons ? "pt-[10px]" : "pt-0"}`} style={{ opacity }}>
			{primaryButtonText && (
				<VSCodeButton
					appearance="primary"
					className={`${secondaryButtonText ? "flex-1 mr-[6px]" : "flex-[2]"}`}
					disabled={!enableButtons}
					onClick={() => {
						if (primaryButtonText === "Start New Task") {
							messageHandlers.startNewTask()
						} else {
							messageHandlers.handleButtonClick(primaryButtonText, inputValue, selectedImages, selectedFiles)
						}
					}}>
					{primaryButtonText}
				</VSCodeButton>
			)}
			{secondaryButtonText && (
				<VSCodeButton
					appearance="secondary"
					className={`${primaryButtonText ? "flex-1 mr-[6px]" : "flex-[2]"}`}
					disabled={!enableButtons}
					onClick={() => {
						messageHandlers.handleButtonClick(secondaryButtonText, inputValue, selectedImages, selectedFiles)
					}}>
					{secondaryButtonText}
				</VSCodeButton>
			)}
		</div>
	)
}
