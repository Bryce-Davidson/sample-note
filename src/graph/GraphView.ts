import "../main.css";

import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import * as d3 from "d3";
import MyPlugin from "../main";
import { createShadowRoot } from "../vite";

export const VIEW_TYPE_GRAPH = "graph-view";

const ratingMap = new Map<number, string>([
	[1, "#D73027"],
	[2, "#FC8D59"],
	[3, "#FEE08B"],
	[4, "#91CF60"],
	[5, "#1A9850"],
]);

function getRatingColor(rating: number): string {
	return ratingMap.get(rating) || "#000000";
}

interface Node extends d3.SimulationNodeDatum {
	id: string;
	fileName?: string;
	path?: string;
	radius: number;
	color: string;
	type: "note" | "card";
	parent?: string;
	offsetX?: number;
	offsetY?: number;
	rating?: number;
	ratingHistory?: { rating: number; timestamp: number }[];
	createdAt?: number;
}

interface Link extends d3.SimulationLinkDatum<Node> {
	source: string | Node;
	target: string | Node;
	value: number;
}

export class GraphView extends ItemView {
	private svg!: d3.Selection<SVGSVGElement, unknown, null, undefined>;
	private container!: d3.Selection<SVGGElement, unknown, null, undefined>;
	private textLayer!: d3.Selection<SVGGElement, unknown, null, undefined>;
	private nodeLayer!: d3.Selection<SVGGElement, unknown, null, undefined>;
	private simulation!: d3.Simulation<Node, Link>;
	private noteNodes: Node[] = [];
	private cardNodes: Node[] = [];
	private links: Link[] = [];
	private zoom!: d3.ZoomBehavior<SVGSVGElement, unknown>;
	private plugin: MyPlugin;
	private colorScale = d3.scaleOrdinal(d3.schemeCategory10);
	private edgeLength: number = 100;
	private chargeStrength: number = -100;
	private cardOffsetDistance: number = 16;
	private cardRadius: number = 5;
	private noteTextColor: string = "#ffffff";
	private shadowRoot: ShadowRoot | null = null;

	private timelineEvents: number[] = [];
	private currentEventIndex: number = 0;
	private animationTimer: d3.Timer | null = null;
	private isPlaying: boolean = false;
	private eventDuration: number = 100;
	private groupingInterval: number = 0;

	constructor(leaf: WorkspaceLeaf, plugin: MyPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return VIEW_TYPE_GRAPH;
	}

	getIcon(): string {
		return "dot-network";
	}

	getDisplayText() {
		return "Graph View";
	}

	async onOpen() {
		this.containerEl.empty();
		this.containerEl.addClass("relative");

		this.shadowRoot = createShadowRoot(this.containerEl);

		const componentContainer = document.createElement("div");
		componentContainer.style.width = "100%";
		componentContainer.style.height = "100%";
		componentContainer.style.display = "flex";
		componentContainer.style.flexDirection = "column";
		componentContainer.style.position = "absolute";
		componentContainer.style.left = "0";
		componentContainer.style.top = "0";
		componentContainer.style.right = "0";
		componentContainer.style.bottom = "0";
		componentContainer.style.overflow = "hidden";

		this.shadowRoot.appendChild(componentContainer);

		this.initControls(componentContainer);
		this.initSvg(componentContainer);
		await this.loadGraphData();

		this.goToEnd();

		this.renderGraph();
		this.registerEvents();

		setTimeout(() => {
			window.dispatchEvent(new Event("resize"));
		}, 100);
	}

	private initControls(container: HTMLElement) {
		const controlBox = document.createElement("div");
		controlBox.className =
			"fixed z-50 w-64 p-3 border border-gray-700 rounded-lg shadow-lg bg-gray-900/90 backdrop-blur-sm top-4 right-4";
		container.appendChild(controlBox);

		controlBox.innerHTML = `
		<div class="space-y-3">
		  <div class="flex justify-end">
			<button id="toggleMinimize" class="text-gray-400">
			  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
			  </svg>
			</button>
		  </div>

		  <!-- Controls content -->
		  <div id="controlsContent" class="space-y-3">
			<!-- Force Controls Section - Compact -->
			<div class="bg-gray-800/50 p-2 rounded-md">
			  <div class="flex flex-col space-y-2">
				<div class="space-y-1">
				  <div class="flex justify-between items-center">
					<span class="text-xs text-indigo-300">Edge</span>
				  </div>
				  <input type="range" id="edgeLengthInput" min="50" max="300" value="${
						this.edgeLength
					}"
						class="w-full h-1 rounded-full appearance-none bg-gray-700 cursor-pointer accent-indigo-500" style="width: 100%;">
				</div>

				<div class="space-y-1">
				  <div class="flex justify-between items-center">
					<span class="text-xs text-indigo-300">Charge</span>
				  </div>
				  <input type="range" id="chargeForceInput" min="-300" max="0" value="${
						this.chargeStrength
					}"
						class="w-full h-1 rounded-full appearance-none bg-gray-700 cursor-pointer accent-indigo-500" style="width: 100%;">
				</div>

				<div class="space-y-1">
				  <div class="flex justify-between items-center">
					<span class="text-xs text-indigo-300">Card Offset Distance</span>
				  </div>
				  <input type="range" id="cardOffsetDistanceInput" min="10" max="50" value="${
						this.cardOffsetDistance
					}"
						class="w-full h-1 rounded-full appearance-none bg-gray-700 cursor-pointer accent-indigo-500" style="width: 100%;">
				</div>

				<div class="space-y-1">
				  <div class="flex justify-between items-center">
					<span class="text-xs text-indigo-300">Card Size</span>
				  </div>
				  <input type="range" id="cardRadiusInput" min="2" max="10" value="${
						this.cardRadius
					}"
						class="w-full h-1 rounded-full appearance-none bg-gray-700 cursor-pointer accent-indigo-500" style="width: 100%;">
				</div>

				<div class="space-y-1">
				  <div class="flex justify-between items-center">
					<span class="text-xs text-indigo-300">Text Color</span>
					<input type="color" id="noteTextColorInput" value="${this.noteTextColor}"
						class="w-6 h-6 rounded cursor-pointer border border-gray-600">
				  </div>
				</div>
			  </div>
			</div>

			<!-- Timeline Section - Compact -->
			<div class="bg-gray-800/50 p-2 rounded-md">
			  <div class="space-y-2">
				<!-- Progress bar -->
				<div class="relative">
				  <div id="progressBarContainer" class="overflow-hidden h-3 flex rounded-full bg-gray-700 cursor-pointer">
					<div id="efProgressBar" class="transition-all ease-out duration-300 shadow-none flex flex-col justify-center rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" style="width: 0%"></div>
				  </div>
				</div>

				<div class="flex justify-between items-center text-xs">
				  <span class="text-gray-400 font-mono" id="timeStart">Start</span>
				  <span id="timelineLabel" class="text-indigo-300 font-mono">0 / 0</span>
				  <span class="text-gray-400 font-mono" id="timeEnd">End</span>
				</div>

				<div class="grid grid-cols-3 gap-1">
				  <button id="prevEvent" class="text-xs rounded px-2 py-1 bg-indigo-900/50 text-indigo-300 border border-indigo-800">Prev</button>
				  <button id="playPause" class="text-xs rounded px-2 py-1 bg-indigo-600 text-white border border-indigo-700">Play</button>
				  <button id="nextEvent" class="text-xs rounded px-2 py-1 bg-indigo-900/50 text-indigo-300 border border-indigo-800">Next</button>
				</div>
			  </div>
			</div>

			<!-- Advanced Settings Section - Compact -->
			<div class="bg-gray-800/50 p-2 rounded-md">
			  <div class="flex flex-col space-y-3">
				<div>
				  <span class="text-xs text-indigo-300 block mb-1">Speed</span>
				  <input type="range" id="eventDurationInput" min="50" max="1000" value="${
						1050 - this.eventDuration
					}"
						class="w-full h-1 rounded-full appearance-none bg-gray-700 cursor-pointer accent-indigo-500" style="width: 100%;">
				  <div class="flex justify-between text-xs text-gray-400 mt-1">
					<span>Slow</span>
					<span>Fast</span>
				  </div>
				</div>

				<div>
				  <span class="text-xs text-indigo-300 block mb-1">Group Events By</span>
				  <select id="groupingPreset" class="w-full bg-gray-700 border border-gray-600 text-xs rounded px-1.5 py-1 text-white">
					<option value="0">None</option>
					<option value="3600000">Hour</option>
					<option value="86400000">Day</option>
					<option value="604800000">Week</option>
					<option value="2592000000">Month</option>
				  </select>
				</div>
			  </div>
			</div>

			<!-- Rating Legend - Compact -->
			<div class="bg-gray-800/50 p-2 rounded-md">
			  <div class="grid grid-cols-5 gap-1 text-center">
				<div class="flex flex-col items-center">
				  <div class="w-3 h-3 rounded-full" style="background-color: #D73027"></div>
				  <span class="text-xs text-gray-300">1</span>
				</div>
				<div class="flex flex-col items-center">
				  <div class="w-3 h-3 rounded-full" style="background-color: #FC8D59"></div>
				  <span class="text-xs text-gray-300">2</span>
				</div>
				<div class="flex flex-col items-center">
				  <div class="w-3 h-3 rounded-full" style="background-color: #FEE08B"></div>
				  <span class="text-xs text-gray-300">3</span>
				</div>
				<div class="flex flex-col items-center">
				  <div class="w-3 h-3 rounded-full" style="background-color: #91CF60"></div>
				  <span class="text-xs text-gray-300">4</span>
				</div>
				<div class="flex flex-col items-center">
				  <div class="w-3 h-3 rounded-full" style="background-color: #1A9850"></div>
				  <span class="text-xs text-gray-300">5</span>
				</div>
			  </div>
			</div>
		  </div>
		</div>
		`;

		this.setupControlListeners(controlBox);
		this.setupTimelineControls(controlBox);
		this.setupMinimizeControl(controlBox);
	}

	private setupMinimizeControl(controlBox: HTMLDivElement) {
		const toggleButton =
			controlBox.querySelector<HTMLButtonElement>("#toggleMinimize");
		const controlsContent =
			controlBox.querySelector<HTMLDivElement>("#controlsContent");
		const svg = toggleButton?.querySelector("svg");

		if (toggleButton && controlsContent && svg) {
			let isMinimized = false;

			toggleButton.addEventListener("click", () => {
				isMinimized = !isMinimized;

				controlsContent.style.display = isMinimized ? "none" : "block";

				if (isMinimized) {
					controlBox.style.width = "auto";
					controlBox.style.padding = "0.5rem";
					svg.style.transform = "rotate(180deg)";
				} else {
					controlBox.style.width = "16rem";
					controlBox.style.padding = "0.75rem";
					svg.style.transform = "rotate(0deg)";
				}
			});
		}
	}

	private initSvg(container: HTMLElement) {
		this.svg = d3
			.select(container)
			.append("svg")
			.attr("width", "100%")
			.attr("height", "100%")
			.classed("w-full h-full", true);

		this.zoom = d3
			.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.1, 8])
			.on("zoom", (event) => {
				this.container.attr("transform", event.transform.toString());
			});

		this.svg.call(this.zoom);
		this.container = this.svg.append("g").classed("graph-container", true);
		this.textLayer = this.container.append("g").attr("class", "text-layer");
		this.nodeLayer = this.container.append("g").attr("class", "node-layer");
	}

	private setupTimelineControls(controlBox: HTMLDivElement) {
		const progressBarContainer = controlBox.querySelector<HTMLDivElement>(
			"#progressBarContainer"
		);
		const timelineLabel =
			controlBox.querySelector<HTMLSpanElement>("#timelineLabel");
		const goToStartButton =
			controlBox.querySelector<HTMLButtonElement>("#prevEvent");
		const playPauseButton =
			controlBox.querySelector<HTMLButtonElement>("#playPause");
		const goToEndButton =
			controlBox.querySelector<HTMLButtonElement>("#nextEvent");
		const eventDurationInput = controlBox.querySelector<HTMLInputElement>(
			"#eventDurationInput"
		);
		const groupingPreset =
			controlBox.querySelector<HTMLSelectElement>("#groupingPreset");

		if (progressBarContainer && timelineLabel) {
			let isDragging = false;

			const handleProgressBarInteraction = (event: MouseEvent) => {
				if (this.isPlaying) {
					this.pauseAnimation();
					if (playPauseButton) playPauseButton.textContent = "Play";
				}

				const rect = progressBarContainer.getBoundingClientRect();
				const clickPositionPercentage = Math.min(
					Math.max((event.clientX - rect.left) / rect.width, 0),
					1
				);

				const newIndex = Math.floor(
					clickPositionPercentage * this.timelineEvents.length
				);
				this.currentEventIndex = Math.min(
					Math.max(0, newIndex),
					this.timelineEvents.length - 1
				);

				const progressBar =
					this.containerEl.querySelector<HTMLDivElement>(
						"#efProgressBar"
					);
				if (progressBar) {
					progressBar.classList.remove(
						"transition-all",
						"duration-300"
					);

					this.updateTimelineLabel();
					this.updateCardNodesForCurrentEvent();
					this.updateCardNodes();
				}
			};

			progressBarContainer.addEventListener("mousedown", (event) => {
				isDragging = true;
				handleProgressBarInteraction(event);

				event.preventDefault();
			});

			document.addEventListener("mousemove", (event) => {
				if (isDragging) {
					handleProgressBarInteraction(event);
				}
			});

			document.addEventListener("mouseup", () => {
				if (isDragging) {
					isDragging = false;

					const progressBar =
						this.containerEl.querySelector<HTMLDivElement>(
							"#efProgressBar"
						);
					if (progressBar) {
						setTimeout(() => {
							progressBar.classList.add(
								"transition-all",
								"duration-300"
							);
						}, 50);
					}
				}
			});
		}

		if (goToStartButton) {
			goToStartButton.textContent = "<|";
			goToStartButton.addEventListener("click", () => {
				console.log("Go to start button clicked");

				if (this.isPlaying) {
					this.pauseAnimation();
					if (playPauseButton) playPauseButton.textContent = "Play";
				}

				this.goToStart();
			});
		}

		if (goToEndButton) {
			goToEndButton.textContent = "|>";
			goToEndButton.addEventListener("click", () => {
				console.log("Go to end button clicked");

				if (this.isPlaying) {
					this.pauseAnimation();
					if (playPauseButton) playPauseButton.textContent = "Play";
				}

				this.goToEnd();
			});
		}

		if (playPauseButton) {
			playPauseButton.addEventListener("click", () => {
				if (this.isPlaying) {
					this.pauseAnimation();
					playPauseButton.textContent = "Play";
				} else {
					if (
						this.currentEventIndex >=
						this.timelineEvents.length - 1
					) {
						this.currentEventIndex = 0;
						this.updateTimelineLabel();
						this.updateCardNodesForCurrentEvent();
						this.updateCardNodes();
					}

					if (this.animationTimer) {
						this.animationTimer.stop();
						this.animationTimer = null;
					}
					this.startAnimation();
					playPauseButton.textContent = "Pause";
				}
			});
		}

		if (eventDurationInput) {
			eventDurationInput.addEventListener("input", () => {
				this.eventDuration = 1050 - parseInt(eventDurationInput.value);
			});
		}

		if (groupingPreset) {
			const updateGroupingInterval = () => {
				const value = parseInt(groupingPreset.value) || 0;
				this.groupingInterval = value;
				this.setupTimelineEvents();
				this.updateTimelineLabel();
				this.updateCardNodesForCurrentEvent();
			};

			groupingPreset.addEventListener("change", updateGroupingInterval);
		}
	}

	private updateTimelineLabel() {
		const timelineLabel =
			this.shadowRoot?.querySelector<HTMLSpanElement>("#timelineLabel");
		if (timelineLabel) {
			timelineLabel.textContent = `${this.currentEventIndex + 1} / ${
				this.timelineEvents.length
			}`;
		}

		const progressBar =
			this.shadowRoot?.querySelector<HTMLDivElement>("#efProgressBar");
		if (progressBar && this.timelineEvents.length > 0) {
			const progressPercent =
				((this.currentEventIndex + 1) / this.timelineEvents.length) *
				100;
			progressBar.style.width = `${progressPercent}%`;
		}

		if (this.timelineEvents.length > 0) {
			const timeStart =
				this.shadowRoot?.querySelector<HTMLSpanElement>("#timeStart");
			const timeEnd =
				this.shadowRoot?.querySelector<HTMLSpanElement>("#timeEnd");

			if (timeStart && timeEnd) {
				const firstDate = new Date(this.timelineEvents[0]);
				const lastDate = new Date(
					this.timelineEvents[this.timelineEvents.length - 1]
				);

				timeStart.textContent = firstDate.toLocaleDateString(
					undefined,
					{ month: "short", day: "numeric" }
				);
				timeEnd.textContent = lastDate.toLocaleDateString(undefined, {
					month: "short",
					day: "numeric",
				});
			}
		}
	}

	private startAnimation() {
		if (this.timelineEvents.length === 0) return;

		if (this.animationTimer) {
			this.animationTimer.stop();
			this.animationTimer = null;
		}

		this.isPlaying = true;
		let lastUpdate = -this.eventDuration;

		this.animationTimer = d3.timer((elapsed) => {
			if (elapsed - lastUpdate >= this.eventDuration) {
				lastUpdate = elapsed;

				if (this.currentEventIndex < this.timelineEvents.length - 1) {
					this.currentEventIndex++;
					this.updateTimelineLabel();
					this.updateCardNodesForCurrentEvent();
					this.updateCardNodes();
				} else {
					this.pauseAnimation();
				}
			}
		});
	}

	private pauseAnimation() {
		this.isPlaying = false;
		if (this.animationTimer) {
			this.animationTimer.stop();
			this.animationTimer = null;
		}

		const playPauseButton =
			this.containerEl.querySelector<HTMLButtonElement>("#playPause");
		if (playPauseButton && playPauseButton.textContent !== "Reset") {
			playPauseButton.textContent = "Play";
		}
	}

	private updateCardNodesForCurrentEvent() {
		if (this.timelineEvents.length === 0) return;

		console.log("Updating cards for event index:", this.currentEventIndex);
		console.log("Timeline events total:", this.timelineEvents.length);

		if (
			this.currentEventIndex >= 0 &&
			this.currentEventIndex < this.timelineEvents.length
		) {
			const currentTimestamp =
				this.timelineEvents[this.currentEventIndex];
			console.log(
				"Timestamp for current event:",
				new Date(currentTimestamp).toLocaleString()
			);

			this.updateCardRatingsForTimestamp(currentTimestamp);
			this.updateCardVisibilityForTimestamp(currentTimestamp);
		} else {
			console.error("Event index out of bounds:", this.currentEventIndex);
		}
	}

	private updateCardRatingsForTimestamp(timestamp: number) {
		this.cardNodes.forEach((card) => {
			if (card.ratingHistory && card.ratingHistory.length > 0) {
				const relevantEvent = card.ratingHistory
					.filter((e) => e.timestamp <= timestamp)
					.sort((a, b) => b.timestamp - a.timestamp)[0];
				if (relevantEvent) {
					card.rating = relevantEvent.rating;
					card.color = getRatingColor(relevantEvent.rating);
				}
			}
		});

		this.nodeLayer
			.selectAll<SVGCircleElement, Node>(".card-node")
			.attr("fill", (d) => {
				const card = this.cardNodes.find((c) => c.id === d.id);
				return card ? card.color : d.color;
			});

		this.nodeLayer
			.selectAll<SVGGElement, Node>(".note-node")
			.each((noteNode: Node, i, groups) => {
				const parentGroup = d3.select(groups[i]);
				parentGroup
					.selectAll<SVGCircleElement, Node>(".card-node")
					.attr("fill", (d) => {
						const card = this.cardNodes.find((c) => c.id === d.id);
						return card ? card.color : d.color;
					});
			});
	}

	private updateCardVisibilityForTimestamp(timestamp: number) {
		this.nodeLayer
			.selectAll<SVGCircleElement, Node>(".card-node")
			.attr("display", (d) => {
				const card = this.cardNodes.find((c) => c.id === d.id);
				if (card?.createdAt !== undefined) {
					return timestamp >= card.createdAt ? "inline" : "none";
				}
				return "inline";
			});

		this.nodeLayer
			.selectAll<SVGGElement, Node>(".note-node")
			.each((noteNode: Node, i, groups) => {
				const parentGroup = d3.select(groups[i]);
				parentGroup
					.selectAll<SVGCircleElement, Node>(".card-node")
					.attr("display", (d) => {
						const card = this.cardNodes.find((c) => c.id === d.id);
						if (card?.createdAt !== undefined) {
							return timestamp >= card.createdAt
								? "inline"
								: "none";
						}
						return "inline";
					});
			});
	}

	private setupControlListeners(controlBox: HTMLDivElement) {
		const edgeLengthInput =
			controlBox.querySelector<HTMLInputElement>("#edgeLengthInput");
		const chargeForceInput =
			controlBox.querySelector<HTMLInputElement>("#chargeForceInput");
		const cardOffsetDistanceInput =
			controlBox.querySelector<HTMLInputElement>(
				"#cardOffsetDistanceInput"
			);
		const cardRadiusInput =
			controlBox.querySelector<HTMLInputElement>("#cardRadiusInput");
		const noteTextColorInput = controlBox.querySelector<HTMLInputElement>(
			"#noteTextColorInput"
		);

		if (edgeLengthInput) {
			edgeLengthInput.addEventListener("input", () => {
				const val = parseInt(edgeLengthInput.value);
				this.edgeLength = val;
				this.updateForceParameters("link", val);
			});
		}

		if (chargeForceInput) {
			chargeForceInput.addEventListener("input", () => {
				const val = parseInt(chargeForceInput.value);
				this.chargeStrength = val;
				this.updateForceParameters("charge", val);
			});
		}

		if (cardOffsetDistanceInput) {
			cardOffsetDistanceInput.addEventListener("input", () => {
				const val = parseInt(cardOffsetDistanceInput.value);
				this.cardOffsetDistance = val;
				this.updateCardPositions();
			});
		}

		if (cardRadiusInput) {
			cardRadiusInput.addEventListener("input", () => {
				const val = parseInt(cardRadiusInput.value);
				this.cardRadius = val;
				this.updateCardSizes();
			});
		}

		if (noteTextColorInput) {
			noteTextColorInput.addEventListener("input", () => {
				this.noteTextColor = noteTextColorInput.value;
				this.updateNoteTextColors();
			});
		}
	}

	private updateForceParameters(forceType: string, value: number) {
		if (!this.simulation) return;

		if (forceType === "link") {
			(
				this.simulation.force("link") as d3.ForceLink<Node, Link>
			).distance(value);
		} else if (forceType === "charge") {
			(
				this.simulation.force("charge") as d3.ForceManyBody<Node>
			).strength(value);
		}

		this.simulation.alpha(0.3).restart();
	}

	private updateCardPositions() {
		this.noteNodes.forEach((noteNode) => {
			const cardsForNote = this.cardNodes.filter(
				(card) => card.parent === noteNode.id
			);
			const count = cardsForNote.length;

			if (count > 0) {
				cardsForNote.forEach((card, index) => {
					const angle = (2 * Math.PI * index) / count;
					card.offsetX = Math.cos(angle) * this.cardOffsetDistance;
					card.offsetY = Math.sin(angle) * this.cardOffsetDistance;
				});
			}
		});

		this.nodeLayer
			.selectAll<SVGGElement, Node>(".note-node")
			.each((noteNode: Node, i, groups) => {
				const parentGroup = d3.select(groups[i]);
				parentGroup
					.selectAll<SVGCircleElement, Node>(".card-node")
					.attr("cx", (d: Node) => d.offsetX!)
					.attr("cy", (d: Node) => d.offsetY!);
			});
	}

	private updateCardSizes() {
		this.cardNodes.forEach((card) => {
			card.radius = this.cardRadius;
		});

		this.nodeLayer
			.selectAll<SVGCircleElement, Node>(".card-node")
			.attr("r", this.cardRadius);

		this.nodeLayer
			.selectAll<SVGGElement, Node>(".note-node")
			.each((noteNode: Node, i, groups) => {
				const parentGroup = d3.select(groups[i]);
				parentGroup
					.selectAll<SVGCircleElement, Node>(".card-node")
					.attr("r", this.cardRadius);
			});
	}

	private registerEvents() {
		this.registerEvent(
			this.app.vault.on("modify", () => this.refreshGraphView())
		);
		this.registerEvent(
			this.app.vault.on("create", () => this.refreshGraphView())
		);
		this.registerEvent(
			this.app.vault.on("delete", () => this.refreshGraphView())
		);
	}

	public async refreshGraphView() {
		await this.loadGraphData();
		this.updateLinks();
		this.updateNoteNodes();
		this.updateCardNodes();
		this.updateSimulation();

		this.updateTimelineLabel();
		this.updateCardNodesForCurrentEvent();
	}

	private updateLinks() {
		const link = this.nodeLayer
			.selectAll<SVGLineElement, Link>(".link")
			.data(this.links, this.getLinkId);

		link.enter()
			.append("line")
			.attr("class", "link")
			.attr("stroke", "#999")
			.attr("stroke-opacity", 0.6)
			.attr("stroke-width", 1.5);

		link.exit().remove();
	}

	private getLinkId(d: Link): string {
		return `${typeof d.source === "object" ? d.source.id : d.source}-${
			typeof d.target === "object" ? d.target.id : d.target
		}`;
	}

	private updateNoteNodes() {
		this.nodeLayer
			.selectAll(".note-node")
			.select("circle")
			.attr("r", (d: Node) => d.radius)
			.attr("fill", (d: Node) => d.color);

		this.textLayer
			.selectAll(".note-text")
			.attr("x", (d: Node) => d.x!)
			.attr("y", (d: Node) => d.y! + d.radius + 15)
			.attr("fill", this.noteTextColor)
			.text(this.truncateNodeLabel);

		const noteGroup = this.nodeLayer
			.selectAll<SVGGElement, Node>(".note-node")
			.data(this.noteNodes, (d: Node) => d.id)
			.enter()
			.append("g")
			.attr("class", "note-node")
			.call(this.setupDragBehavior())
			.on("click", (event, d) => this.nodeClicked(d));

		noteGroup
			.append("circle")
			.attr("r", (d: Node) => d.radius)
			.attr("fill", (d: Node) => d.color)
			.attr("stroke", "#fff")
			.attr("stroke-width", 1.5);

		this.textLayer
			.selectAll<SVGTextElement, Node>(".note-text")
			.data(this.noteNodes, (d: Node) => d.id)
			.enter()
			.append("text")
			.attr("class", "note-text")
			.attr("text-anchor", "middle")
			.attr("x", (d: Node) => d.x!)
			.attr("y", (d: Node) => d.y! + d.radius + 15)
			.attr("fill", this.noteTextColor)
			.text(this.truncateNodeLabel)
			.attr("font-size", "10px")
			.attr("font-family", "sans-serif");
	}

	private truncateNodeLabel(d: Node): string {
		const title = d.fileName ?? "";
		return title.length > 20 ? title.substring(0, 20) + "..." : title;
	}

	private setupDragBehavior() {
		return d3
			.drag<SVGGElement, Node>()
			.on("start", (event, d) => this.dragStarted(event, d))
			.on("drag", (event, d) => this.dragged(event, d))
			.on("end", (event, d) => this.dragEnded(event, d));
	}

	private updateCardNodes() {
		this.nodeLayer
			.selectAll<SVGGElement, Node>(".note-node")
			.each((noteNode: Node, i, groups) => {
				const parentGroup = d3.select(groups[i]);
				const cardsForNote = this.cardNodes.filter(
					(card) => card.parent === noteNode.id
				);
				const cardSelection = parentGroup
					.selectAll<SVGCircleElement, Node>(".card-node")
					.data(cardsForNote, (d: Node) => d.id);

				const currentTimestamp =
					this.timelineEvents[this.currentEventIndex] || 0;

				cardSelection
					.attr("r", (d: Node) => d.radius)
					.attr("cx", (d: Node) => d.offsetX!)
					.attr("cy", (d: Node) => d.offsetY!)
					.attr("fill", (d: Node) => d.color)
					.attr("display", (d: Node) => {
						const card = this.cardNodes.find((c) => c.id === d.id);
						if (card?.createdAt !== undefined) {
							return currentTimestamp >= card.createdAt
								? "inline"
								: "none";
						}
						return "inline";
					});

				cardSelection
					.enter()
					.append("circle")
					.attr("class", "card-node")
					.attr("r", (d: Node) => d.radius)
					.attr("cx", (d: Node) => d.offsetX!)
					.attr("cy", (d: Node) => d.offsetY!)
					.attr("fill", (d: Node) => d.color)
					.attr("stroke", "#fff")
					.attr("stroke-width", 1)
					.attr("display", (d: Node) => {
						const card = this.cardNodes.find((c) => c.id === d.id);
						if (card?.createdAt !== undefined) {
							return currentTimestamp >= card.createdAt
								? "inline"
								: "none";
						}
						return "inline";
					});

				cardSelection.exit().remove();
			});
	}

	private updateSimulation() {
		this.simulation.nodes(this.noteNodes);
		(this.simulation.force("link") as d3.ForceLink<Node, Link>).links(
			this.links
		);
		this.simulation.alpha(0.3).restart();
	}

	renderGraph() {
		const width = this.containerEl.clientWidth;
		const height = this.containerEl.clientHeight;

		this.nodeLayer.selectAll("*").remove();
		this.textLayer.selectAll("*").remove();

		this.nodeLayer
			.selectAll(".link")
			.data(this.links)
			.enter()
			.append("line")
			.attr("class", "link")
			.attr("stroke", "#999")
			.attr("stroke-opacity", 0.6)
			.attr("stroke-width", 1.5);

		const noteGroup = this.nodeLayer
			.selectAll(".note-node")
			.data(this.noteNodes, (d: Node) => d.id)
			.enter()
			.append("g")
			.attr("class", "note-node")
			.call(this.setupDragBehavior())
			.on("click", (event, d) => this.nodeClicked(d));

		noteGroup
			.append("circle")
			.attr("r", (d: Node) => d.radius)
			.attr("fill", (d: Node) => d.color)
			.attr("stroke", "#fff")
			.attr("stroke-width", 1.5);

		this.textLayer
			.selectAll(".note-text")
			.data(this.noteNodes, (d: Node) => d.id)
			.enter()
			.append("text")
			.attr("class", "note-text")
			.attr("text-anchor", "middle")
			.attr("x", (d: Node) => d.x!)
			.attr("y", (d: Node) => d.y! + d.radius + 15)
			.attr("fill", this.noteTextColor)
			.text(this.truncateNodeLabel)
			.attr("font-size", "10px")
			.attr("font-family", "sans-serif");

		this.addCardNodes(noteGroup);
		this.setupSimulation(width, height);
	}

	private addCardNodes(
		noteGroup: d3.Selection<d3.BaseType, Node, SVGGElement, unknown>
	) {
		const currentTimestamp =
			this.timelineEvents[this.currentEventIndex] || 0;

		noteGroup.each((d: Node, i, groups) => {
			const parentGroup = d3.select(groups[i]);
			const cardsForNote = this.cardNodes.filter(
				(card) => card.parent === d.id
			);

			parentGroup
				.selectAll(".card-node")
				.data(cardsForNote, (d: Node) => d.id)
				.enter()
				.append("circle")
				.attr("class", "card-node")
				.attr("r", (d: Node) => d.radius)
				.attr("cx", (d: Node) => d.offsetX!)
				.attr("cy", (d: Node) => d.offsetY!)
				.attr("fill", (d: Node) => d.color)
				.attr("stroke", "#fff")
				.attr("stroke-width", 1)
				.attr("display", (d: Node) => {
					const card = this.cardNodes.find((c) => c.id === d.id);
					if (card?.createdAt !== undefined) {
						return currentTimestamp >= card.createdAt
							? "inline"
							: "none";
					}
					return "inline";
				});
		});
	}

	private setupSimulation(width: number, height: number): void {
		this.simulation = d3
			.forceSimulation<Node>(this.noteNodes)
			.force(
				"link",
				d3
					.forceLink<Node, Link>(this.links)
					.id((d: Node) => d.id)
					.distance(this.edgeLength)
			)
			.force("charge", d3.forceManyBody().strength(this.chargeStrength))
			.force("center", d3.forceCenter(width / 2, height / 2))
			.force("x", d3.forceX(width / 2).strength(0.1))
			.force("y", d3.forceY(height / 2).strength(0.1))
			.force("collide", d3.forceCollide().radius(30))
			.on("tick", () => this.ticked());
	}

	ticked() {
		this.nodeLayer
			.selectAll<SVGLineElement, Link>(".link")
			.attr("x1", (d) => (typeof d.source === "object" ? d.source.x! : 0))
			.attr("y1", (d) => (typeof d.source === "object" ? d.source.y! : 0))
			.attr("x2", (d) => (typeof d.target === "object" ? d.target.x! : 0))
			.attr("y2", (d) =>
				typeof d.target === "object" ? d.target.y! : 0
			);

		this.nodeLayer
			.selectAll<SVGGElement, Node>(".note-node")
			.attr("transform", (d) => `translate(${d.x!}, ${d.y!})`);

		this.textLayer
			.selectAll<SVGTextElement, Node>(".note-text")
			.attr("x", (d) => d.x!)
			.attr("y", (d) => d.y! + d.radius + 15);
	}

	async loadGraphData() {
		this.noteNodes = [];
		this.cardNodes = [];
		this.links = [];

		const flashcardData = await this.plugin.loadData();
		const files = this.app.vault.getMarkdownFiles();
		const noteMap = new Map<string, Node>();
		const basenameMap = new Map<string, Node>();

		this.createNoteNodes(files, noteMap, basenameMap);
		await this.createNoteLinks(files, noteMap, basenameMap);
		this.processFlashcardData(flashcardData, noteMap);
		this.updateFlashcardColors();
		this.setupTimelineEvents();
		this.updateTimelineLabel();
		this.updateCardNodesForCurrentEvent();
	}

	private createNoteNodes(
		files: TFile[],
		noteMap: Map<string, Node>,
		basenameMap: Map<string, Node>
	) {
		for (const file of files) {
			const noteNode: Node = {
				id: file.path,
				fileName: file.basename,
				path: file.path,
				x: Math.random() * 800 - 400,
				y: Math.random() * 800 - 400,
				radius: 10,
				color: this.colorScale(file.extension),
				type: "note",
			};
			this.noteNodes.push(noteNode);
			noteMap.set(file.path, noteNode);
			basenameMap.set(file.basename, noteNode);
		}
	}

	private async createNoteLinks(
		files: TFile[],
		noteMap: Map<string, Node>,
		basenameMap: Map<string, Node>
	) {
		for (const file of files) {
			const content = await this.app.vault.read(file);
			const wikiLinkRegex = /\[\[(.*?)(\|.*?)?\]\]/g;
			let match;

			while ((match = wikiLinkRegex.exec(content)) !== null) {
				const targetName = match[1].split("#")[0].split("|")[0].trim();
				const sourceNode = noteMap.get(file.path);
				const targetNode = basenameMap.get(targetName);

				if (sourceNode && targetNode) {
					this.links.push({
						source: sourceNode.id,
						target: targetNode.id,
						value: 1,
					});
				}
			}
		}
	}

	private processFlashcardData(
		flashcardData: any,
		noteMap: Map<string, Node>
	) {
		if (!flashcardData?.notes) return;

		for (const notePath in flashcardData.notes) {
			const noteEntry = flashcardData.notes[notePath];
			const cards = noteEntry.cards;
			const cardIds = Object.keys(cards);
			const count = cardIds.length;

			if (count > 0 && noteMap.has(notePath)) {
				this.createCardNodesForNote(notePath, cards, cardIds, count);
			}
		}
	}

	private createCardNodesForNote(
		notePath: string,
		cards: any,
		cardIds: string[],
		count: number
	) {
		cardIds.forEach((cardId, index) => {
			const cardData = cards[cardId];
			const rating =
				cardData.efHistory && cardData.efHistory.length > 0
					? cardData.efHistory[cardData.efHistory.length - 1].rating
					: 3;
			const ratingHistory = (cardData.efHistory || []).map(
				(entry: any) => ({
					timestamp: Date.parse(entry.timestamp),
					rating: entry.rating,
				})
			);
			const angle = (2 * Math.PI * index) / count;
			const offset = this.cardOffsetDistance;

			const cardNode: Node = {
				id: `${notePath}_${cardId}`,
				x: 0,
				y: 0,
				radius: this.cardRadius,
				color: getRatingColor(rating),
				type: "card",
				parent: notePath,
				offsetX: Math.cos(angle) * offset,
				offsetY: Math.sin(angle) * offset,
				rating: rating,
				ratingHistory: ratingHistory,
			};

			if (cardData.createdAt) {
				cardNode.createdAt = Date.parse(cardData.createdAt);
			}

			this.cardNodes.push(cardNode);
		});
	}

	private updateFlashcardColors() {
		if (this.cardNodes.length === 0) return;

		this.cardNodes.forEach((card) => {
			if (card.rating !== undefined) {
				card.color = getRatingColor(card.rating);
			}
		});
	}

	dragStarted(event: d3.D3DragEvent<SVGGElement, Node, unknown>, d: Node) {
		if (!event.active) this.simulation.alphaTarget(0.3).restart();
		d.fx = d.x;
		d.fy = d.y;
	}

	dragged(event: d3.D3DragEvent<SVGGElement, Node, unknown>, d: Node) {
		d.fx = event.x;
		d.fy = event.y;
	}

	dragEnded(event: d3.D3DragEvent<SVGGElement, Node, unknown>, d: Node) {
		if (!event.active) this.simulation.alphaTarget(0);
		d.fx = null;
		d.fy = null;
	}

	nodeClicked(d: Node) {
		const file = this.app.vault.getAbstractFileByPath(d.path!);
		if (file instanceof TFile) {
			this.app.workspace.getLeaf().openFile(file);
		}
	}

	private setupTimelineEvents() {
		const eventsSet = new Set<number>();
		this.cardNodes.forEach((card) => {
			card.ratingHistory?.forEach((entry) =>
				eventsSet.add(entry.timestamp)
			);
		});
		const allEvents = Array.from(eventsSet).sort((a, b) => a - b);

		if (this.groupingInterval > 0) {
			const groupedEvents: number[] = [];
			let groupStart: number | null = null;
			let groupMax: number | null = null;

			allEvents.forEach((t) => {
				if (groupStart === null) {
					groupStart = t;
					groupMax = t;
				} else if (t - groupStart < this.groupingInterval) {
					groupMax = Math.max(groupMax!, t);
				} else {
					groupedEvents.push(groupMax!);
					groupStart = t;
					groupMax = t;
				}
			});
			if (groupMax !== null) {
				groupedEvents.push(groupMax);
			}
			this.timelineEvents = groupedEvents;
		} else {
			this.timelineEvents = allEvents;
		}

		this.currentEventIndex = Math.max(0, this.timelineEvents.length - 1);
	}

	async onClose() {
		this.containerEl.empty();
		this.shadowRoot = null;
	}

	private goToStart() {
		this.currentEventIndex = 0;
		this.updateTimelineLabel();
		this.updateCardNodesForCurrentEvent();
		this.updateCardNodes();
		console.log("Jumped to first event");
	}

	private goToEnd() {
		if (this.timelineEvents.length > 0) {
			this.currentEventIndex = this.timelineEvents.length - 1;
			this.updateTimelineLabel();
			this.updateCardNodesForCurrentEvent();
			this.updateCardNodes();
			console.log("Jumped to last event");
		}
	}

	private updateNoteTextColors() {
		this.textLayer
			.selectAll<SVGTextElement, Node>(".note-text")
			.attr("fill", this.noteTextColor);
	}
}
