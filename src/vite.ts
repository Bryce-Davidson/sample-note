import stylesUrl from "./tailwind.css?inline";

export const getSharedStyles = (() => {
	return () => stylesUrl;
})();

export function createShadowRoot(targetEl: HTMLElement): ShadowRoot {
	const shadowRoot = targetEl.attachShadow({ mode: "open" });

	const styleEl = document.createElement("style");
	styleEl.textContent = getSharedStyles();
	shadowRoot.appendChild(styleEl);

	return shadowRoot;
}
