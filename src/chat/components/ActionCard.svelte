<script lang="ts">
	export let action: {
		id: string;
		type: string;
		status: "pending" | "in-progress" | "completed" | "error";
		title: string;
		description: string;
		result?: string;
		timestamp: Date;
		params?: any;
	};
	export let formatTime: (date: Date) => string;

	const ToolNames = {
		create_new_note: "create_new_note",
		replace_document_content: "replace_document_content",
	};
</script>

<div
	class="p-3 border rounded-lg bg-white/5 dark:bg-black/5 border-white/10 dark:border-black/10"
>
	<div class="flex items-start justify-between">
		<div class="flex items-start flex-1 space-x-3">
			<!-- Status Icon -->
			<div class="flex-shrink-0 mt-0.5">
				{#if action.status === "pending"}
					<div
						class="w-4 h-4 border border-gray-400 rounded-full animate-pulse"
					></div>
				{:else if action.status === "in-progress"}
					<svg
						class="w-4 h-4 text-blue-500 animate-spin"
						fill="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.5-6.5l-2.8 2.8M9.3 14.7l-2.8 2.8m12.3-2.8l-2.8-2.8M9.3 9.3L6.5 6.5"
						/>
					</svg>
				{:else if action.status === "completed"}
					<svg
						class="w-4 h-4 text-green-500"
						fill="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							d="M9 16.2l-3.5-3.5c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l4.19 4.19c.39.39 1.02.39 1.41 0L20.3 7.7c.39-.39.39-1.02 0-1.41-.39-.39-1.02-.39-1.41 0L9 16.2z"
						/>
					</svg>
				{:else if action.status === "error"}
					<svg
						class="w-4 h-4 text-red-500"
						fill="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm-1-13h2v6h-2V7zm0 8h2v2h-2v-2z"
						/>
					</svg>
				{/if}
			</div>

			<!-- Action Details -->
			<div class="flex-1 min-w-0">
				<div class="flex items-center justify-between">
					<h4
						class="text-sm font-medium text-gray-900 dark:text-gray-100"
					>
						{action.title}
					</h4>
					<span class="ml-2 text-xs text-gray-500 dark:text-gray-400">
						{formatTime(action.timestamp)}
					</span>
				</div>
				<p class="mt-1 text-xs text-gray-600 dark:text-gray-400">
					{action.description}
				</p>
				{#if action.result}
					<div
						class="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs {action.status ===
						'error'
							? 'text-red-600 dark:text-red-400'
							: 'text-green-600 dark:text-green-400'}"
					>
						{action.result}
					</div>
				{/if}
				{#if action.status === "completed" && action.params}
					<!-- Show preview of what was done -->
					<details class="mt-2">
						<summary
							class="text-xs text-gray-500 cursor-pointer dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
						>
							View details
						</summary>
						<div
							class="p-2 mt-1 font-mono text-xs bg-gray-100 rounded dark:bg-gray-800"
						>
							{#if action.type === ToolNames.create_new_note}
								<div class="mb-1">
									<strong>Note:</strong>
									{action.params.noteName}
								</div>
								<div
									class="overflow-y-auto text-gray-600 dark:text-gray-400 max-h-20"
								>
									{action.params.content.substring(
										0,
										200,
									)}{action.params.content.length > 200
										? "..."
										: ""}
								</div>
							{:else if action.type === ToolNames.replace_document_content}
								<div class="mb-1">
									<strong>File:</strong>
									{action.params.filePath}
								</div>
								<div
									class="overflow-y-auto text-gray-600 dark:text-gray-400 max-h-20"
								>
									{action.params.content.substring(
										0,
										200,
									)}{action.params.content.length > 200
										? "..."
										: ""}
								</div>
							{/if}
						</div>
					</details>
				{/if}
			</div>
		</div>
	</div>
</div>
