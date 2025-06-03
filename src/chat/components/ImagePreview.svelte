<script lang="ts">
	import { createEventDispatcher } from "svelte";

	export let imagePreviewUrls: string[] = [];

	const dispatch = createEventDispatcher();

	function removeImage(index: number) {
		dispatch("removeImage", { index });
	}
</script>

{#if imagePreviewUrls.length > 0}
	<div class="flex flex-wrap gap-2 mb-2">
		{#each imagePreviewUrls as url, index}
			<div class="relative inline-block">
				<img
					src={url}
					alt="Message attachment"
					class="w-auto h-16 border border-gray-300 rounded dark:border-gray-600"
				/>
				<button
					class="absolute flex items-center justify-center w-5 h-5 text-gray-700 transition-all duration-200 border rounded backdrop-blur-sm bg-white/20 dark:bg-black/20 border-white/30 dark:border-black/30 dark:text-gray-200 hover:bg-red-500/20 hover:border-red-400/30 hover:text-red-600 dark:hover:text-red-400 -top-2 -right-2"
					on:click={() => removeImage(index)}
					title="Remove image"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 384 512"
						class="w-2.5 h-2.5 fill-current"
					>
						<path
							d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"
						/>
					</svg>
				</button>
			</div>
		{/each}
	</div>
{/if}
