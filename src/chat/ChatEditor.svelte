<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { TFile } from "obsidian";
	import OpenAI from "openai";
	import type { ResponseInputItem } from "openai/resources/responses/responses";

	import ChatHeader from "./components/ChatHeader.svelte";
	import FileSearch from "./components/FileSearch.svelte";
	import FileTabs from "./components/FileTabs.svelte";
	import ChatMessages from "./components/ChatMessages.svelte";
	import ChatInput from "./components/ChatInput.svelte";

	import {
		type ActionItem,
		type ToolExecutionContext,
		AI_TOOLS,
		executeAITool,
		createActionItem,
		updateActionItem,
	} from "./AITools";

	export let plugin: any;
	export let selectedNotePath = "";

	let openai: OpenAI;
	$: if (plugin?.settings?.openAIApiKey) {
		openai = new OpenAI({
			apiKey: plugin.settings.openAIApiKey,
			dangerouslyAllowBrowser: true,
		});
	}

	enum AIStatus {
		Idle = "idle",
		Thinking = "thinking",
		ExecutingActions = "executing",
		Completed = "completed",
	}

	let containerEl: HTMLElement;
	let messages: Array<{
		role: "user" | "assistant" | "system";
		content: string;
		timestamp: Date;
		images?: File[];
		actions?: ActionItem[];
		aiStatus?: AIStatus;
	}> = [];
	let isProcessing = false;
	let isStreamingInChat = false;
	let currentAIStatus = AIStatus.Idle;
	let currentActions: ActionItem[] = [];
	$: hasApiKey = !!plugin?.settings?.openAIApiKey;
	let abortController: AbortController | null = null;

	let contextTabs: { file: TFile; path: string }[] = [];
	let activeNoteContextTabIndex: number = -1;

	let openAIModels: string[] = [];

	const preferredModels = [
		"gpt-4.1",
		"gpt-4.1-mini",
		"gpt-4.1-nano",
		"o3",
		"o4-mini",
	];

	let selectedModel = "gpt-4.1";

	let currentActiveFile: TFile | null = null;
	let obsidianActiveFile: TFile | null = null;

	let chatMessagesComponent: any;
	let chatInputComponent: any;

	$: activeFileNameForDisplay = currentActiveFile?.basename || "No file open";
	$: obsidianActiveFileName = obsidianActiveFile?.basename || "";

	$: {
		if (selectedNotePath && plugin?.app?.vault) {
			const file =
				plugin.app.vault.getAbstractFileByPath(selectedNotePath);
			if (file instanceof TFile) {
				currentActiveFile = file;
			} else {
				currentActiveFile = null;
			}
		} else {
			currentActiveFile = null;
		}
	}

	$: if (hasApiKey) {
		loadModels();
	}

	async function loadModels() {
		const models = await openai.models.list();

		const availableModels = models.data
			.map((m) => m.id)
			.filter((id: string) => preferredModels.includes(id));

		openAIModels = availableModels.sort();
	}

	async function getSystemMessage() {
		let tabsInfo = "";
		let tableOfContents = "";

		if (contextTabs.length > 0) {
			const tabContents = await Promise.all(
				contextTabs.map(async (tab, index) => {
					const isActive = index === activeNoteContextTabIndex;
					const content = await plugin.app.vault.read(tab.file);

					tableOfContents += `- ${isActive ? "(active note)" : ""}${tab.file.basename} [${tab.file.path}]\n`;

					return `${tab.file.basename}\`\`\`markdown\n${content}\n\`\`\`\n\n`;
				}),
			);

			tabsInfo = "\n\n" + tabContents.join("---\n\n");
		}

		return `You are an AI assistant helping with note-taking and analysis in Obsidian. You can analyze and provide insights on notes, help with organization, suggest improvements, and answer questions about the content. Please format all mathematics correctly.

Current Notes:\n
${tableOfContents}

${tabsInfo}

Please consider all note content when responding to the user. Focus on answering questions about the active note content, but you may reference other open notes if relevant.`;
	}

	function createToolExecutionContext(): ToolExecutionContext {
		return {
			plugin,
			addFileTab,
			selectedNotePath,
			setSelectedNotePath: (path: string) => {
				selectedNotePath = path;
			},
		};
	}

	onMount(() => {
		messages = [];
		ensureActiveFileInTabs();

		obsidianActiveFile = plugin.app.workspace.getActiveFile();

		const activeLeafHandler = plugin.app.workspace.on(
			"active-leaf-change",
			() => {
				obsidianActiveFile = plugin.app.workspace.getActiveFile();
				updateCurrentFileInTabsState();
			},
		);

		const fileRenameHandler = plugin.app.vault.on(
			"rename",
			(file: TFile, oldPath: string) => {
				handleFileRenamed(oldPath, file.path);

				const currentActiveFile = plugin.app.workspace.getActiveFile();
				if (currentActiveFile && currentActiveFile.path === file.path) {
					obsidianActiveFile = currentActiveFile;
					updateCurrentFileInTabsState();
				}
			},
		);

		const fileDeleteHandler = plugin.app.vault.on("delete", (file: any) => {
			if (file instanceof TFile) {
				handleFileDeleted(file.path);
			}
		});

		const fileCreateHandler = plugin.app.vault.on("create", (file: any) => {
			if (file instanceof TFile && file.extension === "md") {
			}
		});

		const fileModifyHandler = plugin.app.vault.on(
			"modify",
			(file: any) => {},
		);

		plugin.registerEvent(activeLeafHandler);
		plugin.registerEvent(fileRenameHandler);
		plugin.registerEvent(fileDeleteHandler);
		plugin.registerEvent(fileCreateHandler);
		plugin.registerEvent(fileModifyHandler);
	});

	function handleFileSelected(event: CustomEvent) {
		const { file } = event.detail;
		addFileTab(file);
	}

	function handleClearChat() {
		messages = [];
	}

	function handleTabSelected(event: CustomEvent) {
		const { index } = event.detail;
		selectTab(index);
	}

	function handleTabClosed(event: CustomEvent) {
		const { index, event: mouseEvent } = event.detail;
		closeTab(index, mouseEvent);
	}

	function handleOpenInObsidian(event: CustomEvent) {
		const { file } = event.detail;
		openFileInNewTab(file);
	}

	function handleAddCurrentFile(event: CustomEvent) {
		const { file } = event.detail;
		addCurrentFile();
	}

	function handleSendMessage(event: CustomEvent) {
		const { message, images } = event.detail;
		handleChatRequest(message, images);
	}

	function addFileTab(file: TFile) {
		const existingTabIndex = contextTabs.findIndex(
			(tab) => tab.path === file.path,
		);

		if (existingTabIndex >= 0) {
			const newTabs = [...contextTabs, { file, path: file.path }];
			contextTabs = newTabs;

			activeNoteContextTabIndex = newTabs.length - 1;
		}

		if (
			activeNoteContextTabIndex >= 0 &&
			activeNoteContextTabIndex < contextTabs.length
		) {
			selectedNotePath = contextTabs[activeNoteContextTabIndex].path;
		}
	}

	function closeTab(index: number, event?: MouseEvent) {
		if (event) {
			event.stopPropagation();
		}

		if (index < 0 || index >= contextTabs.length) return;

		const newTabs = contextTabs.filter((_, i) => i !== index);
		contextTabs = newTabs;

		if (activeNoteContextTabIndex === index) {
			if (contextTabs.length > 0 && index > 0) {
				const newActiveIndex = index - 1;
				activeNoteContextTabIndex = newActiveIndex;
				selectedNotePath = contextTabs[newActiveIndex].path;

				const newFile = plugin.app.vault.getAbstractFileByPath(
					contextTabs[newActiveIndex].path,
				);
				if (newFile instanceof TFile) {
					currentActiveFile = newFile;
				}
			} else {
				ensureActiveFileInTabs();

				if (contextTabs.length === 0) {
					activeNoteContextTabIndex = -1;
					selectedNotePath = "";
					currentActiveFile = null;
				}
			}
		} else if (activeNoteContextTabIndex > index) {
			activeNoteContextTabIndex--;
		}

		if (contextTabs.length === 0) {
			ensureActiveFileInTabs();
		}
	}

	function selectTab(index: number) {
		if (index < 0 || index >= contextTabs.length) return;

		activeNoteContextTabIndex = index;
		selectedNotePath = contextTabs[index].path;

		const file = contextTabs[index].file;
		if (file instanceof TFile) {
			currentActiveFile = file;
		}
	}

	function openFileInNewTab(file: TFile) {
		const existingLeaf = findLeafForFile(file);

		if (existingLeaf) {
			plugin.app.workspace.setActiveLeaf(existingLeaf);
		} else {
			plugin.app.workspace.getLeaf(true).openFile(file);
		}
	}

	function findLeafForFile(file: TFile) {
		const leaves = plugin.app.workspace.getLeavesOfType("markdown");

		for (const leaf of leaves) {
			const viewState = leaf.getViewState();
			if (viewState.state?.file === file.path) {
				return leaf;
			}
		}

		return null;
	}

	function addCurrentFile() {
		const currentActiveFile = plugin.app.workspace.getActiveFile();

		if (currentActiveFile && currentActiveFile.extension === "md") {
			const savedActiveTabIndex = activeNoteContextTabIndex;

			const existingTabIndex = contextTabs.findIndex(
				(tab) => tab.path === currentActiveFile.path,
			);

			if (existingTabIndex === -1) {
				const newTabs = [
					...contextTabs,
					{ file: currentActiveFile, path: currentActiveFile.path },
				];
				contextTabs = newTabs;
			}

			activeNoteContextTabIndex = savedActiveTabIndex;

			updateCurrentFileInTabsState();
		}
	}

	async function handleChatRequest(userMessage: string, images: File[] = []) {
		if (!userMessage.trim() && images.length === 0) return;

		try {
			currentAIStatus = AIStatus.Thinking;
			currentActions = [];

			messages = [
				...messages,
				{
					role: "user",
					content: userMessage,
					timestamp: new Date(),
					images: [...images],
				},
			];

			messages = [
				...messages,
				{
					role: "assistant",
					content: "",
					timestamp: new Date(),
					actions: [],
					aiStatus: AIStatus.Thinking,
				},
			];

			scrollToBottom();

			isProcessing = true;
			isStreamingInChat = true;

			abortController = new AbortController();

			const input: ResponseInputItem[] = [];

			const systemMessage = await getSystemMessage();

			input.push({
				role: "system",
				content: systemMessage,
			});

			for (let i = 0; i < messages.length - 2; i++) {
				input.push({
					role: messages[i].role,
					content: messages[i].content,
				});
			}

			try {
				const imageContents = [];
				for (const image of images) {
					const base64 = await imageToBase64(image);
					imageContents.push({
						type: "input_image" as const,
						image_url: `data:image/${image.type};base64,${base64}`,
						detail: "auto" as const,
					});
				}

				input.push({
					role: "user",
					content: [
						{ type: "input_text", text: userMessage },
						...imageContents,
					],
				});
			} catch (error) {
				console.error("Error processing attached images:", error);
			}

			const stream = await openai.responses.create({
				model: selectedModel,
				input,
				tools: AI_TOOLS,
				stream: true,
				store: true,
			});

			const editToolCalls: Record<number, any> = {};
			const contentParts: Record<number, any> = {};
			let hasContent = false;

			for await (const event of stream) {
				if (abortController?.signal.aborted) return;

				switch (event.type) {
					case "response.created":
						continue;
					case "response.in_progress":
						break;
					case "response.output_item.added":
						switch (event.item.type) {
							case "function_call":
								currentAIStatus = AIStatus.ExecutingActions;
								messages[messages.length - 1].aiStatus =
									AIStatus.ExecutingActions;

								editToolCalls[event.output_index] = event.item;

								const functionCallItemAdded = event.item as any;
								const actionItem = createActionItem(
									functionCallItemAdded.name,
								);

								currentActions = [
									...currentActions,
									actionItem,
								];
								messages[messages.length - 1].actions = [
									...currentActions,
								];
								messages = [...messages];

								break;
							case "message":
								hasContent = true;
								contentParts[event.output_index] = event.item;
								break;
						}
						break;
					case "response.content_part.added":
						break;
					case "response.output_text.delta":
						hasContent = true;
						messages[messages.length - 1].content += event.delta;
						messages = [...messages];
						break;
					case "response.function_call_arguments.delta":
						editToolCalls[event.output_index].arguments +=
							event.delta;
						break;
					case "response.content_part.done":
						break;
					case "response.output_item.done":
						switch (event.item.type) {
							case "function_call":
								editToolCalls[event.output_index] = event.item;

								const functionCallItem = event.item as any;
								const actionIndex = currentActions.findIndex(
									(action) =>
										action.type === functionCallItem.name &&
										action.status === "in-progress",
								);

								if (actionIndex >= 0) {
									try {
										const params = JSON.parse(
											functionCallItem.arguments,
										);
										const context =
											createToolExecutionContext();

										const result = await executeAITool(
											functionCallItem.name,
											params,
											context,
										);

										currentActions[actionIndex] =
											updateActionItem(
												currentActions[actionIndex],
												result,
												params,
											);

										messages[messages.length - 1].actions =
											[...currentActions];
										messages = [...messages];
									} catch (error) {
										currentActions[actionIndex] = {
											...currentActions[actionIndex],
											status: "error",
											result: `Error: ${(error as Error).message}`,
										};
										messages[messages.length - 1].actions =
											[...currentActions];
										messages = [...messages];
									}
								}
								break;
						}
						break;
					case "response.completed":
						currentAIStatus = AIStatus.Completed;
						messages[messages.length - 1].aiStatus =
							AIStatus.Completed;

						if (!hasContent && currentActions.length > 0) {
							const completedActions = currentActions.filter(
								(a) => a.status === "completed",
							);
							if (completedActions.length > 0) {
								messages[messages.length - 1].content =
									`Completed ${completedActions.length} action${completedActions.length > 1 ? "s" : ""}.`;
							}
						}

						messages = [...messages];
						scrollToBottom();

						setTimeout(() => {
							if (chatInputComponent && !isStreamingInChat) {
								chatInputComponent.focusInput();
							}
						}, 500);
						break;
				}
			}
		} catch (error) {
			console.error("Error processing stream:", error);
			currentAIStatus = AIStatus.Idle;

			messages = [
				...messages,
				{
					role: "assistant",
					content: `❌ Error: ${(error as Error).message || "Failed to generate response"}`,
					timestamp: new Date(),
					aiStatus: AIStatus.Idle,
				},
			];
		} finally {
			isProcessing = false;
			isStreamingInChat = false;
			currentAIStatus = AIStatus.Idle;
			abortController = null;

			scrollToBottom();
		}
	}

	function imageToBase64(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.readAsDataURL(file);
			reader.onload = () => {
				const result = reader.result as string;
				const base64 = result.split(",")[1];
				resolve(base64);
			};
			reader.onerror = (error) => reject(error);
		});
	}

	function scrollToBottom() {
		if (chatMessagesComponent) {
			chatMessagesComponent.scrollToBottom();
		}
	}

	function handleFileRenamed(oldPath: string, newPath: string) {
		const existingNewPathIndex = contextTabs.findIndex(
			(tab) => tab.path === newPath,
		);
		const existingOldPathIndex = contextTabs.findIndex(
			(tab) => tab.path === oldPath,
		);

		if (existingNewPathIndex !== -1 && existingOldPathIndex !== -1) {
			contextTabs = contextTabs.filter((tab) => tab.path !== oldPath);

			if (activeNoteContextTabIndex === existingOldPathIndex) {
				activeNoteContextTabIndex = existingNewPathIndex;
			} else if (activeNoteContextTabIndex > existingOldPathIndex) {
				activeNoteContextTabIndex--;
			}
		} else {
			contextTabs = contextTabs.map((tab) => {
				if (tab.path === oldPath) {
					const newFile =
						plugin.app.vault.getAbstractFileByPath(newPath);
					if (newFile instanceof TFile) {
						return { file: newFile, path: newPath };
					}
				}
				return tab;
			});
		}

		if (selectedNotePath === oldPath) {
			selectedNotePath = newPath;
		}
	}

	function handleFileDeleted(deletedPath: string) {
		let tabIndex = -1;

		tabIndex = contextTabs.findIndex((tab) => tab.path === deletedPath);

		if (tabIndex !== -1) {
			const wasActive = tabIndex === activeNoteContextTabIndex;

			contextTabs = contextTabs.filter((tab) => tab.path !== deletedPath);

			if (wasActive) {
				if (contextTabs.length > 0 && tabIndex > 0) {
					activeNoteContextTabIndex = tabIndex - 1;

					if (contextTabs[activeNoteContextTabIndex]) {
						const newPath =
							contextTabs[activeNoteContextTabIndex].path;
						selectedNotePath = newPath;

						const newFile =
							plugin.app.vault.getAbstractFileByPath(newPath);
						if (newFile instanceof TFile) {
							currentActiveFile = newFile;
						}
					}
				} else {
					ensureActiveFileInTabs();

					if (contextTabs.length === 0) {
						activeNoteContextTabIndex = -1;
						selectedNotePath = "";
						currentActiveFile = null;
					}
				}
			} else if (activeNoteContextTabIndex > tabIndex) {
				activeNoteContextTabIndex--;
			}

			if (contextTabs.length === 0) {
				ensureActiveFileInTabs();
			}
		}

		if (selectedNotePath === deletedPath) {
			selectedNotePath = "";
			currentActiveFile = null;

			ensureActiveFileInTabs();
		}
	}

	function ensureActiveFileInTabs() {
		const activeFile = plugin.app.workspace.getActiveFile();

		if (activeFile && activeFile.extension === "md") {
			const existingTabIndex = contextTabs.findIndex(
				(tab) => tab.path === activeFile.path,
			);

			if (existingTabIndex === -1 && contextTabs.length === 0) {
				contextTabs = [{ file: activeFile, path: activeFile.path }];
				activeNoteContextTabIndex = 0;
				selectedNotePath = activeFile.path;

				currentActiveFile = activeFile;

				return activeFile;
			} else if (existingTabIndex >= 0) {
				activeNoteContextTabIndex = existingTabIndex;
				selectedNotePath = activeFile.path;

				currentActiveFile = activeFile;

				return activeFile;
			}
		}

		return null;
	}

	let currentFileIsInTabs = false;

	$: {
		updateCurrentFileInTabsState();
	}

	$: contextTabs, updateCurrentFileInTabsState();
	$: currentActiveFile, updateCurrentFileInTabsState();
	$: selectedNotePath, updateCurrentFileInTabsState();
	$: obsidianActiveFile, updateCurrentFileInTabsState();

	$: plugin?.app?.workspace?.getActiveFile(), updateCurrentFileInTabsState();

	function updateCurrentFileInTabsState() {
		currentFileIsInTabs = !isCurrentFileNotInTabs();
	}

	function isCurrentFileNotInTabs() {
		const obsidianActiveFile = plugin.app.workspace.getActiveFile();

		if (!obsidianActiveFile || obsidianActiveFile.extension !== "md") {
			return false;
		}

		const isAlreadyInTabs = contextTabs.some(
			(tab) => tab.path === obsidianActiveFile.path,
		);

		return !isAlreadyInTabs;
	}
</script>

<div
	class="relative flex flex-col h-full chat-editor bg-gray-50 dark:bg-gray-800"
	bind:this={containerEl}
	role="region"
	aria-label="Chat interface"
>
	<!-- Header section with note selection -->
	<ChatHeader
		{activeFileNameForDisplay}
		{currentAIStatus}
		bind:selectedModel
		{openAIModels}
		{hasApiKey}
	/>

	<!-- Search tray -->
	<FileSearch
		{plugin}
		on:fileSelected={handleFileSelected}
		on:clearChat={handleClearChat}
	/>

	<!-- Tab tray -->
	<FileTabs
		{contextTabs}
		{activeNoteContextTabIndex}
		{currentFileIsInTabs}
		{obsidianActiveFileName}
		{plugin}
		on:tabSelected={handleTabSelected}
		on:tabClosed={handleTabClosed}
		on:openInObsidian={handleOpenInObsidian}
		on:addCurrentFile={handleAddCurrentFile}
	/>

	<!-- Messages container -->
	<ChatMessages
		{messages}
		{isStreamingInChat}
		bind:this={chatMessagesComponent}
	/>

	<!-- Input area -->
	<ChatInput
		{isStreamingInChat}
		{isProcessing}
		{hasApiKey}
		{currentAIStatus}
		{abortController}
		bind:this={chatInputComponent}
		on:sendMessage={handleSendMessage}
	/>
</div>
