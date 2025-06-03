<script lang="ts">
	import ActionCard from "./ActionCard.svelte";

	export let message: {
		role: "user" | "assistant" | "system";
		content: string;
		timestamp: Date;
		images?: File[];
		actions?: any[];
		aiStatus?: any;
	};
	export let isStreaming: boolean = false;
	export let formatTime: (date: Date) => string;

	enum AIStatus {
		Idle = "idle",
		Thinking = "thinking",
		ExecutingActions = "executing",
		Completed = "completed",
	}
</script>

<div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
	<div
		class="{message.role === 'user'
			? 'bg-indigo-500 text-white'
			: 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}
			p-3 rounded-lg max-w-[80%]"
	>
		<!-- AI Status Indicator -->
		{#if message.role === "assistant" && message.aiStatus && message.aiStatus !== AIStatus.Idle}
			<div
				class="flex items-center p-2 mb-3 rounded-md bg-white/10 dark:bg-black/10"
			>
				{#if message.aiStatus === AIStatus.Thinking}
					<div class="flex items-center">
						<svg
							class="w-4 h-4 mr-2 animate-pulse"
							fill="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm-1-13h2v6h-2V7zm0 8h2v2h-2v-2z"
							/>
						</svg>
						<span class="text-sm font-medium"
							>AI is thinking...</span
						>
					</div>
				{:else if message.aiStatus === AIStatus.ExecutingActions}
					<div class="flex items-center">
						<svg
							class="w-4 h-4 mr-2 animate-spin"
							fill="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.5-6.5l-2.8 2.8M9.3 14.7l-2.8 2.8m12.3-2.8l-2.8-2.8M9.3 9.3L6.5 6.5"
							/>
						</svg>
						<span class="text-sm font-medium"
							>Executing actions...</span
						>
					</div>
				{:else if message.aiStatus === AIStatus.Completed}
					<div class="flex items-center">
						<svg
							class="w-4 h-4 mr-2 text-green-500"
							fill="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								d="M9 16.2l-3.5-3.5c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l4.19 4.19c.39.39 1.02.39 1.41 0L20.3 7.7c.39-.39.39-1.02 0-1.41-.39-.39-1.02-.39-1.41 0L9 16.2z"
							/>
						</svg>
						<span
							class="text-sm font-medium text-green-600 dark:text-green-400"
							>Completed</span
						>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Action Cards -->
		{#if message.role === "assistant" && message.actions && message.actions.length > 0}
			<div class="mb-3 space-y-2">
				{#each message.actions as action}
					<ActionCard {action} {formatTime} />
				{/each}
			</div>
		{/if}

		<!-- Message Content -->
		<div class="whitespace-pre-wrap select-text">
			{message.content}
			{#if isStreaming}
				<span class="inline-block cursor-blink">▋</span>
			{/if}
		</div>

		<!-- Display attached images in chat history -->
		{#if message.role === "user" && message.images && message.images.length > 0}
			<div class="flex flex-wrap gap-2 mt-2">
				{#each message.images as image}
					<div class="relative inline-block">
						<img
							src={URL.createObjectURL(image)}
							alt="Attachment"
							class="w-auto border border-gray-300 rounded max-h-24 dark:border-gray-600"
						/>
					</div>
				{/each}
			</div>
		{/if}

		<div class="mt-1 text-xs text-right opacity-75">
			{formatTime(message.timestamp)}
		</div>
	</div>
</div>
