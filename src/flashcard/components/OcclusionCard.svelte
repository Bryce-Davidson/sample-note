<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from "svelte";
	import { TFile } from "obsidian";
	import type SampleNotePlugin from "../../main";
	import type { Flashcard, CardState, OcclusionShape } from "../../types";
	import Konva from "konva";

	export let plugin: SampleNotePlugin;
	export let flashcard: Flashcard;
	export let cardState: CardState;

	const dispatch = createEventDispatcher<{
		error: { message: string };
	}>();

	let stageContainer: HTMLDivElement;
	let stage: Konva.Stage | null = null;
	let resizeObserver: ResizeObserver | null = null;

	async function renderOcclusionCard(): Promise<void> {
		if (!stageContainer) return;

		try {
			let imagePath = flashcard.filePath;

			if (!imagePath || !imagePath.match(/\.(png|jpe?g|gif)$/i)) {
				const imageMatch = flashcard.content.match(/!\[\[(.*?)\]\]/);
				if (imageMatch) {
					imagePath = imageMatch[1];
				}
			}

			if (!imagePath) {
				throw new Error("No image path found for occlusion card");
			}

			const imageFile =
				plugin.app.vault.getAbstractFileByPath(imagePath) ||
				plugin.app.metadataCache.getFirstLinkpathDest(
					imagePath,
					flashcard.filePath || "",
				);

			if (!imageFile || !(imageFile instanceof TFile)) {
				throw new Error(`Image file not found: ${imagePath}`);
			}

			const imageData = await plugin.app.vault.readBinary(
				imageFile as TFile,
			);
			const blob = new Blob([imageData]);
			const url = URL.createObjectURL(blob);

			const img = new Image();

			return new Promise<void>((resolve, reject) => {
				img.onload = () => {
					try {
						const containerWidth = stageContainer.clientWidth;

						const aspectRatio =
							img.naturalHeight / img.naturalWidth;
						const containerHeight = containerWidth * aspectRatio;

						stageContainer.addClass("sample-note-occlusion-stage");
						stageContainer.style.setProperty(
							"--occlusion-height",
							`${containerHeight}px`,
						);

						stage = new Konva.Stage({
							container: stageContainer,
							width: containerWidth,
							height: containerHeight,
						});

						const imageLayer = new Konva.Layer();
						const shapeLayer = new Konva.Layer();

						const kImage = new Konva.Image({
							image: img,
							width: containerWidth,
							height: containerHeight,
						});
						imageLayer.add(kImage);

						const { mode, shapeIds } = cardState.occlusionData!;

						if (!mode || !shapeIds) {
							throw new Error(
								"Invalid occlusion data in card state",
							);
						}

						const scaleX = containerWidth / img.naturalWidth;
						const scaleY = containerHeight / img.naturalHeight;

						let allOcclusions: OcclusionShape[] = [];
						if (
							flashcard.filePath &&
							plugin.notes[flashcard.filePath]?.data?.occlusion
						) {
							allOcclusions =
								plugin.notes[flashcard.filePath].data
									.occlusion ?? [];
						}

						if (allOcclusions.length === 0) {
							throw new Error(
								"No occlusion shapes found for this image",
							);
						}

						const cardStateShapeIds = new Set(shapeIds || []);

						if (mode === "HideAll") {
							allOcclusions.forEach((shape) => {
								const isInCardState =
									shape.id !== undefined &&
									cardStateShapeIds.has(shape.id);

								const rect = new Konva.Rect({
									x: shape.x * scaleX,
									y: shape.y * scaleY,
									width: shape.width * scaleX,
									height: shape.height * scaleY,
									fill:
										shape.fill ||
										plugin.settings.hiddenColor ||
										"#272c36",
									opacity: 1.0,
									cornerRadius: 2,
									perfectDrawEnabled: false,
								});

								if (isInCardState) {
									rect.on("click tap", (e) => {
										e.cancelBubble = true;
										if (!rect.visible()) return;
										rect.visible(false);
										shapeLayer.draw();
									});
								}

								shapeLayer.add(rect);
							});
						} else if (mode === "HideOne") {
							const shapesToRender = allOcclusions.filter(
								(shape) =>
									shape.id && cardStateShapeIds.has(shape.id),
							);

							if (shapesToRender.length === 0) {
								throw new Error(
									"No matching occlusion shapes found for this card",
								);
							}

							shapesToRender.forEach((shape) => {
								const rect = new Konva.Rect({
									x: shape.x * scaleX,
									y: shape.y * scaleY,
									width: shape.width * scaleX,
									height: shape.height * scaleY,
									fill:
										shape.fill ||
										plugin.settings.hiddenColor ||
										"#272c36",
									opacity: 1.0,
									cornerRadius: 2,
									perfectDrawEnabled: false,
								});

								rect.on("click tap", (e) => {
									e.cancelBubble = true;
									if (!rect.visible()) return;
									rect.visible(false);
									shapeLayer.draw();
								});

								shapeLayer.add(rect);
							});
						}

						stage.add(imageLayer);
						stage.add(shapeLayer);

						stage.draw();

						setupResizeObserver(
							img,
							containerWidth,
							containerHeight,
							imageLayer,
							shapeLayer,
							kImage,
						);

						URL.revokeObjectURL(url);
						resolve();
					} catch (renderError) {
						URL.revokeObjectURL(url);
						reject(renderError);
					}
				};

				img.onerror = (error) => {
					URL.revokeObjectURL(url);
					reject(
						new Error(
							`Failed to load image: ${error.toString() || "Unknown error"}`,
						),
					);
				};

				img.src = url;
			});
		} catch (error) {
			console.error("Error rendering occlusion card:", error);
			throw new Error(
				`Error loading image: ${error.message || "Unknown error"}`,
			);
		}
	}

	function setupResizeObserver(
		img: HTMLImageElement,
		originalWidth: number,
		originalHeight: number,
		imageLayer: Konva.Layer,
		shapeLayer: Konva.Layer,
		kImage: Konva.Image,
	) {
		if (resizeObserver) {
			resizeObserver.disconnect();
		}

		const aspectRatio = img.naturalHeight / img.naturalWidth;

		resizeObserver = new ResizeObserver(() => {
			try {
				if (!stage || !stageContainer) return;

				const newWidth = stageContainer.clientWidth;
				const newHeight = newWidth * aspectRatio;

				stage.width(newWidth);
				stage.height(newHeight);

				stageContainer.style.setProperty(
					"--occlusion-height",
					`${newHeight}px`,
				);

				kImage.width(newWidth);
				kImage.height(newHeight);

				const scaleFactorX = newWidth / originalWidth;
				const scaleFactorY = newHeight / originalHeight;

				const shapes = shapeLayer.getChildren();
				shapes.forEach((shape: Konva.Node) => {
					if (shape instanceof Konva.Rect) {
						shape.x(shape.x() * scaleFactorX);
						shape.y(shape.y() * scaleFactorY);
						shape.width(shape.width() * scaleFactorX);
						shape.height(shape.height() * scaleFactorY);
					}
				});

				imageLayer.draw();
				shapeLayer.draw();
			} catch (resizeError) {
				console.error("Error resizing occlusion card:", resizeError);
			}
		});

		resizeObserver.observe(stageContainer);
	}

	function toggleAllOcclusions() {
		if (!stage) return;

		const shapeLayer = stage.getLayers()[1];
		if (!shapeLayer) return;

		const shapes = shapeLayer.getChildren();
		let anyOcclusionHidden = false;

		shapes.forEach((node: Konva.Node) => {
			if (node instanceof Konva.Rect && !node.visible()) {
				anyOcclusionHidden = true;
			}
		});

		if (anyOcclusionHidden) {
			shapes.forEach((node: Konva.Node) => {
				if (node instanceof Konva.Rect) {
					node.visible(true);
				}
			});
		} else {
			shapes.forEach((node: Konva.Node) => {
				if (node instanceof Konva.Rect) {
					node.visible(false);
				}
			});
		}

		shapeLayer.draw();
	}

	onMount(async () => {
		try {
			await renderOcclusionCard();
		} catch (error) {
			dispatch("error", {
				message: error.message || "Failed to render occlusion card",
			});
		}
	});

	onDestroy(() => {
		if (resizeObserver) {
			resizeObserver.disconnect();
			resizeObserver = null;
		}
		if (stage) {
			stage.destroy();
			stage = null;
		}
	});
</script>

<div class="occlusion-card">
	<div class="stage-container" bind:this={stageContainer}>
		<!-- Konva stage will be mounted here -->
	</div>

	<div class="controls">
		<button class="toggle-button" on:click={toggleAllOcclusions}>
			Toggle All
		</button>
	</div>
</div>

<style lang="postcss">
	.occlusion-card {
		@apply flex flex-col items-center w-full;
	}

	.stage-container {
		@apply relative w-full overflow-hidden shadow-lg;
	}

	.controls {
		@apply flex gap-2 mt-4;
	}

	.toggle-button {
		@apply px-4 py-2 font-medium text-white transition-all duration-200 bg-blue-500 border-none cursor-pointer hover:bg-blue-600 hover:-translate-y-px hover:shadow-md active:translate-y-0 dark:bg-indigo-500 dark:hover:bg-indigo-600;
	}
</style>
