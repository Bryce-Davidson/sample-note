<script lang="ts">
	import { onMount } from "svelte";
	import ChatMessage from "./ChatMessage.svelte";

	export let messages: Array<{
		role: "user" | "assistant" | "system";
		content: string;
		timestamp: Date;
		images?: File[];
		actions?: any[];
		aiStatus?: any;
	}> = [];
	export let isStreamingInChat: boolean = false;

	let messagesContainer: HTMLElement;

	function formatTime(date: Date): string {
		return date.toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});
	}

	function scrollToBottom() {
		setTimeout(() => {
			if (messagesContainer) {
				messagesContainer.scrollTop = messagesContainer.scrollHeight;
			}
		}, 50);
	}

	$: if (messages.length > 0) {
		scrollToBottom();
	}

	export { scrollToBottom };
</script>

<div class="flex-1 p-4 overflow-y-auto" bind:this={messagesContainer}>
	{#if messages.length === 0}
		<div class="flex items-center justify-center h-full">
			<div class="text-center text-gray-500 dark:text-gray-400">
				<p>Ask me anything about your notes or to edit them.</p>
			</div>
		</div>
	{:else}
		<div class="space-y-4">
			{#each messages as message, index}
				<ChatMessage
					{message}
					isStreaming={index === messages.length - 1 &&
						isStreamingInChat}
					{formatTime}
				/>
			{/each}
		</div>
	{/if}
</div>
