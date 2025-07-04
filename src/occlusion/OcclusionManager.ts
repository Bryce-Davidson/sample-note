import { App } from "obsidian";
import Konva from "konva";
import type { OcclusionShape } from "../types";
import type SampleNotePlugin from "../main";
import { SvelteOcclusionEditorView } from "./OcclusionEditorView";

export class OcclusionManager {
	private app: App;
	private plugin: SampleNotePlugin;

	constructor(app: App, plugin: SampleNotePlugin) {
		this.app = app;
		this.plugin = plugin;
	}

	public processOcclusionImage(element: HTMLElement): void {
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (
						entry.isIntersecting &&
						entry.target instanceof HTMLImageElement
					) {
						const img = entry.target;
						if (img.getAttribute("data-occlusion-processed"))
							return;

						const alt = img.getAttribute("alt");
						if (!alt) return;

						const filePath = this.findFilePathByAltText(alt);
						if (!filePath) return;

						this.addImageOcclusionHandlers(img, filePath);

						if (this.plugin.notes[filePath]?.data.occlusion) {
							this.replaceImageWithKonva(img, filePath);
						}
						img.setAttribute("data-occlusion-processed", "true");

						observer.unobserve(img);
					}
				});
			},
			{
				root: null,
				rootMargin: "50px",
				threshold: 0.1,
			}
		);

		requestAnimationFrame(() => {
			const allImages = element.querySelectorAll("img");
			allImages.forEach((img) => {
				if (!img.getAttribute("data-occlusion-processed")) {
					observer.observe(img);
				}
			});
		});

		const mutationObserver = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				mutation.addedNodes.forEach((node) => {
					if (node instanceof HTMLElement) {
						const newImages = node.querySelectorAll("img");
						newImages.forEach((img) => {
							if (!img.getAttribute("data-occlusion-processed")) {
								observer.observe(img);
							}
						});
					}
				});
			});
		});

		mutationObserver.observe(element, {
			childList: true,
			subtree: true,
		});
	}

	private findFilePathByAltText(altText: string): string | undefined {
		const files = this.app.vault.getFiles();
		const file = files.find(
			(f) => f.name === altText || f.path.endsWith(altText)
		);
		return file?.path;
	}

	private addImageOcclusionHandlers(
		imgElement: HTMLImageElement,
		key: string
	): void {
		imgElement.addEventListener("dblclick", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.openOcclusionEditorWithFile(key);
		});

		let lastTap = 0;
		imgElement.addEventListener("touchend", (e) => {
			const currentTime = new Date().getTime();
			const tapLength = currentTime - lastTap;
			if (tapLength < 500 && tapLength > 0) {
				e.preventDefault();
				e.stopPropagation();
				this.openOcclusionEditorWithFile(key);
			}
			lastTap = currentTime;
		});
	}

	private replaceImageWithKonva(
		imgElement: HTMLImageElement,
		key: string
	): void {
		const container = document.createElement("div");
		container.classList.add("occluded-image-container");
		container.classList.add("occlusion-interaction-disabled");
		const displayedWidth = imgElement.width || imgElement.clientWidth;
		const displayedHeight = imgElement.height || imgElement.clientHeight;
		container.style.setProperty("--occlusion-width", `${displayedWidth}px`);
		container.style.setProperty(
			"--occlusion-height",
			`${displayedHeight}px`
		);
		container.setAttribute("data-file-path", key);
		container.setAttribute("data-original-src", imgElement.src);
		container.setAttribute("data-width", displayedWidth.toString());
		container.setAttribute("data-height", displayedHeight.toString());

		if (!this.plugin.settings.allHidden) {
			const img = document.createElement("img");
			img.src = imgElement.src;
			img.width = displayedWidth;
			img.height = displayedHeight;
			img.classList.add("occlusion-full-size-img");
			container.appendChild(img);

			this.addImageOcclusionHandlers(img, key);

			imgElement.parentElement?.replaceChild(container, imgElement);
			return;
		}

		this.createKonvaStageInContainer(
			container,
			imgElement.src,
			key,
			displayedWidth,
			displayedHeight
		);
		imgElement.parentElement?.replaceChild(container, imgElement);
	}

	private createKonvaStageInContainer(
		container: HTMLElement,
		imageSrc: string,
		filePath: string,
		width: number,
		height: number
	): void {
		while (container.firstChild) {
			container.removeChild(container.firstChild);
		}

		const img = new Image();

		const stageContainer = document.createElement("div");
		stageContainer.classList.add("occlusion-stage-container");
		container.appendChild(stageContainer);

		img.onload = () => {
			const originalWidth = img.naturalWidth;
			const originalHeight = img.naturalHeight;

			const stage = new Konva.Stage({
				container: stageContainer,
				width: width,
				height: height,
			});

			let occlusionInteractionEnabled = false;

			const imageLayer = new Konva.Layer();
			const shapeLayer = new Konva.Layer();
			stage.add(imageLayer);
			stage.add(shapeLayer);

			const kImage = new Konva.Image({
				image: img,
				x: 0,
				y: 0,
				width: width,
				height: height,
			});
			imageLayer.add(kImage).draw();

			const scaleX = width / originalWidth;
			const scaleY = height / originalHeight;

			const shapes = this.plugin.notes[filePath]?.data.occlusion || [];
			if (shapes && shapes.length > 0) {
				shapes.forEach((s: OcclusionShape) => {
					const rect = new Konva.Rect({
						x: s.x * scaleX,
						y: s.y * scaleY,
						width: s.width * scaleX,
						height: s.height * scaleY,
						fill: s.fill,
						opacity: s.opacity,
						perfectDrawEnabled: false,
						listening: false,
					});

					const toggleHandler = function (
						e: Konva.KonvaEventObject<MouseEvent | TouchEvent>
					) {
						if (occlusionInteractionEnabled) {
							rect.visible(!rect.visible());
							shapeLayer.draw();
							e.cancelBubble = true;
						}
					};

					rect.setAttr("customData", {
						toggleHandler: toggleHandler,
					});

					shapeLayer.add(rect);
				});
				shapeLayer.draw();
			}

			stage.on("dblclick", () => {
				this.openOcclusionEditorWithFile(filePath);
			});

			stage.on("dbltap", () => {
				this.openOcclusionEditorWithFile(filePath);
			});

			stage.on("contentTouchstart", function (e) {
				if (occlusionInteractionEnabled) {
					if (e.target !== stage) {
						e.evt.preventDefault();
					}
				} else {
					e.cancelBubble = false;
				}
			});

			stage.on("contentTouchmove", function (e) {
				if (!occlusionInteractionEnabled) {
					e.cancelBubble = false;
				}
			});

			stage.on("contentTouchend", function (e) {
				if (!occlusionInteractionEnabled) {
					e.cancelBubble = false;
				}
			});

			const disableShapeInteraction = () => {
				shapeLayer.children.forEach((shape) => {
					if (shape instanceof Konva.Shape) {
						shape.listening(false);
						shape.off("click tap");
					}
				});

				stage.listening(false);

				shapeLayer.draw();
			};

			const enableShapeInteraction = () => {
				shapeLayer.children.forEach((shape) => {
					if (shape instanceof Konva.Shape) {
						shape.listening(true);
						const customData = shape.getAttr("customData");
						if (customData && customData.toggleHandler) {
							shape.on("click tap", customData.toggleHandler);
						}
					}
				});

				stage.listening(true);

				shapeLayer.draw();
			};

			const resetShapesVisibility = () => {
				shapeLayer.children.forEach((shape) => {
					if (shape instanceof Konva.Shape) {
						shape.visible(true);
					}
				});
				shapeLayer.draw();
			};

			const toggleButton = this.createOcclusionToggleButton(container);

			const handleToggleClick = (e: Event) => {
				e.stopPropagation();
				e.preventDefault();

				occlusionInteractionEnabled = !occlusionInteractionEnabled;

				if (occlusionInteractionEnabled) {
					enableShapeInteraction();
					while (toggleButton.firstChild) {
						toggleButton.removeChild(toggleButton.firstChild);
					}
					container.classList.remove(
						"occlusion-interaction-disabled"
					);
					container.classList.add("occlusion-interaction-enabled");
				} else {
					resetShapesVisibility();
					disableShapeInteraction();
					while (toggleButton.firstChild) {
						toggleButton.removeChild(toggleButton.firstChild);
					}
					container.classList.remove("occlusion-interaction-enabled");
					container.classList.add("occlusion-interaction-disabled");
				}
			};

			toggleButton.addEventListener("click", handleToggleClick);
			toggleButton.addEventListener("touchend", handleToggleClick, {
				passive: false,
			});

			disableShapeInteraction();
		};

		img.src = imageSrc;
	}

	private createOcclusionToggleButton(
		container: HTMLElement
	): HTMLButtonElement {
		const toggleButton = document.createElement("button");
		toggleButton.className = "occlusion-toggle-button";
		while (toggleButton.firstChild) {
			toggleButton.removeChild(toggleButton.firstChild);
		}
		container.appendChild(toggleButton);
		return toggleButton;
	}

	public async openOcclusionEditorWithFile(filePath: string): Promise<void> {
		await this.plugin.activateView("occlusion-editor", true);
		const occlusionLeaf =
			this.app.workspace.getLeavesOfType("occlusion-editor")[0];
		if (
			occlusionLeaf &&
			occlusionLeaf.view instanceof SvelteOcclusionEditorView
		) {
			const occlusionView =
				occlusionLeaf.view as SvelteOcclusionEditorView;
			occlusionView.setSelectedFile(filePath);
		}
	}

	public refreshOcclusionElements(): void {
		const containers = document.querySelectorAll(
			".occluded-image-container"
		);

		containers.forEach((container) => {
			if (!(container instanceof HTMLElement)) return;

			const filePath = container.getAttribute("data-file-path");
			const originalSrc = container.getAttribute("data-original-src");
			const widthStr = container.getAttribute("data-width");
			const heightStr = container.getAttribute("data-height");

			if (!filePath || !originalSrc || !widthStr || !heightStr) return;

			const width = parseInt(widthStr);
			const height = parseInt(heightStr);

			if (this.plugin.settings.allHidden) {
				this.createKonvaStageInContainer(
					container,
					originalSrc,
					filePath,
					width,
					height
				);
			} else {
				while (container.firstChild) {
					container.removeChild(container.firstChild);
				}
				const img = document.createElement("img");
				img.src = originalSrc;
				img.width = width;
				img.height = height;
				img.classList.add("occlusion-full-size-img");
				container.appendChild(img);
				this.addImageOcclusionHandlers(img, filePath);
			}
		});
	}
}
