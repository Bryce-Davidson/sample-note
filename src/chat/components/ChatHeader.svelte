<script lang="ts">
	export let activeFileNameForDisplay: string;
	export let currentAIStatus: any;
	export let selectedModel: string;
	export let openAIModels: string[];
	export let hasApiKey: boolean;

	enum AIStatus {
		Idle = "idle",
		Thinking = "thinking",
		ExecutingActions = "executing",
		Completed = "completed",
	}

	$: displayModels = openAIModels.map((id) => {
		return { id, label: id };
	});

	function handleModelChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		selectedModel = target.value;
	}
</script>

<div
	class="sticky top-0 z-10 p-3 bg-white border-b border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700"
>
	<div class="flex items-center justify-between">
		<div class="flex items-center space-x-3">
			<h3 class="text-lg font-medium text-gray-800 dark:text-gray-200">
				{activeFileNameForDisplay}
			</h3>

			<!-- Global AI Status Indicator -->
			{#if currentAIStatus !== AIStatus.Idle && currentAIStatus !== AIStatus.ExecutingActions}
				<div
					class="flex items-center px-2 py-1 rounded-full {currentAIStatus ===
					AIStatus.Thinking
						? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
						: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'}"
				>
					{#if currentAIStatus === AIStatus.Thinking}
						<svg
							class="w-3 h-3 mr-1 animate-pulse"
							fill="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm-1-13h2v6h-2V7zm0 8h2v2h-2v-2z"
							/>
						</svg>
						<span class="text-xs font-medium">Thinking</span>
					{:else if currentAIStatus === AIStatus.Completed}
						<svg
							class="w-3 h-3 mr-1 text-green-500"
							fill="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								d="M9 16.2l-3.5-3.5c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l4.19 4.19c.39.39 1.02.39 1.41 0L20.3 7.7c.39-.39.39-1.02 0-1.41-.39-.39-1.02-.39-1.41 0L9 16.2z"
							/>
						</svg>
						<span class="text-xs font-medium">Done</span>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Model selection -->
		<div class="flex items-center">
			<select
				id="model-select"
				value={selectedModel}
				on:change={handleModelChange}
				class="p-1 text-sm text-gray-800 bg-white border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
				disabled={openAIModels.length === 0}
			>
				{#each displayModels as model}
					<option value={model.id}>{model.label}</option>
				{/each}
			</select>
			{#if openAIModels.length === 0 && hasApiKey}
				<span class="ml-2 text-xs text-gray-500 dark:text-gray-400"
					>Loading models...</span
				>
			{/if}
		</div>
	</div>
</div>
