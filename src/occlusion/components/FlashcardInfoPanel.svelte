<script lang="ts">
	import type { CardState } from "../../types";

	export let selectedOcclusioncards: CardState[] = [];
	export let selectedRect: any = null;
	export let onReviewFlashcard: (cardUUID: string) => void;
	export let onDeleteFlashcard: (cardUUID: string) => void;

	let flashcardPanelHeight = 120;
	let resizeHandleEl: HTMLElement;
	let cleanupResize: (() => void) | null = null;

	interface CardStatusStyles {
		liClass: string;
		dotClass: string;
		textClass: string;
		statsTextClass: string;
	}

	function getCardStatusStyles(
		nextReviewDateStr: string | null | undefined,
	): CardStatusStyles {
		const baseLiClasses =
			"flex items-center justify-between p-1.5 text-xs rounded bg-gray-100 dark:bg-gray-700";

		let styles: CardStatusStyles = {
			liClass: baseLiClasses,
			dotClass: "bg-gray-400 dark:bg-gray-500",
			textClass: "text-gray-800 dark:text-gray-200",
			statsTextClass: "text-gray-500 dark:text-gray-400",
		};

		if (!nextReviewDateStr) {
			return styles;
		}

		const nextReviewDate = new Date(nextReviewDateStr);
		const now = new Date();

		const twoDaysFromNow = new Date(now);
		twoDaysFromNow.setDate(now.getDate() + 2);
		twoDaysFromNow.setHours(23, 59, 59, 999);

		const sevenDaysFromNow = new Date(now);
		sevenDaysFromNow.setDate(now.getDate() + 7);
		sevenDaysFromNow.setHours(23, 59, 59, 999);

		if (nextReviewDate <= now) {
			styles.dotClass = "bg-red-500 dark:bg-red-500";
			styles.textClass = "text-red-700 dark:text-red-300";
		} else if (nextReviewDate <= twoDaysFromNow) {
			styles.dotClass = "bg-orange-500 dark:bg-orange-400";
			styles.textClass = "text-orange-700 dark:text-orange-300";
		} else if (nextReviewDate <= sevenDaysFromNow) {
			styles.dotClass = "bg-yellow-500 dark:bg-yellow-400";
			styles.textClass = "text-yellow-700 dark:text-yellow-300";
		} else {
			styles.dotClass = "bg-green-500 dark:bg-green-400";
			styles.textClass = "text-green-700 dark:text-green-300";
		}

		return styles;
	}

	function getDotTitle(nextReviewDateStr: string | null | undefined): string {
		if (!nextReviewDateStr) return "Status unknown";

		const nextReviewDate = new Date(nextReviewDateStr);
		const now = new Date();

		const twoDaysFromNow = new Date(now);
		twoDaysFromNow.setDate(now.getDate() + 2);
		twoDaysFromNow.setHours(23, 59, 59, 999);

		const sevenDaysFromNow = new Date(now);
		sevenDaysFromNow.setDate(now.getDate() + 7);
		sevenDaysFromNow.setHours(23, 59, 59, 999);

		if (nextReviewDate <= now) {
			return "Overdue";
		} else if (nextReviewDate <= twoDaysFromNow) {
			return "Due Soon";
		} else if (nextReviewDate <= sevenDaysFromNow) {
			return "Due Later";
		} else {
			return "Good Standing";
		}
	}

	function setupResizeHandler() {
		if (!resizeHandleEl) return null;

		let startY = 0;
		let startHeight = 0;
		let isDragging = false;

		const handleMouseDown = (e: MouseEvent) => {
			startY = e.clientY;
			startHeight = flashcardPanelHeight;
			isDragging = true;
			e.preventDefault();

			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);
		};

		const handleMouseMove = (e: MouseEvent) => {
			if (!isDragging) return;

			const dy = startY - e.clientY;
			flashcardPanelHeight = Math.max(
				60,
				Math.min(400, startHeight + dy),
			);
		};

		const handleMouseUp = () => {
			isDragging = false;

			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};

		const handleTouchStart = (e: TouchEvent) => {
			if (e.touches.length !== 1) return;

			startY = e.touches[0].clientY;
			startHeight = flashcardPanelHeight;
			isDragging = true;
			e.preventDefault();
		};

		const handleTouchMove = (e: TouchEvent) => {
			if (!isDragging || e.touches.length !== 1) return;

			const dy = startY - e.touches[0].clientY;
			flashcardPanelHeight = Math.max(
				60,
				Math.min(400, startHeight + dy),
			);
			e.preventDefault();
		};

		const handleTouchEnd = () => {
			isDragging = false;
		};

		resizeHandleEl.addEventListener("mousedown", handleMouseDown);
		resizeHandleEl.addEventListener("touchstart", handleTouchStart, {
			passive: false,
		});
		resizeHandleEl.addEventListener("touchmove", handleTouchMove, {
			passive: false,
		});
		resizeHandleEl.addEventListener("touchend", handleTouchEnd);

		return () => {
			if (!resizeHandleEl) return;

			resizeHandleEl.removeEventListener("mousedown", handleMouseDown);
			resizeHandleEl.removeEventListener("touchstart", handleTouchStart);
			resizeHandleEl.removeEventListener("touchmove", handleTouchMove);
			resizeHandleEl.removeEventListener("touchend", handleTouchEnd);
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};
	}

	cleanupResize = setupResizeHandler();
</script>

<div class="absolute bottom-0 left-0 right-0 z-10 shadow-lg">
	<div
		class="flex items-center justify-center w-full h-4 transition-colors duration-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-t-md resize-handle cursor-ns-resize"
		bind:this={resizeHandleEl}
		aria-label="Resize flashcard panel"
	>
		<div class="w-16 h-1 bg-gray-400 rounded-full dark:bg-gray-500"></div>
	</div>

	<!-- Flashcard Info Panel -->
	<div
		class="overflow-auto bg-white border-t border-gray-200 dark:bg-gray-800 dark:border-gray-700 flashcard-info-panel"
		style="height: {flashcardPanelHeight}px;"
	>
		<div class="h-full p-3">
			<div class="content-container">
				{#if selectedOcclusioncards.length > 0}
					<ul class="space-y-1.5 flashcard-list overflow-y-auto pr-1">
						{#each selectedOcclusioncards as card}
							{@const statusStyles = getCardStatusStyles(
								card.nextReviewDate,
							)}
							<li class={statusStyles.liClass}>
								<div class="flex-1 min-w-0 mr-2">
									<div class="flex items-center">
										<span
											class="font-medium {statusStyles.textClass} truncate mr-1.5"
											title={card.cardTitle}
											>{card.cardTitle}</span
										>
										<span
											class="flex-shrink-0 w-2 h-2 {statusStyles.dotClass} rounded-full"
											title={getDotTitle(
												card.nextReviewDate,
											)}
										></span>
									</div>

									<!-- Compact stats row -->
									<div
										class="flex text-2xs {statusStyles.statsTextClass} mt-0.5"
									>
										<span
											class="mr-2"
											title="Created on {new Date(
												card.createdAt,
											).toLocaleDateString()}"
										>
											<span class="opacity-70"
												>Created:</span
											>
											<span class="">
												{new Date(
													card.createdAt,
												).toLocaleDateString("en-US", {
													month: "short",
													day: "numeric",
													year: "numeric",
												})}
											</span>
										</span>
										<span
											class="mr-2"
											title="Next review on {card.nextReviewDate}"
										>
											<span class="opacity-70">Due:</span>
											<span
												class={statusStyles.textClass}
											>
												{new Date(
													card.nextReviewDate,
												).toLocaleDateString("en-US", {
													month: "short",
													day: "numeric",
												})}
											</span>
										</span>
										<span
											title="{card.efHistory?.length ||
												0} reviews completed"
										>
											<span class="opacity-70"
												>Reviews:</span
											>
											<span class=""
												>{card.efHistory?.length ||
													0}</span
											>
										</span>
									</div>
								</div>

								<!-- Action buttons in a compact row -->
								<div class="flex items-center space-x-2">
									<button
										class="!flex !items-center !justify-center !rounded !bg-indigo-600 !text-white dark:!bg-indigo-500 !p-1 !w-7 !h-7"
										on:click={() =>
											onReviewFlashcard(card.cardUUID)}
										title="Review flashcard"
										data-plugin="sample-note"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="!w-3.5 !h-3.5"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
										>
											<path
												d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
											></path>
											<circle cx="12" cy="12" r="3"
											></circle>
										</svg>
									</button>
									<button
										class="!p-1 !rounded-lg !flex !items-center !justify-center !text-red-500 dark:!text-red-400 !border !border-transparent !shadow-none !bg-transparent"
										on:click={() =>
											onDeleteFlashcard(card.cardUUID)}
										title="Delete flashcard"
										data-plugin="sample-note"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="!w-3.5 !h-3.5"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
										>
											<polyline points="3 6 5 6 21 6"
											></polyline>
											<path
												d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
											></path>
										</svg>
									</button>
								</div>
							</li>
						{/each}
					</ul>
				{:else if selectedRect}
					<div class="flex items-center h-full">
						<p class="text-sm text-gray-600 dark:text-gray-400">
							This occlusion is not used in any flashcards.
						</p>
					</div>
				{:else}
					<div class="flex items-center h-full">
						<p class="text-sm text-gray-600 dark:text-gray-400">
							No occlusion selected.
						</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
