<script lang="ts">
	export let filterMode: string;
	export let onFilterChange: (mode: string) => void;
</script>

<div
	class="flex flex-col gap-3 p-4 mb-2 bg-gray-100 rounded-lg dark:bg-gray-700"
>
	<!-- Main filter buttons row -->
	<div class="flex flex-wrap gap-2">
		<button
			class="p-2 rounded-lg flex-grow min-w-[120px] basis-0 flex items-center justify-center text-sm font-medium border transition-colors {filterMode ===
			'due'
				? 'text-gray-900 dark:text-white bg-blue-100 dark:bg-blue-900/30 border-blue-500'
				: 'text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'}"
			on:click={() => onFilterChange("due")}
		>
			Due
		</button>
		<button
			class="p-2 rounded-lg flex-grow min-w-[120px] basis-0 flex items-center justify-center text-sm font-medium border transition-colors {filterMode ===
			'scheduled'
				? 'text-gray-900 dark:text-white bg-blue-100 dark:bg-blue-900/30 border-blue-500'
				: 'text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'}"
			on:click={() => onFilterChange("scheduled")}
		>
			Scheduled
		</button>
		<button
			class="p-2 rounded-lg flex-grow min-w-[120px] basis-0 flex items-center justify-center text-sm font-medium border transition-colors {filterMode ===
			'note'
				? 'text-gray-900 dark:text-white bg-blue-100 dark:bg-blue-900/30 border-blue-500'
				: 'text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'}"
			on:click={() => onFilterChange("note")}
		>
			Note
		</button>
	</div>

	<!-- All Cards button (full width) -->
	<button
		class="p-2 rounded-lg w-full flex items-center justify-center text-sm font-medium border transition-colors {filterMode ===
		'all'
			? 'text-gray-900 dark:text-white bg-blue-100 dark:bg-blue-900/30 border-blue-500'
			: 'text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'}"
		on:click={() => onFilterChange("all")}
	>
		All Cards
	</button>
</div>
