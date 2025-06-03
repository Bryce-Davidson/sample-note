<script lang="ts">
	export let currentIndex: number;
	export let totalCardCount: number;

	let progressBar: HTMLElement;

	function updateProgressBar() {
		if (!progressBar) return;
		requestAnimationFrame(() => {
			if (!progressBar) return;
			const progress = ((currentIndex + 1) / totalCardCount) * 100;
			progressBar.style.width = `${progress}%`;
		});
	}

	$: if (progressBar && currentIndex >= 0 && totalCardCount > 0) {
		updateProgressBar();
	}
</script>

<div class="progress-container">
	<div class="progress-bar" bind:this={progressBar}></div>
</div>

<style lang="postcss">
	.progress-container {
		@apply w-full h-1 overflow-hidden rounded-sm;
	}

	.progress-bar {
		@apply h-full transition-all duration-300 ease-in-out bg-blue-500;
	}
</style>
