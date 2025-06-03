<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import ImagePreview from "./ImagePreview.svelte";

	export let isStreamingInChat: boolean = false;
	export let isProcessing: boolean = false;
	export let hasApiKey: boolean = false;
	export let currentAIStatus: any;
	export let abortController: AbortController | null = null;

	const dispatch = createEventDispatcher();

	let isDraggingOver = false;
	let attachedImages: File[] = [];
	let imagePreviewUrls: string[] = [];

	let dialogText: HTMLTextAreaElement;
	let fileInputEl: HTMLInputElement;

	enum AIStatus {
		Idle = "idle",
		Thinking = "thinking",
		ExecutingActions = "executing",
		Completed = "completed",
	}

	function handleFileInput(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target?.files) {
			const files = Array.from(target.files) as File[];
			if (files.length > 0) {
				attachedImages = [...attachedImages, ...files];
				files.forEach((file) => {
					const url = URL.createObjectURL(file);
					imagePreviewUrls = [...imagePreviewUrls, url];
				});
			}
			target.value = "";
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDraggingOver = true;
	}

	function handleDragLeave() {
		isDraggingOver = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDraggingOver = false;

		if (e.dataTransfer?.files) {
			const files = Array.from(e.dataTransfer.files);
			const imageFiles = files.filter((file) =>
				file.type.startsWith("image/"),
			);

			if (imageFiles.length > 0) {
				attachedImages = [...attachedImages, ...imageFiles];

				imageFiles.forEach((file) => {
					const url = URL.createObjectURL(file);
					imagePreviewUrls = [...imagePreviewUrls, url];
				});
			}
		}
	}

	function removeImage(event: CustomEvent) {
		const { index } = event.detail;
		URL.revokeObjectURL(imagePreviewUrls[index]);
		attachedImages = attachedImages.filter((_, i) => i !== index);
		imagePreviewUrls = imagePreviewUrls.filter((_, i) => i !== index);
	}

	function autoResizeTextarea() {
		if (!dialogText) return;

		dialogText.style.height = "auto";
		const newHeight = Math.min(200, dialogText.scrollHeight + 2);
		dialogText.style.height = `${newHeight}px`;
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			handleSendMessage();
		}
	}

	function handleSendMessage() {
		if (
			!dialogText ||
			(!dialogText.value.trim() && attachedImages.length === 0)
		)
			return;

		const userMessage = dialogText.value;
		const images = [...attachedImages];

		dialogText.value = "";
		attachedImages = [];
		imagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
		imagePreviewUrls = [];

		autoResizeTextarea();

		dispatch("sendMessage", {
			message: userMessage,
			images: images,
		});
	}

	function handleAbort() {
		if (abortController) {
			abortController.abort();
		}
	}

	$: if (dialogText) {
		dialogText.addEventListener("input", autoResizeTextarea);
	}

	export function focusInput() {
		if (dialogText && !isStreamingInChat) {
			dialogText.focus();
		}
	}
</script>

<div
	class="p-3 bg-white border-t border-gray-200 dark:border-gray-700 dark:bg-gray-800"
	role="region"
	aria-label="Image upload area"
	on:dragover={handleDragOver}
	on:dragleave={handleDragLeave}
	on:drop={handleDrop}
>
	{#if isDraggingOver}
		<div
			class="absolute inset-0 z-50 transition-all duration-200 border-2 border-dashed rounded-lg pointer-events-none bg-blue-500/5 border-blue-400/40 ring-4 ring-blue-500/15"
		></div>
	{/if}

	<!-- Image preview area -->
	<ImagePreview {imagePreviewUrls} on:removeImage={removeImage} />

	<div class="relative flex items-end gap-2">
		<textarea
			bind:this={dialogText}
			class="flex-1 p-3 backdrop-blur-sm bg-white/10 dark:bg-black/10 border border-white/20 dark:border-black/20 text-gray-700 dark:text-gray-300 rounded-lg resize-none transition-all duration-200 outline-none focus:outline focus:outline-2 focus:outline-blue-500 {currentAIStatus !==
			AIStatus.Idle
				? 'opacity-75'
				: ''}"
			placeholder={isDraggingOver
				? "Drop image here..."
				: currentAIStatus === AIStatus.Thinking
					? "AI is thinking..."
					: currentAIStatus === AIStatus.ExecutingActions
						? "AI is working on your request..."
						: "Type your message or drop an image..."}
			rows="1"
			on:keydown={handleKeyDown}
			disabled={isStreamingInChat}
		></textarea>

		<!-- Image upload button -->
		<button
			class="flex items-center justify-center h-[46px] w-12 p-2 text-indigo-700 transition-all duration-200 border rounded-lg backdrop-blur-sm bg-indigo-500/20 border-indigo-400/30 dark:text-indigo-300 hover:bg-indigo-500/30 hover:border-indigo-400/40 hover:shadow-lg hover:shadow-indigo-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
			title="Attach image"
			on:click={() => fileInputEl?.click()}
			disabled={isStreamingInChat}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				class="w-5 h-5"
			>
				<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
				<circle cx="8.5" cy="8.5" r="1.5"></circle>
				<polyline points="21 15 16 10 5 21"></polyline>
			</svg>
		</button>

		<input
			id="image-upload"
			type="file"
			accept="image/*"
			class="hidden"
			bind:this={fileInputEl}
			on:change={handleFileInput}
			multiple
		/>

		<!-- Show Stop button when streaming -->
		{#if isStreamingInChat}
			<button
				class="flex items-center justify-center h-[46px] w-12 p-2 text-red-700 transition-all duration-200 border rounded-lg backdrop-blur-sm bg-red-500/20 border-red-400/30 dark:text-red-300 hover:bg-red-500/30 hover:border-red-400/40 hover:shadow-lg hover:shadow-red-500/10"
				on:click={handleAbort}
				title="Stop generating"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					class="w-5 h-5"
				>
					<rect x="6" y="6" width="12" height="12"></rect>
				</svg>
			</button>
		{:else}
			<!-- Send button when not streaming -->
			<button
				class="flex items-center justify-center h-[46px] w-12 p-2 text-indigo-700 transition-all duration-200 border rounded-lg backdrop-blur-sm bg-indigo-500/20 border-indigo-400/30 dark:text-indigo-300 hover:bg-indigo-500/30 hover:border-indigo-400/40 hover:shadow-lg hover:shadow-indigo-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
				on:click={handleSendMessage}
				disabled={isProcessing}
			>
				{#if isProcessing}
					<svg
						class="w-5 h-5 animate-spin"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle
							class="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
				{:else}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						class="w-5 h-5"
					>
						<path d="M22 2L11 13"></path>
						<path d="M22 2l-7 20-4-9-9-4 20-7z"></path>
					</svg>
				{/if}
			</button>
		{/if}
	</div>

	<!-- API Key Notice -->
	{#if !hasApiKey}
		<div
			class="mt-2 text-xs text-center text-amber-600 dark:text-amber-400"
		>
			<p>
				⚠️ OpenAI API key not set. Add it in plugin settings to use AI
				features.
			</p>
		</div>
	{/if}
</div>
